# Vaultbreaker Functionality Matrix

The following matrix documents the verified state of all key features in Vaultbreaker based strictly on code inspection and test execution.

| Feature / Subsystem | Exists | Actually Works | Partially Works | Simulated | Broken | Code & Test Evidence |
|---|---|---|---|---|---|---|
| **Wallet Connection (MetaMask/HashPack)** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ N/A | `wagmi`/`viem` in `package.json`, but zero wallet connection components or hooks in frontend source. |
| **Ledger Hardware CLI Protection** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | Implemented in `broker/src/ledger/keyring.ts`. Probes `wallet-cli --version` and runs CLI encrypt/decrypt. |
| **Ledger Seed Enclave Fallback** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | AES-256-GCM seed fallback in `keyring.ts`. Fully verified in Vitest (`broker.test.ts`). |
| **Agent Creation / Identity** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ N/A | Agents are represented only by string identifiers or JWT payloads; no formal Agent registry exists. |
| **Spend Policy Registration** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | Implemented in `broker/src/policy/engine.ts` (`registerPolicy`) and UI `DeveloperConsole.tsx`. |
| **Capability Token Issuance** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | Implemented in `policy/engine.ts` (`issueCapability`). Mints JWT signed with `JWT_SECRET`. |
| **Capability Revocation (Broker Memory)** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | Implemented in `policy/engine.ts` (`revokeCapability`). Verified in unit & E2E tests. |
| **Capability Revocation (On-Chain)** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | Implemented in `CapabilityRegistry.sol` (`revoke()`). Fully passing in Foundry (`test_SpendRevertsWhenRevoked`). |
| **Capability Expiry (TTL)** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | Checked in broker `/api/metered-service` & contract `spend()`. Passing in Vitest & Foundry. |
| **Budget Enforcement (Broker Memory)** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | Implemented in `policy/engine.ts` (`decrementMemoryBudget`). Fully verified in E2E simulation. |
| **Budget Enforcement (On-Chain EVM)** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | Implemented in `CapabilityRegistry.sol` (`spend()`). Passing 8/8 tests in Foundry. |
| **Broker ↔ On-Chain Synchronization** | ✅ Yes | ❌ No | ✅ Yes | ❌ No | ❌ No | `routes.ts` queries `registryContract.getCapability()`, but `/api/metered-service` does NOT send EVM txs during calls. |
| **x402 Micropayment Execution** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | Implemented at `/api/metered-service`. Checks header `x-capability-token` and returns 402 on budget exhaustion. |
| **Hedera Consensus Service (HCS) SDK** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | Implemented in `broker/src/hedera/hcs.ts` using `@hashgraph/sdk`. Submits topic messages when credentials provided. |
| **HCS Audit Mirror Node Querying** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | `hcs.ts` fetches from `testnet.mirrornode.hedera.com/api/v1/topics/{topic}/messages`. |
| **HCS Audit Local Feed Fallback** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | `inMemoryAuditFeed` saves events locally when operator keys are unconfigured. |
| **Frontend ↔ Broker REST API** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | `app/src/lib/api.ts` connects via HTTP `fetch` to `http://localhost:3001/api`. |
| **Frontend Vercel Offline Demo Fallback** | ✅ Yes | ❌ No | ❌ No | ✅ Yes | ❌ No | Client JS fallback in `api.ts` simulates broker responses completely in-browser when backend is offline. |
| **E2E Simulation Test Script** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | `scripts/e2e-demo-test.ts` executes end-to-end flow cleanly (`npm run test:e2e`). |
