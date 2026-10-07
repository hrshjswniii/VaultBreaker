# Vaultbreaker 2.0 Policy Model

## 1. Overview & Policy Architecture

The Vaultbreaker **Policy Engine** is the rule specification framework used to define administrative guardrails for autonomous AI agent actions. While a **Capability** represents an active token instance assigned to an agent, a **Policy** is the declarative template defining what capabilities may be minted and under what constraints they operate.

---

## 2. Policy Categories

Vaultbreaker 2.0 defines six core policy evaluation dimensions:

```
SpendPolicy
  ├── 1. Spending Rules (Per Tx, Daily, Weekly, Monthly)
  ├── 2. Time Controls (TTL, Time-of-Day Windows)
  ├── 3. Service Constraints (Allowed Endpoints, Service Binding)
  ├── 4. Action Restrictions (Allowed HTTP Methods, Payload Constraints)
  ├── 5. Approval Rules (Human Thresholds, Multi-sig Requirements)
  └── 6. Risk Controls (Anomaly Flags, Velocity Caps)
```

### 1. Spending Policies
- **Per-Transaction Ceiling**: Maximum single call cost (e.g. `maxPricePerCall: 10 HBAR`).
- **Periodic Budget Ceilings**:
  - `dailyBudget`: Hard ceiling per 24-hour rolling window.
  - `weeklyBudget`: Hard ceiling per 7-day rolling window.
  - `monthlyBudget`: Hard ceiling per calendar month.
- **Cumulative Account Cap**: Absolute lifetime limit across all capabilities issued to an agent.

### 2. Time Policies
- **Token TTL (Time-To-Live)**: Hard lifespan of capability token in seconds (e.g. `ttlSeconds: 3600`).
- **Validity Windows**: Start timestamp (`nbf` / Not Before) and End timestamp (`exp`).
- **Schedule Windows**: Restrict execution to specific business hours (e.g., Mon-Fri 09:00 - 17:00 UTC).

### 3. Service Policies
- **Allowed Services**: Whitelist of permitted EVM contract addresses (`serviceAddress`).
- **Blocked Services**: Explicit blacklist of prohibited destination addresses.
- **Endpoint Binding**: Restricts capability to specific HTTP endpoints (e.g. `/api/metered-service`).

### 4. Action Policies
- **HTTP Method Restrictions**: Restrict requests to `POST` or `GET`.
- **Payload Constraints**: Maximum allowed token length, parameter range restrictions, or regex matching on prompt content.

### 5. Approval Policies
- **Auto-Approve Threshold**: Requests below `autoApproveLimit` (e.g. `<= 5 HBAR`) execute automatically.
- **Human Approval Threshold**: Requests above `humanApprovalLimit` (e.g. `> 50 HBAR`) trigger an `APPROVAL_REQUIRED` state and pause execution until a human administrator approves.
- **Approval Expiration**: Human approval decisions expire if not acted upon within `approvalTtlSeconds` (e.g. 15 minutes).

### 6. Risk & Velocity Policies
- **Rate Limits (Velocity Cap)**: Maximum requests per minute (e.g. `maxCallsPerMinute: 30`).
- **Anomaly Detection**: Suspicious spike in spend rate automatically triggers temporary capability suspension.

---

## 3. Canonical Policy Data Schema

```typescript
export interface PolicyRuleSet {
  policyId: string;
  orgId: string;
  name: string;
  description?: string;
  
  // Spending Limits
  spending: {
    maxPricePerCall: number;   // Tinybar / HBAR / Wei
    dailyBudget: number;
    weeklyBudget?: number;
    monthlyBudget?: number;
  };
  
  // Time Controls
  time: {
    ttlSeconds: number;
    allowedHoursUtc?: { startHour: number; endHour: number };
  };
  
  // Service Restrictions
  service: {
    allowedServiceAddresses: string[];
    allowedEndpoints: string[];
  };
  
  // Human Approval Thresholds
  approval: {
    requireApprovalAbove: number;
    approvalTimeoutSeconds: number;
  };
  
  // Velocity & Risk
  risk: {
    maxCallsPerMinute: number;
  };
  
  createdAt: string;
  updatedAt: string;
}
```

---

## 4. Policy Evaluation Engine Workflow

When an agent presents a capability token during an API invocation, the Policy Engine evaluates rules in strict order:

```
Incoming Request
  │
  ├── 1. Service Binding Check (serviceAddress in Whitelist?)
  ├── 2. Expiration Check (block.timestamp < expiry?)
  ├── 3. Revocation Check (revoked == false?)
  ├── 4. Velocity Rate Limit (callsInLastMinute < maxCallsPerMinute?)
  ├── 5. Single Call Cost Check (amount <= maxPricePerCall?)
  ├── 6. Daily Budget Check (budgetRemaining >= amount?)
  ├── 7. Human Approval Threshold (amount > requireApprovalAbove?)
  │       ├── YES ──> Status: APPROVAL_REQUIRED
  │       └── NO  ──> Status: ALLOWED
  │
  └── EXECUTE SPEND & DECRYPT CREDENTIAL
```

If ANY hard check fails, the policy evaluation immediately halts and returns an explicit rejection (`INSUFFICIENT_BUDGET`, `CAPABILITY_EXPIRED`, `CAPABILITY_REVOKED`, or `UNAUTHORIZED_SERVICE`).
