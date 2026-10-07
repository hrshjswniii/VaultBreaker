# Vaultbreaker Product & UX Baseline

## 1. Target User & Core Problem Statement

### Who is the Current User?
1. **AI Agent Developers**: Developers building autonomous AI agents (LangChain, AutoGen, CrewAI, Custom LLM loops) requiring pay-per-call API access without distributing raw wallet private keys or unconstrained API keys.
2. **Metered API Service Providers**: Developers providing pay-per-call services (AI Inference, Compute, Data Feeds) who want real-time on-chain spend protection and payment guarantees.

### What Problem Does Vaultbreaker Solve?
- Solves the **"Autonomous Agent Credential Security Paradox"**: AI agents need financial authority to purchase resources, but granting raw private keys risks total wallet drain if an agent encounters prompt injection or code execution bugs.
- Provides **Scoped Capability Objects**: Short-lived, spend-limited, expiring JWTs backed by Ledger seed hardware protection and enforced on-chain in real time.

---

## 2. Product Usability & UX Evaluation

### Strengths
1. **Immediate Concept Clarity**: The hero banner ("UNLOCK • ACCESS • OWN"), sponsor badges (Ledger, Hedera), and comparison table cleanly explain why scoped capabilities are superior to raw private keys.
2. **Interactive Demo Moment ("The Rejection Moment")**: The Agent Console visually triggers an explicit **REJECTED ON-CHAIN IN REAL-TIME** alert modal when remaining budget drops to zero.
3. **Live HCS Audit Timeline**: The timeline view clearly demonstrates Hedera's immutable logging capabilities with direct HashScan external links.

### UX Weaknesses & Confusing Flows
1. **Ambiguous Live vs. Mock Mode**: When the Node broker is offline, the frontend silently switches to `mockStore` without warning. A user cannot tell whether they are interacting with Hedera Testnet or client-side JavaScript memory.
2. **Disconnected Wallet Experience**: Users expect a "Connect Wallet" (MetaMask / HashPack) button on Web3 dApps. The frontend displays "Testnet (296)" but offers no interactive wallet connection.
3. **Preset / Hardcoded Values in Agent Console**: The Agent Console pre-fills prompt text and default amounts, feeling like a scripted hackathon walkthrough rather than an open developer tool.
4. **Missing Multi-Agent / Multi-Policy Views**: The dashboard only displays cards in a flat layout without filtering, search, or multi-agent delegation hierarchy.
