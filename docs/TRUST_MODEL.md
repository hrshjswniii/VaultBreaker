# Vaultbreaker 2.0 Trust Model & Security Architecture

## 1. Trust Boundary Classification

The Vaultbreaker security architecture is structured around four strict trust tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. UNTRUSTED ZONE                                                      │
│    · Autonomous AI Agents (Subject to Prompt Injection & LLM Bugs)     │
│    · External Service Endpoints & User Form Inputs                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP Request + x-capability-token
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. PARTIALLY TRUSTED ZONE (Broker & Control Plane)                     │
│    · Next.js Frontend Dashboard                                        │
│    · Express REST API Gateway (/api/metered-service)                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Verified JWT & Memory Budget
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. HIGHLY TRUSTED ZONE (Policy Engine & Hardware Enclave)              │
│    · Policy Engine & JWT Validator                                     │
│    · Ledger KeyRing CLI / Seed Hardware Enclave (`wallet-cli ring`)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Cryptographic Proofs & Hash Sync
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. ROOT OF TRUST (Hedera Blockchain & Smart Contracts)                 │
│    · CapabilityRegistry.sol (On-Chain Budget Accounting)               │
│    · Hedera Consensus Service - HCS (Immutable Audit Trail)            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Categorization Matrix

| Component | Trust Classification | Security Rationale |
|---|---|---|
| **AI Agents** | ❌ **UNTRUSTED** | AI agents are probabilistic LLMs vulnerable to prompt injection, jailbreaks, or code execution bugs. They MUST NEVER hold raw private keys or unconstrained credentials. |
| **External API Inputs** | ❌ **UNTRUSTED** | Prompts, header values, and parameters submitted over HTTP can be malformed or malicious. |
| **Frontend App (`app/`)** | ⚠️ **PARTIALLY TRUSTED** | Client-side JavaScript code runs in the user's browser and can be modified. It cannot be trusted for financial authorization or budget enforcement. |
| **Express Broker (`broker/`)** | ⚠️ **PARTIALLY TRUSTED** | Central control plane. Trusted to route requests, but vulnerable to server compromise or memory resets if unauthenticated. |
| **Policy Engine** | ✅ **TRUSTED** | Evaluates policy rules and enforces memory budget decrements. |
| **Ledger KeyRing (`keyring.ts`)** | ✅ **HIGHLY TRUSTED** | Hardware enclave wrapping `wallet-cli ring`. Ensures raw settlement private keys NEVER enter agent memory or log files. |
| **`CapabilityRegistry.sol`** | 🔒 **ROOT OF TRUST** | On-chain EVM contract enforcing budget limits, expiration timestamps, and revocations in real time. Immutable once deployed. |
| **Hedera HCS Topic** | 🔒 **ROOT OF TRUST** | Tamper-evident, public consensus topic providing immutable event ordering and auditability. |

---

## 3. Core Security Assertions

1. **Assertion 1 (Zero Key Exposure)**: Raw wallet private keys and API master keys MUST NEVER enter agent memory, agent context windows, browser state, or log files. Keys exist ONLY inside the Ledger KeyRing enclave.
2. **Assertion 2 (Server-Side Authorization)**: Authorization decisions MUST occur on the Broker / Smart Contract layer. The frontend UI is purely a presentation layer.
3. **Assertion 3 (Real-Time Rejection)**: When a capability is expired, revoked, or over-budget, the system MUST reject the request BEFORE invoking downstream service logic or decrypting credentials.
4. **Assertion 4 (Service Endpoint Binding)**: A capability token issued for Service A (`0x...04`) MUST NOT be valid for Service B (`0x...05`), preventing credential relay attacks.
