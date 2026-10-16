# Vaultbreaker 2.0 Authorization Flow

## 1. Executive Authorization Pipeline Overview

The Vaultbreaker authorization flow defines the deterministic decision pipeline whenever an autonomous AI agent attempts to execute a metered service call (`POST /api/metered-service`). Every request passes through seven sequential evaluation stages before any private credential is decrypted or any payment is processed.

```
[Incoming Agent Request: POST /api/metered-service]
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Stage 1: Request Parsing & JWT Verification            │
│          • Verify cryptographic JWT signature           │
│          • Extract capId, nonce, expiry, issuer        │
└────────────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Stage 2: Capability Validity & Expiration Check       │
│          • Verify capId exists in registry              │
│          • Enforce: currentTime < expiry (UTC)         │
│          • [Failure] ──> HTTP 402 CAPABILITY_EXPIRED   │
└────────────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Stage 3: Authoritative Revocation Check                │
│          • Enforce: capability.revoked == false        │
│          • [Failure] ──> HTTP 403 CAPABILITY_REVOKED   │
└────────────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Stage 4: Agent Lifecycle Authorization Gate            │
│          • Enforce: capability.agentId == agent.id     │
│          • Enforce: agent.status == "ACTIVE"           │
│          • [SUSPENDED] ──> HTTP 403 AGENT_SUSPENDED    │
│          • [REVOKED]   ──> HTTP 403 AGENT_REVOKED      │
└────────────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Stage 5: Least-Privilege Action & Scope Enforcement    │
│          • Enforce: requestedAction in allowedActions   │
│          • Enforce: requestedResource in resourceScope  │
│          • [Failure] ──> HTTP 403 ACTION/SCOPE DENIED  │
└────────────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Stage 6: Deterministic Policy Engine Evaluation        │
│          • Order applicable policies by priority DESC   │
│          • Precedence: Explicit DENY overrides ALLOW    │
│          • Enforce: Price ceiling (maxPricePerCall)    │
│          • Enforce: Velocity limit (calls/min)         │
│          • Enforce: Active hours (allowedHoursUtc)     │
│          • Enforce: Blocked actions & resources        │
│          • [Failure] ──> HTTP 403 POLICY_DENIED / etc. │
│          • Guarantee: ZERO budget deducted on failure  │
└────────────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Stage 7: Exact-Budget Accounting & Execution           │
│          • Enforce: budgetRemaining >= amount          │
│          • [Failure] ──> HTTP 402 INSUFFICIENT_BUDGET  │
│          • Decrement budget: budgetRemaining -= amount │
│          • Decrypt API credential via Ledger KeyRing   │
│          • Dispatch metered payload to service API     │
│          • Log CAPABILITY_SPENT audit event to HCS     │
│          • Return HTTP 200 + Result + Evaluation Trace │
└────────────────────────────────────────────────────────┘
```

---

## 2. Sequence Diagram: Metered Request Pipeline with Policy Evaluation

```mermaid
sequenceDiagram
    autonumber
    actor Agent as Autonomous AI Agent
    participant Broker as Vaultbreaker Broker (/api/metered-service)
    participant Reg as Agent & Capability Store
    participant Engine as Policy Engine (Deterministic Evaluator)
    participant KeyRing as Ledger KeyRing Enclave
    participant HCS as Hedera HCS Topic

    Agent->>Broker: POST /api/metered-service (x-capability-token, x-payment-amount, x-action)
    Broker->>Broker: Stage 1: Verify JWT Signature & Decode capId
    Broker->>Reg: Stage 2-3: Fetch Capability & Validate Expiry & Revocation
    Broker->>Reg: Stage 4: Check Agent Lifecycle Status (ACTIVE required)
    Broker->>Broker: Stage 5: Validate Action & Resource Scope Binding
    
    Broker->>Engine: Stage 6: evaluatePolicies(context: {agentId, service, action, amount})
    Engine->>Engine: Filter applicable policies & sort priority DESC
    Engine->>Engine: Check Precedence (DENY overrides ALLOW)
    Engine->>Engine: Check Price Ceiling, Velocity Rate Limit, UTC Time Window
    
    alt Policy Check Fails (DENY / Limit Exceeded)
        Engine-->>Broker: Return PolicyEvaluationResult (allowed: false, reasonCode)
        Broker->>HCS: Submit CAPABILITY_REJECTED / POLICY_EVALUATED Audit Event
        Note over Broker,Reg: Zero Budget Decrement: budgetRemaining remains untouched
        Broker-->>Agent: HTTP 403 Forbidden { error: reasonCode, evaluationTrace }
    else Policy Checks Pass (ALLOWED)
        Engine-->>Broker: Return PolicyEvaluationResult (allowed: true)
        Broker->>Reg: Stage 7: Decrement Budget (budgetRemaining -= amount)
        Broker->>KeyRing: Decrypt service API key in memory
        KeyRing-->>Broker: Plaintext Key (never written to disk)
        Broker->>Broker: Execute metered inference service
        Broker->>HCS: Submit CAPABILITY_SPENT Audit Event
        Broker-->>Agent: HTTP 200 OK + Service Result + Evaluation Trace
    end
```

---

## 3. Standard Reason Codes Taxonomy

| Category | Reason Code | HTTP Status | Description |
|---|---|---|---|
| **Success** | `AUTHORIZED` | 200 | Request satisfied all capability bounds and policy criteria. |
| **Agent Gate** | `AGENT_SUSPENDED` | 403 | Owning agent is temporarily paused by administrative control. |
| **Agent Gate** | `AGENT_REVOKED` | 403 | Owning agent has been permanently decommissioned. |
| **Agent Gate** | `AGENT_MISMATCH` | 403 | Attempt to execute capability under an unauthorized agent identity. |
| **Capability** | `CAPABILITY_EXPIRED` | 402 | Capability validity period has elapsed (`currentTime >= expiry`). |
| **Capability** | `CAPABILITY_REVOKED` | 403 | Capability token was explicitly revoked by issuing developer. |
| **Scope** | `ACTION_NOT_PERMITTED` | 403 | Requested action is not declared in `allowedActions`. |
| **Scope** | `RESOURCE_OUT_OF_SCOPE` | 403 | Target endpoint path is outside granted `resourceScope`. |
| **Policy** | `POLICY_DENIED` | 403 | Explicit `DENY` policy guardrail matched the request context. |
| **Policy** | `PRICE_LIMIT_EXCEEDED` | 403 | Cost per call exceeds policy price ceiling (`maxPricePerCall`). |
| **Policy** | `VELOCITY_LIMIT_EXCEEDED` | 403 | Request frequency exceeds sliding-window rate limit (`maxCallsPerMinute`). |
| **Policy** | `TIME_WINDOW_VIOLATION` | 403 | Current UTC execution hour falls outside permitted `allowedHoursUtc`. |
| **Policy** | `BLOCKED_ACTION` | 403 | Action name is prohibited by policy blacklist. |
| **Policy** | `BLOCKED_RESOURCE` | 403 | Resource endpoint is prohibited by policy blacklist. |
| **Accounting** | `INSUFFICIENT_BUDGET` | 402 | Requested spend amount exceeds `budgetRemaining`. |

---

## 4. Zero Budget Deduction Invariant

A strict invariant of the Vaultbreaker authorization pipeline is:
> **Financial balance and capability budget tokens are ONLY decremented upon successful completion of all upstream security stages (Stages 1 through 6).**

If a request fails due to:
- Agent suspension or revocation
- Scope mismatch
- Policy DENY rule
- Price ceiling violation
- Rate limit violation
- Off-hours time window restriction

The transaction is immediately aborted, the failure reason is recorded in HCS, and the agent's remaining budget is preserved with 100% mathematical integrity.
