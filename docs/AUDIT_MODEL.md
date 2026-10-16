# Vaultbreaker 2.0 Audit Model

## 1. Overview & Audit Philosophy

Auditability is a core pillar of Vaultbreaker. Every significant lifecycle change, capability issuance, metered spend, rejection, revocation, and policy evaluation is immutably logged to the **Hedera Consensus Service (HCS)**.

This produces a tamper-evident, publicly verifiable record of all autonomous AI agent activity that can be independently inspected on HashScan or queried via Hedera Mirror Nodes.

---

## 2. Event Inventory: Baseline & Extended

```
Audit Events
  ├── Core Capability Events
  │     ├── CAPABILITY_ISSUED
  │     ├── CAPABILITY_SPENT
  │     ├── CAPABILITY_REJECTED
  │     └── CAPABILITY_REVOKED
  │
  ├── Agent Lifecycle Events (Phase 4)
  │     ├── AGENT_REGISTERED
  │     ├── AGENT_STATUS_CHANGED
  │     └── AGENT_AUTHORIZATION_DENIED
  │
  ├── Policy & Governance Events (Phase 6)
  │     ├── POLICY_REGISTERED
  │     ├── POLICY_UPDATED
  │     ├── POLICY_TOGGLED
  │     └── POLICY_EVALUATED
  │
  └── Future Expansion (Phase 7+)
        ├── APPROVAL_REQUESTED
        ├── APPROVAL_GRANTED
        └── APPROVAL_REJECTED
```

### Detailed Event Taxonomy

| Event Type | Event Class | Trigger Condition | Primary Data Payload |
|---|---|---|---|
| `CAPABILITY_ISSUED` | Capability | Developer mints new capability token. | `capId`, `agentId`, `serviceAddress`, `budgetTotal`, `expiry`, `policyHash` |
| `CAPABILITY_SPENT` | Capability | Agent completes valid metered call; budget decremented. | `capId`, `serviceAddress`, `amount`, `budgetRemaining` |
| `CAPABILITY_REJECTED` | Capability | Spend attempt fails budget, expiry, revocation, or policy check. | `capId`, `amount`, `budgetRemaining`, `reason` |
| `CAPABILITY_REVOKED` | Capability | Developer or owner revokes capability token. | `capId`, `agentId`, `reason` |
| `AGENT_REGISTERED` | Agent | New agent registered in system. | `agentId`, `name`, `walletAddress` |
| `AGENT_STATUS_CHANGED` | Agent | Agent lifecycle transitioned (`ACTIVE` ↔ `SUSPENDED` ↔ `REVOKED`). | `agentId`, `previousStatus`, `newStatus`, `reason` |
| `AGENT_AUTHORIZATION_DENIED` | Agent | Agent lifecycle gate rejects spend attempt. | `agentId`, `capId`, `reason`, `amount` |
| `POLICY_REGISTERED` | Policy | Developer registers a new SpendPolicy. | `policyId`, `policyName`, `effect`, `priority` |
| `POLICY_UPDATED` | Policy | Policy conditions, description, or limits modified. | `policyId`, `policyName`, `version`, `reason` |
| `POLICY_TOGGLED` | Policy | Policy enabled or disabled state toggled. | `policyId`, `policyName`, `enabled`, `version` |
| `POLICY_EVALUATED` | Policy | Policy evaluation executed during authorization or dry-run. | `decisionId`, `policyId`, `outcome`, `reasonCode`, `amount` |

---

## 3. Canonical Audit Event Data Schema

Implemented in `broker/src/hedera/hcs.ts` and mirrored in `app/src/lib/api.ts`:

```typescript
export interface HCSAuditEvent {
  type:
    | "CAPABILITY_ISSUED"
    | "CAPABILITY_SPENT"
    | "CAPABILITY_REJECTED"
    | "CAPABILITY_REVOKED"
    | "AGENT_REGISTERED"
    | "AGENT_STATUS_CHANGED"
    | "AGENT_AUTHORIZATION_DENIED"
    | "POLICY_REGISTERED"
    | "POLICY_UPDATED"
    | "POLICY_TOGGLED"
    | "POLICY_EVALUATED";
  capId?: string;
  agentId?: string;
  agentName?: string;
  previousStatus?: string;
  newStatus?: string;
  policyId?: string;
  policyName?: string;
  decisionId?: string;
  outcome?: string;
  reasonCode?: string;
  service?: string;
  amount?: number;
  budgetRemaining?: number;
  reason?: string;
  policyHash?: string;
  timestamp: string;
  txHash?: string;
}
```

---

## 4. Hedera Consensus Service Integration

1. **Production Mode**: When `HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_KEY` are provided in `.env`, audit events are serialized as JSON and submitted to the target Hedera Topic ID via the Hedera Java/JS SDK (`TopicMessageSubmitTransaction`).
2. **Mirror Mode & Offline Fallback**: If operator keys are unconfigured, audit events are preserved in the in-memory feed and queryable via `/api/audit-feed` with sequence numbers and timestamps intact.
