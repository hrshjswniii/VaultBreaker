# Vaultbreaker 2.0 Master Product & Technical Specification

## 1. One-Line Description
Vaultbreaker is authorization and financial control infrastructure for autonomous AI agents, enforcing narrow, expiring, revocable spend capabilities on-chain in real time while isolating wallet credentials inside hardware enclaves.

---

## 2. Problem
Autonomous AI agents (LLM loops, background scripts, multi-agent networks) are increasingly tasked with purchasing resources, calling pay-per-call APIs, and executing financial transactions. Giving an autonomous agent unrestricted wallet access or static API keys creates extreme risk: a prompt injection attack, code bug, or unexpected loop can drain an entire wallet or incur catastrophic API bills.

---

## 3. Solution
Vaultbreaker introduces a capability-based security control plane between autonomous AI agents and protected resources. Instead of raw private keys, agents receive short-lived, spend-limited, expiring JWT capability tokens backed by Ledger seed hardware protection and enforced on-chain via Hedera EVM smart contracts and Hedera Consensus Service (HCS) audit trails.

---

## 4. Core Principles
1. **Agents Should Have Power Without Having Unlimited Authority**: Restrict agent power to exact, spend-limited scopes.
2. **Zero Credential Exposure**: Raw private keys and master secrets NEVER enter agent memory, context windows, or browser state.
3. **Real-Time On-Chain Enforcement**: Over-budget, expired, or revoked requests are rejected before downstream execution.
4. **Tamper-Evident Auditability**: Every lifecycle action is logged to Hedera HCS for immutable public verification.
5. **Decoupled Architecture**: Clean separation between Policy (abstract rule), Capability (instance token), and Service (protected endpoint).

---

## 5. Target Users
- **AI Agent Developers**: Developers building autonomous LLM agents who need safe financial authority delegation.
- **Metered API Service Providers**: API providers who require payment guarantees and spend-policy compliance.
- **Enterprise Security Administrators**: Administrators who require auditability and human approval guardrails for agent actions.

---

## 6. Core Domain Entities
Vaultbreaker defines 12 canonical entities: `Organization`, `User`, `Agent`, `Wallet`, `Capability`, `Policy`, `Service`, `Payment`, `Approval`, `AuditEvent`, `Session`, `Credential`. (See [`DOMAIN_MODEL.md`](file:///c:/Users/harsh/OneDrive/Desktop/EthOnline/docs/DOMAIN_MODEL.md)).

---

## 7. Capability Model
A Capability is an immutable, spend-limited authority object specifying WHO (agent), WHAT (action), WHERE (service address), WHEN (expiry timestamp), HOW MUCH (budget remaining), and CONDITIONS (revocation/policy hash). (See [`CAPABILITY_MODEL.md`](file:///c:/Users/harsh/OneDrive/Desktop/EthOnline/docs/CAPABILITY_MODEL.md)).

---

## 8. Policy Model
Policies are declarative templates defining maximum per-call costs, daily budgets, token TTLs, human approval thresholds, and velocity limits across six evaluation dimensions. (See [`POLICY_MODEL.md`](file:///c:/Users/harsh/OneDrive/Desktop/EthOnline/docs/POLICY_MODEL.md)).

---

## 9. Agent Model
Agents progress through a 6-state lifecycle: `CREATED` -> `ACTIVE` -> `SUSPENDED` -> `COMPROMISED` -> `REVOKED` -> `ARCHIVED`. Compromised or suspended agents automatically lose capability authority. (See [`AGENT_MODEL.md`](file:///c:/Users/harsh/OneDrive/Desktop/EthOnline/docs/AGENT_MODEL.md)).

---

## 10. Service Model
Services represent pay-per-call endpoints protected by Vaultbreaker. Capabilities are cryptographically bound to specific `serviceAddress` targets to prevent credential relay attacks. (See [`SERVICE_MODEL.md`](file:///c:/Users/harsh/OneDrive/Desktop/EthOnline/docs/SERVICE_MODEL.md)).

---

## 11. Payment Model
Payments follow a strict 6-stage lifecycle: Request -> Policy Verification -> Credential Decryption -> Budget Decrement -> On-Chain Settlement (`CapabilityRegistry.sol`) -> HCS Audit Logging. (See [`PAYMENT_MODEL.md`](file:///c:/Users/harsh/OneDrive/Desktop/EthOnline/docs/PAYMENT_MODEL.md)).

---

## 12. Approval Model
High-value requests exceeding `requireApprovalAbove` thresholds trigger an `APPROVAL_REQUIRED` state, pausing execution until a human administrator approves or rejects the request. (See [`APPROVAL_MODEL.md`](file:///c:/Users/harsh/OneDrive/Desktop/EthOnline/docs/APPROVAL_MODEL.md)).

---

## 13. Audit Model
All lifecycle events are logged to Hedera HCS (`topicId: 0.0.654321`) using `@hashgraph/sdk`, providing sequence numbers and HashScan verification links. (See [`AUDIT_MODEL.md`](file:///c:/Users/harsh/OneDrive/Desktop/EthOnline/docs/AUDIT_MODEL.md)).

---

## 14. Security Model
Enforces four security tiers: Untrusted (Agents), Partially Trusted (Frontend/Broker API Gateway), Trusted (Policy Engine & Ledger KeyRing), and Root of Trust (Hedera Smart Contracts & HCS). (See [`TRUST_MODEL.md`](file:///c:/Users/harsh/OneDrive/Desktop/EthOnline/docs/TRUST_MODEL.md)).

---

## 15. Current Architecture (Phase 0 Baseline)
- Next.js 16 App Router frontend (`app/`) with client-side mock store fallback.
- Express Node.js TypeScript broker (`broker/`) with in-memory state storage.
- Ledger KeyRing CLI wrapper (`keyring.ts`) with seed AES-256-GCM fallback.
- Solidity smart contracts (`CapabilityRegistry.sol`, `X402FacilitatorAdapter.sol`) tested via Foundry (8/8 pass).

---

## 16. Target Architecture (Vaultbreaker 2.0)
- Modular monorepo with persistent database (SQLite/PostgreSQL) in broker.
- Strict API key authentication on administrative endpoints.
- On-chain relayer syncing memory budget decrements to EVM smart contracts.
- Wagmi/RainbowKit Web3 wallet connection in frontend.
- Local font loading eliminating Google Font network build failures.

---

## 17. MVP Scope (Phase 1 & Phase 2)
- Persistent SQLite broker database.
- Admin route authentication & Zod request validation.
- Local font loading & fixed offline Next.js builds.
- Wagmi wallet connection button in dashboard.
- On-chain relayer for EVM transaction settlement.

---

## 18. Future Scope (Phases 3 - 21)
- Human-in-the-loop approval dashboard.
- Python and TypeScript Agent SDK libraries.
- Multi-agent hierarchical delegation policies.
- Multi-chain EVM support (Arbitrum, Base, Ethereum).
- Standalone Hedera HCS Audit Explorer.

---

## 19. Explicit Non-Goals
- Vaultbreaker will NOT train or host LLM models.
- Vaultbreaker will NOT build an AI agent marketplace.
- Vaultbreaker will NOT build a generic consumer crypto wallet.
- Vaultbreaker will NOT replace OAuth2 or OIDC identity standards.

---

## 20. Success Criteria
1. Zero raw private key leakage under any agent execution flow.
2. Real-time rejection of over-budget or expired capability calls on-chain.
3. 100% test coverage across contracts, broker persistence, and API routes.
4. Clean production build (`npm run build`) in offline environments.
5. Immutable audit logging of all actions on Hedera Consensus Service.
