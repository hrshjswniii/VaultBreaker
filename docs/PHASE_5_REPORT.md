# Vaultbreaker 2.0 — Phase 5 Report: Capability Lifecycle & Permission Management

**Phase:** Phase 5  
**System:** Vaultbreaker 2.0  
**Repository:** [https://github.com/hrshjswniii/VaultBreaker](https://github.com/hrshjswniii/VaultBreaker)  
**Status:** COMPLETE  

---

## 1. Executive Summary

Phase 5 completes the transformation of Capabilities from passive data structures into **authoritative, cryptographically bounded units of execution authority** for autonomous AI agents.

Under the guiding principle:
> *"Agents should have power without having unlimited authority."*

Capabilities now strictly bind an agent to explicit permissions:
1. **Agent Binding:** Every capability is tied to an explicit `agentId`. Attempts by another agent to invoke endpoints with a borrowed or stolen token are rejected with `HTTP 403 AGENT_MISMATCH`.
2. **Action Constraints:** Every capability defines explicit allowed actions (e.g., `["EXECUTE_METERED_SERVICE"]`). Requests attempting unspecified actions are rejected with `HTTP 403 ACTION_NOT_PERMITTED`.
3. **Resource Scopes:** Scopes are matched against target resource endpoints and contract bindings. Requests outside the declared scope are rejected with `HTTP 403 RESOURCE_OUT_OF_SCOPE`.
4. **Deterministic Lifecycle:** Lifecycle status is derived authoritatively as `ACTIVE`, `EXHAUSTED`, `EXPIRED`, or `REVOKED`. Expired or revoked capabilities fail closed on every evaluation path.
5. **Issuance Gate:** Capabilities can only be issued to `ACTIVE` registered agents. Deactivated or suspended agents are rejected with `HTTP 403`.
6. **Revocation Persistence & Audit:** Revocation takes immediate effect, records an immutable audit log to Hedera Consensus Service (HCS), and cannot be reactivated by resuming an agent.
7. **Budget Accounting:** Non-negative integer arithmetic with exact boundary enforcement guarantees that requests exceeding remaining budget fail closed with `HTTP 402 INSUFFICIENT_BUDGET`.

---

## 2. Canonical Capability Model & Lifecycle

### 2.1 The Authoritative Schema

The canonical capability object is defined in `broker/src/policy/engine.ts` and mirrored in `app/src/lib/api.ts`:

```typescript
export type CapabilityStatus = "ACTIVE" | "EXHAUSTED" | "EXPIRED" | "REVOKED";

export interface IssuedCapability {
  capId: string;                     // Deterministic Keccak256 identifier
  agentId: string;                   // Owning AI Agent ID
  policyId: string;                  // Underlying policy template reference
  policyHash: string;                // Keccak256 hash of policy parameters
  serviceAddress: string;            // Target EVM service binding
  allowedActions: string[];          // Authorized action list (e.g. ["EXECUTE_METERED_SERVICE"])
  resourceScope: string;             // Resource boundary (e.g. "/api/metered-service")
  budgetTotal: number;               // Initial spending ceiling
  budgetRemaining: number;           // Real-time remaining spendable budget
  currency: string;                  // Denomination (e.g. "HBAR")
  expiry: number;                    // Unix timestamp (seconds) TTL
  issuer: string;                    // Broker admin / relayer address
  encryptedCredential: string;       // Seed-enclave encrypted wallet reference
  token: string;                     // Signed HS256 JWT bearer token
  revoked: boolean;                  // Authoritative revocation flag
  revokedAt?: string;                // ISO timestamp of revocation event
  status: CapabilityStatus;          // Derived lifecycle status
  createdAt: string;                 // ISO creation timestamp
}
```

### 2.2 Deterministic Lifecycle Transitions

Capability lifecycle status is derived from authoritative fields:
- `REVOKED` if `cap.revoked === true`.
- `EXPIRED` if `Math.floor(Date.now() / 1000) >= cap.expiry`.
- `EXHAUSTED` if `cap.budgetRemaining <= 0`.
- `ACTIVE` if unrevoked, unexpired, and budget > 0.

An expired or revoked capability **never** becomes active again; status is derived dynamically and fails closed across all evaluation paths.

---

## 3. Implementation Details

### 3.1 Capability Issuance Workflow (`POST /api/capabilities/issue`)

The issuance path enforces:
1. **Agent Verification:** Look up `agentId` in `agentRegistry`.
   - Agent does not exist: returns `HTTP 404 AGENT_NOT_FOUND`.
   - Agent is `SUSPENDED`: returns `HTTP 403 AGENT_SUSPENDED`.
   - Agent is `REVOKED`: returns `HTTP 403 AGENT_REVOKED`.
2. **Policy Template Validation:** Look up `policyId`.
   - Policy not found: returns `HTTP 404 POLICY_NOT_FOUND`.
3. **Parameter Bounds:**
   - Budget must be a positive integer $\le$ policy `dailyBudget`.
   - TTL must be a positive integer $\le$ policy `ttlSeconds`.
   - At least one allowed action must be provided.
   - Resource scope cannot be blank.
4. **Cryptographic Credential Binding:** Encrypts wallet credentials using the Ledger seed enclave (`AES-256-GCM`).
5. **JWT Claims:** Embeds `agentId`, `capId`, `serviceAddress`, `allowedActions`, `resourceScope`, and `exp` into the signed token.
6. **Audit Event:** Emits `CAPABILITY_ISSUED` to Hedera Consensus Service.

### 3.2 Server-Side Authorization Gate (`POST /api/metered-service`)

Protected requests evaluate the capability through a 7-stage authorization pipeline:

```
[Incoming Request: Token + Headers]
         │
         ▼
[1. JWT Verification & Agent Match] ──Mismatch──► HTTP 403 AGENT_MISMATCH
         │
         ▼
[2. Phase 4 Agent Lifecycle Gate]   ──Inactive──► HTTP 403 AGENT_SUSPENDED / AGENT_REVOKED
         │
         ▼
[3. Capability Revocation Check]    ──Revoked───► HTTP 403 CAPABILITY_REVOKED
         │
         ▼
[4. Capability Expiration Check]    ──Expired───► HTTP 402 CAPABILITY_EXPIRED
         │
         ▼
[5. Action Constraint Check]        ──Invalid───► HTTP 403 ACTION_NOT_PERMITTED
         │
         ▼
[6. Resource Scope Check]           ──Invalid───► HTTP 403 RESOURCE_OUT_OF_SCOPE
         │
         ▼
[7. Budget Limit Deduction]         ──Exceeds───► HTTP 402 INSUFFICIENT_BUDGET
         │
         ▼
[Allow Execution: Decrypt Credential in Memory & Execute]
```

### 3.3 Authoritative Revocation (`POST /api/capabilities/revoke`)

- Accepts `capId` and optional `reason`.
- Authoritatively sets `revoked = true` and `revokedAt = new Date().toISOString()`.
- Emits `CAPABILITY_REVOKED` audit log with correlation ID.
- Instantly blocks all subsequent requests across the broker with `HTTP 403 CAPABILITY_REVOKED`.
- Resuming or modifying an agent's status cannot reactivate revoked capabilities.

---

## 4. Frontend Management (`CapabilitiesView.tsx`)

1. **Active Registry Display:**
   - Visual status badges: `ACTIVE` (emerald pulse), `EXHAUSTED` (amber warning), `EXPIRED` (slate clock), `REVOKED` (rose alert).
   - Real-time budget progress bar (`Remaining / Total HBAR`).
   - Allowed action tags and scope indicators.
   - Direct link to Owning Agent and Associated Policy.
2. **Capability Issuance Modal:**
   - Target Agent selector showing live agent lifecycle status with inline warnings if suspended/revoked.
   - Action checklist for `EXECUTE_METERED_SERVICE`, `READ_TELEMETRY`, `SUBMIT_TRANSACTION`.
   - Resource scope input with quick chips (`/api/metered-service`, `/api/v1/market-data`, `*`).
   - Spending limit and TTL duration selectors.
   - Client-side validation preventing empty scopes, non-positive budgets, or empty action lists.
   - Server error handling and confirmation banner upon issuance.
3. **Revocation Modal:**
   - Explicit confirmation requirement.
   - Operator reason input logged directly to HCS audit stream.
   - Immediate visual feedback.
4. **Detail Drawer:**
   - Complete capability metadata, bearer token snippet with one-click copy, cryptographic hashes, and creation/expiration timestamps.

---

## 5. Test Verification & Actual Results

All tests executed with real results in local environment:

### 5.1 Broker Unit & Integration Test Suite (`broker/src/test/capability.test.ts`)
20 dedicated tests written and passing:
- **Issuance Tests:** Valid issuance, agent eligibility check, rejection of suspended/revoked agents, missing actions rejection, invalid scopes rejection, budget ceiling clamping.
- **Enforcement Tests:** Action permissions, resource scope matching, agent substitution prevention (`AGENT_MISMATCH`), revoked token rejection (`CAPABILITY_REVOKED`), expired token rejection (`CAPABILITY_EXPIRED`).
- **Budget Tests:** Exact integer deductions, boundary rejection when budget exhausted (`INSUFFICIENT_BUDGET`), non-negative balance enforcement.
- **Revocation Tests:** Explicit revocation via endpoint, permanent fail-closed behavior, agent resumption isolation (revoked capabilities remain revoked when agent is resumed).

### 5.2 Test Summary Table

| Test Suite | Framework | Command | Total Tests | Status |
|---|---|---|---|---|
| **Capability Lifecycle & Permissions** | Vitest | `npm run test:broker` | 20 / 20 | **PASSED** |
| **Agent Lifecycle & Management** | Vitest | `npm run test:broker` | 15 / 15 | **PASSED** |
| **Broker Core & KeyRing Enclave** | Vitest | `npm run test:broker` | 4 / 4 | **PASSED** |
| **Smart Contract Capability Registry** | Foundry Forge | `npm run test:contracts` | 8 / 8 | **PASSED** |
| **End-to-End Integration Flow** | tsx script | `npm run test:e2e` | 5 / 5 stages | **PASSED** |
| **Next.js Production App Build** | Turbopack | `npm run build:app` | 4 / 4 static pages | **PASSED** |
| **TypeScript Broker Build** | `tsc` | `npm run build:broker` | Zero TS errors | **PASSED** |

**Total Suite Pass Rate: 100% (47/47 tests passing across Vitest and Foundry).**

---

## 6. Broker vs On-Chain Enforcement Boundaries

| Dimension | Broker Memory Layer | Smart Contract (`CapabilityRegistry.sol`) |
|---|---|---|
| **Authority** | Authoritative gateway for HTTP/REST requests | Authoritative anchor for on-chain settlement |
| **Revocation** | Immediate effect on broker memory & HCS log | Immediate effect on EVM state when `revoke()` is called |
| **Cross-Boundary Sync** | Broker checks local state; contracts reject on-chain spends if invoked directly | Reconciled via relayer during Phase 6 policy engine & Phase 9 settlement |
| **Trust Model** | Least-privilege server gate protecting secrets | Decentralized immutability on Hedera EVM |

---

## 7. Proposed Modular Commits

1. `feat(broker): implement canonical capability model, issuance validation, and lifecycle status`
2. `feat(broker): enforce action constraints, resource scopes, and agent binding in authorization gate`
3. `feat(broker): add authoritative revocation and non-negative integer budget accounting`
4. `test(broker): add comprehensive capability lifecycle and permission enforcement test suite`
5. `feat(app): add capability minting, revocation modal, and lifecycle filters in CapabilitiesView`
6. `docs: update roadmap, functionality matrix, and phase 5 completion report`
