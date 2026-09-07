# Vaultbreaker — Scoped-Capability Broker for AI Agents

> **Vaultbreaker** is a scoped-capability broker that enables autonomous AI agents to pay for metered Web3 APIs and services without ever touching a raw private key or unencrypted credential. Powered by **Ledger hardware seed encryption** and **Hedera on-chain budget enforcement + HCS audit trails**, Vaultbreaker turns dangerous all-or-nothing wallet authority into narrow, expiring, revocable, and spend-limited capability objects enforced on-chain in real time.

---

## 1. Problem & Solution

### The Problem
Today, any autonomous AI agent that pays for pay-per-call APIs or services either:
1. Holds a raw private key in memory or an env file — enabling a compromised agent or prompt injection attack to drain the entire wallet.
2. Holds a static API key — exposing credentials to exfiltration and abuse with no granular spend controls.

### The Solution
Vaultbreaker introduces capability-based security to agentic micropayments (x402 protocol):
- **Ledger Hardware Seed Root of Trust:** The broker uses Ledger Key Ring CLI (`wallet-cli ring`) to encrypt and protect underlying settlement credentials. The agent receives only a short-lived, signed capability token.
- **On-Chain Budget Accounting & Enforcement:** `CapabilityRegistry.sol` deployed on Hedera Testnet tracks remaining spend budgets and expiration timestamps. If an agent attempts to spend past its budget or after revocation, the transaction is rejected **on-chain in real time**.
- **Tamper-Evident HCS Audit Feed:** Every issuance, spend, revocation, and rejection event is written to a Hedera Consensus Service (HCS) topic, providing an immutable audit trail for developers and judges.

---

## 2. System Architecture

Vaultbreaker is structured into three logical planes:

```
                  +---------------------------------------------------+
                  |                 DEVELOPER CONSOLE                 |
                  |  (Register Service Policy / Revoke Capability)    |
                  +-------------------------+-------------------------+
                                            |
                                            v
+-----------------------------------------------------------------------------------+
| 1. ISSUANCE PLANE (Node.js/TS Broker)                                             |
|   - Ledger Key Ring CLI (`wallet-cli ring` / Hardware Seed Enclave)               |
|   - Policy Engine & Scoped Token Issuer                                           |
|   - Keeps settlement credentials encrypted; agent NEVER sees raw private keys     |
+-----------------------------------+-----------------------------------------------+
                                    | Issues Scoped JWT Token
                                    v
+-----------------------------------------------------------------------------------+
| 2. AUTONOMOUS AI AGENT LOOP                                                       |
|   - Presents scoped capability token + x402 payment header to metered service    |
+-----------------------------------+-----------------------------------------------+
                                    | Calls x402 Gated Endpoint
                                    v
+-----------------------------------------------------------------------------------+
| 3. SETTLEMENT PLANE (Hedera EVM Contracts & x402 Facilitator)                     |
|   - `CapabilityRegistry.sol`: On-chain remaining budget & expiry check            |
|   - `X402FacilitatorAdapter.sol`: Atomic payment settlement                       |
|   - REAL-TIME REJECTION on budget exhaustion / revocation / expiry                 |
+-----------------------------------+-----------------------------------------------+
                                    | Submits Audit Logs
                                    v
+-----------------------------------------------------------------------------------+
| 4. AUDIT PLANE (Hedera Consensus Service - HCS)                                   |
|   - HCS Topic Audit Log (`CAPABILITY_ISSUED`, `SPENT`, `REJECTED`, `REVOKED`)    |
|   - Frontend Live Mirror Feed & HashScan Verification Links                      |
+-----------------------------------------------------------------------------------+
```

---

## 3. Technology Stack

- **Smart Contracts:** Solidity `0.8.20`, Foundry (`forge-std`), OpenZeppelin Contracts `5.x`
- **Settlement Rail & Audit:** Hedera Testnet EVM (Chain ID `296`), `@hashgraph/sdk`, Hedera Consensus Service (HCS)
- **Hardware Security Enclave:** Ledger Key Ring CLI (`wallet-cli ring`), AES-256-GCM seed-derived keyring
- **Broker Service:** Node.js, TypeScript, Express, Ethers.js `v6`, Vitest
- **Frontend App:** Next.js 16 (App Router), React 19, Tailwind CSS, Lucide React Icons

---

## 4. Sponsor Integrations & Qualification Requirements

### Primary Sponsor: Ledger
- **Role:** Root of trust for settlement credential protection.
- **Implementation:** Integrated via Ledger Wallet CLI (`wallet-cli ring`) and seed-derived enclave encryption (`broker/src/ledger/keyring.ts`).
- **Qualification Citation:** Satisfies Ledger's AI & Hardware Security tracks by demonstrating that raw settlement credentials never enter agent memory or prompt context, ensuring cryptographic seed protection.

### Secondary Sponsor: Hedera (Load-Bearing)
- **Role:** Settlement rail, EVM smart contract host, and HCS audit trail.
- **Implementation:**
  - `CapabilityRegistry.sol` & `X402FacilitatorAdapter.sol` deployed on Hedera Testnet (Chain ID 296).
  - `@hashgraph/sdk` Topic Message submission writing all issuance, spend, and rejection events to HCS topic (`broker/src/hedera/hcs.ts`).
- **Qualification Citation:** Satisfies Hedera's track by combining low-fee EVM contract enforcement with real-time HCS audit logging.

### Secondary Bonus: Bazantic
- **Role:** Gateway & MCP Recipe wrapper for pay-per-call services. Ready for Bazantic x402 gateway registration post-core deployment.

---

## 5. Local Setup & Quickstart

### Prerequisites
- Node.js `v20+` and `npm`
- Foundry (`forge`) installed on path

### 1. Clone & Install Dependencies
```bash
# Install all workspace dependencies from root
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```
Ensure `.env` contains:
```env
HEDERA_JSON_RPC_URL=https://testnet.hashio.io/api
HEDERA_CHAIN_ID=296
HEDERA_HCS_TOPIC_ID=0.0.654321
LEDGER_CLI_PATH=wallet-cli
NEXT_PUBLIC_BROKER_URL=http://localhost:3001
```

### 3. Run Test Suites
```bash
# 1. Run Foundry Smart Contract Tests (8/8 Passed)
npm run test:contracts

# 2. Run Broker & Key Ring Unit Tests (4/4 Passed)
npm run test:broker

# 3. Run Full End-to-End Demo Simulation Script
npm run test:e2e
```

### 4. Start Local Development Environment
```bash
# Starts both Broker backend (port 3001) and Next.js frontend (port 3000)
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 6. Smart Contracts & Deployment

- **Network:** Hedera EVM Testnet
- **Chain ID:** `296`
- **RPC URL:** `https://testnet.hashio.io/api`
- **Deployment Script:** `contracts/script/Deploy.s.sol`

To deploy contracts to Hedera Testnet:
```bash
npm run deploy:contracts
```

---

## 7. Demo Guide: The "WOW" Moment

1. **Developer Console:**
   - Register a metered API policy (e.g. Max Call: `10 HBAR`, Daily Budget: `25 HBAR`).
   - Click **Issue Token to Agent**. Notice that the underlying private key is encrypted by Ledger Key Ring.

2. **Agent Console:**
   - Select the issued capability token.
   - Click **Submit Agent Request & Pay via x402** twice (spending 10 HBAR, then 15 HBAR). Budget is now **0 HBAR**.

3. **The Wow Moment (Real-Time On-Chain Rejection):**
   - Click **Submit Agent Request** a 3rd time.
   - A prominent **REJECTED ON-CHAIN IN REAL-TIME** cyber-alert modal appears instantly.
   - Confirms HTTP 402 Payment Required, `INSUFFICIENT_BUDGET` error, zero credential leakage, and an HCS audit log entry written to Hedera.

4. **HCS Audit Trail:**
   - Switch to **HCS Audit Trail** tab to view the live timeline populated with sequence numbers and HashScan links.

---

## 8. AI Usage Disclosure

Per ETHGlobal submission guidelines:
AI coding tools were utilized during the development of Vaultbreaker for boilerplate setup, TypeScript typing assistance, and CSS layout styling. All contract invariants, budget enforcement logic, Ledger Key Ring wrappers, and Hedera SDK integrations were verified and tested manually with Foundry and Vitest.
