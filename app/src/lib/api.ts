export interface Policy {
  id: string;
  name: string;
  serviceEndpoint: string;
  serviceAddress: string;
  maxPricePerCall: number;
  dailyBudget: number;
  ttlSeconds: number;
  createdAt: string;
}

export interface Capability {
  capId: string;
  policyId: string;
  policyHash: string;
  serviceAddress: string;
  budgetTotal: number;
  budgetRemaining: number;
  expiry: number;
  issuer: string;
  encryptedCredential: string;
  token: string;
  revoked: boolean;
  createdAt: string;
}

export interface HCSAuditEvent {
  type: "CAPABILITY_ISSUED" | "CAPABILITY_SPENT" | "CAPABILITY_REJECTED" | "CAPABILITY_REVOKED";
  capId: string;
  service?: string;
  amount?: number;
  budgetRemaining?: number;
  reason?: string;
  policyHash?: string;
  timestamp: string;
  txHash?: string;
}

export interface KeyRingStatus {
  mode: "LEDGER_CLI" | "SIMULATED_KEYRING";
  initialized: boolean;
  cliPath: string;
  seedFingerprint?: string;
}

// ---------------------------------------------------------------------------
// Phase 3 Extended Domain Models
// ---------------------------------------------------------------------------

export interface Agent {
  id: string;
  name: string;
  description: string;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  walletAddress: string;
  network: string;
  capabilitiesCount: number;
  totalSpentHbar: number;
  createdAt: string;
  lastActiveAt: string;
  isDemoFixture: boolean;
}

export interface Wallet {
  address: string;
  network: string;
  chainId: number;
  keyringProvider: "LEDGER_CLI" | "SEED_ENCLAVE";
  balanceHbar: number;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  address: string;
  network: string;
  pricePerCall: number;
  currency: string;
  x402Supported: boolean;
  status: "REACHABLE" | "CONFIGURED" | "SIMULATED";
  isDemoFixture: boolean;
}

export interface EvaluationStep {
  stage: "REQUEST_RECEIVED" | "CAPABILITY_RESOLVED" | "POLICY_EVALUATED" | "BUDGET_CHECKED" | "DECISION_RETURNED";
  status: "PASS" | "FAIL" | "PENDING";
  detail: string;
  timestamp: string;
}

export interface PaymentAttempt {
  id: string;
  capId: string;
  agentId: string;
  agentName: string;
  serviceAddress: string;
  serviceName: string;
  amount: number;
  asset: string;
  network: string;
  decision: "ALLOWED" | "DENIED" | "APPROVAL_REQUIRED";
  status: "SETTLED" | "FAILED" | "REJECTED" | "AUTHORIZED" | "PENDING";
  txHash?: string;
  reason?: string;
  evaluationTrace: EvaluationStep[];
  timestamp: string;
  isDemoFixture: boolean;
}

const BROKER_BASE_URL = process.env.NEXT_PUBLIC_BROKER_URL || "http://localhost:3001";

// ---------------------------------------------------------------------------
// In-memory mock store & demo fixtures — used when broker is unreachable
// ---------------------------------------------------------------------------
function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10);
}

const demoAgents: Agent[] = [
  {
    id: "agent_alpha",
    name: "Agent Alpha (Summarizer)",
    description: "Autonomous LLM loop processing technical market feeds & code summaries.",
    status: "ACTIVE",
    walletAddress: "0x0000000000000000000000000000000000000001",
    network: "Hedera Testnet (296)",
    capabilitiesCount: 1,
    totalSpentHbar: 25,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    lastActiveAt: new Date().toISOString(),
    isDemoFixture: true,
  },
  {
    id: "agent_beta",
    name: "Agent Beta (Compute Node)",
    description: "High-frequency transaction validator executing metered compute requests.",
    status: "ACTIVE",
    walletAddress: "0x0000000000000000000000000000000000000002",
    network: "Hedera Testnet (296)",
    capabilitiesCount: 0,
    totalSpentHbar: 0,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    lastActiveAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    isDemoFixture: true,
  },
  {
    id: "agent_gamma",
    name: "Agent Gamma (Data Feed)",
    description: "Market price oracle agent fetching cross-chain liquidity metrics.",
    status: "SUSPENDED",
    walletAddress: "0x0000000000000000000000000000000000000003",
    network: "Hedera Testnet (296)",
    capabilitiesCount: 0,
    totalSpentHbar: 0,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    lastActiveAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    isDemoFixture: true,
  },
];

const demoServices: ServiceItem[] = [
  {
    id: "srv_ai_summarizer",
    name: "Vaultbreaker AI Text Summarizer API",
    description: "Pay-per-call text summarization service protected by x402 header enforcement.",
    endpoint: "/api/metered-service",
    address: "0x0000000000000000000000000000000000000004",
    network: "Hedera Testnet (296)",
    pricePerCall: 10,
    currency: "HBAR",
    x402Supported: true,
    status: "REACHABLE",
    isDemoFixture: false,
  },
  {
    id: "srv_market_data",
    name: "Financial Market Sentiment Oracle",
    description: "Real-time liquidity and sentiment data feed for EVM & Hedera native tokens.",
    endpoint: "/api/v1/market-data",
    address: "0x0000000000000000000000000000000000000005",
    network: "Hedera Testnet (296)",
    pricePerCall: 2,
    currency: "HBAR",
    x402Supported: true,
    status: "CONFIGURED",
    isDemoFixture: true,
  },
];

const mockStore = {
  policies: new Map<string, Policy>([
    [
      "pol_ai_summarizer_v1",
      {
        id: "pol_ai_summarizer_v1",
        name: "AI Inference & Text Summarization API",
        serviceEndpoint: "/api/metered-service",
        serviceAddress: "0x0000000000000000000000000000000000000004",
        maxPricePerCall: 10,
        dailyBudget: 50,
        ttlSeconds: 3600,
        createdAt: new Date().toISOString(),
      },
    ],
  ]),
  capabilities: new Map<string, Capability>(),
  auditFeed: [] as HCSAuditEvent[],
  paymentAttempts: [] as PaymentAttempt[],
  brokerOnline: false,
};

async function checkBroker(): Promise<boolean> {
  try {
    const res = await fetch(`${BROKER_BASE_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    mockStore.brokerOnline = res.ok;
    return res.ok;
  } catch {
    mockStore.brokerOnline = false;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Mock implementations
// ---------------------------------------------------------------------------
function mockHealth() {
  return {
    status: "ok",
    service: "Vaultbreaker Capability Broker (Demo Mode)",
    keyring: {
      mode: "SIMULATED_KEYRING" as const,
      initialized: true,
      cliPath: "wallet-cli",
      seedFingerprint: "a1b2c3d4",
    },
    topicId: "0.0.654321",
    contractAddress: "Not set",
    timestamp: new Date().toISOString(),
  };
}

function mockCreatePolicy(body: Partial<Policy>): Policy {
  const id = uid("pol_");
  const policy: Policy = {
    id,
    name: body.name || "Unnamed Policy",
    serviceEndpoint: body.serviceEndpoint || "/api/metered-service",
    serviceAddress: body.serviceAddress || "0x0000000000000000000000000000000000000004",
    maxPricePerCall: Number(body.maxPricePerCall) || 10,
    dailyBudget: Number(body.dailyBudget) || 50,
    ttlSeconds: Number(body.ttlSeconds) || 3600,
    createdAt: new Date().toISOString(),
  };
  mockStore.policies.set(id, policy);
  return policy;
}

function mockIssueCapability(policyId: string, budget?: number): Capability {
  const policy = mockStore.policies.get(policyId);
  if (!policy) throw new Error(`Policy ${policyId} not found`);
  const capId = "0x" + uid() + uid() + uid() + uid();
  const budgetTotal = Math.min(budget || policy.dailyBudget, policy.dailyBudget);
  const expiry = Math.floor(Date.now() / 1000) + policy.ttlSeconds;
  const cap: Capability = {
    capId,
    policyId: policy.id,
    policyHash: "0x" + uid() + uid() + uid() + uid(),
    serviceAddress: policy.serviceAddress,
    budgetTotal,
    budgetRemaining: budgetTotal,
    expiry,
    issuer: "0xBrokerAdminIssuerAddress",
    encryptedCredential: '{"provider":"ledger-keyring-v1","iv":"demo","tag":"demo","ciphertext":"demo"}',
    token: `demo.jwt.${capId}`,
    revoked: false,
    createdAt: new Date().toISOString(),
  };
  mockStore.capabilities.set(capId, cap);
  mockStore.auditFeed.unshift({
    type: "CAPABILITY_ISSUED",
    capId,
    service: policy.serviceAddress,
    amount: 0,
    budgetRemaining: budgetTotal,
    policyHash: cap.policyHash,
    timestamp: new Date().toISOString(),
  });
  return cap;
}

function mockExecuteMeteredCall(token: string, promptText: string, amount: number) {
  const capId = token.startsWith("demo.jwt.") ? token.replace("demo.jwt.", "") : null;
  const nowStr = new Date().toISOString();

  if (!capId) {
    const failedPayment: PaymentAttempt = {
      id: uid("pay_"),
      capId: token.slice(0, 12),
      agentId: "agent_alpha",
      agentName: "Agent Alpha (Summarizer)",
      serviceAddress: "0x0000000000000000000000000000000000000004",
      serviceName: "Vaultbreaker AI Text Summarizer API",
      amount,
      asset: "HBAR",
      network: "Hedera Testnet (296)",
      decision: "DENIED",
      status: "REJECTED",
      reason: "INVALID_TOKEN",
      evaluationTrace: [
        { stage: "REQUEST_RECEIVED", status: "PASS", detail: "HTTP POST request parsed", timestamp: nowStr },
        { stage: "CAPABILITY_RESOLVED", status: "FAIL", detail: "Invalid JWT capability signature", timestamp: nowStr },
      ],
      timestamp: nowStr,
      isDemoFixture: true,
    };
    mockStore.paymentAttempts.unshift(failedPayment);
    return { status: 401, ok: false, data: { error: "INVALID_TOKEN" } };
  }

  const cap = mockStore.capabilities.get(capId);
  if (!cap) {
    return { status: 404, ok: false, data: { error: "CAPABILITY_NOT_FOUND" } };
  }

  if (cap.revoked) {
    mockStore.auditFeed.unshift({
      type: "CAPABILITY_REJECTED",
      capId,
      amount,
      reason: "Capability Revoked by Issuer",
      timestamp: nowStr,
    });

    const revokedPayment: PaymentAttempt = {
      id: uid("pay_"),
      capId,
      agentId: "agent_alpha",
      agentName: "Agent Alpha (Summarizer)",
      serviceAddress: cap.serviceAddress,
      serviceName: "Vaultbreaker AI Text Summarizer API",
      amount,
      asset: "HBAR",
      network: "Hedera Testnet (296)",
      decision: "DENIED",
      status: "REJECTED",
      reason: "CAPABILITY_REVOKED",
      evaluationTrace: [
        { stage: "REQUEST_RECEIVED", status: "PASS", detail: "HTTP POST request received with token", timestamp: nowStr },
        { stage: "CAPABILITY_RESOLVED", status: "PASS", detail: `Capability resolved: ${capId.slice(0, 10)}...`, timestamp: nowStr },
        { stage: "POLICY_EVALUATED", status: "FAIL", detail: "Capability has been explicitly revoked on-chain", timestamp: nowStr },
      ],
      timestamp: nowStr,
      isDemoFixture: true,
    };
    mockStore.paymentAttempts.unshift(revokedPayment);

    return {
      status: 403,
      ok: false,
      data: {
        error: "CAPABILITY_REVOKED",
        capId,
        message: "On-Chain Enforcement: Capability has been explicitly revoked by issuing developer.",
      },
    };
  }

  if (Math.floor(Date.now() / 1000) >= cap.expiry) {
    mockStore.auditFeed.unshift({
      type: "CAPABILITY_REJECTED",
      capId,
      amount,
      reason: "Capability Expired",
      timestamp: nowStr,
    });

    const expiredPayment: PaymentAttempt = {
      id: uid("pay_"),
      capId,
      agentId: "agent_alpha",
      agentName: "Agent Alpha (Summarizer)",
      serviceAddress: cap.serviceAddress,
      serviceName: "Vaultbreaker AI Text Summarizer API",
      amount,
      asset: "HBAR",
      network: "Hedera Testnet (296)",
      decision: "DENIED",
      status: "REJECTED",
      reason: "CAPABILITY_EXPIRED",
      evaluationTrace: [
        { stage: "REQUEST_RECEIVED", status: "PASS", detail: "HTTP POST request received", timestamp: nowStr },
        { stage: "CAPABILITY_RESOLVED", status: "PASS", detail: `Capability resolved: ${capId.slice(0, 10)}...`, timestamp: nowStr },
        { stage: "POLICY_EVALUATED", status: "FAIL", detail: `Token expired at timestamp ${cap.expiry}`, timestamp: nowStr },
      ],
      timestamp: nowStr,
      isDemoFixture: true,
    };
    mockStore.paymentAttempts.unshift(expiredPayment);

    return {
      status: 402,
      ok: false,
      data: {
        error: "CAPABILITY_EXPIRED",
        capId,
        message: "On-Chain Enforcement: Capability token expired. Real-time rejection.",
      },
    };
  }

  if (cap.budgetRemaining < amount) {
    mockStore.auditFeed.unshift({
      type: "CAPABILITY_REJECTED",
      capId,
      amount,
      budgetRemaining: cap.budgetRemaining,
      reason: "Budget Exhausted",
      timestamp: nowStr,
    });

    const budgetPayment: PaymentAttempt = {
      id: uid("pay_"),
      capId,
      agentId: "agent_alpha",
      agentName: "Agent Alpha (Summarizer)",
      serviceAddress: cap.serviceAddress,
      serviceName: "Vaultbreaker AI Text Summarizer API",
      amount,
      asset: "HBAR",
      network: "Hedera Testnet (296)",
      decision: "DENIED",
      status: "REJECTED",
      reason: "INSUFFICIENT_BUDGET",
      evaluationTrace: [
        { stage: "REQUEST_RECEIVED", status: "PASS", detail: "HTTP POST request received", timestamp: nowStr },
        { stage: "CAPABILITY_RESOLVED", status: "PASS", detail: `Capability resolved: ${capId.slice(0, 10)}...`, timestamp: nowStr },
        { stage: "POLICY_EVALUATED", status: "PASS", detail: "Policy rules valid & active", timestamp: nowStr },
        { stage: "BUDGET_CHECKED", status: "FAIL", detail: `Requested ${amount} HBAR but remaining budget is ${cap.budgetRemaining} HBAR`, timestamp: nowStr },
      ],
      timestamp: nowStr,
      isDemoFixture: true,
    };
    mockStore.paymentAttempts.unshift(budgetPayment);

    return {
      status: 402,
      ok: false,
      data: {
        error: "INSUFFICIENT_BUDGET",
        capId,
        budgetRemaining: cap.budgetRemaining,
        requestedAmount: amount,
        message: `On-Chain Enforcement: Attempted call costs ${amount} units, but remaining budget is ${cap.budgetRemaining}. Real-time rejection enforced on-chain.`,
      },
    };
  }

  cap.budgetRemaining -= amount;
  mockStore.auditFeed.unshift({
    type: "CAPABILITY_SPENT",
    capId,
    service: cap.serviceAddress,
    amount,
    budgetRemaining: cap.budgetRemaining,
    timestamp: nowStr,
  });

  const successPayment: PaymentAttempt = {
    id: uid("pay_"),
    capId,
    agentId: "agent_alpha",
    agentName: "Agent Alpha (Summarizer)",
    serviceAddress: cap.serviceAddress,
    serviceName: "Vaultbreaker AI Text Summarizer API",
    amount,
    asset: "HBAR",
    network: "Hedera Testnet (296)",
    decision: "ALLOWED",
    status: "AUTHORIZED",
    evaluationTrace: [
      { stage: "REQUEST_RECEIVED", status: "PASS", detail: "HTTP POST request received with token", timestamp: nowStr },
      { stage: "CAPABILITY_RESOLVED", status: "PASS", detail: `Capability resolved: ${capId.slice(0, 10)}...`, timestamp: nowStr },
      { stage: "POLICY_EVALUATED", status: "PASS", detail: "Policy criteria met (expiry & revocation valid)", timestamp: nowStr },
      { stage: "BUDGET_CHECKED", status: "PASS", detail: `Budget decremented by ${amount} HBAR. Remaining: ${cap.budgetRemaining} HBAR`, timestamp: nowStr },
      { stage: "DECISION_RETURNED", status: "PASS", detail: "Execution allowed & Ledger credential decrypted in memory", timestamp: nowStr },
    ],
    timestamp: nowStr,
    isDemoFixture: true,
  };
  mockStore.paymentAttempts.unshift(successPayment);

  return {
    status: 200,
    ok: true,
    data: {
      status: "SUCCESS",
      capId,
      amountCharged: amount,
      budgetRemaining: cap.budgetRemaining,
      hcsAuditMessage: "Logged to in-memory Hedera audit feed (Demo Mode)",
      data: {
        service: "Vaultbreaker AI Text Summarizer",
        inputPrompt: promptText,
        summaryResult: `[x402 Micropayment Executed] Summarized analysis for: "${promptText.slice(0, 40)}...". Credential protected by Ledger Key Ring. Spend enforced on-chain on Hedera.`,
        tokenCount: 42,
        processingTimeMs: 24,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Public API Client — tries broker first, falls back to mock
// ---------------------------------------------------------------------------
export async function fetchHealth() {
  const online = await checkBroker();
  if (online) {
    const res = await fetch(`${BROKER_BASE_URL}/api/health`);
    return res.json();
  }
  return mockHealth();
}

export async function fetchPolicies(): Promise<Policy[]> {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/policies`);
    return res.json();
  }
  return Array.from(mockStore.policies.values());
}

export async function createPolicy(policy: Partial<Policy>): Promise<Policy> {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/policies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(policy),
    });
    return res.json();
  }
  return mockCreatePolicy(policy);
}

export async function issueCapability(policyId: string, budget?: number): Promise<Capability> {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/capabilities/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId, requestedBudget: budget }),
    });
    return res.json();
  }
  return mockIssueCapability(policyId, budget);
}

export async function fetchCapabilities(): Promise<Capability[]> {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/capabilities`);
    return res.json();
  }
  return Array.from(mockStore.capabilities.values());
}

export async function revokeCapability(capId: string) {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/capabilities/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capId }),
    });
    return res.json();
  }
  const cap = mockStore.capabilities.get(capId);
  if (cap) {
    cap.revoked = true;
    mockStore.auditFeed.unshift({ type: "CAPABILITY_REVOKED", capId, timestamp: new Date().toISOString() });
  }
  return { success: true, capId };
}

export async function executeMeteredCall(token: string, promptText: string, amount: number = 10) {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/metered-service`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-capability-token": token, "x-payment-amount": String(amount) },
      body: JSON.stringify({ prompt: promptText }),
    });
    const data = await res.json();
    return { status: res.status, ok: res.ok, data };
  }
  return mockExecuteMeteredCall(token, promptText, amount);
}

export async function fetchAuditFeed(): Promise<HCSAuditEvent[]> {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/audit-feed`);
    return res.json();
  }
  return mockStore.auditFeed;
}

// ---------------------------------------------------------------------------
// Phase 3 Domain Data Methods
// ---------------------------------------------------------------------------

export async function fetchAgents(): Promise<Agent[]> {
  const caps = await fetchCapabilities();
  const agentMap = new Map<string, Agent>();

  demoAgents.forEach((a) => agentMap.set(a.id, { ...a }));

  // Dynamic calculation based on issued capabilities
  const activeAgentAlpha = agentMap.get("agent_alpha");
  if (activeAgentAlpha) {
    activeAgentAlpha.capabilitiesCount = caps.length;
  }

  return Array.from(agentMap.values());
}

export async function fetchServices(): Promise<ServiceItem[]> {
  const pols = await fetchPolicies();
  const serviceList: ServiceItem[] = [...demoServices];

  // Merge policies registered dynamically into services view
  pols.forEach((p) => {
    if (!serviceList.some((s) => s.address === p.serviceAddress)) {
      serviceList.push({
        id: `srv_${p.id}`,
        name: p.name,
        description: `Metered service endpoint bound to ${p.serviceEndpoint}`,
        endpoint: p.serviceEndpoint,
        address: p.serviceAddress,
        network: "Hedera Testnet (296)",
        pricePerCall: p.maxPricePerCall,
        currency: "HBAR",
        x402Supported: true,
        status: "CONFIGURED",
        isDemoFixture: false,
      });
    }
  });

  return serviceList;
}

export async function fetchPaymentAttempts(): Promise<PaymentAttempt[]> {
  return mockStore.paymentAttempts;
}
