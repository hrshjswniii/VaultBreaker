# Vaultbreaker 2.0 Target Architecture

## 1. Overview & Architectural Evolution

This document defines the target production architecture for **Vaultbreaker 2.0**, contrasting the current Phase 0 prototype baseline with the target modular state.

---

## 2. Current Architecture vs. Target Architecture Comparison

```
CURRENT ARCHITECTURE (Phase 0 Baseline)
  Developer Console ──> Broker API (Express) ──> Memory State Map (In-Memory RAM)
                             │
                             ├──> Ledger KeyRing (Seed/CLI)
                             ├──> Hedera HCS Audit Logger
                             └──> [Disconnected] CapabilityRegistry.sol (Foundry Unit Tested Only)
```

```
TARGET ARCHITECTURE (Vaultbreaker 2.0)
┌────────────────────────────────────────────────────────────────────────┐
│ 1. PRESENTATION PLANE (Dashboard & Developer Console)                  │
│    · Next.js 16 Web Dashboard (Wagmi / Viem Wallet Connection)         │
│    · CLI Tooling & Agent SDK (Python & TypeScript)                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Admin API / SDK Call
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. CONTROL & AUTHORIZATION PLANE (Broker Microservice)                  │
│    · API Gateway & Auth Middleware (API Keys / JWT Bearer)             │
│    · Policy & Risk Engine (Zod Validation, Rate Limiting, Velocity)    │
│    · Persistence Layer (SQLite / PostgreSQL Database)                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Encrypted Key Ref / On-Chain Relayer
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. SECURITY & ENCLAVE PLANE (Ledger Hardware Key Ring)                │
│    · Ledger KeyRing CLI (`wallet-cli ring`) & Hardware HSM             │
│    · AES-256-GCM In-Memory Credential Decryptor                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ EVM Tx Broadcast & Topic Message
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. SETTLEMENT & AUDIT PLANE (Hedera Network & Smart Contracts)         │
│    · CapabilityRegistry.sol (On-Chain Budget & Expiry Accounting)      │
│    · X402FacilitatorAdapter.sol (Atomic Payment Settlement Gateway)    │
│    · Hedera Consensus Service - HCS (Immutable Audit Feed Topic)       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Evolution Mapping

| Component Layer | Current Phase 0 Prototype | Target Vaultbreaker 2.0 Architecture |
|---|---|---|
| **Broker State Storage** | In-Memory JavaScript `Map<string, IssuedCapability>` (Wiped on restart). | Persistent relational database (SQLite / PostgreSQL) with ORM (Prisma / Drizzle). |
| **Broker Security** | Open Express routes; default HMAC `JWT_SECRET` and private keys in code. | API Key authentication on admin routes; strict environment secret enforcement. |
| **On-Chain Settlement** | Unit-tested contract; broker updates memory budget without EVM txs. | Broker Relayer submits on-chain `spend()` transactions to `CapabilityRegistry.sol`. |
| **Frontend Storage** | Dual-mode mock store (`lib/api.ts`) hiding broker offline failures. | Connected API client with visible status banner ("Broker Online" vs "Offline"). |
| **Wallet Integration** | Installed dependencies (`wagmi`/`viem`) unused in source code. | Full RainbowKit / Wagmi wallet connection for developer policy signing. |
| **Font Dependencies** | Online Google Fonts fetch (`next/font/google`) failing offline. | Local font loading via `next/font/local`. |
| **Audit Logging** | Hedera HCS `@hashgraph/sdk` with mirror node query fallback. | Dual-channel audit: Real-time HCS stream + indexed Mirror Node database relayer. |
| **Input Validation** | Basic type casting (`Number()`). | Strict `zod` request body and header validation schemas. |
