import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { LedgerKeyRing } from "../ledger/keyring.js";

export interface SpendPolicy {
  id: string;
  name: string;
  serviceEndpoint: string;
  serviceAddress: string;
  maxPricePerCall: number; // in tinybar / HBAR units
  dailyBudget: number;
  ttlSeconds: number;
  createdAt: string;
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

  constructor(keyring: LedgerKeyRing) {
    this.keyring = keyring;

    // Seed a default pay-per-call API policy for demo
    const defaultPolicy: SpendPolicy = {
      id: "pol_ai_summarizer_v1",
      name: "AI Inference & Text Summarization API",
      serviceEndpoint: "/api/metered-service",
      serviceAddress: "0x0000000000000000000000000000000000000004",
      maxPricePerCall: 10,
      dailyBudget: 50,
      ttlSeconds: 3600,
      createdAt: new Date().toISOString(),
    };
    this.policies.set(defaultPolicy.id, defaultPolicy);
  }

  /**
   * Registers a new spend policy for a metered service.
   */
  registerPolicy(policy: Omit<SpendPolicy, "id" | "createdAt">): SpendPolicy {
    const id = `pol_${crypto.randomBytes(6).toString("hex")}`;
    const newPolicy: SpendPolicy = {
      ...policy,
      id,
      createdAt: new Date().toISOString(),
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
