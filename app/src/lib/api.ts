export type PolicyEffect = "ALLOW" | "DENY";

export interface PolicyConditions {
  maxPricePerCall?: number;
  dailyBudget?: number;
  maxCallsPerMinute?: number;
  allowedHoursUtc?: { startHour: number; endHour: number };
  blockedActions?: string[];
  blockedResources?: string[];
}

export interface Policy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  effect: PolicyEffect;
  priority: number;
  serviceEndpoint: string;
  serviceAddress: string;
  maxPricePerCall: number;
  dailyBudget: number;
  ttlSeconds: number;
  conditions?: PolicyConditions;
  applicableAgents?: string[];
  applicableServices?: string[];
  applicableActions?: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyEvaluationContext {
  agentId: string;
  serviceAddress: string;
  action: string;
  resource: string;
  amount: number;
  policyId?: string;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  decisionId: string;
  outcome: "ALLOWED" | "DENIED";
  reasonCode:
    | "AUTHORIZED"
    | "POLICY_DENIED"
    | "PRICE_LIMIT_EXCEEDED"
    | "VELOCITY_LIMIT_EXCEEDED"
    | "TIME_WINDOW_VIOLATION"
    | "BLOCKED_ACTION"
    | "BLOCKED_RESOURCE"
    | "NO_APPLICABLE_POLICY"
    | "POLICY_EVALUATION_FAILED";
  primaryReason: string;
  matchedPolicyId?: string;
  matchedPolicyName?: string;
  matchedPolicyVersion?: number;
  evaluationTrace: EvaluationStep[];
  timestamp: string;
}

export type CapabilityStatus = "ACTIVE" | "EXHAUSTED" | "EXPIRED" | "REVOKED";

export interface Capability {
  capId: string;
  agentId?: string;
  policyId: string;
  policyHash: string;
  serviceAddress: string;
  allowedActions?: string[];
  resourceScope?: string;
  budgetTotal: number;
  budgetRemaining: number;
  currency?: string;
  expiry: number;
  issuer: string;
  encryptedCredential: string;
  token: string;
  revoked: boolean;
  revokedAt?: string;
  status?: CapabilityStatus;
  createdAt: string;
}

export interface IssueCapabilityOptions {
  agentId?: string;
  budget?: number;
  allowedActions?: string[];
  resourceScope?: string;
  ttlSeconds?: number;
}


export function getCapabilityStatus(cap: {
  revoked: boolean;
  expiry: number;
  budgetRemaining: number;
}): CapabilityStatus {
  if (cap.revoked) return "REVOKED";
  const now = Math.floor(Date.now() / 1000);
  if (now >= cap.expiry) return "EXPIRED";
  if (cap.budgetRemaining <= 0) return "EXHAUSTED";
  return "ACTIVE";
}

export interface HCSAuditEvent {
  type:
    | "CAPABILITY_ISSUED"
    | "CAPABILITY_SPENT"
    | "CAPABILITY_REJECTED"
    | "CAPABILITY_REVOKED"
    | "AGENT_REGISTERED"
    | "AGENT_STATUS_CHANGED"
    | "AGENT_AUTHORIZATION_DENIED"
    | "POLICY_REGISTERED"
    | "POLICY_UPDATED"
    | "POLICY_TOGGLED"
    | "POLICY_EVALUATED";
  capId?: string;
  agentId?: string;
  agentName?: string;
  previousStatus?: string;
  newStatus?: string;
  policyId?: string;
  policyName?: string;
  decisionId?: string;
  outcome?: string;
  reasonCode?: string;
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
// Phase 3 & 4 Extended Domain Models
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
  totalCallsExecuted?: number;
  totalCallsRejected?: number;
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
  stage: string;
  status: "PASS" | "FAIL" | "SKIPPED" | "PENDING";
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

const velocityMap = new Map<string, number[]>();

const mockStore = {
  policies: new Map<string, Policy>([
    [
      "pol_ai_summarizer_v1",
      {
        id: "pol_ai_summarizer_v1",
        name: "AI Inference & Text Summarization Baseline",
        description: "Default baseline allow policy for metered text summarization service",
        enabled: true,
        effect: "ALLOW" as PolicyEffect,
        priority: 100,
        serviceEndpoint: "/api/metered-service",
        serviceAddress: "0x0000000000000000000000000000000000000004",
        maxPricePerCall: 10,
        dailyBudget: 50,
        ttlSeconds: 3600,
        conditions: {
          maxPricePerCall: 10,
          dailyBudget: 50,
          maxCallsPerMinute: 60,
        },
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    [
      "pol_high_value_guard",
      {
        id: "pol_high_value_guard",
        name: "High Value Call Price Ceiling",
        description: "Denies individual single calls exceeding 25 HBAR across all services",
        enabled: true,
        effect: "DENY" as PolicyEffect,
        priority: 200,
        serviceEndpoint: "/api/metered-service",
        serviceAddress: "*",
        maxPricePerCall: 25,
        dailyBudget: 100,
        ttlSeconds: 3600,
        conditions: {
          maxPricePerCall: 25,
        },
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  ]),
  capabilities: new Map<string, Capability>(),
  agents: new Map<string, Agent>(demoAgents.map((a) => [a.id, { ...a }])),
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

function mockEvaluatePolicies(context: PolicyEvaluationContext): PolicyEvaluationResult {
  const now = new Date();
  const nowIso = now.toISOString();
  const decisionId = uid("dec_");
  const evaluationTrace: EvaluationStep[] = [];

  evaluationTrace.push({
    stage: "EVALUATION_INITIATED",
    status: "PASS",
    detail: `Context: Agent=${context.agentId}, Service=${context.serviceAddress}, Action=${context.action}, Amount=${context.amount} HBAR`,
    timestamp: nowIso,
  });

  const activePolicies: Policy[] = [];
  for (const policy of mockStore.policies.values()) {
    if (!policy.enabled) {
      evaluationTrace.push({
        stage: "APPLICABILITY_CHECK",
        status: "SKIPPED",
        detail: `Policy '${policy.name}' (${policy.id}) is DISABLED; skipped`,
        timestamp: nowIso,
      });
      continue;
    }

    if (
      policy.applicableAgents &&
      policy.applicableAgents.length > 0 &&
      !policy.applicableAgents.includes(context.agentId) &&
      !policy.applicableAgents.includes("*")
    ) {
      continue;
    }

    if (policy.applicableServices && policy.applicableServices.length > 0) {
      const match = policy.applicableServices.some(
        (s) => s === "*" || s.toLowerCase() === context.serviceAddress.toLowerCase()
      );
      if (!match) continue;
    } else if (
      policy.serviceAddress &&
      policy.serviceAddress !== "*" &&
      policy.serviceAddress.toLowerCase() !== context.serviceAddress.toLowerCase()
    ) {
      continue;
    }

    if (
      policy.applicableActions &&
      policy.applicableActions.length > 0 &&
      !policy.applicableActions.includes(context.action) &&
      !policy.applicableActions.includes("*")
    ) {
      continue;
    }

    activePolicies.push(policy);
  }

  if (activePolicies.length === 0) {
    evaluationTrace.push({
      stage: "POLICY_RESOLUTION",
      status: "PASS",
      detail: "No applicable policies found; capability baseline authority applies",
      timestamp: nowIso,
    });
    return {
      allowed: true,
      decisionId,
      outcome: "ALLOWED",
      reasonCode: "AUTHORIZED",
      primaryReason: "No applicable policy restrictions matched; capability baseline authority granted",
      evaluationTrace,
      timestamp: nowIso,
    };
  }

  // Sort by priority descending
  activePolicies.sort((a, b) => b.priority - a.priority);

  for (const policy of activePolicies) {
    const cond = policy.conditions || {};

    if (cond.blockedActions && cond.blockedActions.includes(context.action)) {
      evaluationTrace.push({
        stage: "ACTION_CHECK",
        status: "FAIL",
        detail: `Action '${context.action}' is explicitly blocked by policy '${policy.name}'`,
        timestamp: nowIso,
      });
      return {
        allowed: false,
        decisionId,
        outcome: "DENIED",
        reasonCode: "BLOCKED_ACTION",
        primaryReason: `Action '${context.action}' is prohibited by policy '${policy.name}'`,
        matchedPolicyId: policy.id,
        matchedPolicyName: policy.name,
        matchedPolicyVersion: policy.version,
        evaluationTrace,
        timestamp: nowIso,
      };
    }

    if (cond.blockedResources && cond.blockedResources.includes(context.resource)) {
      evaluationTrace.push({
        stage: "RESOURCE_CHECK",
        status: "FAIL",
        detail: `Resource '${context.resource}' is blocked by policy '${policy.name}'`,
        timestamp: nowIso,
      });
      return {
        allowed: false,
        decisionId,
        outcome: "DENIED",
        reasonCode: "BLOCKED_RESOURCE",
        primaryReason: `Resource '${context.resource}' is prohibited by policy '${policy.name}'`,
        matchedPolicyId: policy.id,
        matchedPolicyName: policy.name,
        matchedPolicyVersion: policy.version,
        evaluationTrace,
        timestamp: nowIso,
      };
    }

    if (cond.allowedHoursUtc) {
      const curHour = now.getUTCHours();
      const { startHour, endHour } = cond.allowedHoursUtc;
      const inWindow =
        startHour <= endHour
          ? curHour >= startHour && curHour <= endHour
          : curHour >= startHour || curHour <= endHour;
      if (!inWindow) {
        evaluationTrace.push({
          stage: "TIME_WINDOW_CHECK",
          status: "FAIL",
          detail: `Current UTC hour ${curHour}:00 is outside permitted window [${startHour}:00 - ${endHour}:00]`,
          timestamp: nowIso,
        });
        return {
          allowed: false,
          decisionId,
          outcome: "DENIED",
          reasonCode: "TIME_WINDOW_VIOLATION",
          primaryReason: `Execution at UTC hour ${curHour} violates active hours window [${startHour}:00 - ${endHour}:00] in policy '${policy.name}'`,
          matchedPolicyId: policy.id,
          matchedPolicyName: policy.name,
          matchedPolicyVersion: policy.version,
          evaluationTrace,
          timestamp: nowIso,
        };
      }
    }

    const priceLimit = cond.maxPricePerCall ?? policy.maxPricePerCall;
    if (priceLimit !== undefined && priceLimit > 0) {
      if (policy.effect === "DENY" && context.amount > priceLimit) {
        evaluationTrace.push({
          stage: "PRICE_CEILING_CHECK",
          status: "FAIL",
          detail: `Call amount ${context.amount} HBAR exceeds price ceiling of ${priceLimit} HBAR in DENY policy '${policy.name}'`,
          timestamp: nowIso,
        });
        return {
          allowed: false,
          decisionId,
          outcome: "DENIED",
          reasonCode: "PRICE_LIMIT_EXCEEDED",
          primaryReason: `Amount ${context.amount} HBAR exceeds maximum price ceiling of ${priceLimit} HBAR enforced by '${policy.name}'`,
          matchedPolicyId: policy.id,
          matchedPolicyName: policy.name,
          matchedPolicyVersion: policy.version,
          evaluationTrace,
          timestamp: nowIso,
        };
      }
      if (policy.effect === "ALLOW" && context.amount > priceLimit) {
        evaluationTrace.push({
          stage: "PRICE_CEILING_CHECK",
          status: "FAIL",
          detail: `Call amount ${context.amount} HBAR exceeds allow threshold of ${priceLimit} HBAR in policy '${policy.name}'`,
          timestamp: nowIso,
        });
        return {
          allowed: false,
          decisionId,
          outcome: "DENIED",
          reasonCode: "PRICE_LIMIT_EXCEEDED",
          primaryReason: `Amount ${context.amount} HBAR exceeds allowed price ceiling of ${priceLimit} HBAR in '${policy.name}'`,
          matchedPolicyId: policy.id,
          matchedPolicyName: policy.name,
          matchedPolicyVersion: policy.version,
          evaluationTrace,
          timestamp: nowIso,
        };
      }
    }

    if (cond.maxCallsPerMinute !== undefined && cond.maxCallsPerMinute > 0) {
      const key = `${context.agentId}:${context.serviceAddress}`;
      const timestamps = velocityMap.get(key) || [];
      const oneMinAgo = Date.now() - 60000;
      const recent = timestamps.filter((t) => t > oneMinAgo);
      if (recent.length >= cond.maxCallsPerMinute) {
        evaluationTrace.push({
          stage: "VELOCITY_CHECK",
          status: "FAIL",
          detail: `Velocity limit exceeded: ${recent.length} calls in last 60s (max: ${cond.maxCallsPerMinute})`,
          timestamp: nowIso,
        });
        return {
          allowed: false,
          decisionId,
          outcome: "DENIED",
          reasonCode: "VELOCITY_LIMIT_EXCEEDED",
          primaryReason: `Velocity rate limit exceeded (${recent.length}/${cond.maxCallsPerMinute} calls/min) enforced by policy '${policy.name}'`,
          matchedPolicyId: policy.id,
          matchedPolicyName: policy.name,
          matchedPolicyVersion: policy.version,
          evaluationTrace,
          timestamp: nowIso,
        };
      }
    }

    if (policy.effect === "DENY") {
      evaluationTrace.push({
        stage: "POLICY_RESOLUTION",
        status: "FAIL",
        detail: `Explicit DENY rule triggered by policy '${policy.name}' (priority: ${policy.priority})`,
        timestamp: nowIso,
      });
      return {
        allowed: false,
        decisionId,
        outcome: "DENIED",
        reasonCode: "POLICY_DENIED",
        primaryReason: `Explicit DENY policy rule '${policy.name}' matched and rejected authorization`,
        matchedPolicyId: policy.id,
        matchedPolicyName: policy.name,
        matchedPolicyVersion: policy.version,
        evaluationTrace,
        timestamp: nowIso,
      };
    }

    evaluationTrace.push({
      stage: "POLICY_MATCH",
      status: "PASS",
      detail: `Policy '${policy.name}' (ALLOW, priority ${policy.priority}) passed all conditions`,
      timestamp: nowIso,
    });
  }

  evaluationTrace.push({
    stage: "POLICY_RESOLUTION",
    status: "PASS",
    detail: "All applicable policy checks completed successfully",
    timestamp: nowIso,
  });

  return {
    allowed: true,
    decisionId,
    outcome: "ALLOWED",
    reasonCode: "AUTHORIZED",
    primaryReason: "All applicable policy checks passed successfully",
    matchedPolicyId: activePolicies[0].id,
    matchedPolicyName: activePolicies[0].name,
    matchedPolicyVersion: activePolicies[0].version,
    evaluationTrace,
    timestamp: nowIso,
  };
}

function mockCreatePolicy(body: Partial<Policy>): Policy {
  const id = uid("pol_");
  const now = new Date().toISOString();
  const maxPrice = Number(body.maxPricePerCall || body.conditions?.maxPricePerCall) || 10;
  const budget = Number(body.dailyBudget || body.conditions?.dailyBudget) || 50;

  const policy: Policy = {
    id,
    name: body.name || "Unnamed Policy",
    description: body.description || "",
    enabled: body.enabled !== false,
    effect: body.effect || "ALLOW",
    priority: body.priority ?? 100,
    serviceEndpoint: body.serviceEndpoint || "/api/metered-service",
    serviceAddress: body.serviceAddress || "*",
    maxPricePerCall: maxPrice,
    dailyBudget: budget,
    ttlSeconds: Number(body.ttlSeconds) || 3600,
    conditions: body.conditions || {
      maxPricePerCall: maxPrice,
      dailyBudget: budget,
    },
    applicableAgents: body.applicableAgents,
    applicableServices: body.applicableServices,
    applicableActions: body.applicableActions,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  mockStore.policies.set(id, policy);
  return policy;
}

function mockIssueCapability(
  policyId: string,
  budgetOrOptions?: number | IssueCapabilityOptions
): Capability {
  const options: IssueCapabilityOptions =
    typeof budgetOrOptions === "number" ? { budget: budgetOrOptions } : budgetOrOptions || {};

  const policy = mockStore.policies.get(policyId);
  if (!policy) throw new Error(`Policy ${policyId} not found`);

  const targetAgentId = options.agentId || "agent_alpha";
  const agent = mockStore.agents.get(targetAgentId);
  if (agent) {
    if (agent.status === "SUSPENDED") {
      throw new Error(`Cannot issue capability: Agent '${agent.name}' is currently SUSPENDED.`);
    }
    if (agent.status === "REVOKED") {
      throw new Error(`Cannot issue capability: Agent '${agent.name}' is permanently REVOKED.`);
    }
  }

  const budgetTotal = Math.min(options.budget || policy.dailyBudget, policy.dailyBudget);
  const ttl = Math.min(options.ttlSeconds || policy.ttlSeconds, policy.ttlSeconds);
  const expiry = Math.floor(Date.now() / 1000) + ttl;
  const capId = "0x" + uid() + uid() + uid() + uid();

  const actions =
    options.allowedActions && options.allowedActions.length > 0
      ? options.allowedActions
      : ["EXECUTE_METERED_SERVICE"];
  const scope = options.resourceScope || policy.serviceEndpoint;

  const cap: Capability = {
    capId,
    agentId: targetAgentId,
    policyId: policy.id,
    policyHash: "0x" + uid() + uid() + uid() + uid(),
    serviceAddress: policy.serviceAddress,
    allowedActions: actions,
    resourceScope: scope,
    budgetTotal,
    budgetRemaining: budgetTotal,
    currency: "HBAR",
    expiry,
    issuer: "0xBrokerAdminIssuerAddress",
    encryptedCredential: '{"provider":"ledger-keyring-v1","iv":"demo","tag":"demo","ciphertext":"demo"}',
    token: `demo.jwt.${capId}`,
    revoked: false,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  };
  mockStore.capabilities.set(capId, cap);
  mockStore.auditFeed.unshift({
    type: "CAPABILITY_ISSUED",
    capId,
    agentId: targetAgentId,
    service: policy.serviceAddress,
    amount: 0,
    budgetRemaining: budgetTotal,
    policyHash: cap.policyHash,
    reason: `Capability issued with actions [${actions.join(", ")}] and scope '${scope}'`,
    timestamp: new Date().toISOString(),
  });
  return cap;
}

function mockExecuteMeteredCall(
  token: string,
  promptText: string,
  amount: number,
  options?: { action?: string; resource?: string; agentId?: string }
) {
  const capId = token.startsWith("demo.jwt.") ? token.replace("demo.jwt.", "") : null;
  const nowStr = new Date().toISOString();

  if (!capId) {
    const failedPayment: PaymentAttempt = {
      id: uid("pay_"),
      capId: token.slice(0, 12),
      agentId: options?.agentId || "agent_alpha",
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

  // 1. Agent Binding & Substitution Check
  const effectiveAgentId = cap.agentId || "agent_alpha";
  if (options?.agentId && options.agentId !== effectiveAgentId) {
    return {
      status: 403,
      ok: false,
      data: {
        error: "AGENT_MISMATCH",
        message: `Agent binding failure: token belongs to agent '${effectiveAgentId}', but request presented agent '${options.agentId}'`,
      },
    };
  }

  // Authoritative Agent Lifecycle Check in Mock / Offline Mode
  const agent = mockStore.agents.get(effectiveAgentId);

  if (agent) {
    if (agent.status === "SUSPENDED") {
      mockStore.auditFeed.unshift({
        type: "AGENT_AUTHORIZATION_DENIED",
        capId,
        agentId: agent.id,
        agentName: agent.name,
        amount,
        reason: "Agent execution is suspended by administrator",
        timestamp: nowStr,
      });

      const suspendedPayment: PaymentAttempt = {
        id: uid("pay_"),
        capId,
        agentId: agent.id,
        agentName: agent.name,
        serviceAddress: cap.serviceAddress,
        serviceName: "Vaultbreaker AI Text Summarizer API",
        amount,
        asset: "HBAR",
        network: "Hedera Testnet (296)",
        decision: "DENIED",
        status: "REJECTED",
        reason: "AGENT_SUSPENDED",
        evaluationTrace: [
          { stage: "REQUEST_RECEIVED", status: "PASS", detail: "HTTP POST request parsed", timestamp: nowStr },
          { stage: "CAPABILITY_RESOLVED", status: "PASS", detail: `Capability resolved for ${agent.name}`, timestamp: nowStr },
          { stage: "POLICY_EVALUATED", status: "FAIL", detail: `Authorization Gate: Agent '${agent.name}' is currently SUSPENDED. All execution denied.`, timestamp: nowStr },
        ],
        timestamp: nowStr,
        isDemoFixture: true,
      };
      mockStore.paymentAttempts.unshift(suspendedPayment);

      return {
        status: 403,
        ok: false,
        data: {
          error: "AGENT_SUSPENDED",
          message: `Authorization Gate: Agent '${agent.name}' (${agent.id}) is SUSPENDED. All protected metered execution is denied.`,
        },
      };
    }

    if (agent.status === "REVOKED") {
      mockStore.auditFeed.unshift({
        type: "AGENT_AUTHORIZATION_DENIED",
        capId,
        agentId: agent.id,
        agentName: agent.name,
        amount,
        reason: "Agent authority permanently revoked",
        timestamp: nowStr,
      });

      const revokedAgentPayment: PaymentAttempt = {
        id: uid("pay_"),
        capId,
        agentId: agent.id,
        agentName: agent.name,
        serviceAddress: cap.serviceAddress,
        serviceName: "Vaultbreaker AI Text Summarizer API",
        amount,
        asset: "HBAR",
        network: "Hedera Testnet (296)",
        decision: "DENIED",
        status: "REJECTED",
        reason: "AGENT_REVOKED",
        evaluationTrace: [
          { stage: "REQUEST_RECEIVED", status: "PASS", detail: "HTTP POST request parsed", timestamp: nowStr },
          { stage: "CAPABILITY_RESOLVED", status: "PASS", detail: `Capability resolved for ${agent.name}`, timestamp: nowStr },
          { stage: "POLICY_EVALUATED", status: "FAIL", detail: `Authorization Gate: Agent '${agent.name}' is REVOKED. Execution permanently denied.`, timestamp: nowStr },
        ],
        timestamp: nowStr,
        isDemoFixture: true,
      };
      mockStore.paymentAttempts.unshift(revokedAgentPayment);

      return {
        status: 403,
        ok: false,
        data: {
          error: "AGENT_REVOKED",
          message: `Authorization Gate: Agent '${agent.name}' (${agent.id}) is REVOKED. Execution permanently denied.`,
        },
      };
    }
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

  // Action constraint check
  const requestedAction = options?.action || "EXECUTE_METERED_SERVICE";
  if (cap.allowedActions && cap.allowedActions.length > 0 && !cap.allowedActions.includes(requestedAction)) {
    return {
      status: 403,
      ok: false,
      data: {
        error: "ACTION_NOT_PERMITTED",
        message: `Action '${requestedAction}' is not permitted by capability (allowed: [${cap.allowedActions.join(", ")}])`,
      },
    };
  }

  // Resource scope constraint check
  const requestedResource = options?.resource || "/api/metered-service";
  if (
    cap.resourceScope &&
    cap.resourceScope !== "*" &&
    cap.resourceScope !== requestedResource &&
    cap.serviceAddress !== requestedResource
  ) {
    return {
      status: 403,
      ok: false,
      data: {
        error: "RESOURCE_OUT_OF_SCOPE",
        message: `Resource '${requestedResource}' is out of capability scope '${cap.resourceScope}'`,
      },
    };
  }

  // Stage 6: Deterministic Policy Engine Evaluation
  const evalResult = mockEvaluatePolicies({
    agentId: cap.agentId || "agent_alpha",
    serviceAddress: cap.serviceAddress,
    action: requestedAction,
    resource: requestedResource,
    amount,
    policyId: cap.policyId,
  });

  if (!evalResult.allowed) {
    mockStore.auditFeed.unshift({
      type: "POLICY_EVALUATED",
      capId,
      agentId: cap.agentId || "agent_alpha",
      agentName: agent?.name || "Agent Alpha (Summarizer)",
      policyId: evalResult.matchedPolicyId,
      policyName: evalResult.matchedPolicyName,
      decisionId: evalResult.decisionId,
      outcome: "DENIED",
      reasonCode: evalResult.reasonCode,
      reason: evalResult.primaryReason,
      amount,
      timestamp: nowStr,
    });

    const policyDeniedPayment: PaymentAttempt = {
      id: uid("pay_"),
      capId,
      agentId: cap.agentId || "agent_alpha",
      agentName: agent?.name || "Agent Alpha (Summarizer)",
      serviceAddress: cap.serviceAddress,
      serviceName: "Vaultbreaker AI Text Summarizer API",
      amount,
      asset: "HBAR",
      network: "Hedera Testnet (296)",
      decision: "DENIED",
      status: "REJECTED",
      reason: evalResult.reasonCode,
      evaluationTrace: [
        { stage: "REQUEST_RECEIVED", status: "PASS", detail: "HTTP POST request received with token", timestamp: nowStr },
        { stage: "CAPABILITY_RESOLVED", status: "PASS", detail: `Capability resolved: ${capId.slice(0, 10)}...`, timestamp: nowStr },
        ...evalResult.evaluationTrace,
      ],
      timestamp: nowStr,
      isDemoFixture: true,
    };
    mockStore.paymentAttempts.unshift(policyDeniedPayment);

    return {
      status: 403,
      ok: false,
      data: {
        error: evalResult.reasonCode,
        message: evalResult.primaryReason,
        decisionId: evalResult.decisionId,
        evaluation: evalResult,
      },
    };
  }

  // Record velocity for permitted execution
  const velKey = `${cap.agentId || "agent_alpha"}:${cap.serviceAddress}`;
  const nowMs = Date.now();
  const times = velocityMap.get(velKey) || [];
  times.push(nowMs);
  velocityMap.set(velKey, times);

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
        ...evalResult.evaluationTrace,
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
      ...evalResult.evaluationTrace,
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

export async function fetchPolicy(id: string): Promise<Policy | null> {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/policies/${id}`);
    if (!res.ok) return null;
    return res.json();
  }
  return mockStore.policies.get(id) || null;
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

export async function updatePolicy(id: string, updates: Partial<Policy>): Promise<Policy> {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/policies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to update policy (${res.status})`);
    }
    return res.json();
  }
  const policy = mockStore.policies.get(id);
  if (!policy) throw new Error(`Policy ${id} not found`);
  const updated: Policy = {
    ...policy,
    ...updates,
    version: policy.version + 1,
    updatedAt: new Date().toISOString(),
  };
  mockStore.policies.set(id, updated);
  mockStore.auditFeed.unshift({
    type: "POLICY_UPDATED",
    policyId: updated.id,
    policyName: updated.name,
    reason: `Policy updated to v${updated.version}`,
    timestamp: new Date().toISOString(),
  });
  return updated;
}

export async function togglePolicy(id: string): Promise<Policy> {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/policies/${id}/toggle`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to toggle policy (${res.status})`);
    }
    return res.json();
  }
  const policy = mockStore.policies.get(id);
  if (!policy) throw new Error(`Policy ${id} not found`);
  policy.enabled = !policy.enabled;
  policy.version += 1;
  policy.updatedAt = new Date().toISOString();
  mockStore.auditFeed.unshift({
    type: "POLICY_TOGGLED",
    policyId: policy.id,
    policyName: policy.name,
    reason: `Policy ${policy.enabled ? "enabled" : "disabled"}`,
    timestamp: new Date().toISOString(),
  });
  return policy;
}

export async function evaluatePolicyDryRun(
  context: PolicyEvaluationContext
): Promise<PolicyEvaluationResult> {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/policies/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(context),
    });
    return res.json();
  }
  return mockEvaluatePolicies(context);
}

export async function issueCapability(
  policyId: string,
  budgetOrOptions?: number | IssueCapabilityOptions
): Promise<Capability> {
  const options: IssueCapabilityOptions =
    typeof budgetOrOptions === "number" ? { budget: budgetOrOptions } : budgetOrOptions || {};

  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/capabilities/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        policyId,
        agentId: options.agentId,
        requestedBudget: options.budget,
        allowedActions: options.allowedActions,
        resourceScope: options.resourceScope,
        ttlSeconds: options.ttlSeconds,
      }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || errData.error || `Failed to issue capability (${res.status})`);
    }
    return res.json();
  }
  return mockIssueCapability(policyId, options);
}

export async function fetchCapabilities(): Promise<Capability[]> {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/capabilities`);
    return res.json();
  }
  return Array.from(mockStore.capabilities.values());
}

export async function revokeCapability(capId: string, reason?: string) {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/capabilities/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capId, reason }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || errData.error || `Failed to revoke capability (${res.status})`);
    }
    return res.json();
  }
  const cap = mockStore.capabilities.get(capId);
  if (cap) {
    cap.revoked = true;
    cap.revokedAt = new Date().toISOString();
    cap.status = "REVOKED";
    mockStore.auditFeed.unshift({
      type: "CAPABILITY_REVOKED",
      capId,
      agentId: cap.agentId,
      reason: reason || "Administrative revocation",
      timestamp: new Date().toISOString(),
    });
  }
  return { success: true, capId };
}

export async function executeMeteredCall(
  token: string,
  promptText: string,
  amount: number = 10,
  options?: { action?: string; resource?: string; agentId?: string }
) {
  if (mockStore.brokerOnline) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-capability-token": token,
      "x-payment-amount": String(amount),
    };
    if (options?.action) headers["x-action"] = options.action;
    if (options?.resource) headers["x-resource"] = options.resource;
    if (options?.agentId) headers["x-agent-id"] = options.agentId;

    const res = await fetch(`${BROKER_BASE_URL}/api/metered-service`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt: promptText }),
    });
    const data = await res.json();
    return { status: res.status, ok: res.ok, data };
  }
  return mockExecuteMeteredCall(token, promptText, amount, options);
}

export async function fetchAuditFeed(): Promise<HCSAuditEvent[]> {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/audit-feed`);
    return res.json();
  }
  return mockStore.auditFeed;
}

// ---------------------------------------------------------------------------
// Phase 3 & 4 Domain Data Methods: Agents & Lifecycle
// ---------------------------------------------------------------------------

export async function fetchAgents(): Promise<Agent[]> {
  if (mockStore.brokerOnline) {
    try {
      const res = await fetch(`${BROKER_BASE_URL}/api/agents`);
      if (res.ok) {
        const brokerAgents: any[] = await res.json();
        const caps = await fetchCapabilities();
        return brokerAgents.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description || "",
          status: a.status,
          walletAddress: a.walletAddress,
          network: a.network || "Hedera Testnet (296)",
          capabilitiesCount: caps.filter((c: any) => c.agentId === a.id).length,
          totalSpentHbar: a.totalSpentHbar || 0,
          totalCallsExecuted: a.totalCallsExecuted || 0,
          totalCallsRejected: a.totalCallsRejected || 0,
          createdAt: a.createdAt,
          lastActiveAt: a.lastActiveAt,
          isDemoFixture: false,
        }));
      }
    } catch (err) {
      console.warn("[API] fetchAgents broker call notice, falling back to mock:", err);
    }
  }

  const caps = await fetchCapabilities();
  const list = Array.from(mockStore.agents.values()).map((a) => ({ ...a }));
  const alpha = list.find((a) => a.id === "agent_alpha");
  if (alpha) {
    alpha.capabilitiesCount = caps.length;
  }
  return list;
}

export async function fetchAgent(id: string): Promise<Agent | null> {
  if (mockStore.brokerOnline) {
    try {
      const res = await fetch(`${BROKER_BASE_URL}/api/agents/${id}`);
      if (res.ok) {
        const a = await res.json();
        return {
          id: a.id,
          name: a.name,
          description: a.description || "",
          status: a.status,
          walletAddress: a.walletAddress,
          network: a.network || "Hedera Testnet (296)",
          capabilitiesCount: (a.capabilities || []).length,
          totalSpentHbar: a.totalSpentHbar || 0,
          totalCallsExecuted: a.totalCallsExecuted || 0,
          totalCallsRejected: a.totalCallsRejected || 0,
          createdAt: a.createdAt,
          lastActiveAt: a.lastActiveAt,
          isDemoFixture: false,
        };
      }
    } catch {
      // fallback
    }
  }
  return mockStore.agents.get(id) || null;
}

export async function createAgent(input: {
  name: string;
  description?: string;
  walletAddress?: string;
}): Promise<Agent> {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || "Failed to create agent");
    }
    return {
      ...data,
      capabilitiesCount: 0,
      isDemoFixture: false,
    };
  }

  // Client-side demo fallback
  const name = (input.name || "").trim();
  if (!name || name.length < 2) {
    throw new Error("VALIDATION_ERROR: 'name' must be at least 2 characters");
  }

  for (const existing of mockStore.agents.values()) {
    if (existing.name.toLowerCase() === name.toLowerCase()) {
      throw new Error(`CONFLICT: Agent with name '${name}' already exists`);
    }
  }

  const newId = `agent_${uid()}`;
  const now = new Date().toISOString();
  const newAgent: Agent = {
    id: newId,
    name,
    description: (input.description || "").trim(),
    status: "ACTIVE",
    walletAddress: input.walletAddress || `0x${uid()}${uid()}${uid()}`,
    network: "Hedera Testnet (296)",
    capabilitiesCount: 0,
    totalSpentHbar: 0,
    totalCallsExecuted: 0,
    totalCallsRejected: 0,
    createdAt: now,
    lastActiveAt: now,
    isDemoFixture: true,
  };

  mockStore.agents.set(newId, newAgent);
  mockStore.auditFeed.unshift({
    type: "AGENT_REGISTERED",
    agentId: newId,
    agentName: name,
    timestamp: now,
  });

  return newAgent;
}

export async function transitionAgentStatus(
  id: string,
  targetStatus: "ACTIVE" | "SUSPENDED" | "REVOKED",
  reason?: string
): Promise<{ agent: Agent; previousStatus: string; reason?: string }> {
  if (mockStore.brokerOnline) {
    const res = await fetch(`${BROKER_BASE_URL}/api/agents/${id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetStatus, reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || "Failed to transition agent");
    }
    return data;
  }

  // Client-side demo fallback
  const agent = mockStore.agents.get(id);
  if (!agent) throw new Error(`NOT_FOUND: Agent '${id}' not found`);

  const allowed: Record<string, string[]> = {
    ACTIVE: ["SUSPENDED", "REVOKED"],
    SUSPENDED: ["ACTIVE", "REVOKED"],
    REVOKED: [],
  };

  if (!allowed[agent.status]?.includes(targetStatus)) {
    throw new Error(`INVALID_TRANSITION: Cannot transition from ${agent.status} to ${targetStatus}`);
  }

  const previousStatus = agent.status;
  agent.status = targetStatus;
  const now = new Date().toISOString();

  mockStore.auditFeed.unshift({
    type: "AGENT_STATUS_CHANGED",
    agentId: agent.id,
    agentName: agent.name,
    previousStatus,
    newStatus: targetStatus,
    reason: reason || `Transitioned to ${targetStatus}`,
    timestamp: now,
  });

  return { agent, previousStatus, reason };
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
