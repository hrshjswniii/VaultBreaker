# Phase 7 Implementation Report: Human Approval & Escalation

## Executive Summary

Phase 7 establishes a secure, explainable, and cryptographically verified **Human Approval & Escalation System** for Vaultbreaker 2.0. Operating on the core architectural axiom that **"Agents should have power without having unlimited authority"**, Phase 7 introduces human-in-the-loop controls for high-value or high-risk autonomous AI agent transactions.

Key achievements delivered in Phase 7:
- **Canonical Approval Model & State Machine**: Implemented `ApprovalStore` with a deterministic 6-state finite state machine (`PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`, `CONSUMED`), lazy UTC expiration, and query filters.
- **Cryptographic SHA-256 Request Fingerprint**: Binds 9 immutable execution parameters (`agentId`, `capId`, `serviceAddress`, `targetResource`, `requestedAction`, `requestedAmount`, `asset`, `policyId`, `policyVersion`). Prevents parameter tampering or bait-and-switch escalation attacks.
- **Policy Engine Escalation Precedence**: Expanded `PolicyEffect` to include `APPROVAL_REQUIRED`; added typed conditions `requireApprovalAbove`, `requireApproval`, and `approvalTimeoutSeconds`. Preserves strict **DENY precedence**—an explicit `DENY` policy can never be bypassed by approval escalation.
- **Dual Pipeline Integration in Metered Service**:
  - *Escalation Path*: High-value calls without prior approval return HTTP 202 `APPROVAL_REQUIRED` with pending approval creation, zero budget deduction, zero credential exposure, and zero service execution.
  - *Resumption Path*: Invocations with `x-approval-id` re-verify all non-overridable security checks (agent active, capability unexpired/unrevoked, scope match, budget sufficient), validate SHA-256 request fingerprint integrity, re-evaluate policy engine with `approvalVerified: true`, atomically transition approval status to `CONSUMED` (single-use replay prevention), and decrement capability budget exactly once.
- **Operator Authentication Boundary**: Implemented `verifyOperatorAuth` middleware. Server authoritatively derives `approverId` from authenticated bearer tokens (`VAULTBREAKER_OPERATOR_TOKEN` / `OPERATOR_SECRET_KEY`) and strictly ignores or rejects caller-supplied `approvedBy` body fields. Clearly demarcates `DEVELOPMENT_DEMO_MODE` vs `PRODUCTION_AUTH_ENFORCED`.
- **Hedera Consensus Service (HCS) Audit Trail**: Full event logging across all approval lifecycle milestones (`APPROVAL_REQUESTED`, `APPROVAL_GRANTED`, `APPROVAL_REJECTED`, `APPROVAL_CANCELLED`, `APPROVAL_EXPIRED`, `APPROVAL_CONSUMED`, `APPROVAL_EXECUTION_DENIED`).
- **Operator Approval Inbox UI (`ApprovalsView.tsx`)**: Premium dark-mode glassmorphic inbox featuring real-time security boundary notice, status filters, search, metrics counters, live expiration timers, approval confirmation modal with bound parameter verification, rejection modal with mandatory reason input, and detailed request dossier inspection with copyable curl resumption headers.
- **100% Test Pass Rate**: 82 broker tests passed (20 dedicated Phase 7 approval tests), 8 Foundry contract tests passed, and frontend Next.js production build compiled cleanly.

---

## 1. Architectural Changes & Domain Models

### 1.1 Canonical Approval Request Schema (`broker/src/approval/store.ts`)

```typescript
export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED"
  | "CONSUMED";

export interface ApprovalRequest {
  approvalId: string;
  id: string;                                               // Compatibility alias
  correlationId: string;
  agentId: string;
  capId: string;
  serviceAddress: string;
  targetResource: string;
  requestedAction: string;
  requestedAmount: number;
  asset: string;                                            // e.g. "HBAR"
  policyId: string;
  policyVersion: number;
  reason: string;
  policyThreshold?: number;
  approvalScope?: string;
  status: ApprovalStatus;
  requestFingerprint: string;                               // SHA-256 hash binding 9 parameters
  createdAt: string;
  expiresAt: string;
  decidedAt?: string;
  decisionAt?: string;
  decidedBy?: string;                                       // Server-derived approver ID
  decisionBy?: string;
  decisionReason?: string;
  rejectionReason?: string;
  consumedAt?: string;
  metadata?: Record<string, any>;
}
```

### 1.2 Cryptographic Request Fingerprint Binding

To prevent parameter tampering, the broker binds 9 execution parameters into a deterministic SHA-256 digest:

```typescript
export function computeRequestFingerprint(params: {
  agentId: string;
  capId: string;
  serviceAddress: string;
  targetResource: string;
  requestedAction: string;
  requestedAmount: number;
  asset: string;
  policyId: string;
  policyVersion: number;
}): string {
  const canonical = [
    params.agentId.trim(),
    params.capId.trim(),
    params.serviceAddress.trim().toLowerCase(),
    params.targetResource.trim(),
    params.requestedAction.trim(),
    params.requestedAmount.toString(),
    params.asset.trim().toUpperCase(),
    params.policyId.trim(),
    params.policyVersion.toString(),
  ].join("|");

  return crypto.createHash("sha256").update(canonical).digest("hex");
}
```

If an agent attempts to resume an approved request with a altered amount (e.g., approved for 15 HBAR, resumed with 20 HBAR) or a different target endpoint, the fingerprint recomputation fails immediately with HTTP 403 `APPROVAL_FINGERPRINT_MISMATCH`.

---

## 2. Policy Engine Escalation Integration

### 2.1 Extended Policy Schema (`broker/src/policy/engine.ts`)

```typescript
export type PolicyEffect = "ALLOW" | "DENY" | "APPROVAL_REQUIRED";

export interface PolicyConditions {
  maxPricePerCall?: number;
  dailyBudget?: number;
  maxCallsPerMinute?: number;
  allowedHoursUtc?: { startHour: number; endHour: number };
  blockedActions?: string[];
  blockedResources?: string[];
  requireApprovalAbove?: number;                            // Numerical threshold triggering escalation
  requireApproval?: boolean;                                // Mandatory approval flag
  approvalTimeoutSeconds?: number;                          // TTL for pending request (default: 900s)
}
```

### 2.2 Precedence Rules & Non-Overridability

The evaluation engine adheres to the following strict order of operations:
1. **Explicit DENY Precedence**: If a matching policy specifies `effect: "DENY"` (e.g., blocked action, off-hours execution, or explicit deny guardrail), the request is rejected immediately. It can **never** escalate to human approval.
2. **Threshold Escalation**: If no `DENY` applies and the requested amount exceeds `requireApprovalAbove` (or `requireApproval: true` is set):
   - Without verified approval: Evaluates to `outcome: "APPROVAL_REQUIRED"`.
   - With verified approval (`approvalVerified: true`): Evaluates to `outcome: "ALLOWED"`.
3. **Sub-Threshold Autonomous Execution**: If the requested amount is `<= requireApprovalAbove`, execution proceeds autonomously without requiring operator intervention.

---

## 3. Dual Pipeline in Metered Service (`POST /api/metered-service`)

### 3.1 Escalation Flow (Unapproved High-Value Invocation)
1. Agent calls `POST /api/metered-service` with spend exceeding policy threshold.
2. Policy engine returns `outcome: "APPROVAL_REQUIRED"`.
3. Broker creates an `ApprovalRequest` record in `ApprovalStore` (status: `PENDING`).
4. Hedera HCS records an `APPROVAL_REQUESTED` audit event.
5. Broker responds with **HTTP 202 Accepted**:
   ```json
   {
     "status": "APPROVAL_REQUIRED",
     "approvalId": "app_e4b17a02c914",
     "reason": "Requested amount 15 HBAR exceeds policy threshold of 10 HBAR. Approval request submitted.",
     "expiresAt": "2026-10-16T19:30:00.000Z",
     "requestFingerprint": "8a7f..."
   }
   ```
6. **Strict Invariant**: Budget deduction is **0 HBAR**. No private credentials decrypted. No service executed.

### 3.2 Resumption Flow (`x-approval-id` Header Supplied)
1. Agent resumes invocation supplying header `x-approval-id: app_e4b17a02c914`.
2. Broker retrieves approval record from `ApprovalStore`.
3. Validates status is `APPROVED` (rejects `PENDING`, `REJECTED`, `CANCELLED`).
4. Validates server UTC expiration (`currentTime < expiresAt`).
5. Recomputes SHA-256 fingerprint from active request parameters; rejects if mismatch.
6. **Re-evaluates Non-Overridable Security Checks**:
   - Agent lifecycle must still be `ACTIVE` (fails if agent was suspended or revoked while approval was pending).
   - Capability token must not be expired or revoked.
   - Capability scope must match requested action and target resource.
   - Capability budget must be `>= requestedAmount`.
7. Re-evaluates policy engine with `approvalVerified: true`.
8. **Atomic Single-Use Transition**: Status changes to `CONSUMED`.
9. Decrements capability budget **exactly once**.
10. KeyRing enclave signs micropayment and decrypts API credentials in memory.
11. Dispatches service call and logs `APPROVAL_CONSUMED` and `CAPABILITY_SPENT` to HCS.
12. Responds with HTTP 200 OK.
13. Subsequent replay attempts with the same `x-approval-id` fail immediately with HTTP 403 `APPROVAL_ALREADY_CONSUMED`.

---

## 4. Operator Authentication Boundary

To ensure production security integrity without making false claims:
1. **Authoritative Approver Identity**:
   - `verifyOperatorAuth` middleware inspects `Authorization: Bearer <token>` or `x-operator-token`.
   - If `VAULTBREAKER_OPERATOR_TOKEN` or `OPERATOR_SECRET_KEY` is configured in `.env`, strict token validation is enforced and sets mode `PRODUCTION_AUTH_ENFORCED`.
   - If unconfigured, the broker marks the boundary as `DEVELOPMENT_DEMO_MODE` and assigns identity `operator_demo_local`.
   - **Any `approvedBy` or `approverId` submitted in request bodies is strictly ignored/rejected**.
2. **Mandatory Rejection Reason**:
   - Operator rejection (`POST /api/approvals/:id/reject`) requires an explicit non-empty human-readable `reason`.
3. **Auditable Boundary Endpoint**:
   - `GET /api/approvals/status/security-boundary` exposes operational boundary mode, auth mechanism, and enterprise IdP readiness to the operator UI.

---

## 5. Frontend Operator Approval Inbox (`ApprovalsView.tsx`)

The frontend delivers an executive-grade Operator Approval Inbox UI:
- **Security Boundary Banner**: Prominently displays `DEVELOPMENT_DEMO_MODE` or `PRODUCTION_AUTH_ENFORCED` with explicit notices regarding enterprise IdP requirements.
- **Metrics Summary Cards**: Instant counters for Pending, Approved, Rejected, and Consumed requests with pulsing alert indicators when pending items exist.
- **Filter Bar & Search**: Instant filtering across `ALL`, `PENDING`, `APPROVED`, `REJECTED`, `CONSUMED`, `EXPIRED`, `CANCELLED` and real-time text search.
- **Live Expiration Timers**: Displays remaining authorization window (e.g., `14m 22s remaining`).
- **Interactive Modals**:
  - *Approve Confirmation Modal*: Displays the 9 cryptographically bound parameters and authoritative SHA-256 hash. Warns operator of high-value agent execution.
  - *Reject Modal*: Requires explicit human-readable rejection reason input.
  - *Request Dossier Modal*: Full inspection of bound parameters, lifecycle timestamps, evaluation reasons, and a one-click copyable curl command with `x-approval-id` header for agent resumption testing.
- **Navigation Integration**: `Navbar.tsx` displays the Approvals tab with a real-time pending notification badge.

---

## 6. Verification & Test Evidence

### 6.1 Vitest Unit & Integration Test Suite (`broker/src/test/approval.test.ts`)
A dedicated 20-test test suite verifies every facet of Phase 7:
- Deterministic 6-state machine transitions (`PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`, `CONSUMED`).
- Lazy UTC expiration transitions.
- Cryptographic SHA-256 parameter binding and tamper detection across all 9 fields.
- Policy escalation threshold triggering and explicit `DENY` precedence preservation.
- Zero budget deduction on pending or rejected requests.
- Single-use replay protection (second execution fails with `APPROVAL_ALREADY_CONSUMED`).
- Non-overridable security checks re-evaluation (agent suspension blocks approved execution).
- Server-derived `approverId` ignoring caller-supplied body fields.
- Mandatory rejection reason enforcement.
- Query filters by status and agent ID.

**Broker Test Suite Execution Result**:
```
 ✓ src/test/capability.test.ts (12 tests) 282ms
 ✓ src/test/agent.test.ts (15 tests) 314ms
 ✓ src/test/broker.test.ts (12 tests) 220ms
 ✓ src/test/approval.test.ts (20 tests) 321ms
 ✓ src/test/policy.test.ts (23 tests) 420ms

 Test Files  5 passed (5)
      Tests  82 passed (82)
   Start at  19:04:12
   Duration  2.10s (transform 328ms, setup 0ms, collect 741ms, tests 1.56s, environment 0ms, prepare 332ms)
```

### 6.2 Foundry Smart Contract Test Suite
```
[PASS] test_CapabilityIssuance() (gas: 151242)
[PASS] test_SpendDecrementsBudget() (gas: 48920)
[PASS] test_SpendRevertsWhenInsufficientBudget() (gas: 31201)
[PASS] test_SpendRevertsWhenExpired() (gas: 32014)
[PASS] test_SpendRevertsWhenRevoked() (gas: 32850)
[PASS] test_NonOwnerCannotRevoke() (gas: 18210)
[PASS] test_NonOwnerCannotIssue() (gas: 19412)
[PASS] test_InitialParameters() (gas: 14210)
Suite result: ok. 8 passed; 0 failed; 0 skipped
```

### 6.3 Frontend Next.js Production Build
```
▲ Next.js 16.3.4 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 202ms
  Creating an optimized production build ...
✓ Compiled successfully in 22.2s
  Running TypeScript ...
  Finished TypeScript in 8.1s ...
✓ Generating static pages using 3 workers (4/4) in 548ms
Finalizing page optimization ...
Route (app)
┌ ○ /
└ ○ /_not-found
○ (Static) prerendered as static content
```

---

## 7. Limitations, Known Gaps, & Phase 8 Handoff

1. **Enterprise Identity Provider (IdP)**: Phase 7 implements the server authorization gate, bearer token validation, and authoritative approver derivation. True production enterprise deployment requires OIDC/SAML integration (e.g. Okta, Azure AD, Auth0) or WebAuthn hardware passkeys for human operators.
2. **Temporary Budget Increases**: The canonical approval model supports `ONE_TIME` single-use request approvals. Multi-call temporary budget increases (`TEMPORARY_INCREASE`) will be expanded in future policy governance iterations.
3. **Phase 8 Handoff (Agent SDK)**: With server-side agent lifecycle (Phase 4), capability permissions (Phase 5), policy engine (Phase 6), and human approval escalation (Phase 7) completely operational, the next phase is building official client SDK libraries (Python and TypeScript) enabling agent frameworks (LangChain, AutoGen, CrewAI) to consume capability tokens, handle HTTP 202 escalation responses, and resume approved workflows automatically.

---

## 8. Atomic Small-Commit Plan

The following atomic commits represent the logical progression of Phase 7:
1. `feat(approval): implement canonical approval store and sha256 request fingerprinting`
2. `feat(policy): add approval escalation threshold conditions and APPROVAL_REQUIRED effect`
3. `feat(audit): introduce approval lifecycle audit events for hedera hcs`
4. `feat(broker): integrate approval escalation and resumption gates in metered-service pipeline`
5. `feat(broker): add operator decision endpoints and verification authentication middleware`
6. `test(approval): add comprehensive vitest unit and integration test suite`
7. `feat(app): build operator approval inbox ui and integrate navigation`
8. `docs(phase7): update core model documentation and publish comprehensive phase 7 report`
