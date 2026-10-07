# Vaultbreaker 2.0 Feature Classification Tiers

## 1. Overview & Classification Strategy

To maintain engineering discipline throughout the rebuild, features are strictly classified into four execution tiers:
- **CURRENT / CORE**: Foundational prototype capabilities established in Phase 0.
- **NEXT**: High-priority architectural and UI enhancements required for Phase 1/2 stability.
- **FUTURE**: Validated long-term roadmap features planned for later phases.
- **EXPERIMENTAL**: Speculative research ideas that MUST NOT distract from current development.

---

## 2. Feature Classification Matrix

```
Vaultbreaker Features
  ├── CURRENT / CORE (Phase 0 Implemented Baseline)
  │     ├── CapabilityRegistry.sol & X402FacilitatorAdapter.sol
  │     ├── Ledger KeyRing CLI + Seed AES-256-GCM Enclave Fallback
  │     ├── Express Broker REST API & Policy Engine
  │     ├── Hedera HCS Audit Logger & Mirror Node Fetcher
  │     └── Next.js 16 Glassmorphism Dashboard & Tabbed Views
  │
  ├── NEXT (Phase 1 / Phase 2 Priorities)
  │     ├── Persistent Broker Database (SQLite / PostgreSQL)
  │     ├── API Key & Bearer Token Auth on Admin Endpoints
  │     ├── Strict Zod Request Validation & Rate Limiting
  │     ├── Broker ↔ Contract On-Chain Transaction Relayer
  │     ├── Local Font Loading (`next/font/local`)
  │     └── Real Web3 Wallet Provider Integration (Wagmi / RainbowKit)
  │
  ├── FUTURE (Validated Roadmap Extensions)
  │     ├── Human Approval Workflows & Threshold Triggers
  │     ├── Agent Identity & Organization Multi-Tenancy
  │     ├── Python & TypeScript Agent SDK Libraries
  │     ├── Multi-Chain EVM Support (Arbitrum, Base, Ethereum)
  │     └── Dedicated HCS Audit Explorer & Search Interface
  │
  └── EXPERIMENTAL (Speculative Research - Do Not Build Yet)
        ├── Zero-Knowledge Capability Proofs (zk-SNARKs)
        ├── Fully Homomorphic Encryption (FHE) Key Rings
        ├── Autonomous Agent-to-Agent Capability Trading
        └── AI Anomaly Detection LLM Guardrails
```

---

## 3. Strict Boundary Rules

1. **No Experimental Features in Core**: Experimental items (zk-proofs, FHE, LLM guardrails) MUST NOT enter main codebase branches until core authorization and persistence are rock-solid.
2. **Phase Order Enforcement**: Features in the **FUTURE** tier MUST NOT be built during Phase 1 or Phase 2.
