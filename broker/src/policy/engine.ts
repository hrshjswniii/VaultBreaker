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

export interface IssuedCapability {
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

const JWT_SECRET = process.env.JWT_SECRET || "vaultbreaker-broker-jwt-signing-secret-2026";

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
   */
  async issueCapability(
    policyId: string,
    requestedBudget?: number,
    requestedTtlSeconds?: number,
    settlementCredentialSecret?: string
  ): Promise<IssuedCapability> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy ${policyId} not found`);
    }

    const budgetTotal = Math.min(requestedBudget || policy.dailyBudget, policy.dailyBudget);
    const ttl = Math.min(requestedTtlSeconds || policy.ttlSeconds, policy.ttlSeconds);
    const expiry = Math.floor(Date.now() / 1000) + ttl;

    // Compute policy hash
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

    // Generate deterministic capability ID nonce
    const nonceHex = crypto.randomBytes(16).toString("hex");
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const capId = ethers.keccak256(
      abiCoder.encode(
        ["bytes32", "address", "uint256", "uint256", "bytes16"],
        [policyHash, policy.serviceAddress, budgetTotal, expiry, `0x${nonceHex}`]
      )
    );

    // Encrypt underlying settlement credential via Ledger Key Ring
    const credentialToProtect = settlementCredentialSecret || process.env.DEPLOYER_PRIVATE_KEY || "0x0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff";
    const encryptedCredential = await this.keyring.encryptCredential(credentialToProtect);

    // Sign scoped JWT token for AI Agent (Agent NEVER sees raw credential)
    const token = jwt.sign(
      {
        capId,
        policyId: policy.id,
        policyHash,
        service: policy.serviceAddress,
        maxPricePerCall: policy.maxPricePerCall,
        budgetTotal,
        expiry,
      },
      JWT_SECRET,
      { expiresIn: ttl }
    );

    const capability: IssuedCapability = {
      capId,
      policyId: policy.id,
      policyHash,
      serviceAddress: policy.serviceAddress,
      budgetTotal,
      budgetRemaining: budgetTotal,
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

  listCapabilities(): IssuedCapability[] {
    return Array.from(this.capabilities.values());
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
    if (cap.budgetRemaining < amount) throw new Error("INSUFFICIENT_BUDGET");
    cap.budgetRemaining -= amount;
    return cap.budgetRemaining;
  }

  revokeCapability(capId: string): boolean {
    const cap = this.capabilities.get(capId);
    if (!cap) return false;
    cap.revoked = true;
    return true;
  }
}
