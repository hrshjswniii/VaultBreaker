# Phase 6 Implementation Report: Policy Engine & Authorization Decision System

## Executive Summary

Phase 6 turns Vaultbreaker's security guardrails into a deterministic, explainable, and production-ready **Policy Engine & Authorization Decision System**. Building directly upon the foundation of Phase 4 (Agent Lifecycle & Management) and Phase 5 (Capability Lifecycle & Permission Management), Phase 6 introduces:
- A canonical, typed policy model with operational conditions, enabled/disabled state, and versioning.
- A deterministic server-side policy evaluator enforcing precedence (explicit `DENY` rules strictly override `ALLOW` rules), priority ordering, price ceilings, sliding-window velocity caps (`maxCallsPerMinute`), UTC time-of-day windows, and blocked actions/resources.
- Seamless integration into Stage 6 of the authorization pipeline (`POST /api/metered-service`) with a strict **zero budget deduction guarantee** on policy rejection.
- A comprehensive REST API for policy lifecycle management (`GET`, `POST`, `PATCH`, `POST /toggle`, `POST /evaluate`).
- Real-time audit event logging to the Hedera Consensus Service (HCS) for policy registration, updates, toggles, and evaluations.
- An interactive UI overhaul in `PoliciesView.tsx` featuring an integrated **Dry-Run Policy Evaluator Sandbox**, live rule toggle, and creation modal.
- 100% test pass rate across 23 new Phase 6 unit/integration tests (62 total Vitest tests), 8 Foundry contract tests, and end-to-end integration tests.

---

## 1. Architectural Changes & Domain Models

### 1.1 Canonical Policy Model (`broker/src/policy/engine.ts`)

```typescript
export type PolicyEffect = "ALLOW" | "DENY";

export interface PolicyConditions {
  maxPricePerCall?: number;                                 // Ceiling per individual call
  dailyBudget?: number;                                     // Daily rolling budget limit
  maxCallsPerMinute?: number;                               // Sliding window velocity cap (requests / 60s)
  allowedHoursUtc?: { startHour: number; endHour: number }; // Time-of-day window (0-23 UTC)
  blockedActions?: string[];                                // Blacklisted action names
  blockedResources?: string[];                              // Blacklisted endpoint routes
}

export interface SpendPolicy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;                                         // Active enforcement flag
  effect: PolicyEffect;                                     // ALLOW or DENY
  priority: number;                                         // Higher number = higher precedence (default: 100)
  serviceEndpoint: string;                                  // Target endpoint
  serviceAddress: string;                                   // Target service address or "*"
  maxPricePerCall: number;                                  // Shorthand compatibility
  dailyBudget: number;                                      // Shorthand compatibility
  ttlSeconds: number;                                       // Default TTL for capability issuance
  conditions?: PolicyConditions;                            // Typed rule criteria
  applicableAgents?: string[];                              // Target agent IDs (empty = all)
  applicableServices?: string[];                            // Target service addresses (empty = all)
  applicableActions?: string[];                             // Target actions (empty = all)
  version: number;                                          // Incremented on every mutation/toggle
  createdAt: string;
  updatedAt: string;
}
```

### 1.2 Evaluation Result & Audit Schemas

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

---

## 2. Server-Side Policy Evaluator & Precedence Engine

The core evaluation logic in `evaluatePolicies(context, customNow?)` applies the following deterministic resolution pipeline:

1. **Applicability Filtering**:
   - Disabled policies (`enabled: false`) are recorded in the trace as `SKIPPED` and ignored.
   - Policies targeting specific agents (`applicableAgents`), services (`applicableServices` / `serviceAddress`), or actions (`applicableActions`) are matched against the evaluation context.
2. **Capability Baseline Authority**:
   - If no applicable policies exist, the request passes with `NO_APPLICABLE_POLICY`, preserving capability baseline authority.
3. **Priority Ordering**:
   - Applicable policies are sorted by `priority DESC`.
4. **Condition Verification**:
   - **Action Blacklist**: If `conditions.blockedActions` contains the requested action, immediately rejects with `BLOCKED_ACTION`.
   - **Resource Blacklist**: If `conditions.blockedResources` contains the target resource, immediately rejects with `BLOCKED_RESOURCE`.
   - **UTC Operating Window**: If `conditions.allowedHoursUtc` is specified, verifies the current UTC hour falls within `[startHour, endHour]`. Rejects off-hours executions with `TIME_WINDOW_VIOLATION`.
   - **Price Ceiling**: Checks requested amount against `conditions.maxPricePerCall`. Rejects calls exceeding the limit with `PRICE_LIMIT_EXCEEDED`.
   - **Velocity Throttling**: Checks sliding 60-second window in `velocityTracker`. Rejects calls exceeding `maxCallsPerMinute` with `VELOCITY_LIMIT_EXCEEDED`.
5. **Conflict Resolution (DENY Precedence)**:
   - If a matching policy specifies `effect: "DENY"`, it triggers rejection with `POLICY_DENIED`. Explicit `DENY` takes precedence over all `ALLOW` rules.
6. **Zero Budget Deduction Guarantee**:
   - Evaluated before `decrementMemoryBudget`. If authorization fails, the capability's remaining budget is completely untouched.

---

## 3. Unified Authorization Pipeline Integration

In `broker/src/api/routes.ts`, `POST /api/metered-service` implements the full 7-stage security gate:

- **Stage 1**: JWT signature verification & claims parsing.
- **Stage 2**: Capability expiration verification (`now < expiry`).
- **Stage 3**: Authoritative revocation verification (`revoked == false`).
- **Stage 4**: Agent lifecycle authorization gate (`agent.status == "ACTIVE"`, rejects `SUSPENDED` and `REVOKED`).
- **Stage 5**: Least-privilege action and resource scope binding checks.
- **Stage 6**: **Deterministic Policy Engine Evaluation** (`evaluatePolicies(...)`). On denial, returns HTTP 403 with `evaluationTrace` and logs to HCS; budget remains untouched.
- **Stage 7**: Budget deduction (`budgetRemaining -= amount`), in-memory Ledger KeyRing credential decryption, and metered execution.

---

## 4. REST API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/policies` | List all registered policies with conditions and status. |
| `GET` | `/api/policies/:id` | Fetch single policy details. |
| `POST` | `/api/policies` | Register a new policy with typed conditions and version tracking. |
| `PATCH` | `/api/policies/:id` | Mutate policy properties or conditions; increments `version`. |
| `POST` | `/api/policies/:id/toggle` | Toggle `enabled` state; increments `version`. |
| `POST` | `/api/policies/evaluate` | Dry-run pre-execution simulation sandbox returning evaluation trace without executing services or decrementing budget tokens. |

---

## 5. Frontend UI & Dry-Run Sandbox

`app/src/components/PoliciesView.tsx` was enhanced with:
- **Policy Metrics Row**: Total policies, active policies, deny guardrails count, and maximum priority level.
- **Interactive Dry-Run Sandbox**: Real-time evaluator allowing operators to test hypothetical calls with configurable agent, service address, action, resource path, and amount. Displays structured decisions (`ALLOWED` / `DENIED`), reason codes, and step-by-step trace timeline pills.
- **Card-Level Controls**: Live `ACTIVE` / `DISABLED` power toggle button, priority badges, version tags, and conditions summary.
- **Register Policy Modal**: Form to define typed conditions (max price, daily budget, velocity cap, UTC time window, blocked actions, blocked resources, priority, effect).

---

## 6. Verification & Test Evidence

### 6.1 Broker Vitest Test Suite (`broker/src/test/policy.test.ts`)
Total of **23 new tests** covering:
- **A. Canonical Policy Data Schema & Lifecycle**:
  - `POST /api/policies`: creates policy with typed conditions, priority, effect, and version 1.
  - `GET /api/policies/:id`: retrieves registered policy.
  - `PATCH /api/policies/:id`: updates conditions and increments version.
  - `POST /api/policies/:id/toggle`: toggles enabled status and increments version.
- **B. Deterministic Rule Evaluator**:
  - Allows valid request when conditions pass.
  - Rejects request exceeding price ceiling (`PRICE_LIMIT_EXCEEDED`).
  - Rejects request outside permitted UTC hours (`TIME_WINDOW_VIOLATION`).
  - Rejects request with prohibited action (`BLOCKED_ACTION`).
  - Rejects request with prohibited resource (`BLOCKED_RESOURCE`).
  - Enforces sliding-window velocity rate limit (`VELOCITY_LIMIT_EXCEEDED`).
  - Enforces precedence: explicit `DENY` overrides `ALLOW`.
  - Respects higher priority policy over lower priority policy.
  - Ignores disabled policy rules.
- **C. Unified Authorization Pipeline Integration**:
  - Allows metered request and decrements budget when policy checks pass.
  - Rejects request when policy ceiling is violated and **preserves remaining budget untouched**.
  - Rejects request when explicit DENY policy is registered and preserves budget.
  - Resumes allowed execution when DENY policy is toggled to disabled.
  - Prevents forged client-supplied policy IDs from bypassing policy evaluation.
- **D. Dry-Run Policy Evaluation Endpoint**:
  - `POST /api/policies/evaluate` returns ALLOWED with detailed trace.
  - `POST /api/policies/evaluate` returns DENIED with primary reason and step trace.

### 6.2 Test Execution Results

```
Test Files  4 passed (4)
     Tests  62 passed (62)
  - broker.test.ts:     4 passed
  - agent.test.ts:     15 passed
  - capability.test.ts: 20 passed
  - policy.test.ts:    23 passed
```

### 6.3 Smart Contracts & E2E Verification
- `npm run test:contracts`: 8/8 Foundry tests passed (`CapabilityRegistryTest`).
- `npm run test:e2e`: End-to-end simulation passing with real-time on-chain rejection.
- `npm run build:broker`: TypeScript compilation succeeded with zero errors.
- `npm run build:app`: Next.js production build succeeded with zero errors.

---

## 7. Modular Git Commit Plan

1. **`feat(policy): implement canonical spend policy model and typed conditions`**
   - Core data structures in `broker/src/policy/engine.ts` (`SpendPolicy`, `PolicyEffect`, `PolicyConditions`, `PolicyEvaluationResult`, `EvaluationStep`).
2. **`feat(policy): implement deterministic policy evaluator with precedence and velocity limits`**
   - Precedence resolution, sliding-window rate limit tracker (`velocityTracker`), UTC operating windows, and blacklist checks.
3. **`feat(api): integrate policy engine evaluation gate into metered service pipeline`**
   - Stage 6 policy evaluation in `broker/src/api/routes.ts`, zero budget deduction guarantee, policy CRUD, toggle, and dry-run evaluation endpoints.
4. **`feat(audit): add policy lifecycle and evaluation events to HCS audit logger`**
   - Expand `HCSAuditEvent` in `broker/src/hedera/hcs.ts` and `app/src/lib/api.ts` with `POLICY_REGISTERED`, `POLICY_UPDATED`, `POLICY_TOGGLED`, and `POLICY_EVALUATED`.
5. **`test(policy): add comprehensive Vitest test suite for policy evaluation and authorization`**
   - 23 unit and integration tests in `broker/src/test/policy.test.ts`.
6. **`feat(ui): update PoliciesView with dry-run sandbox, status toggle, and registration modal`**
   - Frontend API client helpers in `app/src/lib/api.ts` and interactive UI overhaul in `app/src/components/PoliciesView.tsx`.
7. **`docs(policy): update policy, authorization, audit models, and roadmap for Phase 6`**
   - Update `docs/POLICY_MODEL.md`, `docs/AUTHORIZATION_FLOW.md`, `docs/AUDIT_MODEL.md`, `docs/FUNCTIONALITY_MATRIX.md`, `docs/ROADMAP.md`, and add `docs/PHASE_6_REPORT.md`.
