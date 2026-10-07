# Vaultbreaker 2.0 Audit Model

## 1. Overview & Audit Philosophy

Auditability is a core pillar of Vaultbreaker. Every significant lifecycle change, capability issuance, metered spend, rejection, revocation, and human approval is immutably logged to the **Hedera Consensus Service (HCS)**.

This produces a tamper-evident, publicly verifiable record of all autonomous AI agent activity that can be independently verified on HashScan or queried via Hedera Mirror Nodes.

---

## 2. Event Inventory: Current vs. Target

```
Audit Events
  ├── Current Implementation (Phase 0 Baseline)
  │     ├── CAPABILITY_ISSUED
  │     ├── CAPABILITY_SPENT
  │     ├── CAPABILITY_REJECTED
  │     └── CAPABILITY_REVOKED
  │
  └── Target Implementation (Vaultbreaker 2.0 Expansion)
        ├── AGENT_CREATED
        ├── AGENT_SUSPENDED
        ├── AGENT_COMPROMISED
        ├── POLICY_REGISTERED
        ├── APPROVAL_REQUESTED
        ├── APPROVAL_GRANTED
        ├── APPROVAL_REJECTED
        ├── PAYMENT_INITIATED
        ├── PAYMENT_SETTLED
        ├── PAYMENT_FAILED
        └── POLICY_VIOLATION
```

### Detailed Event Taxonomy

| Event Type | Event Class | Trigger Condition | Primary Data Payload |
|---|---|---|---|
| `CAPABILITY_ISSUED` | Current | Developer mints new capability token. | `capId`, `serviceAddress`, `budgetTotal`, `expiry`, `policyHash` |
| `CAPABILITY_SPENT` | Current | Agent completes valid metered call. | `capId`, `serviceAddress`, `amount`, `budgetRemaining` |
| `CAPABILITY_REJECTED` | Current | Spend attempt fails budget, expiry, or revocation. | `capId`, `amount`, `budgetRemaining`, `reason` |
| `CAPABILITY_REVOKED` | Current | Developer or owner revokes capability. | `capId`, `revokedBy` |
| `AGENT_CREATED` | Target | New Agent registered in Organization. | `agentId`, `ownerId`, `walletAddress` |
| `AGENT_SUSPENDED` | Target | Admin or system pauses Agent. | `agentId`, `reason` |
| `AGENT_COMPROMISED` | Target | Anomaly / prompt injection flagged. | `agentId`, `threatScore`, `actionTaken` |
| `POLICY_REGISTERED` | Target | Developer registers new SpendPolicy. | `policyId`, `maxPricePerCall`, `dailyBudget` |
| `APPROVAL_REQUESTED` | Target | Spend exceeds auto-approve threshold. | `approvalId`, `agentId`, `requestedAmount` |
| `APPROVAL_GRANTED` | Target | Human admin approves spend. | `approvalId`, `approverId`, `resolvedAmount` |
| `APPROVAL_REJECTED` | Target | Human admin rejects spend. | `approvalId`, `approverId`, `reason` |
| `PAYMENT_SETTLED` | Target | EVM transaction confirmed on Hedera Testnet. | `paymentId`, `txHash`, `amount`, `settledAt` |
| `POLICY_VIOLATION` | Target | Rate limit or boundary breached. | `agentId`, `policyId`, `violatedRule` |

---

## 3. Canonical Audit Event Data Schema

```typescript
export interface CanonicalAuditEvent {
  // Event Metadata
  eventId: string;             // UUID v4
  eventType: string;           // Taxonomy string above
  timestamp: string;           // ISO-8601 UTC string
  
  // Topic & Verification
  topicId: string;             // Hedera HCS Topic ID (e.g. 0.0.654321)
  sequenceNumber?: number;     // HCS assigned sequence number
  txHash?: string;             // EVM transaction hash if settled on-chain
  
  // Core Domain Context
  orgId?: string;
  agentId?: string;
  capId?: string;
  serviceAddress?: string;
  policyId?: string;
  
  // Financial Context
  amount?: number;
  budgetRemaining?: number;
  currency?: string;
  
  // Status & Reason
  status: "SUCCESS" | "REJECTED" | "PENDING" | "ALERT";
  reason?: string;
  
  // Verification Reference
  hashScanUrl?: string;
}
```

---

## 4. Hedera HCS Audit Architecture

```
[ Broker Event Emitter ]
       │
       ▼
[ HederaHCSLogger (broker/src/hedera/hcs.ts) ]
       │
       ├── Mode 1: HEDERA SDK ACTIVE (Operator ID + ECDSA Key Configured)
       │     └── TopicMessageSubmitTransaction ──> Hedera Testnet Topic (0.0.654321)
       │                                                    │
       │                                                    ▼
       │                                         Hedera Mirror Node API
       │
       └── Mode 2: LOCAL MIRROR FEED (Operator Keys Default)
             └── Appends JSON to inMemoryAuditFeed Array
       │
       ▼
[ Frontend Audit Feed Timeline Component (AuditFeedTimeline.tsx) ]
       └── Polls /api/audit-feed & renders live event stream + HashScan links
```
