# Vaultbreaker Technical Debt & Improvement Index

## 1. Overview & Categorization

This document categorizes known technical debt across Architecture, Smart Contracts, Backend Broker, Frontend, Security, Testing, Deployment, and UX. Issues are prioritized using:
- **P0**: Critical (Must fix before production or Phase 1 implementation)
- **P1**: Important (High impact architectural or stability enhancement)
- **P2**: Useful (Feature or refactoring improvement)
- **P3**: Polish (Minor UX or code styling cleanup)

---

## 2. Technical Debt Matrix

| Category | Problem | Why It Matters | Evidence | Priority | Suggested Future Direction |
|---|---|---|---|---|---|
| **Architecture** | In-Memory Broker State | Restarting broker wipes policies & capabilities | `policy/engine.ts` uses `Map<string, SpendPolicy>` | **P0** | Integrate persistent storage (PostgreSQL, Redis, or SQLite) |
| **Architecture** | Broker ↔ Contract Desync | HTTP requests don't write spend to EVM | `/api/metered-service` decrements memory only | **P0** | Submit EVM transactions or use state sync relayer |
| **Security** | Unauthenticated Broker Admin APIs | Anyone can mint capabilities / register policies | `routes.ts` lacks auth middleware | **P0** | Add API key / JWT bearer authentication for admin routes |
| **Security** | Hardcoded Fallback Secrets | Insecure defaults for JWT secret & private key | `engine.ts` default strings | **P0** | Enforce environment variable presence on startup |
| **Security** | Shell Injection Risk in KeyRing | `exec` string interpolation in CLI wrapper | `keyring.ts` `execAsync` calls | **P1** | Replace `exec` with `execFile` or native IPC binding |
| **Frontend** | Offline Font Build Failure | `next build` fails offline due to Google Fonts | Next.js build output error log | **P1** | Switch to `next/font/local` or self-hosted fonts |
| **Frontend** | Unused Dependencies | Bundle bloat & misleading capability claims | `wagmi` & `viem` installed but unused | **P2** | Integrate proper EVM wallet connection (RainbowKit/Wagmi) |
| **Frontend** | Silent Mock Degradation | User cannot distinguish live broker from mock store | `api.ts` `mockStore` fallback | **P1** | Add visible banner indicating "Demo Mock Mode Active" |
| **Backend** | Missing Input Validation | Malformed inputs cause unhandled exceptions | `routes.ts` relies on basic `Number()` casts | **P1** | Add `zod` schema validation for all request bodies |
| **Backend** | Missing Rate Limiting | Vulnerable to request flooding DoS | `routes.ts` lacks rate limiters | **P1** | Integrate `express-rate-limit` |
| **Contracts** | Absence of Native Escrow | Contracts track numbers, not locked HBAR/ERC20 | `CapabilityRegistry.sol` | **P2** | Add escrow lock & release functionality to contract |
| **Testing** | Lack of Integration Tests | Frontend API integration not covered by tests | Tests cover contracts & broker unit only | **P2** | Add Playwright / Cypress E2E frontend test suite |
