import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { LedgerKeyRing } from "../ledger/keyring.js";
import { HederaHCSLogger } from "../hedera/hcs.js";
import { PolicyEngine } from "../policy/engine.js";
import { AgentRegistry } from "../agent/registry.js";
import { createApiRouter } from "../api/routes.js";

describe("Phase 5: Capability Lifecycle & Permission Management Test Suite", () => {
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

  describe("A. Capability Issuance & Parameter Validation", () => {
    let activeAgentId: string;
    let suspendedAgentId: string;
    let revokedAgentId: string;

    beforeAll(async () => {
      // Create test agents in different lifecycle states
      const resActive = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Cap Active Agent" }),
      });
      activeAgentId = ((await resActive.json()) as any).id;

      const resSuspended = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Cap Suspended Agent" }),
      });
      suspendedAgentId = ((await resSuspended.json()) as any).id;
      await fetch(`${baseUrl}/agents/${suspendedAgentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "SUSPENDED" }),
      });

      const resRevoked = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Cap Revoked Agent" }),
      });
      revokedAgentId = ((await resRevoked.json()) as any).id;
      await fetch(`${baseUrl}/agents/${revokedAgentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "REVOKED" }),
      });
    });

    it("should issue a valid capability with custom actions and scope to an active agent", async () => {
      const res = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: "pol_ai_summarizer_v1",
          agentId: activeAgentId,
          requestedBudget: 40,
          requestedTtlSeconds: 1800,
          allowedActions: ["EXECUTE_METERED_SERVICE", "SUMMARIZE_TEXT"],
          resourceScope: "/api/metered-service",
        }),
      });

      expect(res.status).toBe(201);
      const cap = (await res.json()) as any;
      expect(cap.capId).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(cap.agentId).toBe(activeAgentId);
      expect(cap.budgetTotal).toBe(40);
      expect(cap.budgetRemaining).toBe(40);
      expect(cap.currency).toBe("HBAR");
      expect(cap.allowedActions).toEqual(["EXECUTE_METERED_SERVICE", "SUMMARIZE_TEXT"]);
      expect(cap.resourceScope).toBe("/api/metered-service");
      expect(cap.status).toBe("ACTIVE");
      expect(cap.revoked).toBe(false);
      expect(cap.token).toBeDefined();
    });

    it("should reject capability issuance to a non-existent agent", async () => {
      const res = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: "pol_ai_summarizer_v1",
          agentId: "agent_nonexistent_404",
        }),
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toBe("AGENT_NOT_FOUND");
    });

    it("should reject capability issuance to a SUSPENDED agent", async () => {
      const res = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: "pol_ai_summarizer_v1",
          agentId: suspendedAgentId,
        }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe("AGENT_SUSPENDED");
      expect(body.message).toContain("SUSPENDED");
    });

    it("should reject capability issuance to a REVOKED agent", async () => {
      const res = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: "pol_ai_summarizer_v1",
          agentId: revokedAgentId,
        }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe("AGENT_REVOKED");
    });

    it("should reject capability issuance with invalid policyId", async () => {
      const res = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: "pol_invalid_999",
          agentId: activeAgentId,
        }),
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toBe("POLICY_NOT_FOUND");
    });

    it("should reject capability issuance exceeding policy daily budget ceiling", async () => {
      const res = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: "pol_ai_summarizer_v1",
          agentId: activeAgentId,
          requestedBudget: 999999, // Exceeds dailyBudget (50)
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe("VALIDATION_ERROR");
      expect(body.message).toContain("cannot exceed policy daily budget");
    });

    it("should reject capability issuance with empty allowedActions array", async () => {
      const res = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: "pol_ai_summarizer_v1",
          agentId: activeAgentId,
          allowedActions: [],
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe("VALIDATION_ERROR");
      expect(body.message).toContain("allowedActions");
    });
  });

  describe("B. Least-Privilege Action & Resource Scope Enforcement", () => {
    let scopedAgentId: string;
    let validToken: string;

    beforeAll(async () => {
      const resAgent = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Scope Enforcement Agent" }),
      });
      scopedAgentId = ((await resAgent.json()) as any).id;

      const resCap = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: "pol_ai_summarizer_v1",
          agentId: scopedAgentId,
          requestedBudget: 50,
          requestedTtlSeconds: 3600,
          allowedActions: ["EXECUTE_METERED_SERVICE"],
          resourceScope: "/api/metered-service",
        }),
      });

      const cap = (await resCap.json()) as any;
      validToken = cap.token;
    });

    it("should permit execution when action and resource scope match granted capability", async () => {
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": validToken,
          "x-payment-amount": "10",
          "x-requested-action": "EXECUTE_METERED_SERVICE",
          "x-target-resource": "/api/metered-service",
        },
        body: JSON.stringify({ prompt: "Standard permitted call" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.status).toBe("SUCCESS");
      expect(body.action).toBe("EXECUTE_METERED_SERVICE");
      expect(body.resource).toBe("/api/metered-service");
      expect(body.amountCharged).toBe(10);
    });

    it("should reject request when requested action is not in allowedActions (ACTION_NOT_PERMITTED)", async () => {
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": validToken,
          "x-payment-amount": "10",
          "x-requested-action": "UNAUTHORIZED_ADMIN_DELETE",
          "x-target-resource": "/api/metered-service",
        },
        body: JSON.stringify({ prompt: "Privilege escalation attempt" }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe("ACTION_NOT_PERMITTED");
      expect(body.requestedAction).toBe("UNAUTHORIZED_ADMIN_DELETE");
      expect(body.allowedActions).toContain("EXECUTE_METERED_SERVICE");
    });

    it("should reject request when target resource is outside granted scope (RESOURCE_OUT_OF_SCOPE)", async () => {
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": validToken,
          "x-payment-amount": "10",
          "x-requested-action": "EXECUTE_METERED_SERVICE",
          "x-target-resource": "/api/secret-admin-vault",
        },
        body: JSON.stringify({ prompt: "Out of scope resource access" }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe("RESOURCE_OUT_OF_SCOPE");
      expect(body.targetResource).toBe("/api/secret-admin-vault");
      expect(body.resourceScope).toBe("/api/metered-service");
    });

    it("should reject agent substitution attempt (AGENT_MISMATCH)", async () => {
      // Attacker tries presenting valid token belonging to scopedAgentId, but asserts x-agent-id is agent_other
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": validToken,
          "x-payment-amount": "10",
          "x-agent-id": "agent_impersonator_999",
        },
        body: JSON.stringify({ prompt: "Substitution attempt" }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe("AGENT_MISMATCH");
    });
  });

  describe("C. Expiration & Authoritative Revocation", () => {
    let testAgentId: string;
    let revokedCapId: string;
    let revokedToken: string;

    beforeAll(async () => {
      const resAgent = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Revocation Tester Agent" }),
      });
      testAgentId = ((await resAgent.json()) as any).id;

      const resCap = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: "pol_ai_summarizer_v1",
          agentId: testAgentId,
          requestedBudget: 30,
        }),
      });

      const cap = (await resCap.json()) as any;
      revokedCapId = cap.capId;
      revokedToken = cap.token;
    });

    it("should execute explicit capability revocation via POST /api/capabilities/revoke", async () => {
      const res = await fetch(`${baseUrl}/capabilities/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capId: revokedCapId,
          reason: "Emergency key leak suspicion",
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.capId).toBe(revokedCapId);
      expect(body.status).toBe("REVOKED");
      expect(body.revokedAt).toBeDefined();

      // Verify GET /api/capabilities/:capId reflects REVOKED status
      const getRes = await fetch(`${baseUrl}/capabilities/${revokedCapId}`);
      expect(getRes.status).toBe(200);
      const getBody = (await getRes.json()) as any;
      expect(getBody.revoked).toBe(true);
      expect(getBody.status).toBe("REVOKED");
    });

    it("should reject spend attempts using a REVOKED capability (HTTP 403 CAPABILITY_REVOKED)", async () => {
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": revokedToken,
          "x-payment-amount": "10",
        },
        body: JSON.stringify({ prompt: "Spend on revoked capability" }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe("CAPABILITY_REVOKED");
    });

    it("should return 404 when attempting to revoke an unknown capability", async () => {
      const res = await fetch(`${baseUrl}/capabilities/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capId: "0xdeadbeef99999999999999999999999999999999999999999999999999999999" }),
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toBe("CAPABILITY_NOT_FOUND");
    });

    it("should not reactivate a revoked capability if the owning agent is suspended and resumed", async () => {
      // Suspend agent
      await fetch(`${baseUrl}/agents/${testAgentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "SUSPENDED" }),
      });

      // Resume agent
      await fetch(`${baseUrl}/agents/${testAgentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "ACTIVE" }),
      });

      // Revoked capability must still be revoked!
      const getRes = await fetch(`${baseUrl}/capabilities/${revokedCapId}`);
      const getBody = (await getRes.json()) as any;
      expect(getBody.revoked).toBe(true);
      expect(getBody.status).toBe("REVOKED");

      const spendRes = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": revokedToken,
          "x-payment-amount": "10",
        },
        body: JSON.stringify({ prompt: "Spend attempt after resume" }),
      });
      expect(spendRes.status).toBe(403);
      expect(((await spendRes.json()) as any).error).toBe("CAPABILITY_REVOKED");
    });
  });

  describe("D. Budget Limits & Accounting Guarantees", () => {
    let budgetAgentId: string;
    let budgetToken: string;
    let budgetCapId: string;

    beforeAll(async () => {
      const resAgent = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Budget Accounting Agent" }),
      });
      budgetAgentId = ((await resAgent.json()) as any).id;

      // Issue cap with exact budget 25 HBAR
      const resCap = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: "pol_ai_summarizer_v1",
          agentId: budgetAgentId,
          requestedBudget: 25,
        }),
      });

      const cap = (await resCap.json()) as any;
      budgetCapId = cap.capId;
      budgetToken = cap.token;
    });

    it("should reject negative or zero payment amounts (HTTP 400 INVALID_AMOUNT)", async () => {
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": budgetToken,
          "x-payment-amount": "0",
        },
        body: JSON.stringify({ prompt: "Zero spend" }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe("INVALID_AMOUNT");
    });

    it("should accurately decrement budget on successful spend", async () => {
      // Spend 15 of 25
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": budgetToken,
          "x-payment-amount": "15",
        },
        body: JSON.stringify({ prompt: "First valid spend" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.budgetRemaining).toBe(10);
    });

    it("should reject requests exceeding remaining budget (HTTP 402 INSUFFICIENT_BUDGET)", async () => {
      // Attempt spend 15 when remaining is 10
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": budgetToken,
          "x-payment-amount": "15",
        },
        body: JSON.stringify({ prompt: "Over budget spend" }),
      });

      expect(res.status).toBe(402);
      const body = (await res.json()) as any;
      expect(body.error).toBe("INSUFFICIENT_BUDGET");
      expect(body.budgetRemaining).toBe(10);

      // Verify budget was not decremented on failure!
      const getCap = await fetch(`${baseUrl}/capabilities/${budgetCapId}`);
      const capBody = (await getCap.json()) as any;
      expect(capBody.budgetRemaining).toBe(10);
      expect(capBody.status).toBe("ACTIVE");
    });

    it("should transition status to EXHAUSTED when budget reaches exact zero", async () => {
      // Spend exact remaining 10
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": budgetToken,
          "x-payment-amount": "10",
        },
        body: JSON.stringify({ prompt: "Exact final spend" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.budgetRemaining).toBe(0);

      // Check status is now EXHAUSTED
      const getCap = await fetch(`${baseUrl}/capabilities/${budgetCapId}`);
      const capBody = (await getCap.json()) as any;
      expect(capBody.budgetRemaining).toBe(0);
      expect(capBody.status).toBe("EXHAUSTED");
    });
  });

  describe("E. Hedera HCS Audit Logging Verification", () => {
    it("should record complete audit trail events for capability issuance, revocation, and rejections", async () => {
      const feedRes = await fetch(`${baseUrl}/audit-feed`);
      expect(feedRes.status).toBe(200);

      const events = (await feedRes.json()) as any;
      const issued = events.filter((e: any) => e.type === "CAPABILITY_ISSUED");
      const revoked = events.filter((e: any) => e.type === "CAPABILITY_REVOKED");
      const rejected = events.filter((e: any) => e.type === "CAPABILITY_REJECTED");
      const spent = events.filter((e: any) => e.type === "CAPABILITY_SPENT");

      expect(issued.length).toBeGreaterThan(0);
      expect(revoked.length).toBeGreaterThan(0);
      expect(rejected.length).toBeGreaterThan(0);
      expect(spent.length).toBeGreaterThan(0);
    });
  });
});
