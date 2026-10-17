# Vaultbreaker 2.0 Human Approval & Escalation Model

## 1. Overview: Human-in-the-Loop Financial Control

The **Human Approval & Escalation Model** establishes an explicit, auditable, and cryptographically verified control plane for high-value or high-risk autonomous AI agent transactions.

**Core Principle**: *Agents should have power without having unlimited authority.*

While capabilities grant agents autonomous authority for routine micropayments (e.g. `<= 10 HBAR`), transactions that exceed policy thresholds or target sensitive resources escalate to an `APPROVAL_REQUIRED` state. This pauses execution without consuming budget, exposing credentials, or executing external services until an authorized human operator inspects and signs off on the request.

---

## 2. Canonical Approval State Machine

The approval lifecycle follows a deterministic, 6-state finite state machine:

```
                      ┌────────────────────────────────────────┐
                      │                PENDING                 │
                      └───┬─────────────┬─────────────┬────────┘
                          │             │             │
               [Operator] │  [Operator] │    [Expiry] │ [Operator]
                Approve   │   Reject    │    Passed   │  Cancel
                          ▼             ▼             ▼
                     ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐
                     │ APPROVED │ │ REJECTED │ │  EXPIRED  │ │ CANCELLED │
                     └────┬─────┘ └──────────┘ └───────────┘ └───────────┘
                          │
             [Agent Calls │ (Resumption with valid
               Metered    │  SHA-256 fingerprint &
              Endpoint]   │  budget available)
                          ▼
                     ┌──────────┐
                     │ CONSUMED │ (Single-Use Replay Prevention)
                     └──────────┘
```

### State Definitions:
1. **`PENDING`**: Initial state upon escalation. Zero budget deducted, zero external service execution. Awaiting operator action or TTL expiration.
2. **`APPROVED`**: Authorized by human operator. Bound cryptographically to the exact 9 execution parameters. Eligible for single-use execution resumption.
3. **`REJECTED`**: Explicitly denied by human operator with mandatory human-readable reason. Terminal state.
4. **`EXPIRED`**: Authorization window exceeded without human resolution (`approvalTimeoutSeconds`, default 900s). Invocations referencing this ID fail with HTTP 403 `APPROVAL_EXPIRED`. Terminal state.
5. **`CANCELLED`**: Revoked by operator or requesting system prior to decision. Terminal state.
6. **`CONSUMED`**: Successfully executed exactly once. Budget decremented. Any replay attempt fails immediately with HTTP 403 `APPROVAL_ALREADY_CONSUMED`. Terminal state.

---

## 3. Cryptographic Request Fingerprint Integrity

To prevent parameter tampering or bait-and-switch escalation attacks, every approval request generates a canonical SHA-256 fingerprint binding 9 immutable execution parameters:

```
RequestFingerprint = SHA256(
  agentId + "|" +
  capId + "|" +
  serviceAddress.toLowerCase() + "|" +
  targetResource + "|" +
  requestedAction + "|" +
  requestedAmount + "|" +
  asset + "|" +
  policyId + "|" +
  policyVersion
)
```

### Tamper Protection Guarantee
When an agent resumes execution via `POST /api/metered-service` with `x-approval-id: <approval_id>`:
1. The broker recalculates the SHA-256 fingerprint from the active request parameters.
2. The broker compares the calculated hash against the stored `requestFingerprint`.
3. If any field differs (e.g., amount escalated for 15 HBAR but resumed for 20 HBAR, or different target resource), the request is rejected immediately with HTTP 403 `APPROVAL_FINGERPRINT_MISMATCH`.
4. The violation is immutably recorded to Hedera Consensus Service (HCS) as an `APPROVAL_EXECUTION_DENIED` audit event.

---

## 4. Policy Engine Escalation Integration

Policy rules define approval conditions alongside standard Allow/Deny controls:

```json
{
  "id": "policy_high_value_compute",
  "name": "High Value Compute Guardrail",
  "effect": "ALLOW",
  "requireApprovalAbove": 10,
  "approvalTimeoutSeconds": 900
}
```

### Decision Pipeline Precedence:
1. **Deny Precedence**: Explicit `DENY` policies always override any `ALLOW` or `APPROVAL_REQUIRED` condition. A denied request cannot escalate to human approval.
2. **Threshold Evaluation**: If requested amount is `<= requireApprovalAbove`, the call proceeds autonomously.
3. **Escalation Trigger**: If requested amount exceeds `requireApprovalAbove` (or if `requireApproval: true` is set) and no `x-approval-id` is provided:
   - The engine returns `status: "APPROVAL_REQUIRED"` with HTTP 202.
   - The approval record is created in `ApprovalStore`.
   - Budget deduction is **strictly zero**.
   - HCS records an `APPROVAL_REQUESTED` event.

---

## 5. Resumption & Re-evaluation Pipeline

When an agent calls `POST /api/metered-service` with `x-approval-id: <id>`:

1. **State & Expiry Validation**:
   - Status must be `APPROVED`.
   - Authoritative server UTC timestamp must be `< expiresAt`.
2. **Fingerprint Validation**:
   - Recomputed SHA-256 must match `requestFingerprint`.
3. **Non-Overridable Safety Re-evaluation**:
   - Human approval **never** overrides fundamental security invariant checks:
     - Agent status must still be `ACTIVE` (if suspended or revoked, execution is denied).
     - Capability must not be expired or revoked.
     - Capability scope must match requested action and resource.
     - Capability budget must be `>= requestedAmount`.
4. **Policy Engine Re-evaluation**:
   - Evaluated with `approvalVerified: true`, satisfying the approval requirement.
5. **Atomic Single-Use Consumption**:
   - Status transitions atomically from `APPROVED` -> `CONSUMED`.
   - Capability budget is decremented **exactly once**.
   - Ledger Seed Key Ring generates EVM authorization signature.
   - HCS records `APPROVAL_CONSUMED` and `CAPABILITY_SPENT` events.

---

## 6. Operator Authentication & Security Boundary

Vaultbreaker distinguishes between operator decision authority and calling agent authority:

- **Server-Derived Approver Identity**: Operator decision endpoints (`/api/approvals/:id/approve` and `/api/approvals/:id/reject`) determine the approver identity authoritatively from authenticated session/bearer tokens (`VAULTBREAKER_OPERATOR_TOKEN` / `OPERATOR_SECRET_KEY`).
- **Caller-Supplied Identity Rejection**: Any `approvedBy` or `approverId` submitted in the request body by callers is strictly ignored or rejected.
- **Explicit Boundary Modes**:
  - `PRODUCTION_AUTH_ENFORCED`: Strict cryptographic token validation via operator bearer tokens.
  - `DEVELOPMENT_DEMO_MODE`: Demo fallback labeling when run without external enterprise IdP, explicitly notifying operators in UI and logs.
