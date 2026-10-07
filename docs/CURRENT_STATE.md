# Vaultbreaker Current State — Repository Inventory

## Overview

Vaultbreaker is an npm monorepo workspace containing a Next.js 16 frontend (`app`), an Express/Node.js TypeScript broker service (`broker`), a set of Solidity smart contracts built with Foundry (`contracts`), and end-to-end test automation scripts (`scripts`).

---

## Repository Directory Tree

```
EthOnline/
├── .env.example                     # Environment variable template with local RPC and key defaults
├── .gitignore                       # Git ignore configuration (node_modules, build artifacts, env files)
├── .gitmodules                      # Git submodule configuration for Foundry libraries (openzeppelin-contracts, forge-std)
├── .vercel/                         # Vercel deployment metadata
├── README.md                        # Project landing document and ETHOnline submission overview
├── package.json                     # Root monorepo configuration with npm workspaces & root scripts
├── package-lock.json                # Root dependency lockfile
├── vercel.json                      # Vercel deployment build override for frontend
├── vaultbreaker cover image.png     # Project branding asset
│
├── app/                             # Next.js 16 App Router Frontend Workspace
│   ├── .env.local                   # Local frontend environment overrides (Vercel CLI output)
│   ├── .gitignore                   # Next.js specific gitignore
│   ├── README.md                    # App sub-package README
│   ├── eslint.config.mjs            # ESLint flat config
│   ├── next-env.d.ts                # Next.js TypeScript ambient type definitions
│   ├── next.config.ts               # Next.js configuration file
│   ├── package.json                 # Frontend dependencies (@tanstack/react-query, lucide-react, viem, wagmi, tailwindcss v4)
│   ├── postcss.config.mjs           # PostCSS configuration for Tailwind CSS v4
│   ├── tsconfig.json                # Frontend TypeScript configuration
│   ├── public/                      # Static assets served by Next.js
│   │   ├── banner.png               # Banner image
│   │   ├── banner-dark.png          # Dark mode banner image
│   │   └── logo.jpg                 # Vaultbreaker logo image
│   └── src/                         # Source code
│       ├── app/
│       │   ├── favicon.ico          # Favicon asset
│       │   ├── globals.css          # CSS styles, glassmorphism card classes, Tailwind v4 imports
│       │   ├── layout.tsx           # Root Next.js layout, Geist font loader, HTML title metadata
│       │   └── page.tsx             # Main dashboard single-page view with tabbed views and hero banner
│       ├── components/
│       │   ├── AgentConsole.tsx     # Simulated agent micropayment terminal component (x402 call tester)
│       │   ├── AuditFeedTimeline.tsx# Live timeline component displaying Hedera HCS audit events
│       │   ├── DeveloperConsole.tsx # Spend policy registration and capability token issuance component
│       │   └── Navbar.tsx           # Header navigation with Ledger status, Hedera badge, tab buttons & dark mode toggle
│       └── lib/
│           └── api.ts               # Typed client library for Broker REST endpoints with Vercel fallback mock store
│
├── assets/                          # Marketing and documentation graphics
│   ├── banner.png                   # High-res banner graphic
│   └── logo.jpg                     # High-res logo graphic
│
├── broker/                          # Express.js / TypeScript Capability Broker Workspace
│   ├── package.json                 # Broker dependencies (@hashgraph/sdk, ethers v6, express, jsonwebtoken, vitest)
│   ├── tsconfig.json                # NodeNext TypeScript compilation rules
│   └── src/
│       ├── index.ts                 # Broker HTTP server entrypoint (Express server on port 3001)
│       ├── api/
│       │   └── routes.ts            # REST API endpoints (/health, /policies, /capabilities, /metered-service, /audit-feed)
│       ├── hedera/
│       │   └── hcs.ts               # Hedera Consensus Service audit logger via @hashgraph/sdk & mirror node fallback
│       ├── ledger/
│       │   └── keyring.ts           # Ledger Key Ring CLI wrapper (`wallet-cli ring`) + AES-256-GCM seed fallback
│       ├── policy/
│       │   └── engine.ts            # Policy registration, capability issuance, JWT signing, memory budget tracking
│       └── test/
│           └── broker.test.ts       # Vitest unit test suite (4 tests for keyring, policy engine, budget, HCS)
│
├── contracts/                       # Foundry Smart Contracts Workspace
│   ├── .gitignore                   # Foundry build artifact gitignore
│   ├── .gitmodules                  # Foundry submodule mapping
│   ├── README.md                    # Foundry standard documentation
│   ├── foundry.lock                 # Dependency lockfile for forge
│   ├── foundry.toml                 # Foundry compiler and profile configuration
│   ├── remappings.txt               # Import remappings for OpenZeppelin and Forge-std
│   ├── lib/                         # Submodules
│   │   ├── forge-std/               # Forge testing utilities standard library
│   │   └── openzeppelin-contracts/  # OpenZeppelin contracts v5.x library
│   ├── script/
│   │   └── Deploy.s.sol             # Forge script for deploying CapabilityRegistry & X402FacilitatorAdapter to Hedera EVM
│   ├── src/
│   │   ├── CapabilityRegistry.sol   # On-chain budget enforcement, capability status tracking, spend/revoke logic
│   │   └── X402FacilitatorAdapter.sol # Payment facilitator interface contract mapping x402 payments to CapabilityRegistry
│   └── test/
│       └── CapabilityRegistry.t.sol # Forge test suite (8 tests covering issuance, spend, revocation, expiry, adapter)
│
└── scripts/                         # Integration and testing scripts
    └── e2e-demo-test.ts             # Standalone end-to-end simulation script validating the full flow
```

---

## Workspace Structure & Purpose

### 1. Root Workspace (`package.json`)
Configures npm workspaces (`"workspaces": ["broker", "app"]`) and top-level CLI commands:
- `npm run build`: Compiles smart contracts via Forge, broker via `tsc`, and frontend via `next build`.
- `npm run test`: Executes contract tests via Forge, broker unit tests via Vitest, and end-to-end simulation via `tsx scripts/e2e-demo-test.ts`.
- `npm run dev`: Runs broker and frontend concurrently.

### 2. Frontend Workspace (`app/`)
A Next.js 16 App Router web application built with React 19 and Tailwind CSS v4. Provides a single-page interactive console allowing users to toggle between:
- **Developer Console**: Policy creation, capability minting, revocation.
- **Agent Console**: Executing pay-per-call x402 micropayments using scoped JWT tokens.
- **HCS Audit Trail**: Reviewing live Hedera Consensus Service timeline logs.

### 3. Broker Workspace (`broker/`)
A Node.js service running Express on port 3001. Acts as the control plane that:
- Wraps the Ledger Key Ring CLI / seed enclave to protect credentials.
- Signs scoped JWT capability tokens for agents.
- Enforces memory budget decrements and expiry checks before calling metered endpoints.
- Submits structured JSON audit messages to Hedera Consensus Service (HCS).
- Connects to `CapabilityRegistry.sol` on Hedera EVM when deployed.

### 4. Smart Contracts Workspace (`contracts/`)
Solidity 0.8.20 smart contracts tested with Foundry:
- `CapabilityRegistry.sol`: On-chain enforcement registry tracking capability hashes, remaining budgets, expiry timestamps, and revocation flags.
- `X402FacilitatorAdapter.sol`: Intermediary adapter allowing authorized payment facilitators to call `registry.spend()` during payment processing.

### 5. Scripts (`scripts/`)
- `e2e-demo-test.ts`: Standalone execution flow test that initializes Ledger KeyRing, HCS Logger, and Policy Engine, issues a capability, performs two valid spends, and asserts that a third over-budget spend is rejected with `INSUFFICIENT_BUDGET`.

---

## Unused, Dead, or Artifact Files

- `app/.env.local`: Contains a temporary Vercel CLI OIDC token (`VERCEL_OIDC_TOKEN`). Not committed in production environments.
- `contracts/out/`, `contracts/cache/`: Local Foundry compilation artifacts.
- `broker/dist/`: Built JavaScript output of the broker workspace.
- `app/.next/`: Next.js build output directory.
