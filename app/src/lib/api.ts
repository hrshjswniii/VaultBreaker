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

const BROKER_BASE_URL = process.env.NEXT_PUBLIC_BROKER_URL || "http://localhost:3001";

// ---------------------------------------------------------------------------
// In-memory mock store — used when broker is unreachable (Vercel demo mode)
// ---------------------------------------------------------------------------
function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10);
}

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
  // Extract capId from demo token
  const capId = token.startsWith("demo.jwt.") ? token.replace("demo.jwt.", "") : null;
  if (!capId) return { status: 401, ok: false, data: { error: "INVALID_TOKEN" } };

  const cap = mockStore.capabilities.get(capId);
  if (!cap) return { status: 404, ok: false, data: { error: "CAPABILITY_NOT_FOUND" } };
  if (cap.revoked) {
    mockStore.auditFeed.unshift({ type: "CAPABILITY_REJECTED", capId, amount, reason: "Capability Revoked by Issuer", timestamp: new Date().toISOString() });
    return { status: 403, ok: false, data: { error: "CAPABILITY_REVOKED", capId, message: "On-Chain Enforcement: Capability has been explicitly revoked by issuing developer." } };
  }
  if (Math.floor(Date.now() / 1000) >= cap.expiry) {
    mockStore.auditFeed.unshift({ type: "CAPABILITY_REJECTED", capId, amount, reason: "Capability Expired", timestamp: new Date().toISOString() });
    return { status: 402, ok: false, data: { error: "CAPABILITY_EXPIRED", capId, message: "On-Chain Enforcement: Capability token expired. Real-time rejection." } };
  }
  if (cap.budgetRemaining < amount) {
    mockStore.auditFeed.unshift({ type: "CAPABILITY_REJECTED", capId, amount, budgetRemaining: cap.budgetRemaining, reason: "Budget Exhausted", timestamp: new Date().toISOString() });
    return {
      status: 402, ok: false,
      data: { error: "INSUFFICIENT_BUDGET", capId, budgetRemaining: cap.budgetRemaining, requestedAmount: amount, message: `On-Chain Enforcement: Attempted call costs ${amount} units, but remaining budget is ${cap.budgetRemaining}. Real-time rejection enforced on-chain.` },
    };
  }
  cap.budgetRemaining -= amount;
  mockStore.auditFeed.unshift({ type: "CAPABILITY_SPENT", capId, service: cap.serviceAddress, amount, budgetRemaining: cap.budgetRemaining, timestamp: new Date().toISOString() });
  return {
    status: 200, ok: true,
    data: {
      status: "SUCCESS", capId, amountCharged: amount, budgetRemaining: cap.budgetRemaining,
      hcsAuditMessage: "Logged to in-memory Hedera audit feed (Demo Mode)",
      data: { service: "Vaultbreaker AI Text Summarizer", inputPrompt: promptText, summaryResult: `[x402 Micropayment Executed] Summarized analysis for: "${promptText.slice(0, 40)}...". Credential protected by Ledger Key Ring. Spend enforced on-chain on Hedera.`, tokenCount: 42, processingTimeMs: 24 },
    },
  };
}

// ---------------------------------------------------------------------------
// Public API — tries broker first, falls back to mock
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
