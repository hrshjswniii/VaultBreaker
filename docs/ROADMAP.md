# Vaultbreaker Rebuild Roadmap

This roadmap defines the multi-phase evolution of Vaultbreaker from a hackathon prototype into production-grade financial control infrastructure for autonomous AI agents.

---

## Roadmap Phases

- [x] **PHASE 0 — Audit & Baseline** `[COMPLETED]`
  - Deep repository audit, system flow tracing, technical debt cataloging, test execution, security review, and phase baseline documentation.

- [x] **PHASE 1 — Product Architecture** `[COMPLETED]`
  - Define core data models, persistent database schema (SQLite/PostgreSQL/Redis), broker-to-contract transaction relayer design, and API authentication layer.

- [x] **PHASE 2 — UI/UX Rebuild** `[COMPLETED]`
  - Redesign design system, resolve offline font fetching issues, establish responsive layouts, theme tokens, and component library.

- [x] **PHASE 3 — Core Product Experience** `[COMPLETED]`
  - End-to-end management views for Dashboard, Agents, Capabilities, Policies, Services, Payments, Audit Trail, and Agent Terminal with live broker API bindings and simulation mode.

- [x] **PHASE 4 — Agent Lifecycle & Management** `[COMPLETED]`
  - Authoritative agent registry, state machine (`ACTIVE`, `SUSPENDED`, `REVOKED`), server-side lifecycle authorization enforcement gate in `/api/metered-service`, safe wallet binding, and frontend management controls.

- [x] **PHASE 5 — Capability Management** `[COMPLETED]`
  - Canonical capability model with deterministic lifecycle states (`ACTIVE`, `EXHAUSTED`, `EXPIRED`, `REVOKED`), least-privilege action and resource scope enforcement, authoritative agent binding (`AGENT_MISMATCH` prevention), non-negative integer budget accounting, immediate broker revocation with HCS audit logging, and full frontend management in `CapabilitiesView.tsx`.

- [x] **PHASE 6 — Policy Engine & Authorization Decision System** `[COMPLETED]`
  - Canonical policy model with typed conditions (`maxPricePerCall`, `maxCallsPerMinute`, `allowedHoursUtc`, `blockedActions`, `blockedResources`), precedence rules (explicit `DENY` overrides `ALLOW`), priority ordering, dynamic sliding-window velocity tracker, dry-run evaluation endpoint (`POST /api/policies/evaluate`), zero-deduction guarantee on rejection, HCS audit logging for policy lifecycle events, and interactive sandbox in `PoliciesView.tsx`.

- [ ] **PHASE 7 — Human Approval**
  - Multi-sig / human-in-the-loop approval workflows for high-value agent micropayments or policy adjustments exceeding pre-set limits.

- [ ] **PHASE 8 — Agent SDK**
  - Client SDK libraries for Python and TypeScript/Node.js enabling AI agent frameworks (LangChain, AutoGen, CrewAI) to consume capability tokens seamlessly.

- [ ] **PHASE 9 — x402 Services**
  - Extended metered service adapters, HTTP 402 header negotiation protocol, payment settlement gateways, and service provider integrations.

- [ ] **PHASE 10 — Agent Playground**
  - Interactive testbed sandbox for developers to simulate AI agents, trigger edge-case spending scenarios, and test real-time rejection policies.

- [ ] **PHASE 11 — Security Center**
  - Key management overview, Ledger KeyRing hardware enclave diagnostics, credential exposure auditing, and threat response actions.

- [ ] **PHASE 12 — Audit Explorer**
  - Dedicated Hedera Consensus Service (HCS) audit trail explorer with search, filtering, sequence validation, and HashScan integration.

- [ ] **PHASE 13 — Multi-Agent**
  - Hierarchical agent delegation, sub-agent capability scoping, shared organizational budgets, and multi-agent coordination policies.

- [ ] **PHASE 14 — Multi-Chain**
  - Expand settlement rails beyond Hedera EVM to additional EVM chains (Arbitrum, Base, Ethereum) and non-EVM networks via cross-chain relayers.

- [ ] **PHASE 15 — API / Developer Platform**
  - Public developer API, webhooks, API keys, developer portal, and CLI tooling for managing Vaultbreaker broker instances.

- [ ] **PHASE 16 — Testing & Security Hardening**
  - Integration testing suite, fuzzing smart contracts, formal verification, end-to-end regression tests, and security hardening.

- [ ] **PHASE 17 — Observability**
  - Prometheus metrics, OpenTelemetry tracing, alert dispatchers, log aggregation, and real-time operational monitoring.

- [ ] **PHASE 18 — Deployment / DevOps**
  - Docker containerization, Kubernetes helm charts, CI/CD pipeline automation, production environment configuration, and infrastructure-as-code.

- [ ] **PHASE 19 — Documentation**
  - Comprehensive developer guide, API reference, architecture deep-dives, integration tutorials, and SDK quickstarts.

- [ ] **PHASE 20 — Brand / Landing Page**
  - Product branding, marketing landing page, visual assets, interactive demos, and documentation site.

- [ ] **PHASE 21 — Final Demo**
  - End-to-end production demonstration, video walkthroughs, testnet deployment verification, and launch readiness.
