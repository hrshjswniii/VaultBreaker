# Vaultbreaker Broker / Backend Audit

## 1. Overview & Entrypoint

The broker backend is an Express.js application written in TypeScript (`broker/src/index.ts`). It runs on port `3001` (configurable via `PORT` env variable) and acts as the central control plane connecting the frontend, Ledger KeyRing protection, Hedera Consensus Service, and capability policy engine.

---

## 2. API Endpoint Specification

### `GET /api/health`
- **Purpose**: System health check & Ledger KeyRing availability status.
- **Input**: None.
- **Output**: `{ status: "ok", service: "...", keyring: LedgerKeyRingStatus, topicId: string, contractAddress: string, timestamp: string }`.
- **Auth / Authz**: None.
- **Side Effects**: Executes shell command `wallet-cli --version` to probe hardware status.

### `GET /api/policies`
- **Purpose**: List registered metered service policies.
- **Input**: None.
- **Output**: Array of `SpendPolicy` objects.
- **Auth / Authz**: None.

### `POST /api/policies`
- **Purpose**: Register a new metered spend policy.
- **Input**: `{ name, serviceEndpoint, serviceAddress, maxPricePerCall, dailyBudget, ttlSeconds }`.
- **Output**: Created `SpendPolicy` object (status 201).
- **Auth / Authz**: None (Open endpoint in current prototype).
- **Validation**: Basic numeric type casting; missing robust schema validation.

### `POST /api/capabilities/issue`
- **Purpose**: Mint a short-lived scoped JWT capability token backed by Ledger seed encryption.
- **Input**: `{ policyId, requestedBudget?, requestedTtlSeconds?, settlementCredentialSecret? }`.
- **Output**: Created `IssuedCapability` object (status 201).
- **Auth / Authz**: None.
- **Side Effects**: Encrypts secret via `keyring.encryptCredential()`, signs JWT with `JWT_SECRET`, and submits `CAPABILITY_ISSUED` audit message to Hedera HCS.

### `GET /api/capabilities`
- **Purpose**: List all issued capabilities.
- **Input**: None.
- **Output**: Array of `IssuedCapability` objects.
- **Auth / Authz**: None.

### `GET /api/capabilities/:capId`
- **Purpose**: Inspect state of a specific capability.
- **Input**: `capId` in route parameter.
- **Output**: `IssuedCapability` merged with on-chain data if `CONTRACT_CAPABILITY_REGISTRY` is configured.
- **Auth / Authz**: None.

### `POST /api/capabilities/revoke`
- **Purpose**: Revoke an active capability token.
- **Input**: `{ capId }`.
- **Output**: `{ success: true, capId, message: "..." }`.
- **Auth / Authz**: None.
- **Side Effects**: Updates in-memory revoked flag and submits `CAPABILITY_REVOKED` message to Hedera HCS.

### `POST /api/metered-service`
- **Purpose**: Simulated x402-gated metered API service endpoint (e.g. AI Text Summarizer).
- **Input**: Headers `x-capability-token` (JWT), `x-payment-amount` (default 10). Body `{ prompt }`.
- **Output**:
  - `200 OK`: Gated response data + micropayment audit receipt.
  - `401 Unauthorized`: Missing header or invalid JWT signature.
  - `402 Payment Required`: `INSUFFICIENT_BUDGET` or `CAPABILITY_EXPIRED`.
  - `403 Forbidden`: `CAPABILITY_REVOKED`.
  - `404 Not Found`: Unknown `capId`.
- **Side Effects**: Decrements memory budget, decrypts settlement credential in memory using Ledger KeyRing, logs audit event to Hedera HCS.

### `GET /api/audit-feed`
- **Purpose**: Fetch timeline of HCS audit log events for frontend display.
- **Input**: Query parameter `topicId` (optional).
- **Output**: Array of `HCSAuditEvent` objects.
- **Side Effects**: Fetches from Hedera Mirror Node API if operator topic set, otherwise returns in-memory feed.

---

## 3. Subsystem Deep-Dives

### A. Ledger Key Ring (`broker/src/ledger/keyring.ts`)
- Spikes shell command `wallet-cli --version`.
- If CLI exists, delegates encryption/decryption to `wallet-cli ring encrypt/decrypt`.
- If CLI does not exist, uses Node `crypto` AES-256-GCM encryption with a master key derived via SHA-256 from `HEDERA_OPERATOR_KEY` or default seed string.

### B. Policy Engine (`broker/src/policy/engine.ts`)
- Seeds a default policy (`pol_ai_summarizer_v1`) on startup.
- Computes `policyHash` using `ethers.keccak256`.
- Mints JWT tokens signed with symmetric secret `JWT_SECRET`.
- Manages memory budget decrement via `decrementMemoryBudget()`.

### C. Hedera HCS Logger (`broker/src/hedera/hcs.ts`)
- Initializes `@hashgraph/sdk` `Client.forTestnet()` if `HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_KEY` are provided.
- Submits JSON payloads using `TopicMessageSubmitTransaction`.
- Maintains an `inMemoryAuditFeed` fallback array for instant local mirror feed querying when offline.

---

## 4. Operational & Security Deficiencies in Current Backend

1. **Hardcoded Fallback JWT Secret**: Uses `"vaultbreaker-broker-jwt-signing-secret-2026"` if `JWT_SECRET` env is omitted.
2. **Hardcoded Private Key Fallback**: Uses `"0x0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff"` as default credential in `issueCapability` if no secret or `DEPLOYER_PRIVATE_KEY` is supplied.
3. **No Auth/Authz on Admin Endpoints**: `/api/policies` and `/api/capabilities/issue` can be invoked by any HTTP client without authentication.
4. **No Rate Limiting**: Absence of Express rate limiter (`express-rate-limit`) makes `/api/metered-service` vulnerable to DoS.
5. **In-Memory Volatility**: Restarting the Node process clears registered policies and capability tokens.
