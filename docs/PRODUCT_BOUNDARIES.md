# Vaultbreaker 2.0 Product Boundaries

## 1. Core Principle: Focus & Scope Preservation

Vaultbreaker is **authorization and financial control infrastructure for autonomous AI agents**. To prevent scope creep and maintain architectural excellence, this document explicitly defines what Vaultbreaker **IS** and what Vaultbreaker **IS NOT**.

---

## 2. Product Boundaries Matrix

```
                  ┌─────────────────────────────────────────┐
                  │            VAULTBREAKER 2.0             │
                  │   Authorization & Financial Control     │
                  └────────────────────┬────────────────────┘
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                             ▼
┌──────────────────────────────┐                             ┌──────────────────────────────┐
│     WHAT VAULTBREAKER IS     │                             │   WHAT VAULTBREAKER IS NOT   │
├──────────────────────────────┤                             ├──────────────────────────────┤
│ · Authorization Infrastructure│                             │ · General-Purpose AI Model   │
│ · Capability Management      │                             │ · AI Agent Marketplace       │
│ · Spend Policy Enforcement   │                             │ · LLM Host / Provider        │
│ · Hardware Key Isolation     │                             │ · Generic Crypto Wallet      │
│ · Micropayment Control       │                             │ · Replacement for OAuth/OIDC │
│ · Immutable Audit Logging    │                             │ · AI Chatbot UI              │
└──────────────────────────────┘                             └──────────────────────────────┘
```

### Vaultbreaker IS:
1. **Authorization Infrastructure**: An API gateway and policy control plane governing agent permissions.
2. **Capability Management**: Minting, enforcing, tracking, and revoking scoped capability objects.
3. **Financial Control Layer**: Enforcing per-call price caps, daily budgets, and human approval thresholds.
4. **Hardware Credential Shield**: Isolating raw settlement private keys inside Ledger KeyRing enclaves so agents never hold keys.
5. **On-Chain Enforcement**: Executing budget accounting and revocation on Hedera EVM smart contracts.
6. **Immutable Audit Trail**: Submitting tamper-evident event streams to Hedera Consensus Service (HCS).

### Vaultbreaker IS NOT:
1. **NOT an AI Model / LLM Provider**: Vaultbreaker does not train, host, or execute LLMs (e.g. OpenAI, Anthropic, Llama). It sits *between* LLMs and resources.
2. **NOT an AI Agent Marketplace**: Vaultbreaker does not host an app store for buying or selling agents.
3. **NOT an AI Agent Framework**: Vaultbreaker does not compete with LangChain, AutoGen, or CrewAI; it provides a security SDK that those frameworks integrate.
4. **NOT a Generic Crypto Wallet**: Vaultbreaker is not a consumer Web3 wallet extension or custodial retail wallet.
5. **NOT a Replacer of Base Protocols**: Vaultbreaker does not replace OAuth2, OIDC, or DID standards; it layers financial capability scoping on top of them.
6. **NOT an AI Chatbot UI**: Vaultbreaker is developer infrastructure, not a consumer conversational chatbot.
