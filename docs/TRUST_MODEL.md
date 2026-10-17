# Vaultbreaker 2.0 Trust Model & Security Architecture

## 1. Trust Boundary Classification

The Vaultbreaker security architecture is structured around four strict trust tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. UNTRUSTED ZONE                                                      │
│    · Autonomous AI Agents (Subject to Prompt Injection & LLM Bugs)     │
│    · External Service Endpoints & User Form Inputs                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP Request + x-capability-token
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. PARTIALLY TRUSTED ZONE (Broker & Control Plane)                     │
│    · Next.js Frontend Dashboard                                        │
│    · Express REST API Gateway (/api/metered-service)                   │
│    · Human Operator Inbox (UI Presentation Layer)                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Verified JWT & Memory Budget
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. HIGHLY TRUSTED ZONE (Policy Engine, Store & Hardware Enclave)       │
│    · Policy Engine & JWT Validator                                     │
│    · Cryptographic Request Fingerprint Validator (SHA-256)             │
│    · Approval State Machine & Operator Auth Middleware                 │
│    · Ledger KeyRing CLI / Seed Hardware Enclave (`wallet-cli ring`)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Cryptographic Proofs & Hash Sync
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. ROOT OF TRUST (Hedera Blockchain & Smart Contracts)                 │
│    · CapabilityRegistry.sol (On-Chain Budget Accounting)               │
│    · Hedera Consensus Service - HCS (Immutable Audit Trail)            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Categorization Matrix

| Component | Trust Classification | Security Rationale |
|---|---|---|
| **AI Agents** | ❌ **UNTRUSTED** | AI agents are probabilistic LLMs vulnerable to prompt injection, jailbreaks, or code execution bugs. They MUST NEVER hold raw private keys, unconstrained credentials, or self-authorize approval tokens. |
| **External API Inputs** | ❌ **UNTRUSTED** | Prompts, header values, and parameters submitted over HTTP can be malformed or malicious. |
| **Frontend App (`app/`)** | ⚠️ **PARTIALLY TRUSTED** | Client-side JavaScript code runs in the user's browser and can be modified. It cannot be trusted for financial authorization, budget enforcement, or operator authentication assertions. |
| **Express Broker (`broker/`)** | ⚠️ **PARTIALLY TRUSTED** | Central control plane. Trusted to route requests, but must strictly enforce middleware authentication boundaries. |
| **Policy Engine** | ✅ **TRUSTED** | Evaluates policy rules and escalates high-risk requests to human approval. |
| **Approval Store** | ✅ **TRUSTED** | Enforces atomic 6-state transitions, single-use replay prevention, and server-side UTC expiration. |
| **Ledger KeyRing (`keyring.ts`)** | ✅ **HIGHLY TRUSTED** | Hardware enclave wrapping `wallet-cli ring`. Ensures raw settlement private keys NEVER enter agent memory or log files. |
| **`CapabilityRegistry.sol`** | 🔒 **ROOT OF TRUST** | On-chain EVM contract enforcing budget limits, expiration timestamps, and revocations in real time. Immutable once deployed. |
| **Hedera HCS Topic** | 🔒 **ROOT OF TRUST** | Tamper-evident, public consensus topic providing immutable event ordering and auditability. |

---

## 3. Human Operator Authorization Boundary & Identity Guarantees

Phase 7 introduces human approval workflows. To prevent privilege escalation attacks:

1. **Server-Derived Approver Identity**:
   - The operator decision endpoints (`POST /api/approvals/:id/approve` and `POST /api/approvals/:id/reject`) determine the approver identity authoritatively from authenticated session/bearer tokens (`verifyOperatorAuth`).
   - Callers cannot spoof approver identity by supplying `approvedBy` or `approverId` in the request body; any such body fields are strictly ignored and overwritten by server-verified credentials.
2. **Explicit Boundary Modes**:
   - **`PRODUCTION_AUTH_ENFORCED`**: Strict cryptographic token validation via operator bearer tokens (`VAULTBREAKER_OPERATOR_TOKEN` / `OPERATOR_SECRET_KEY`).
   - **`DEVELOPMENT_DEMO_MODE`**: Demo fallback labeling when run in local development without external enterprise IdP, explicitly notifying operators in UI and logs.
3. **Enterprise Identity Boundary**:
   - The system explicitly acknowledges that full production identity assurance requires integration with an enterprise Identity Provider (OIDC / SAML / WebAuthn).

---

## 4. Core Security Assertions

1. **Assertion 1 (Zero Key Exposure)**: Raw wallet private keys and API master keys MUST NEVER enter agent memory, agent context windows, browser state, or log files. Keys exist ONLY inside the Ledger KeyRing enclave.
2. **Assertion 2 (Server-Side Authorization)**: Authorization decisions MUST occur on the Broker / Smart Contract layer. The frontend UI is purely a presentation layer.
3. **Assertion 3 (Real-Time Rejection)**: When a capability is expired, revoked, or over-budget, the system MUST reject the request BEFORE invoking downstream service logic or decrypting credentials.
4. **Assertion 4 (Service Endpoint Binding)**: A capability token issued for Service A (`0x...04`) MUST NOT be valid for Service B (`0x...05`), preventing credential relay attacks.
5. **Assertion 5 (Cryptographic Request Fingerprint Binding)**: SHA-256 binding of all 9 invocation parameters (`agentId`, `capId`, `serviceAddress`, `targetResource`, `requestedAction`, `requestedAmount`, `asset`, `policyId`, `policyVersion`) prevents parameter tampering or bait-and-switch between escalation and resumption.
6. **Assertion 6 (Single-Use Replay Prevention)**: Approved requests can only be executed once. An approved request is atomically transitioned to `CONSUMED` during execution; any subsequent replay attempt is rejected immediately.
7. **Assertion 7 (Zero Budget Deduction on Pending / Rejected Requests)**: Pending or rejected approval requests NEVER decrement capability budgets or trigger EVM micropayments.
