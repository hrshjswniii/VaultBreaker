# Vaultbreaker Security Baseline

> [!NOTE]
> This document represents a preliminary security audit and threat model baseline of the current Vaultbreaker codebase. It is NOT a formal security audit. Findings are based on static code analysis and execution flow analysis.

---

## 1. Threat Model & Security Claims vs Realities

| Vaultbreaker Security Claim | Actual Repository Implementation | Risk Rating |
|---|---|---|
| *"Raw private keys never enter agent memory"* | **TRUE**. Agent only receives scoped JWT token (`token`). Broker holds settlement credentials. | ✅ **Low** |
| *"Credentials protected by Ledger KeyRing hardware enclave"* | **PARTIAL**. Operates via `wallet-cli` if present, but falls back to in-memory AES-256-GCM using environment key string. | ⚠️ **Medium** |
| *"On-chain budget enforcement in real-time"* | **PARTIAL**. On-chain enforcement logic exists in `CapabilityRegistry.sol`, but HTTP requests to `/api/metered-service` enforce budget in **Node.js memory only** without EVM txs. | ⚠️ **Medium** |
| *"Tamper-evident audit logging"* | **TRUE**. Logged to Hedera HCS topic via `@hashgraph/sdk` or mirrored locally. | ✅ **Low** |

---

## 2. Critical & High Security Risks

### 1. Hardcoded Default Secrets in Source Code
- **Location**: `broker/src/policy/engine.ts` (L32, L119)
- **Detail**:
  - `JWT_SECRET` defaults to `"vaultbreaker-broker-jwt-signing-secret-2026"`.
  - Fallback settlement credential defaults to `"0x0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff"`.
- **Impact**: Any attacker who knows these default strings can mint valid JWT capability tokens and pass verification without going through authorization checks.

### 2. Unauthenticated Administrative Endpoints
- **Location**: `broker/src/api/routes.ts`
- **Detail**: `/api/policies` (`POST`), `/api/capabilities/issue` (`POST`), and `/api/capabilities/revoke` (`POST`) require zero API keys, bearer tokens, or signatures.
- **Impact**: Any unauthenticated network client can issue unlimited capability tokens or revoke existing capabilities.

### 3. Lack of Rate Limiting & DoS Vulnerability
- **Location**: `broker/src/api/routes.ts` (`POST /api/metered-service`)
- **Detail**: Endpoint executes JWT verification, AES decryption, and HCS logging on every HTTP request without rate limiting.
- **Impact**: An attacker can spam requests to exhaust broker CPU, memory, or Hedera operator account balance.

---

## 3. Medium & Low Security Risks

### 4. Memory Budget State Volatility & Desynchronization
- **Location**: `broker/src/policy/engine.ts`
- **Detail**: Capability remaining budgets are stored in an in-memory TypeScript `Map`.
- **Impact**: Server restart resets remaining budgets to initial amounts unless persisted, creating a potential double-spend / budget reset vector.

### 5. Insecure Command Execution in Ledger Wrapper
- **Location**: `broker/src/ledger/keyring.ts` (L31, L59, L88)
- **Detail**: Uses `child_process.exec` with string interpolation (`"${this.cliPath}" ring encrypt "${plainTextCredential}"`).
- **Impact**: Potential shell injection vulnerability if `cliPath` or `plainTextCredential` contain unescaped shell metacharacters.

### 6. Weak Random Nonce in Capability Hashing
- **Location**: `broker/src/policy/engine.ts` (L109)
- **Detail**: Generates `nonceHex = crypto.randomBytes(16).toString("hex")` instead of cryptographically binding to a sequential on-chain nonce.

---

## 4. Solidity Contract Security Review

- **Reentrancy**: `CapabilityRegistry.sol` does not make external call invocations or transfer native ETH/HBAR, eliminating reentrancy risk in its current state.
- **Access Control**: `onlyFacilitator` modifier correctly restricts `spend()` to `authorizedFacilitators` and contract owner.
- **Overflow / Underflow**: Controlled by Solidity `0.8.20` default compiler checks (`cap.budgetRemaining -= amount`).
- **Replay Protection**: `capId` includes `nonce` and `block.chainid`.
