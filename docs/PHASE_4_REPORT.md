# Vaultbreaker Phase 4 Report — Agent Lifecycle & Management

## 1. Executive Summary

Phase 4 implements **Authoritative Agent Lifecycle & Management** for Vaultbreaker 2.0.

In prior phases, autonomous agents existed primarily as loose string parameters within UI components and JWT payloads, without server-side identity validation, state transition safeguards, or lifecycle enforcement in the request authorization path.

Phase 4 establishes:
1. An authoritative **Agent Registry** and canonical domain entity model in the broker.
2. A strict, explicit **Lifecycle State Machine** (`ACTIVE`, `SUSPENDED`, `REVOKED`).
3. Server-side **Lifecycle Authorization Enforcement** in `/api/metered-service` evaluated before key decryption or spend execution.
4. Tamper-evident **Audit Logging** via Hedera Consensus Service (HCS) for registrations, status changes, and rejected execution attempts.
5. Interactive UI workflows in `AgentsView.tsx` with duplicate-protected registration, drawer detail views, and explicit consequential confirmation dialogs.

---

## 2. Authoritative Lifecycle State Machine

The agent lifecycle is defined by three explicit states with unambiguous operational semantics:

| State | Status Meaning | Protected Execution Allowed? | May Transition To | Notes |
|---|---|---|---|---|
| `ACTIVE` | Normal operational state. | **YES** (if capability valid & within budget) | `SUSPENDED`, `REVOKED` | Agent can execute metered service calls. |
| `SUSPENDED` | Temporarily paused by administrator. | **NO** (fails closed with HTTP 403 `AGENT_SUSPENDED`) | `ACTIVE`, `REVOKED` | Capabilities remain valid but dormant until resumed. |
| `REVOKED` | Permanently deactivated / decommissioned. | **NO** (fails closed with HTTP 403 `AGENT_REVOKED`) | *None* (Terminal State) | Cannot be reactivated. Authority terminated. |

### State Transition Matrix

```
                 ┌─────────────────────────────────┐
                 │                                 │
                 ▼                                 │ Resume
          ┌──────────────┐    Suspend       ┌──────────────┐
          │    ACTIVE    ├─────────────────►│  SUSPENDED   │
          └──────┬───────┘                  └──────┬───────┘
                 │                                 │
                 │ Permanent                       │ Permanent
                 │ Revocation                      │ Revocation
                 │                                 │
                 ▼                                 ▼
          ┌────────────────────────────────────────────────┐
          │                    REVOKED                     │
          │         (Terminal State: Cannot Exit)          │
          └────────────────────────────────────────────────┘
```

- **Prohibited Transitions**: Any attempt to transition out of `REVOKED` (e.g. `REVOKED -> ACTIVE` or `REVOKED -> SUSPENDED`) is rejected with HTTP 400 `INVALID_TRANSITION`.
- **Unknown States**: Any agent in an unapproved state fails closed immediately.
- **Atomic Mutation**: An invalid transition request does not partially alter or corrupt agent state.

---

## 3. Architecture & Enforcement Boundaries

### Where Lifecycle Enforcement Occurs

Enforcement occurs in the **Broker Authorization Pipeline** (`broker/src/api/routes.ts` in `POST /api/metered-service`):

```
[Agent Request with x-capability-token]
           │
           ▼
1. Verify JWT Signature & Decode capId + agentId
           │
           ▼
2. Resolve Agent Identity from Broker AgentRegistry
           │
           ├──> Agent Missing ─────────────► [DENY: HTTP 403 AGENT_NOT_FOUND] + HCS Audit
           ├──> Agent is SUSPENDED ────────► [DENY: HTTP 403 AGENT_SUSPENDED] + HCS Audit
           ├──> Agent is REVOKED ──────────► [DENY: HTTP 403 AGENT_REVOKED]   + HCS Audit
           └──> Agent is ACTIVE
                      │
                      ▼
3. Check Capability Revocation, Expiry & Budget
           │
           ├──> Capability Revoked/Expired/Exhausted ──► [DENY: HTTP 402/403]
           └──> All Checks Pass
                      │
                      ▼
4. Decrypt Settlement Credential via Ledger KeyRing in memory
           │
           ▼
5. Execute Metered Service & Submit CAPABILITY_SPENT Audit to HCS
```

### Trust Boundary: Broker vs. On-Chain Contracts

- **Broker Enforcement**: Agent identity, lifecycle status (`ACTIVE`, `SUSPENDED`, `REVOKED`), and activity metrics are authoritative inside the broker control plane.
- **On-Chain Enforcement (`CapabilityRegistry.sol`)**: The smart contract verifies cryptographic `policyHash`, `serviceAddress`, `expiry`, `budgetRemaining`, and `revoked` flag per capability hash (`capId`). The contract does **not** maintain an on-chain agent directory.
- **Boundary Implication**: Agent suspension is enforced off-chain in the broker gateway before key decryption. Direct contract calls (if permitted outside the broker relayer) verify capability validity and budget ceilings, but rely on the broker to invoke `revoke(capId)` for global on-chain invalidation.

---

## 4. API Endpoints & Response Contracts

| Method | Route | Description | Status Codes |
|---|---|---|---|
| `GET` | `/api/agents` | Lists all registered agents in the fleet | `200 OK` |
| `GET` | `/api/agents/:id` | Returns agent details with granted capabilities | `200 OK`, `404 Not Found` |
| `POST` | `/api/agents` | Registers a new agent with input validation | `201 Created`, `400 Bad Request`, `409 Conflict` |
| `POST` | `/api/agents/:id/transition` | Executes lifecycle transition (`targetStatus`, `reason`) | `200 OK`, `400 Bad Request`, `404 Not Found` |
| `POST` | `/api/capabilities/issue` | Mints capability token bound to `agentId` | `201 Created`, `400 Bad Request`, `404 Not Found` |
| `POST` | `/api/metered-service` | Protected service endpoint with lifecycle check | `200 OK`, `401 Unauthorized`, `402 Over Budget`, `403 Forbidden` |

### Credential & Wallet Safety

1. **No Private Key Ingestion**: `POST /api/agents` does not accept, generate, or log private keys or seed phrases.
2. **Hardware Wallet Association**: A public EVM address (`0x...`) is bound as a hardware wallet reference, with settlement credentials strictly managed in the Ledger KeyRing hardware enclave.
3. **No Leakage**: Metadata, error messages, and API responses never expose internal keys or credentials.

---

## 5. Audit Logging Semantics

All lifecycle actions generate tamper-evident audit records submitted to Hedera Consensus Service (HCS):

1. **`AGENT_REGISTERED`**: Logged upon creation (`agentId`, `agentName`, `timestamp`).
2. **`AGENT_STATUS_CHANGED`**: Logged upon transition (`agentId`, `agentName`, `previousStatus`, `newStatus`, `reason`, `timestamp`).
3. **`AGENT_AUTHORIZATION_DENIED`**: Logged when a suspended or revoked agent attempts a metered request (`agentId`, `agentName`, `capId`, `amount`, `reason`, `timestamp`).

---

## 6. Testing & Validation Results

| Test Target | Suite | Command | Total Tests | Pass | Fail | Execution Time |
|---|---|---|---|---|---|---|
| **Broker Unit & Integration** | `broker.test.ts` & `agent.test.ts` | `npm run test:broker` | 19 | **19** | 0 | 2.70s |
| **Broker TypeScript Build** | `tsc` compilation | `npm run build:broker` | — | **PASS** | 0 | 0.8s |
| **Smart Contracts** | `CapabilityRegistryTest` | `npm run test:contracts` | 8 | **8** | 0 | 9.50ms |
| **Frontend Production Build** | Next.js Turbopack | `npm run build:app` | 4 pages | **PASS** | 0 | 17.7s |

### Verified Test Cases (`broker/src/test/agent.test.ts`):
- `A1. should list seeded canonical agents` — PASS
- `A2. should register a valid new agent with auto-generated safe wallet address` — PASS
- `A3. should register a valid agent with explicit valid EVM wallet address` — PASS
- `A4. should reject agent creation with duplicate name (CONFLICT)` — PASS
- `A5. should reject agent creation with invalid name or malformed wallet` — PASS
- `B1. should allow transition: ACTIVE -> SUSPENDED` — PASS
- `B2. should allow transition: SUSPENDED -> ACTIVE` — PASS
- `B3. should allow transition: ACTIVE -> REVOKED` — PASS
- `B4. should prohibit transition out of REVOKED terminal state (REVOKED -> ACTIVE)` — PASS
- `B5. should return 404 for unknown agent transition` — PASS
- `C1. should allow metered request when agent is ACTIVE` — PASS
- `C2. should FAIL CLOSED (HTTP 403 AGENT_SUSPENDED) when agent is SUSPENDED` — PASS
- `C3. should resume execution when agent is transitioned back to ACTIVE` — PASS
- `C4. should permanently FAIL CLOSED (HTTP 403 AGENT_REVOKED) when agent is REVOKED` — PASS
- `C5. should log audit trail events to HCS timeline for all agent lifecycle actions` — PASS

---

## 7. Known Limitations & Technical Debt

1. **Broker Memory Persistence**: Agent records currently persist in-memory in `AgentRegistry` with initial default seeds (`agent_alpha`, `agent_beta`, `agent_gamma`). Restarting the broker process resets dynamically created agents to default seeds. Persistent database storage (SQLite/PostgreSQL) is roadmapped for Phase 15.
2. **On-Chain Directory Isolation**: The EVM contract `CapabilityRegistry.sol` enforces capability limits and revocation, but does not independently query the broker's agent lifecycle table.
3. **Authentication Boundary**: Broker endpoints run without administrative user session authentication (e.g. JWT/API Key auth for admins), which is slated for Phase 15.
