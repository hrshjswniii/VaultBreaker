<p align="center">
  <img src="assets/banner.png" alt="Vaultbreaker Banner" width="100%" />
</p>

<h1 align="center">VAULTBREAKER</h1>

<p align="center">
  <strong>Scoped-Capability Broker for Autonomous AI Agents</strong><br/>
  <em>Narrow · Expiring · Revocable · Spend-Limited — Enforced On-Chain in Real Time</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Hedera-Testnet%20EVM-8B5CF6?style=flat-square&logo=hedera&logoColor=white" />
  <img src="https://img.shields.io/badge/Ledger-Key%20Ring%20CLI-000000?style=flat-square&logo=ledger&logoColor=white" />
  <img src="https://img.shields.io/badge/x402-Micropayments-0EA5E9?style=flat-square" />
  <img src="https://img.shields.io/badge/Solidity-0.8.20-363636?style=flat-square&logo=solidity" />
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" />
  <img src="https://img.shields.io/badge/ETHOnline-2026-F59E0B?style=flat-square" />
</p>

---

## What is Vaultbreaker?

Today, any autonomous AI agent that pays for pay-per-call APIs either:

- Holds a **raw private key** in memory or an env file — a compromised agent or prompt injection attack drains the entire wallet.
- Holds a **static API key** — credentials are exfiltrated with no granular spend controls.

**Vaultbreaker** solves this with capability-based security for agentic micropayments:

| Without Vaultbreaker | With Vaultbreaker |
|---|---|
| Agent holds raw private key | Agent holds a short-lived scoped JWT — no key ever |
| All-or-nothing wallet authority | Narrow, spend-limited, expiring capability objects |
| No on-chain enforcement | `CapabilityRegistry.sol` rejects overspend in real time |
| No audit trail | Every event immutably logged to Hedera HCS |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DEVELOPER CONSOLE                      │
│          Register Service Policy · Revoke Capability        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  1. ISSUANCE PLANE  (Node.js / TypeScript Broker)           │
│  · Ledger Key Ring CLI — hardware seed enclave              │
│  · Policy Engine & Scoped JWT Token Issuer                  │
│  · Settlement credentials NEVER enter agent memory          │
└──────────────────────────┬──────────────────────────────────┘
                           │  Issues Scoped JWT
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  2. AUTONOMOUS AI AGENT LOOP                                │
│  · Presents capability token + x402 payment header          │
└──────────────────────────┬──────────────────────────────────┘
                           │  Calls x402-Gated Endpoint
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  3. SETTLEMENT PLANE  (Hedera EVM + x402 Facilitator)       │
│  · CapabilityRegistry.sol — budget & expiry enforcement     │
│  · X402FacilitatorAdapter.sol — atomic payment settlement   │
│  · REAL-TIME REJECTION on budget exhaustion / revocation    │
└──────────────────────────┬──────────────────────────────────┘
                           │  Submits Audit Logs
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  4. AUDIT PLANE  (Hedera Consensus Service — HCS)           │
│  · Immutable topic log: ISSUED · SPENT · REJECTED · REVOKED │
│  · Live frontend timeline + HashScan verification links     │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity `0.8.20`, Foundry, OpenZeppelin `5.x` |
| Settlement & Audit | Hedera Testnet EVM (Chain ID `296`), `@hashgraph/sdk`, HCS |
| Hardware Security | Ledger Key Ring CLI (`wallet-cli ring`), AES-256-GCM seed enclave |
| Broker Service | Node.js, TypeScript, Express, Ethers.js `v6`, Vitest |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4 |

---

## Sponsor Integrations

### Ledger — Root of Trust
- **Role:** Protects settlement credentials from ever reaching agent memory.
- **Implementation:** [`broker/src/ledger/keyring.ts`](broker/src/ledger/keyring.ts) — integrates `wallet-cli ring encrypt/decrypt`. Falls back to seed-derived AES-256-GCM when hardware CLI is unavailable.
- **Track:** Ledger AI & Hardware Security — raw private keys never enter agent context.

### Hedera — Settlement Rail + Audit
- **Role:** EVM contract host for on-chain budget enforcement and HCS tamper-evident audit trail.
- **Implementation:**
  - [`contracts/src/CapabilityRegistry.sol`](contracts/src/CapabilityRegistry.sol) — on-chain budget accounting, expiry, and revocation.
  - [`contracts/src/X402FacilitatorAdapter.sol`](contracts/src/X402FacilitatorAdapter.sol) — atomic x402 payment settlement.
  - [`broker/src/hedera/hcs.ts`](broker/src/hedera/hcs.ts) — `@hashgraph/sdk` topic message submission.
- **Network:** Hedera Testnet · Chain ID `296` · RPC `https://testnet.hashio.io/api`

---

## Smart Contracts

| Contract | Description |
|---|---|
| `CapabilityRegistry.sol` | Tracks `budgetRemaining`, `expiry`, `revoked` per capability hash. Emits `CapabilitySpent`, `CapabilityRejected` events. |
| `X402FacilitatorAdapter.sol` | Authorized facilitator that calls `registry.spend()` atomically on each x402 payment. |

**Deploy to Hedera Testnet:**
```bash
npm run deploy:contracts
```

---

## Project Structure

```
EthOnline/
├── app/                        # Next.js 16 frontend
│   └── src/
│       ├── app/                # App Router (layout, page, globals.css)
│       ├── components/         # DeveloperConsole, AgentConsole, AuditFeedTimeline, Navbar
│       └── lib/api.ts          # Typed broker API client
├── broker/                     # Node.js/TypeScript broker service (port 3001)
│   └── src/
│       ├── ledger/keyring.ts   # Ledger Key Ring CLI wrapper + AES-256-GCM fallback
│       ├── hedera/hcs.ts       # Hedera HCS audit logger
│       ├── policy/engine.ts    # Policy & capability management
│       └── api/routes.ts       # Express REST API
├── contracts/                  # Foundry smart contracts
│   ├── src/                    # CapabilityRegistry.sol, X402FacilitatorAdapter.sol
│   ├── test/                   # Foundry tests (8/8 passing)
│   └── script/Deploy.s.sol     # Deployment script
└── scripts/e2e-demo-test.ts    # Full end-to-end simulation
```

---

## Local Setup

### Prerequisites
- Node.js `v20+`
- Foundry (`forge`) on PATH

### 1. Install
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Key variables:
```env
HEDERA_JSON_RPC_URL=https://testnet.hashio.io/api
HEDERA_CHAIN_ID=296
HEDERA_OPERATOR_ID=0.0.YOUR_ACCOUNT
HEDERA_OPERATOR_KEY=YOUR_ECDSA_KEY
HEDERA_HCS_TOPIC_ID=0.0.YOUR_TOPIC
NEXT_PUBLIC_BROKER_URL=http://localhost:3001
```

### 3. Run Tests
```bash
npm run test:contracts   # Foundry — 8/8 passing
npm run test:broker      # Vitest — 4/4 passing
npm run test:e2e         # Full end-to-end simulation
```

### 4. Start Dev Environment
```bash
npm run dev
# Broker → http://localhost:3001
# Frontend → http://localhost:3000
```

---

## Demo Walkthrough

### Step 1 — Developer Console
- Register a metered API policy (e.g. Max Call: `10 HBAR`, Daily Budget: `25 HBAR`).
- Click **Issue Token to Agent**. The underlying private key is encrypted by Ledger Key Ring — the agent receives only a scoped JWT.

### Step 2 — Agent Console
- Select the issued capability token.
- Submit two agent requests (spending `10 HBAR` each). Budget reaches `0 HBAR`.

### Step 3 — The Rejection Moment ⚡
- Submit a third request.
- A **REJECTED ON-CHAIN IN REAL-TIME** alert fires instantly.
- Confirms: HTTP 402, `INSUFFICIENT_BUDGET`, zero credential leakage, HCS audit event written.

### Step 4 — HCS Audit Trail
- Switch to the **HCS Audit Trail** tab.
- View the live timeline with sequence numbers and HashScan verification links.

---

## API Reference (Broker — port 3001)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Keyring status & broker health |
| `GET` | `/api/policies` | List registered service policies |
| `POST` | `/api/policies` | Register a new spend policy |
| `POST` | `/api/capabilities/issue` | Issue a scoped capability token |
| `GET` | `/api/capabilities` | List all issued capabilities |
| `POST` | `/api/capabilities/revoke` | Revoke a capability on-chain |
| `POST` | `/api/metered-service` | Execute an x402-gated metered call |
| `GET` | `/api/audit-feed` | Fetch HCS audit event timeline |

---

## AI Usage Disclosure

Per ETHGlobal submission guidelines: AI coding tools were used for boilerplate setup, TypeScript typing, and CSS layout. All contract invariants, budget enforcement logic, Ledger Key Ring wrappers, and Hedera SDK integrations were verified and tested manually with Foundry and Vitest.

---

<p align="center">
  <strong>Vaultbreaker</strong> · ETHOnline 2026 Submission<br/>
  Powered by <strong>Hedera Testnet EVM + HCS</strong> &amp; <strong>Ledger Key Ring CLI</strong>
</p>
