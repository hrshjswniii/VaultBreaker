# Vaultbreaker 2.0 Policy Model

## 1. Overview & Policy Architecture

The Vaultbreaker **Policy Engine** is the deterministic authorization decision framework that enforces administrative guardrails for autonomous AI agent actions. While a **Capability** represents a scoped bearer token assigned to an agent, a **Policy** defines the operational bounds, price ceilings, velocity throttles, time windows, and security restrictions under which capabilities may operate.

The central guiding principle is:
> **Agents should have power without having unlimited authority.**

---

## 2. Canonical Policy Data Schema

Vaultbreaker 2.0 formalizes the canonical `SpendPolicy` structure implemented in `broker/src/policy/engine.ts`:

```typescript
export type PolicyEffect = "ALLOW" | "DENY";

export interface PolicyConditions {
  maxPricePerCall?: number;                                 // Ceiling per individual call (HBAR / Tinybar)
  dailyBudget?: number;                                     // Daily rolling budget ceiling
  maxCallsPerMinute?: number;                               // Velocity rate limit (requests per 60s sliding window)
  allowedHoursUtc?: { startHour: number; endHour: number }; // Permitted UTC operating window (0-23)
  blockedActions?: string[];                                // Explicitly prohibited action names
  blockedResources?: string[];                              // Explicitly prohibited endpoint paths
}

export interface SpendPolicy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;                                         // Active enforcement flag
  effect: PolicyEffect;                                     // ALLOW or DENY
  priority: number;                                         // Precedence integer (higher = higher priority)
  serviceEndpoint: string;                                  // Target HTTP service endpoint
  serviceAddress: string;                                   // EVM contract address or "*" for global wildcard
  maxPricePerCall: number;                                  // Shorthand compatibility ceiling
  dailyBudget: number;                                      // Shorthand daily limit
  ttlSeconds: number;                                       // Default TTL for capability issuance
  conditions?: PolicyConditions;                            // Typed rule criteria
  applicableAgents?: string[];                              // Target agent IDs (empty = all agents)
  applicableServices?: string[];                            // Target service addresses (empty = all services)
  applicableActions?: string[];                             // Target actions (empty = all actions)
  version: number;                                          // Incrementing configuration version counter
  createdAt: string;                                        // ISO 8601 creation timestamp
  updatedAt: string;                                        // ISO 8601 last modified timestamp
}
```

---

## 3. Policy Evaluation Decision Engine

### 3.1 Precedence & Conflict Resolution Rules

When a request arrives at the authorization gate, multiple policies may match the request context. The evaluation engine applies three deterministic precedence rules:

1. **Explicit DENY Precedence**:
   - An explicit `DENY` rule **always overrides** an `ALLOW` rule.
   - If a guardrail policy specifies `effect: "DENY"` and its conditions match the request context, the request is immediately rejected.
2. **Priority Ordering**:
   - Policies are ordered by `priority DESC` (higher numbers evaluate first).
   - Higher-priority policies dictate decisions before lower-priority baseline rules.
3. **Capability Baseline Authority**:
   - If no applicable policies target the requested service, agent, or action, the capability's baseline authority is respected without policy override (`outcome: "ALLOWED"`, `reasonCode: "AUTHORIZED"`).
4. **Zero Budget Deduction Guarantee**:
   - If any policy evaluation step fails (`allowed: false`), **no budget is ever decremented** from the agent or capability token.

### 3.2 Evaluation Conditions Taxonomy

| Condition | Field | Enforcement Behavior | Reason Code on Violation |
|---|---|---|---|
| **Price Ceiling** | `conditions.maxPricePerCall` | Evaluates requested amount against threshold. In `DENY` policies, amounts exceeding the ceiling trigger rejection. In `ALLOW` policies, calls must remain within the ceiling. | `PRICE_LIMIT_EXCEEDED` |
| **Velocity Cap** | `conditions.maxCallsPerMinute` | Maintains an in-memory sliding window of timestamps per `agentId:serviceAddress`. Rejects calls exceeding the frequency cap within 60 seconds. | `VELOCITY_LIMIT_EXCEEDED` |
| **UTC Time Window** | `conditions.allowedHoursUtc` | Compares the current UTC hour against `[startHour, endHour]`. Rejects off-hours executions (e.g. overnight or outside business hours). | `TIME_WINDOW_VIOLATION` |
| **Blocked Actions** | `conditions.blockedActions` | Compares the incoming `x-action` header against an explicit blacklist (e.g. `EXPORT_DATABASE`, `DELETE_RECORD`). | `BLOCKED_ACTION` |
| **Blocked Resources** | `conditions.blockedResources` | Compares the target endpoint path against prohibited routes (e.g. `/api/admin`, `/api/root`). | `BLOCKED_RESOURCE` |
| **Explicit Guardrail** | `effect: "DENY"` | Rejects any matching request matching targeted agents/services/actions. | `POLICY_DENIED` |

---

## 4. Evaluation Trace & Explainability

Every policy evaluation produces a structured `PolicyEvaluationResult` with an auditable step-by-step trace:

```typescript
export interface PolicyEvaluationResult {
  allowed: boolean;
  decisionId: string;
  outcome: "ALLOWED" | "DENIED";
  reasonCode:
    | "AUTHORIZED"
    | "POLICY_DENIED"
    | "PRICE_LIMIT_EXCEEDED"
    | "VELOCITY_LIMIT_EXCEEDED"
    | "TIME_WINDOW_VIOLATION"
    | "BLOCKED_ACTION"
    | "BLOCKED_RESOURCE"
    | "NO_APPLICABLE_POLICY"
    | "POLICY_EVALUATION_FAILED";
  primaryReason: string;
  matchedPolicyId?: string;
  matchedPolicyName?: string;
  matchedPolicyVersion?: number;
  evaluationTrace: EvaluationStep[];
  timestamp: string;
}
```

### Example Evaluation Trace

```json
{
  "allowed": false,
  "decisionId": "dec_8f3d1e4c",
  "outcome": "DENIED",
  "reasonCode": "PRICE_LIMIT_EXCEEDED",
  "primaryReason": "Amount 30 HBAR exceeds maximum price ceiling of 25 HBAR enforced by 'High Value Call Guardrail'",
  "matchedPolicyId": "pol_high_value_guard",
  "matchedPolicyName": "High Value Call Guardrail",
  "matchedPolicyVersion": 1,
  "evaluationTrace": [
    {
      "stage": "EVALUATION_INITIATED",
      "status": "PASS",
      "detail": "Context: Agent=agent_alpha, Service=0x000...004, Action=EXECUTE_METERED_SERVICE, Amount=30 HBAR",
      "timestamp": "2026-10-14T17:00:00.000Z"
    },
    {
      "stage": "PRICE_CEILING_CHECK",
      "status": "FAIL",
      "detail": "Call amount 30 HBAR exceeds price ceiling of 25 HBAR in DENY policy 'High Value Call Guardrail'",
      "timestamp": "2026-10-14T17:00:00.000Z"
    }
  ],
  "timestamp": "2026-10-14T17:00:00.000Z"
}
```

---

## 5. REST API Specifications

The broker exposes complete CRUD, state toggle, and simulation endpoints:

- `GET /api/policies`: Retrieve all registered policies.
- `GET /api/policies/:id`: Retrieve single policy specification by ID.
- `POST /api/policies`: Register new policy with typed conditions and version tracking.
- `PATCH /api/policies/:id`: Mutate conditions, description, or limits (increments `version`).
- `POST /api/policies/:id/toggle`: Toggle enabled/disabled state (increments `version`).
- `POST /api/policies/evaluate`: Dry-run pre-execution simulation sandbox returning evaluation trace without executing services or decrementing budget tokens.
