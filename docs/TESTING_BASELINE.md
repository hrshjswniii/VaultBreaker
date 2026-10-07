# Vaultbreaker Testing Baseline

## 1. Summary of Execution Results

All existing test suites and build scripts were executed locally in a read-only, non-destructive manner.

| Suite / Target | Command | Result | Pass Count | Fail Count | Skipped | Notes |
|---|---|---|---|---|---|---|
| **Smart Contracts** | `npm run test:contracts` | **PASS** | 8 | 0 | 0 | Executed via Forge (`forge test -vvv`). 100% passing in 44ms. |
| **Broker Backend** | `npm run test:broker` | **PASS** | 4 | 0 | 0 | Executed via Vitest (`vitest run`). 100% passing. |
| **End-to-End Simulation** | `npm run test:e2e` | **PASS** | 1 | 0 | 0 | Executed via `tsx scripts/e2e-demo-test.ts`. Validated real-time 402 rejection. |
| **Broker TypeScript Build** | `npm run build:broker` | **PASS** | N/A | 0 | 0 | Executed via `tsc`. Compiled cleanly into `broker/dist`. |
| **Frontend Next.js Build** | `npm run build:app` | **FAIL (Offline Font Fetch)** | 0 | 1 | 0 | Turbopack compilation succeeds, but fails font fetch from `fonts.googleapis.com` in offline environments. |

---

## 2. Smart Contract Coverage Breakdown (`forge test`)

Suite: `CapabilityRegistryTest` (`contracts/test/CapabilityRegistry.t.sol`)

- `test_IssueCapability()` — **PASS**: Verifies `issueCapability()` sets policyHash, service, budgetRemaining, expiry, issuer, and revoked=false.
- `test_SpendUntilBudgetExhausted()` — **PASS**: Verifies multiple partial spends until remaining budget is zero, and asserts `InsufficientBudget` revert on overspend.
- `test_SpendRevertsWhenExpired()` — **PASS**: Uses `vm.warp()` to advance block timestamp past expiry and asserts `CapabilityExpired` revert.
- `test_SpendRevertsWhenRevoked()` — **PASS**: Verifies issuer revocation sets `revoked=true` and asserts `CapabilityRevokedError` revert on spend attempt.
- `test_UnauthorizedCallerCannotSpend()` — **PASS**: Verifies non-facilitator caller reverts with `UnauthorizedCaller`.
- `test_ExactAccountingMultiplePartialSpends()` — **PASS**: Verifies exact array of spend amounts `[123, 456, 200, 221]` decrements remaining budget to exactly 0.
- `test_AdapterProcessPaymentAndSpend()` — **PASS**: Verifies `X402FacilitatorAdapter.processPaymentAndSpend()` properly forwards spend to registry.
- `test_AdapterRevertsOnServiceMismatch()` — **PASS**: Verifies adapter reverts with `SERVICE_MISMATCH` if requested service endpoint does not match capability binding.

---

## 3. Broker Unit Test Coverage (`vitest run`)

Suite: `broker.test.ts` (`broker/src/test/broker.test.ts`)

- `should initialize Ledger Key Ring and encrypt/decrypt credentials safely` — **PASS**: Asserts AES-256-GCM fallback encryption and decryption return exact plaintext secret.
- `should issue scoped capability token backed by Ledger Key Ring` — **PASS**: Asserts capId generation, budget initialization, and token minting.
- `should enforce real-time budget exhaustion rejection` — **PASS**: Asserts `decrementMemoryBudget()` throws `INSUFFICIENT_BUDGET` error on 3rd call.
- `should record HCS audit log events cleanly` — **PASS**: Asserts audit event logging and retrieval from `inMemoryAuditFeed`.

---

## 4. End-to-End Simulation Script (`scripts/e2e-demo-test.ts`)

Simulates a full 5-step lifecycle:
1. Initialize Ledger KeyRing (detects `SIMULATED_KEYRING`).
2. Initialize Hedera HCS Logger (detects local mirror mode).
3. Issue Capability Token for policy `AI Inference & Text Summarization API` (budget: 25 HBAR).
4. Execute metered calls:
   - Call #1 (Spend 10 HBAR -> Remaining: 15 HBAR).
   - Call #2 (Spend 15 HBAR -> Remaining: 0 HBAR).
5. Attempt Call #3 (Charge 10 HBAR -> Catches `INSUFFICIENT_BUDGET` exception, asserts real-time rejection, logs audit event).

---

## 5. Build Failure Analysis: Frontend Font Fetch

### Root Cause
During `npm run build:app` (`next build`), Next.js font optimization (`next/font/google`) attempts to fetch the font files for `Geist` and `Geist Mono` directly from Google Fonts (`https://fonts.googleapis.com/css2?...`). When building in an offline or restricted network environment, Turbopack throws a build error:
```
Error: Failed to fetch Geist from Google Fonts. If you are offline or behind a proxy, self-host the font with next/font/local...
```

### Impact & Recommendation
- **Impact**: Production build command fails when internet connectivity is restricted.
- **Recommendation for Phase 1**: Replace `next/font/google` with local font files using `next/font/local` or supply fallback font definitions.
