import { describe, it, expect, beforeAll } from "vitest";
import { LedgerKeyRing } from "../ledger/keyring.js";
import { HederaHCSLogger } from "../hedera/hcs.js";
import { PolicyEngine } from "../policy/engine.js";

describe("Vaultbreaker Broker & Ledger Key Ring Test Suite", () => {
  let keyring: LedgerKeyRing;
  let hcsLogger: HederaHCSLogger;
  let policyEngine: PolicyEngine;

  beforeAll(() => {
    keyring = new LedgerKeyRing();
    hcsLogger = new HederaHCSLogger();
    policyEngine = new PolicyEngine(keyring);
  });

  it("should initialize Ledger Key Ring and encrypt/decrypt credentials safely", async () => {
    const status = await keyring.checkAvailability();
    expect(status.initialized).toBe(true);

    const rawSecret = "0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666";
    const encrypted = await keyring.encryptCredential(rawSecret);
    expect(encrypted).not.toBe(rawSecret);

    const decrypted = await keyring.decryptCredential(encrypted);
    expect(decrypted).toBe(rawSecret);
  });

  it("should issue scoped capability token backed by Ledger Key Ring", async () => {
    const policies = policyEngine.listPolicies();
    expect(policies.length).toBeGreaterThan(0);
    const policy = policies[0];

    const capability = await policyEngine.issueCapability(policy.id, 30, 3600);
    expect(capability.capId).toBeDefined();
    expect(capability.budgetRemaining).toBe(30);
    expect(capability.encryptedCredential).toBeDefined();
    expect(capability.token).toBeDefined();
  });

  it("should enforce real-time budget exhaustion rejection", async () => {
    const policies = policyEngine.listPolicies();
    const policy = policies[0];

    // Issue capability with budget of 25 units
    const capability = await policyEngine.issueCapability(policy.id, 25, 3600);

    // Spend 10
    const rem1 = policyEngine.decrementMemoryBudget(capability.capId, 10);
    expect(rem1).toBe(15);

    // Spend 15
    const rem2 = policyEngine.decrementMemoryBudget(capability.capId, 15);
    expect(rem2).toBe(0);

    // Next spend attempt should throw INSUFFICIENT_BUDGET
    expect(() => {
      policyEngine.decrementMemoryBudget(capability.capId, 10);
    }).toThrow("INSUFFICIENT_BUDGET");
  });

  it("should record HCS audit log events cleanly", async () => {
    const result = await hcsLogger.logAuditEvent({
      type: "CAPABILITY_ISSUED",
      capId: "0x1234567890abcdef",
      service: "0x0000000000000000000000000000000000000004",
      amount: 0,
      budgetRemaining: 100,
      timestamp: new Date().toISOString(),
    });

    expect(result.success).toBe(true);

    const feed = await hcsLogger.getAuditLog();
    expect(feed.length).toBeGreaterThan(0);
  });
});
