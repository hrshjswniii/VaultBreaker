# Vaultbreaker 2.0 Human Approval Model

## 1. Overview: Human-in-the-Loop Financial Control

The **Human Approval Model** provides a fail-safe mechanism for high-value or high-risk autonomous AI agent transactions. While capabilities grant agents autonomous authority for routine micropayments (e.g. `<= 5 HBAR`), transactions exceeding pre-configured threshold limits trigger an `APPROVAL_REQUIRED` state, pausing execution until an authorized human administrator reviews and resolves the request.

---

## 2. Scenario Walkthrough

```
Agent Action Request: Spend 25 HBAR on Compute Service
  │
  ▼
Policy Check:
  - Max Auto-Approve Threshold: 5 HBAR
  - Requested Amount: 25 HBAR
  │
  ▼
Result: 25 HBAR > 5 HBAR ──> Status: APPROVAL_REQUIRED
  │
  ├── 1. Broker pauses request execution
  ├── 2. Broker creates Approval Request record (status: PENDING)
  ├── 3. Broker logs APPROVAL_REQUESTED event to Hedera HCS Topic
  ├── 4. Broker sends notification to Administrator Dashboard
  │
  ▼
Human Administrator Actions:
  ├── View Context: Agent ID, Requested Amount (25 HBAR), Service, Policy Rule
  ├── Option A: APPROVE ──> Execution Resumes ──> Spend Processed ──> HCS Audit Log
  └── Option B: REJECT  ──> Execution Cancelled ──> HTTP 403 Returned ──> HCS Audit Log
```

---

## 3. Approval Request Schema

```typescript
export interface ApprovalRequest {
  approvalId: string;
  orgId: string;
  agentId: string;
  capId: string;
  serviceAddress: string;
  
  // Request Details
  requestedAmount: number;     // e.g. 25 HBAR
  asset: "HBAR" | "USDC";
  promptSummary?: string;
  policyThreshold: number;     // e.g. 5 HBAR
  
  // Approval Metadata
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  approverId?: string;         // User ID of approving administrator
  approvalScope: "ONE_TIME" | "TEMPORARY_INCREASE";
  
  expiresAt: string;           // Timestamp when pending approval expires (e.g. 15 mins)
  resolvedAt?: string;
  createdAt: string;
}
```

---

## 4. Key Approval Governance Rules

1. **One-Time vs Reusable Approvals**:
   - `ONE_TIME`: Approval applies ONLY to the specific pending request. Once executed, the capability threshold resets.
   - `TEMPORARY_INCREASE`: Temporarily raises the capability budget limit for a specified window (e.g., 2 hours).
2. **Time-To-Live Expiration**: Pending approvals expire after `approvalTimeoutSeconds` (default: 900s / 15 minutes). Expired requests automatically transition to `EXPIRED` and reject the pending agent request.
3. **Immutability & Audit Trail**: Every approval creation (`APPROVAL_REQUESTED`), approval decision (`APPROVAL_GRANTED`), and rejection (`APPROVAL_REJECTED`) is immutably logged to the Hedera HCS audit trail.
