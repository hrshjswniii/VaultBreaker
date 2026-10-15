import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { LedgerKeyRing } from "../ledger/keyring.js";

export type PolicyEffect = "ALLOW" | "DENY";

export interface PolicyConditions {
  maxPricePerCall?: number; // Ceiling per call (e.g. 10 HBAR)
  dailyBudget?: number; // Daily rolling budget limit
  maxCallsPerMinute?: number; // Velocity cap: maximum requests per 60s window
  allowedHoursUtc?: { startHour: number; endHour: number }; // Time window (0-23 UTC)
  blockedActions?: string[]; // Explicitly blocked action names
  blockedResources?: string[]; // Explicitly blocked endpoint paths
}

export interface SpendPolicy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  effect: PolicyEffect;
  priority: number; // Higher number = higher precedence (default: 100)
  serviceEndpoint: string;
  serviceAddress: string;
  maxPricePerCall: number; // Backwards-compatible shorthand
  dailyBudget: number; // Backwards-compatible shorthand
  ttlSeconds: number; // Default TTL for capability issuance
  conditions?: PolicyConditions;
  applicableAgents?: string[]; // Specific agent IDs (empty/undefined = all)
  applicableServices?: string[]; // Specific service addresses (empty/undefined = all)
  applicableActions?: string[]; // Specific actions (empty/undefined = all)
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationStep {
  stage: string;
  status: "PASS" | "FAIL" | "SKIPPED";
  detail: string;
  timestamp: string;
}

export interface PolicyEvaluationContext {
  agentId: string;
  serviceAddress: string;
  action: string;
  resource: string;
  amount: number;
  policyId?: string;
  now?: Date;
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

export interface IssuedCapability {
  capId: string;
  agentId: string;
  policyId: string;
  policyHash: string;
  serviceAddress: string;
  allowedActions: string[];
  resourceScope: string;
  budgetTotal: number;
  budgetRemaining: number;
  currency: string;
  expiry: number; // Unix timestamp in seconds (UTC)
  issuer: string;
  encryptedCredential: string;
  token: string;
  revoked: boolean;
  revokedAt?: string;
  createdAt: string;
}

export interface IssueCapabilityParams {
  policyId: string;
  requestedBudget?: number;
  requestedTtlSeconds?: number;
  settlementCredentialSecret?: string;
  agentId?: string;
  allowedActions?: string[];
  resourceScope?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "vaultbreaker-broker-jwt-signing-secret-2026";

/**
 * Authoritatively calculates capability lifecycle status based on immutable invariants:
 * 1. If explicitly revoked -> REVOKED
 * 2. If current UTC timestamp >= expiry -> EXPIRED
 * 3. If remaining budget is zero -> EXHAUSTED
 * 4. Otherwise -> ACTIVE
 */
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

export class PolicyEngine {
  private policies: Map<string, SpendPolicy> = new Map();
  private capabilities: Map<string, IssuedCapability> = new Map();
  private keyring: LedgerKeyRing;
  private velocityTracker: Map<string, number[]> = new Map();

  constructor(keyring: LedgerKeyRing) {
    this.keyring = keyring;

    // Seed a default pay-per-call API policy for demo with full canonical fields
    const defaultPolicy: SpendPolicy = {
      id: "pol_ai_summarizer_v1",
      name: "AI Inference & Text Summarization API",
      description: "Default spend and velocity guardrails for text summarization service",
      enabled: true,
      effect: "ALLOW",
      priority: 100,
      serviceEndpoint: "/api/metered-service",
      serviceAddress: "0x0000000000000000000000000000000000000004",
      maxPricePerCall: 50,
      dailyBudget: 50,
      ttlSeconds: 3600,
      conditions: {
        maxPricePerCall: 50,
        dailyBudget: 50,
        maxCallsPerMinute: 60,
      },
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

    };
    this.policies.set(defaultPolicy.id, defaultPolicy);
  }

  /**
   * Registers a new spend policy for a metered service with strict validation.
   */
  registerPolicy(policy: Partial<SpendPolicy> & { name: string }): SpendPolicy {
    if (!policy.name || !policy.name.trim()) {
      throw new Error("VALIDATION_ERROR: 'name' is required");
    }

    const serviceEndpoint = policy.serviceEndpoint?.trim() || "/api/metered-service";
    const serviceAddress = policy.serviceAddress?.trim() || "0x0000000000000000000000000000000000000004";

    const maxPricePerCall = Number(policy.maxPricePerCall ?? 10);
    if (isNaN(maxPricePerCall) || maxPricePerCall <= 0) {
      throw new Error("VALIDATION_ERROR: 'maxPricePerCall' must be a positive number");
    }

    const dailyBudget = Number(policy.dailyBudget ?? 50);
    if (isNaN(dailyBudget) || dailyBudget <= 0) {
      throw new Error("VALIDATION_ERROR: 'dailyBudget' must be a positive number");
    }

    const ttlSeconds = Number(policy.ttlSeconds ?? 3600);
    if (isNaN(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error("VALIDATION_ERROR: 'ttlSeconds' must be a positive integer");
    }

    // Validate conditions if provided
    if (policy.conditions?.allowedHoursUtc) {
      const { startHour, endHour } = policy.conditions.allowedHoursUtc;
      if (
        startHour == null ||
        endHour == null ||
        startHour < 0 ||
        startHour > 23 ||
        endHour < 0 ||
        endHour > 23
      ) {
        throw new Error("VALIDATION_ERROR: 'allowedHoursUtc' hours must be integers between 0 and 23");
      }
    }

    if (policy.conditions?.maxCallsPerMinute !== undefined) {
      const limit = Number(policy.conditions.maxCallsPerMinute);
      if (isNaN(limit) || limit <= 0) {
        throw new Error("VALIDATION_ERROR: 'maxCallsPerMinute' must be a positive integer");
      }
    }

    const id = `pol_${crypto.randomBytes(6).toString("hex")}`;
    const nowIso = new Date().toISOString();

    const newPolicy: SpendPolicy = {
      id,
      name: policy.name.trim(),
      description: policy.description?.trim(),
      enabled: policy.enabled !== undefined ? Boolean(policy.enabled) : true,
      effect: policy.effect === "DENY" ? "DENY" : "ALLOW",
      priority: Number(policy.priority ?? 100),
      serviceEndpoint,
      serviceAddress,
      maxPricePerCall,
      dailyBudget,
      ttlSeconds,
      conditions: policy.conditions,
      applicableAgents: policy.applicableAgents,
      applicableServices: policy.applicableServices,
      applicableActions: policy.applicableActions,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.policies.set(id, newPolicy);
    return newPolicy;
  }

  getPolicy(id: string): SpendPolicy | undefined {
    return this.policies.get(id);
  }

  listPolicies(): SpendPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Updates an existing policy and deterministically increments its revision version.
   */
  updatePolicy(id: string, updates: Partial<SpendPolicy>): SpendPolicy {
    const existing = this.policies.get(id);
    if (!existing) {
      throw new Error(`NOT_FOUND: Policy '${id}' does not exist`);
    }

    if (updates.name !== undefined && !updates.name.trim()) {
      throw new Error("VALIDATION_ERROR: 'name' cannot be empty");
    }

    if (updates.maxPricePerCall !== undefined) {
      const price = Number(updates.maxPricePerCall);
      if (isNaN(price) || price <= 0) {
        throw new Error("VALIDATION_ERROR: 'maxPricePerCall' must be a positive number");
      }
      existing.maxPricePerCall = price;
    }

    if (updates.dailyBudget !== undefined) {
      const budget = Number(updates.dailyBudget);
      if (isNaN(budget) || budget <= 0) {
        throw new Error("VALIDATION_ERROR: 'dailyBudget' must be a positive number");
      }
      existing.dailyBudget = budget;
    }

    if (updates.ttlSeconds !== undefined) {
      const ttl = Number(updates.ttlSeconds);
      if (isNaN(ttl) || ttl <= 0) {
        throw new Error("VALIDATION_ERROR: 'ttlSeconds' must be a positive integer");
      }
      existing.ttlSeconds = ttl;
    }

    if (updates.priority !== undefined) {
      existing.priority = Number(updates.priority);
    }

    if (updates.name !== undefined) existing.name = updates.name.trim();
    if (updates.description !== undefined) existing.description = updates.description.trim();
    if (updates.enabled !== undefined) existing.enabled = Boolean(updates.enabled);
    if (updates.effect !== undefined) existing.effect = updates.effect === "DENY" ? "DENY" : "ALLOW";
    if (updates.serviceEndpoint !== undefined) existing.serviceEndpoint = updates.serviceEndpoint.trim();
    if (updates.serviceAddress !== undefined) existing.serviceAddress = updates.serviceAddress.trim();
    if (updates.conditions !== undefined) existing.conditions = updates.conditions;
    if (updates.applicableAgents !== undefined) existing.applicableAgents = updates.applicableAgents;
    if (updates.applicableServices !== undefined) existing.applicableServices = updates.applicableServices;
    if (updates.applicableActions !== undefined) existing.applicableActions = updates.applicableActions;

    existing.version += 1;
    existing.updatedAt = new Date().toISOString();

    return existing;
  }

  /**
   * Toggles enabled/disabled state of a policy and increments version.
   */
  togglePolicy(id: string, enabled?: boolean): SpendPolicy {
    const existing = this.policies.get(id);
    if (!existing) {
      throw new Error(`NOT_FOUND: Policy '${id}' does not exist`);
    }

    existing.enabled = enabled !== undefined ? Boolean(enabled) : !existing.enabled;
    existing.version += 1;
    existing.updatedAt = new Date().toISOString();
    return existing;
  }

  deletePolicy(id: string): boolean {
    return this.policies.delete(id);
  }


  /**
   * Mints a short-lived, scoped Capability Token backed by Ledger Key Ring credential protection.
   * Enforces least-privilege action constraints, resource scopes, and financial budget bounds.
   */
  async issueCapability(
    policyIdOrParams: string | IssueCapabilityParams,
    requestedBudget?: number,
    requestedTtlSeconds?: number,
    settlementCredentialSecret?: string,
    agentId?: string,
    allowedActions?: string[],
    resourceScope?: string
  ): Promise<IssuedCapability> {
    let params: IssueCapabilityParams;
    if (typeof policyIdOrParams === "object") {
      params = policyIdOrParams;
    } else {
      params = {
        policyId: policyIdOrParams,
        requestedBudget,
        requestedTtlSeconds,
        settlementCredentialSecret,
        agentId,
        allowedActions,
        resourceScope,
      };
    }

    const policy = this.policies.get(params.policyId);
    if (!policy) {
      throw new Error(`Policy ${params.policyId} not found`);
    }

    // 1. Budget Bounds Validation
    let budgetTotal = policy.dailyBudget;
    if (params.requestedBudget !== undefined) {
      const budgetNum = Number(params.requestedBudget);
      if (isNaN(budgetNum) || budgetNum <= 0) {
        throw new Error("VALIDATION_ERROR: 'requestedBudget' must be a positive integer");
      }
      if (budgetNum > policy.dailyBudget) {
        throw new Error(
          `VALIDATION_ERROR: 'requestedBudget' (${budgetNum}) cannot exceed policy daily budget ceiling (${policy.dailyBudget})`
        );
      }
      budgetTotal = Math.floor(budgetNum);
    }

    // 2. TTL and Expiration Validation
    let ttl = policy.ttlSeconds;
    if (params.requestedTtlSeconds !== undefined) {
      const ttlNum = Number(params.requestedTtlSeconds);
      if (isNaN(ttlNum) || ttlNum <= 0) {
        throw new Error("VALIDATION_ERROR: 'requestedTtlSeconds' must be a positive integer");
      }
      if (ttlNum > policy.ttlSeconds) {
        throw new Error(
          `VALIDATION_ERROR: 'requestedTtlSeconds' (${ttlNum}) cannot exceed policy TTL ceiling (${policy.ttlSeconds}s)`
        );
      }
      ttl = Math.floor(ttlNum);
    }
    const expiry = Math.floor(Date.now() / 1000) + ttl;

    // 3. Actions Validation
    let actions: string[] = ["EXECUTE_METERED_SERVICE"];
    if (params.allowedActions !== undefined) {
      if (!Array.isArray(params.allowedActions) || params.allowedActions.length === 0) {
        throw new Error("VALIDATION_ERROR: 'allowedActions' must be a non-empty array of action strings");
      }
      actions = params.allowedActions.map((a) => {
        if (typeof a !== "string" || !a.trim()) {
          throw new Error("VALIDATION_ERROR: Action elements must be non-empty strings");
        }
        return a.trim();
      });
    }

    // 4. Resource Scope Validation
    let scope = policy.serviceEndpoint;
    if (params.resourceScope !== undefined) {
      if (typeof params.resourceScope !== "string" || !params.resourceScope.trim()) {
        throw new Error("VALIDATION_ERROR: 'resourceScope' must be a non-empty endpoint path or string");
      }
      scope = params.resourceScope.trim();
    }

    const targetAgentId = params.agentId || "agent_alpha";

    // 5. Compute cryptographic policy hash
    const policyHash = ethers.keccak256(
      ethers.toUtf8Bytes(
        JSON.stringify({
          policyId: policy.id,
          service: policy.serviceAddress,
          maxPricePerCall: policy.maxPricePerCall,
          dailyBudget: policy.dailyBudget,
        })
      )
    );

    // 6. Generate deterministic capability ID nonce
    const nonceHex = crypto.randomBytes(16).toString("hex");
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const capId = ethers.keccak256(
      abiCoder.encode(
        ["bytes32", "address", "uint256", "uint256", "bytes16"],
        [policyHash, policy.serviceAddress, budgetTotal, expiry, `0x${nonceHex}`]
      )
    );

    // 7. Encrypt underlying settlement credential via Ledger Key Ring
    const credentialToProtect =
      params.settlementCredentialSecret ||
      process.env.DEPLOYER_PRIVATE_KEY ||
      "0x0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff";
    const encryptedCredential = await this.keyring.encryptCredential(credentialToProtect);

    // 8. Sign scoped JWT token for AI Agent with embedded actions and scope
    const token = jwt.sign(
      {
        capId,
        agentId: targetAgentId,
        policyId: policy.id,
        policyHash,
        service: policy.serviceAddress,
        allowedActions: actions,
        resourceScope: scope,
        maxPricePerCall: policy.maxPricePerCall,
        budgetTotal,
        currency: "HBAR",
        expiry,
      },
      JWT_SECRET,
      { expiresIn: ttl }
    );

    const capability: IssuedCapability = {
      capId,
      agentId: targetAgentId,
      policyId: policy.id,
      policyHash,
      serviceAddress: policy.serviceAddress,
      allowedActions: actions,
      resourceScope: scope,
      budgetTotal,
      budgetRemaining: budgetTotal,
      currency: "HBAR",
      expiry,
      issuer: "0xBrokerAdminIssuerAddress",
      encryptedCredential,
      token,
      revoked: false,
      createdAt: new Date().toISOString(),
    };

    this.capabilities.set(capId, capability);
    return capability;
  }

  getCapability(capId: string): IssuedCapability | undefined {
    return this.capabilities.get(capId);
  }

  listCapabilities(agentIdFilter?: string): IssuedCapability[] {
    const all = Array.from(this.capabilities.values());
    if (agentIdFilter) {
      return all.filter((c) => c.agentId === agentIdFilter);
    }
    return all;
  }

  verifyToken(tokenString: string): any {
    try {
      return jwt.verify(tokenString, JWT_SECRET);
    } catch {
      throw new Error("Invalid or expired capability token signature");
    }
  }

  decrementMemoryBudget(capId: string, amount: number): number {
    const cap = this.capabilities.get(capId);
    if (!cap) throw new Error("Capability not found");
    if (cap.revoked) throw new Error("CAPABILITY_REVOKED");
    if (Math.floor(Date.now() / 1000) >= cap.expiry) throw new Error("CAPABILITY_EXPIRED");
    if (amount <= 0) throw new Error("INVALID_AMOUNT: Spend amount must be greater than zero");
    if (cap.budgetRemaining < amount) throw new Error("INSUFFICIENT_BUDGET");

    cap.budgetRemaining -= amount;
    return cap.budgetRemaining;
  }

  revokeCapability(capId: string): boolean {
    const cap = this.capabilities.get(capId);
    if (!cap) return false;
    cap.revoked = true;
    cap.revokedAt = new Date().toISOString();
    return true;
  }
}
