# Vaultbreaker Frontend Audit

## 1. Overview & UI Architecture

The frontend is a single-page Next.js 16 application (`app/`) built with React 19 and Tailwind CSS v4. It features a modern dark/light mode dashboard designed around glassmorphism visual cards, glowing status indicators, and real-time polling.

---

## 2. Component Inventory & Structure

```
app/src/
├── app/
│   ├── layout.tsx             # Root layout with Google Fonts (Geist/Geist Mono), dark mode root class
│   ├── page.tsx               # Main container page managing active tab state ("developer" | "agent" | "audit")
│   └── globals.css            # Tailwind CSS v4 import & custom glass card utilities
├── components/
│   ├── Navbar.tsx             # Top header navigation bar & status indicators
│   ├── DeveloperConsole.tsx   # Policy creation & capability minting interface
│   ├── AgentConsole.tsx       # Simulated AI agent micropayment terminal
│   └── AuditFeedTimeline.tsx  # Hedera HCS live audit event stream
└── lib/
    └── api.ts                 # Dual-mode API client (REST fetcher + client-side mock store)
```

---

## 3. Screen-by-Screen Functional Audit

### A. Navigation Header (`Navbar.tsx`)
1. **Purpose**: Global branding, status monitoring, tab switching, theme toggling.
2. **User**: Developers & Auditors.
3. **Main Actions**: Switch tabs ("Developer Console", "Agent Console", "HCS Audit Trail"), toggle dark mode.
4. **Data Displayed**: Ledger Key Ring status badge ("KeyRing CLI Active" vs "Seed Enclave"), Hedera network badge ("Testnet (296)").
5. **Data Source**: Polled via `fetchHealth()` every 4 seconds.
6. **Backend Dependency**: Broker `/api/health`.

### B. Developer Console (`DeveloperConsole.tsx`)
1. **Purpose**: Manage spend policies and mint capability tokens for agents.
2. **User**: Service Provider / Developer.
3. **Main Actions**:
   - Register Spend Policy (opens modal: Name, Max Price, Daily Budget, TTL).
   - "Issue Token to Agent" (mints capability and auto-switches to Agent tab).
   - Revoke capability.
4. **Data Displayed**: Policy list cards, active capability tokens with budget progress bars (`budgetRemaining / budgetTotal`), revocation tags.
5. **Data Source**: Polled via `fetchPolicies()` and `fetchCapabilities()`.
6. **Backend Dependency**: Broker `/api/policies` and `/api/capabilities`.

### C. Agent Console (`AgentConsole.tsx`)
1. **Purpose**: Simulate an autonomous AI agent executing pay-per-call metered requests.
2. **User**: Simulated AI Agent / Evaluator.
3. **Main Actions**: Input prompt, set payment amount, submit request.
4. **Data Displayed**: Active capability badge, budget progress bar, success output receipt, **REJECTED ON-CHAIN IN REAL-TIME** alert modal (HTTP 402/403).
5. **Data Source**: Response from `executeMeteredCall()`.
6. **Backend Dependency**: Broker `/api/metered-service`.

### D. HCS Audit Trail (`AuditFeedTimeline.tsx`)
1. **Purpose**: Inspect tamper-evident audit logs logged to Hedera HCS.
2. **User**: Security Auditor / Developer.
3. **Main Actions**: Manual refresh button, HashScan external link button.
4. **Data Displayed**: Event type badges (`CAPABILITY_ISSUED`, `CAPABILITY_SPENT`, `CAPABILITY_REJECTED`, `CAPABILITY_REVOKED`), capId, amount, remaining budget, timestamps, topic ID.
5. **Data Source**: Polled via `fetchAuditFeed()`.
6. **Backend Dependency**: Broker `/api/audit-feed`.

---

## 4. Dual-Mode API Architecture (`lib/api.ts`)

The frontend contains a unique client-side mock fallback system:
- When page loads, `checkBroker()` calls `http://localhost:3001/api/health`.
- If broker responds, `mockStore.brokerOnline = true` and all calls hit the Node Express server.
- If broker fails to respond (e.g. static Vercel deployment without backend server), `mockStore.brokerOnline = false` and all operations run against an in-memory client JavaScript store (`mockStore`).

---

## 5. Current UX & Technical Problems

1. **Client-Side Fallback Obscures Connection Failures**: When the backend broker is offline, the UI silently degrades to mock mode without clearly alerting the user that backend/blockchain connectivity is inactive.
2. **Hardcoded HashScan Links**: External HashScan links point to hardcoded topic `0.0.654321` or `NEXT_PUBLIC_HCS_TOPIC_ID` regardless of the actual event's topic ID.
3. **No True Wallet Provider Integration (Wagmi / Viem Unused)**: While `wagmi` and `viem` are installed in `package.json`, there is no Connect Wallet button (MetaMask, HashPack) hooked up to contract interactions in the UI.
4. **Font Load Failure During Offline Builds**: `layout.tsx` imports Google Fonts (`Geist`, `Geist Mono`), causing `next build` to fail when building in offline environments.
