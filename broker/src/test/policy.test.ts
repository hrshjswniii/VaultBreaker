import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { LedgerKeyRing } from "../ledger/keyring.js";
import { HederaHCSLogger } from "../hedera/hcs.js";
import { PolicyEngine } from "../policy/engine.js";
import { AgentRegistry } from "../agent/registry.js";
import { createApiRouter } from "../api/routes.js";

describe("Phase 6: Policy Engine & Authorization Decision System Test Suite", () => {
  let keyring: LedgerKeyRing;
  let hcsLogger: HederaHCSLogger;
  let policyEngine: PolicyEngine;
  let agentRegistry: AgentRegistry;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    keyring = new LedgerKeyRing();
    hcsLogger = new HederaHCSLogger();
    policyEngine = new PolicyEngine(keyring);
    agentRegistry = new AgentRegistry();

    const app = express();
    app.use(express.json());
    app.use("/api", createApiRouter(keyring, hcsLogger, policyEngine, agentRegistry));

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}/api`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // =========================================================================
  // A. POLICY REGISTRATION, UPDATING, AND VERSIONING API
  // =========================================================================
  describe("A. Policy Registration, Updating, and Versioning", () => {
    let createdPolicyId: string;

    it("should list seeded default policies with full canonical fields", async () => {
      const res = await fetch(`${baseUrl}/policies`);
      expect(res.status).toBe(200);

      const policies = (await res.json()) as any[];
      expect(Array.isArray(policies)).toBe(true);
      expect(policies.length).toBeGreaterThanOrEqual(1);

      const defaultPol = policies.find((p) => p.id === "pol_ai_summarizer_v1");
      expect(defaultPol).toBeDefined();
      expect(defaultPol.enabled).toBe(true);
      expect(defaultPol.effect).toBe("ALLOW");
      expect(defaultPol.priority).toBe(100);
      expect(defaultPol.version).toBe(1);
      expect(defaultPol.createdAt).toBeDefined();
      expect(defaultPol.updatedAt).toBeDefined();
    });

    it("should register a valid new policy with rich conditions and version 1", async () => {
      const res = await fetch(`${baseUrl}/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "High-Frequency Compute Policy",
          description: "Strict velocity and pricing limits for compute nodes",
          serviceEndpoint: "/api/compute",
          serviceAddress: "0x0000000000000000000000000000000000000005",
          maxPricePerCall: 5,
          dailyBudget: 25,
          ttlSeconds: 1800,
          effect: "ALLOW",
          priority: 200,
          conditions: {
            maxPricePerCall: 5,
            dailyBudget: 25,
            maxCallsPerMinute: 10,
            allowedHoursUtc: { startHour: 8, endHour: 20 },
            blockedActions: ["EXECUTE_ARBITRARY_CODE"],
            blockedResources: ["/admin/reset"],
          },
        }),
      });

      expect(res.status).toBe(201);
      const policy = (await res.json()) as any;
      expect(policy.id).toMatch(/^pol_/);
      expect(policy.name).toBe("High-Frequency Compute Policy");
      expect(policy.version).toBe(1);
      expect(policy.enabled).toBe(true);
      expect(policy.effect).toBe("ALLOW");
      expect(policy.priority).toBe(200);
      expect(policy.conditions.maxCallsPerMinute).toBe(10);
      expect(policy.conditions.blockedActions).toContain("EXECUTE_ARBITRARY_CODE");

      createdPolicyId = policy.id;
    });

    it("should reject malformed policy registration with missing name or invalid price", async () => {
      const resNoName = await fetch(`${baseUrl}/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "",
          maxPricePerCall: 10,
        }),
      });
      expect(resNoName.status).toBe(400);

      const resBadPrice = await fetch(`${baseUrl}/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Invalid Price Policy",
          maxPricePerCall: -10,
        }),
      });
      expect(resBadPrice.status).toBe(400);
    });

    it("should retrieve a policy by its ID and return 404 for unknown IDs", async () => {
      const resFound = await fetch(`${baseUrl}/policies/${createdPolicyId}`);
      expect(resFound.status).toBe(200);
      const body = (await resFound.json()) as any;
      expect(body.id).toBe(createdPolicyId);

      const resNotFound = await fetch(`${baseUrl}/policies/pol_non_existent_999`);
      expect(resNotFound.status).toBe(404);
    });

    it("should update an existing policy and increment its version from 1 to 2", async () => {
      const resUpdate = await fetch(`${baseUrl}/policies/${createdPolicyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Updated description with relaxed velocity",
          priority: 250,
          conditions: {
            maxPricePerCall: 8,
            maxCallsPerMinute: 20,
          },
        }),
      });

      expect(resUpdate.status).toBe(200);
      const updated = (await resUpdate.json()) as any;
      expect(updated.version).toBe(2);
      expect(updated.priority).toBe(250);
      expect(updated.conditions.maxCallsPerMinute).toBe(20);
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(updated.createdAt).getTime()
      );
    });

    it("should toggle a policy to disabled and increment its version from 2 to 3", async () => {
      const resToggle = await fetch(`${baseUrl}/policies/${createdPolicyId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });

      expect(resToggle.status).toBe(200);
      const toggled = (await resToggle.json()) as any;
      expect(toggled.enabled).toBe(false);
      expect(toggled.version).toBe(3);

      // Re-enable for subsequent tests
      const resReEnable = await fetch(`${baseUrl}/policies/${createdPolicyId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      expect(resReEnable.status).toBe(200);
      expect(((await resReEnable.json()) as any).enabled).toBe(true);
    });
  });

  // =========================================================================
  // B. POLICY EVALUATION ENGINE SEMANTICS & CONDITIONS
  // =========================================================================
  describe("B. Policy Evaluation Semantics & Rule Conditions", () => {
    it("should approve request when within all policy limits and return an evaluation trace", () => {
      const result = policyEngine.evaluatePolicies({
        agentId: "agent_alpha",
        serviceAddress: "0x0000000000000000000000000000000000000004",
        action: "EXECUTE_METERED_SERVICE",
        resource: "/api/metered-service",
        amount: 10,
      });

      expect(result.allowed).toBe(true);
      expect(result.outcome).toBe("ALLOWED");
      expect(result.reasonCode).toBe("AUTHORIZED");
      expect(result.decisionId).toMatch(/^dec_/);
      expect(Array.isArray(result.evaluationTrace)).toBe(true);
      expect(result.evaluationTrace.length).toBeGreaterThan(0);
      expect(result.evaluationTrace.every((step) => step.status === "PASS")).toBe(true);
    });

    it("should reject request when an explicit DENY policy matches (POLICY_DENIED)", () => {
      // Register an explicit deny policy
      const denyPol = policyEngine.registerPolicy({
        name: "Prohibit External Oracle Invocations",
        serviceEndpoint: "/api/oracle",
        serviceAddress: "0x0000000000000000000000000000000000000099",
        maxPricePerCall: 10,
        dailyBudget: 50,
        ttlSeconds: 3600,
        effect: "DENY",
        priority: 300,
      });

      const result = policyEngine.evaluatePolicies({
        agentId: "agent_alpha",
        serviceAddress: "0x0000000000000000000000000000000000000099",
        action: "EXECUTE_METERED_SERVICE",
        resource: "/api/oracle",
        amount: 5,
      });

      expect(result.allowed).toBe(false);
      expect(result.outcome).toBe("DENIED");
      expect(result.reasonCode).toBe("POLICY_DENIED");
      expect(result.matchedPolicyId).toBe(denyPol.id);
      expect(result.primaryReason).toContain("explicitly prohibits");
    });

    it("should enforce conflict resolution: explicit DENY strictly overrides ALLOW", () => {
      const conflictService = "0x00000000000000000000000000000000000000CC";

      // Register ALLOW policy with high priority
      policyEngine.registerPolicy({
        name: "Permit All Traffic",
        serviceEndpoint: "/api/conflict",
        serviceAddress: conflictService,
        maxPricePerCall: 50,
        dailyBudget: 100,
        ttlSeconds: 3600,
        effect: "ALLOW",
        priority: 500,
      });

      // Register DENY policy with lower priority
      policyEngine.registerPolicy({
        name: "Emergency Lockdown Deny",
        serviceEndpoint: "/api/conflict",
        serviceAddress: conflictService,
        maxPricePerCall: 50,
        dailyBudget: 100,
        ttlSeconds: 3600,
        effect: "DENY",
        priority: 100,
      });

      // Evaluation must deny because ANY applicable DENY policy overrides ALLOW!
      const result = policyEngine.evaluatePolicies({
        agentId: "agent_alpha",
        serviceAddress: conflictService,
        action: "EXECUTE_METERED_SERVICE",
        resource: "/api/conflict",
        amount: 10,
      });

      expect(result.allowed).toBe(false);
      expect(result.outcome).toBe("DENIED");
      expect(result.reasonCode).toBe("POLICY_DENIED");
    });

    it("should skip DISABLED policies during evaluation", () => {
      const disabledService = "0x00000000000000000000000000000000000000DD";

      // Register a DENY policy that is DISABLED
      policyEngine.registerPolicy({
        name: "Inactive Deny Policy",
        serviceEndpoint: "/api/disabled",
        serviceAddress: disabledService,
        maxPricePerCall: 50,
        dailyBudget: 100,
        ttlSeconds: 3600,
        effect: "DENY",
        enabled: false,
        priority: 999,
      });

      const result = policyEngine.evaluatePolicies({
        agentId: "agent_alpha",
        serviceAddress: disabledService,
        action: "EXECUTE_METERED_SERVICE",
        resource: "/api/disabled",
        amount: 5,
      });

      // Since the DENY policy is disabled, it should NOT deny!
      expect(result.allowed).toBe(true);
      expect(result.outcome).toBe("ALLOWED");
      expect(
        result.evaluationTrace.some((step) => step.detail.includes("DISABLED"))
      ).toBe(true);
    });

    it("should enforce maxPricePerCall condition ceiling (PRICE_LIMIT_EXCEEDED)", () => {
      const priceCapService = "0x00000000000000000000000000000000000000EE";

      policyEngine.registerPolicy({
        name: "Strict Micro-Price Policy",
        serviceEndpoint: "/api/micropay",
        serviceAddress: priceCapService,
        maxPricePerCall: 5,
        dailyBudget: 50,
        ttlSeconds: 3600,
        conditions: { maxPricePerCall: 5 },
      });

      // Spend 10 when cap is 5
      const result = policyEngine.evaluatePolicies({
        agentId: "agent_alpha",
        serviceAddress: priceCapService,
        action: "EXECUTE_METERED_SERVICE",
        resource: "/api/micropay",
        amount: 10,
      });

      expect(result.allowed).toBe(false);
      expect(result.outcome).toBe("DENIED");
      expect(result.reasonCode).toBe("PRICE_LIMIT_EXCEEDED");
      expect(result.primaryReason).toContain("exceeds policy ceiling of 5");
    });

    it("should enforce blockedActions condition (BLOCKED_ACTION)", () => {
      const actionService = "0x00000000000000000000000000000000000000FF";

      policyEngine.registerPolicy({
        name: "Prohibit Mutation Actions",
        serviceEndpoint: "/api/data",
        serviceAddress: actionService,
        maxPricePerCall: 50,
        dailyBudget: 100,
        ttlSeconds: 3600,
        conditions: {
          blockedActions: ["DELETE_RECORD", "DROP_DATABASE"],
        },
      });

      const result = policyEngine.evaluatePolicies({
        agentId: "agent_alpha",
        serviceAddress: actionService,
        action: "DELETE_RECORD",
        resource: "/api/data",
        amount: 1,
      });

      expect(result.allowed).toBe(false);
      expect(result.outcome).toBe("DENIED");
      expect(result.reasonCode).toBe("BLOCKED_ACTION");
      expect(result.primaryReason).toContain("Action 'DELETE_RECORD' is explicitly blocked");
    });

    it("should enforce blockedResources condition (BLOCKED_RESOURCE)", () => {
      const resourceService = "0x00000000000000000000000000000000000000AA";

      policyEngine.registerPolicy({
        name: "Block Sensitive Endpoints",
        serviceEndpoint: "/api/sensitive",
        serviceAddress: resourceService,
        maxPricePerCall: 50,
        dailyBudget: 100,
        ttlSeconds: 3600,
        conditions: {
          blockedResources: ["/api/sensitive/keys", "/api/sensitive/admin"],
        },
      });

      const result = policyEngine.evaluatePolicies({
        agentId: "agent_alpha",
        serviceAddress: resourceService,
        action: "EXECUTE_METERED_SERVICE",
        resource: "/api/sensitive/keys",
        amount: 1,
      });

      expect(result.allowed).toBe(false);
      expect(result.outcome).toBe("DENIED");
      expect(result.reasonCode).toBe("BLOCKED_RESOURCE");
      expect(result.primaryReason).toContain("Resource '/api/sensitive/keys' is explicitly blocked");
    });

    it("should enforce allowedHoursUtc time window condition (TIME_WINDOW_VIOLATION)", () => {
      const timeService = "0x00000000000000000000000000000000000000BB";

      // Restrict execution to 09:00 - 17:00 UTC
      policyEngine.registerPolicy({
        name: "Business Hours Policy",
        serviceEndpoint: "/api/business",
        serviceAddress: timeService,
        maxPricePerCall: 50,
        dailyBudget: 100,
        ttlSeconds: 3600,
        conditions: {
          allowedHoursUtc: { startHour: 9, endHour: 17 },
        },
      });

      // Test inside window (12:00 UTC)
      const dateInside = new Date("2026-10-14T12:00:00Z");
      const resultInside = policyEngine.evaluatePolicies({
        agentId: "agent_alpha",
        serviceAddress: timeService,
        action: "EXECUTE_METERED_SERVICE",
        resource: "/api/business",
        amount: 5,
        now: dateInside,
      });
      expect(resultInside.allowed).toBe(true);

      // Test outside window (22:00 UTC)
      const dateOutside = new Date("2026-10-14T22:00:00Z");
      const resultOutside = policyEngine.evaluatePolicies({
        agentId: "agent_alpha",
        serviceAddress: timeService,
        action: "EXECUTE_METERED_SERVICE",
        resource: "/api/business",
        amount: 5,
        now: dateOutside,
      });
      expect(resultOutside.allowed).toBe(false);
      expect(resultOutside.outcome).toBe("DENIED");
      expect(resultOutside.reasonCode).toBe("TIME_WINDOW_VIOLATION");
    });

    it("should enforce maxCallsPerMinute velocity cap (VELOCITY_LIMIT_EXCEEDED)", () => {
      policyEngine.clearVelocityTracker();
      const velocityService = "0x0000000000000000000000000000000000000011";

      policyEngine.registerPolicy({
        name: "Strict 2-Call Velocity Cap",
        serviceEndpoint: "/api/limited",
        serviceAddress: velocityService,
        maxPricePerCall: 50,
        dailyBudget: 100,
        ttlSeconds: 3600,
        conditions: {
          maxCallsPerMinute: 2,
        },
      });

      const ctx = {
        agentId: "agent_velocity_tester",
        serviceAddress: velocityService,
        action: "EXECUTE_METERED_SERVICE",
        resource: "/api/limited",
        amount: 1,
      };

      // Call 1: Allowed & recorded
      const res1 = policyEngine.evaluatePolicies(ctx);
      expect(res1.allowed).toBe(true);
      policyEngine.recordVelocity(ctx);

      // Call 2: Allowed & recorded
      const res2 = policyEngine.evaluatePolicies(ctx);
      expect(res2.allowed).toBe(true);
      policyEngine.recordVelocity(ctx);

      // Call 3: Exceeds 2 calls/minute! Must reject
      const res3 = policyEngine.evaluatePolicies(ctx);
      expect(res3.allowed).toBe(false);
      expect(res3.outcome).toBe("DENIED");
      expect(res3.reasonCode).toBe("VELOCITY_LIMIT_EXCEEDED");
      expect(res3.primaryReason).toContain("Velocity limit exceeded");
    });

    it("should fail closed when security context is malformed (POLICY_EVALUATION_FAILED)", () => {
      const result = policyEngine.evaluatePolicies({
        agentId: "",
        serviceAddress: "0x0000000000000000000000000000000000000004",
        action: "EXECUTE_METERED_SERVICE",
        resource: "/api/metered-service",
        amount: -5,
      });

      expect(result.allowed).toBe(false);
      expect(result.outcome).toBe("DENIED");
      expect(result.reasonCode).toBe("POLICY_EVALUATION_FAILED");
    });
  });

  // =========================================================================
  // C. UNIFIED AUTHORIZATION PIPELINE INTEGRATION (/api/metered-service)
  // =========================================================================
  describe("C. Unified Authorization Pipeline Integration", () => {
    let authAgentId: string;
    let authCapId: string;
    let authToken: string;

    beforeAll(async () => {
      // 1. Create an active agent
      const resAgent = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Phase 6 Auth Pipeline Agent" }),
      });
      authAgentId = ((await resAgent.json()) as any).id;

      // 2. Register a custom policy with max price 20
      const resPol = await fetch(`${baseUrl}/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Pipeline Protected Policy",
          serviceEndpoint: "/api/metered-service",
          serviceAddress: "0x0000000000000000000000000000000000000004",
          maxPricePerCall: 20,
          dailyBudget: 60,
          ttlSeconds: 3600,
          conditions: {
            maxPricePerCall: 20,
          },
        }),
      });
      const policyId = ((await resPol.json()) as any).id;

      // 3. Issue capability with budget 50
      const resCap = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId,
          agentId: authAgentId,
          requestedBudget: 50,
        }),
      });
      const cap = (await resCap.json()) as any;
      authCapId = cap.capId;
      authToken = cap.token;
    });

    it("should allow metered request and deduct budget when policy checks pass", async () => {
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": authToken,
          "x-payment-amount": "15",
        },
        body: JSON.stringify({ prompt: "Valid policy check" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.status).toBe("SUCCESS");
      expect(body.budgetRemaining).toBe(35);
      expect(body.decisionId).toBeDefined();
      expect(body.policyDecision).toBeDefined();
      expect(body.policyDecision.outcome).toBe("ALLOWED");
      expect(Array.isArray(body.evaluationTrace)).toBe(true);
    });

    it("should reject request when policy ceiling is violated and preserve remaining budget untouched", async () => {
      // Spend 25 when policy maxPricePerCall is 20
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": authToken,
          "x-payment-amount": "25",
        },
        body: JSON.stringify({ prompt: "Price cap violation" }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe("PRICE_LIMIT_EXCEEDED");
      expect(body.reasonCode).toBe("PRICE_LIMIT_EXCEEDED");
      expect(body.outcome).toBe("DENIED");
      expect(body.decisionId).toBeDefined();

      // Crucial security guarantee: Budget must NOT be decremented on policy rejection!
      const getCap = await fetch(`${baseUrl}/capabilities/${authCapId}`);
      const capData = (await getCap.json()) as any;
      expect(capData.budgetRemaining).toBe(35);
    });

    it("should reject request when an explicit DENY policy is registered and preserve budget", async () => {
      // Register an explicit DENY policy applicable to this service
      const resDeny = await fetch(`${baseUrl}/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Temporary Denial Rule",
          serviceEndpoint: "/api/metered-service",
          serviceAddress: "0x0000000000000000000000000000000000000004",
          maxPricePerCall: 50,
          dailyBudget: 100,
          ttlSeconds: 3600,
          effect: "DENY",
          priority: 500,
        }),
      });
      const denyPolicyId = ((await resDeny.json()) as any).id;

      // Attempt call of 10 HBAR (which would otherwise pass)
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": authToken,
          "x-payment-amount": "10",
        },
        body: JSON.stringify({ prompt: "Denied by admin policy" }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe("POLICY_DENIED");
      expect(body.matchedPolicyId).toBe(denyPolicyId);

      // Verify budget remains intact at 35
      const getCap = await fetch(`${baseUrl}/capabilities/${authCapId}`);
      const capData = (await getCap.json()) as any;
      expect(capData.budgetRemaining).toBe(35);

      // Disable the deny policy so it doesn't affect other tests
      await fetch(`${baseUrl}/policies/${denyPolicyId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
    });

    it("should prevent forged client-supplied policy IDs from bypassing policy evaluation", async () => {
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": authToken,
          "x-payment-amount": "10",
          "x-policy-id": "pol_fabricated_allow_all",
        },
        body: JSON.stringify({ prompt: "Forged policy test" }),
      });

      // The server ignores the forged header and evaluates real server-side policies
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.policyDecision.matchedPolicyId).not.toBe("pol_fabricated_allow_all");
    });
  });

  // =========================================================================
  // D. DRY-RUN POLICY EVALUATION ENDPOINT (/api/policies/evaluate)
  // =========================================================================
  describe("D. Dry-Run Policy Evaluation Endpoint", () => {
    it("should execute dry-run evaluation returning ALLOWED without mutating state", async () => {
      const res = await fetch(`${baseUrl}/policies/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent_alpha",
          serviceAddress: "0x0000000000000000000000000000000000000004",
          action: "EXECUTE_METERED_SERVICE",
          resource: "/api/metered-service",
          amount: 10,
        }),
      });

      expect(res.status).toBe(200);
      const result = (await res.json()) as any;
      expect(result.allowed).toBe(true);
      expect(result.outcome).toBe("ALLOWED");
      expect(result.decisionId).toBeDefined();
      expect(Array.isArray(result.evaluationTrace)).toBe(true);
      expect(result.evaluationTrace.length).toBeGreaterThan(0);
    });

    it("should execute dry-run evaluation returning DENIED with detailed evaluation trace", async () => {
      // Register a policy blocking action 'EXPORT_DATA'
      await fetch(`${baseUrl}/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Export Block Rule",
          serviceEndpoint: "/api/metered-service",
          serviceAddress: "0x0000000000000000000000000000000000000004",
          maxPricePerCall: 50,
          dailyBudget: 100,
          ttlSeconds: 3600,
          conditions: {
            blockedActions: ["EXPORT_DATA"],
          },
        }),
      });

      const res = await fetch(`${baseUrl}/policies/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent_alpha",
          serviceAddress: "0x0000000000000000000000000000000000000004",
          action: "EXPORT_DATA",
          resource: "/api/metered-service",
          amount: 10,
        }),
      });

      expect(res.status).toBe(200);
      const result = (await res.json()) as any;
      expect(result.allowed).toBe(false);
      expect(result.outcome).toBe("DENIED");
      expect(result.reasonCode).toBe("BLOCKED_ACTION");
      expect(
        result.evaluationTrace.some((step: any) => step.status === "FAIL")
      ).toBe(true);
    });

    it("should record policy audit events in HCS audit feed", async () => {
      const resFeed = await fetch(`${baseUrl}/audit-feed`);
      expect(resFeed.status).toBe(200);
      const feed = (await resFeed.json()) as any[];

      const hasPolicyReg = feed.some((e) => e.type === "POLICY_REGISTERED");
      const hasPolicyUpd = feed.some((e) => e.type === "POLICY_UPDATED");
      const hasPolicyTog = feed.some((e) => e.type === "POLICY_TOGGLED");

      expect(hasPolicyReg).toBe(true);
      expect(hasPolicyUpd).toBe(true);
      expect(hasPolicyTog).toBe(true);
    });
  });
});
