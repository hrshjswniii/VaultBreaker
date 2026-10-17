# Vaultbreaker 2.0 Policy Model

## 1. Overview & Policy Architecture

The Vaultbreaker **Policy Engine** is the deterministic authorization decision framework that enforces administrative guardrails for autonomous AI agent actions. While a **Capability** represents a scoped bearer token assigned to an agent, a **Policy** defines the operational bounds, price ceilings, velocity throttles, time windows, security restrictions, and human escalation criteria under which capabilities may operate.

The central guiding principle is:
> **Agents should have power without having unlimited authority.**

---

## 2. Canonical Policy Data Schema

Vaultbreaker 2.0 formalizes the canonical `SpendPolicy` structure implemented in `broker/src/policy/engine.ts`:

```typescript
export type PolicyEffect = "ALLOW" | "DENY" | "APPROVAL_REQUIRED";

export interface PolicyConditions {
  maxPricePerCall?: number;                                 // Ceiling per individual call (HBAR / Tinybar)
  dailyBudget?: number;                                     // Daily rolling budget ceiling
  maxCallsPerMinute?: number;                               // Velocity rate limit (requests per 60s sliding window)
  allowedHoursUtc?: { startHour: number; endHour: number }; // Permitted UTC operating window (0-23)
  blockedActions?: string[];                                // Explicitly prohibited action names
  blockedResources?: string[];                              // Explicitly prohibited endpoint paths
  requireApprovalAbove?: number;                            // Threshold above which human approval is mandatory
  requireApproval?: boolean;                                // Unconditional human approval requirement flag
  approvalTimeoutSeconds?: number;                          // TTL for pending approval requests (default 900s)
}

export interface SpendPolicy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;                                         // Active enforcement flag
  effect: PolicyEffect;                                     // ALLOW, DENY, or APPROVAL_REQUIRED
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

When a request arrives at the authorization gate, multiple policies may match the request context. The evaluation engine applies four deterministic precedence rules:

1. **Explicit DENY Precedence**:
   - An explicit `DENY` rule **always overrides** both `ALLOW` and `APPROVAL_REQUIRED`.
   - If a guardrail policy specifies `effect: "DENY"` and its conditions match the request context, the request is immediately rejected without escalating to human review.
2. **Priority Ordering**:
   - Policies are ordered by `priority DESC` (higher numbers evaluate first).
   - Higher-priority policies dictate decisions before lower-priority baseline rules.
3. **Escalation Thresholds (`APPROVAL_REQUIRED`)**:
   - If no explicit `DENY` applies, and a policy specifies `requireApprovalAbove` (where `requestedAmount > threshold`) or `requireApproval: true`:
     - If the agent provided no verified approval (`approvalVerified: false`), the outcome is `APPROVAL_REQUIRED`.
     - If the agent provided a cryptographically verified, unconsumed approval (`approvalVerified: true`), the threshold condition is satisfied and execution is allowed.
4. **Capability Baseline Authority**:
   - If no applicable policies target the requested service, agent, or action, the capability's baseline authority is respected (`outcome: "ALLOWED"`, `reasonCode: "AUTHORIZED"`).
5. **Zero Budget Deduction Guarantee**:
   - If any policy evaluation step fails (`allowed: false`) or escalates (`APPROVAL_REQUIRED`), **no budget is ever decremented** from the agent or capability token.

### 3.2 Evaluation Conditions Taxonomy

| Condition | Field | Enforcement Behavior | Reason Code on Violation |
|---|---|---|---|
| **Price Ceiling** | `conditions.maxPricePerCall` | Evaluates requested amount against ceiling. In `DENY` policies, amounts exceeding ceiling trigger rejection. In `ALLOW` policies, calls must remain within ceiling. | `PRICE_LIMIT_EXCEEDED` |
| **Approval Escalation** | `conditions.requireApprovalAbove` | Amounts exceeding the threshold escalate to human operator review. Sub-threshold amounts execute autonomously. | `APPROVAL_REQUIRED` |
| **Velocity Cap** | `conditions.maxCallsPerMinute` | Maintains an in-memory sliding window of timestamps per `agentId:serviceAddress`. Rejects calls exceeding the frequency cap within 60 seconds. | `VELOCITY_LIMIT_EXCEEDED` |
| **UTC Time Window** | `conditions.allowedHoursUtc` | Compares current UTC hour against `[startHour, endHour]`. Rejects off-hours executions (e.g. outside business hours). | `TIME_WINDOW_VIOLATION` |
| **Blocked Actions** | `conditions.blockedActions` | Compares incoming `x-action` header against an explicit blacklist. | `BLOCKED_ACTION` |
| **Blocked Resources** | `conditions.blockedResources` | Compares target endpoint path against prohibited routes. | `BLOCKED_RESOURCE` |
| **Explicit Guardrail** | `effect: "DENY"` | Rejects any request matching targeted agents/services/actions. | `POLICY_DENIED` |

---

## 4. Evaluation Trace & Explainability

Every policy evaluation produces a structured `PolicyEvaluationResult` with an auditable step-by-step trace:

```typescript
export interface PolicyEvaluationResult {
  allowed: boolean;
  decisionId: string;
  outcome: "ALLOWED" | "DENIED" | "APPROVAL_REQUIRED";
  reasonCode:
    | "AUTHORIZED"
    | "APPROVAL_REQUIRED"
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
  requiresApproval?: boolean;
  approvalThreshold?: number;
  approvalTimeoutSeconds?: number;
  evaluationTrace: EvaluationStep[];
  timestamp: string;
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
