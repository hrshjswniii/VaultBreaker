import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { LedgerKeyRing } from "../ledger/keyring.js";
import { HederaHCSLogger } from "../hedera/hcs.js";
import { PolicyEngine } from "../policy/engine.js";
import { AgentRegistry } from "../agent/registry.js";
import { createApiRouter } from "../api/routes.js";

describe("Phase 4: Agent Lifecycle & Authorization Enforcement Test Suite", () => {
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

  describe("A. Agent Registration & Input Validation", () => {
    it("should list seeded canonical agents", async () => {
      const res = await fetch(`${baseUrl}/agents`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(3);

      const alpha = data.find((a: any) => a.id === "agent_alpha");
      expect(alpha).toBeDefined();
      expect(alpha.status).toBe("ACTIVE");
      expect(alpha.walletAddress).toBeDefined();
    });

    it("should register a valid new agent with auto-generated safe wallet address", async () => {
      const res = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Trading Agent",
          description: "Autonomous bot executing algorithmic rebalancing.",
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.id).toMatch(/^agent_/);
      expect(body.name).toBe("Test Trading Agent");
      expect(body.status).toBe("ACTIVE");
      expect(body.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(body.totalSpentHbar).toBe(0);
      expect(body.totalCallsExecuted).toBe(0);

      // Verify agent is retrievable via GET /api/agents/:id
      const getRes = await fetch(`${baseUrl}/agents/${body.id}`);
      expect(getRes.status).toBe(200);
      const getBody = (await getRes.json()) as any;
      expect(getBody.name).toBe("Test Trading Agent");
      expect(Array.isArray(getBody.capabilities)).toBe(true);
    });

    it("should register a valid agent with explicit valid EVM wallet address", async () => {
      const explicitWallet = "0x1111222233334444555566667777888899990000";
      const res = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Explicit Wallet Agent",
          description: "Agent bound to pre-configured cold storage address",
          walletAddress: explicitWallet,
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.walletAddress).toBe(explicitWallet);
    });

    it("should reject agent creation with duplicate name (CONFLICT)", async () => {
      const res = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Agent Alpha (Summarizer)", // duplicate of seeded agent
        }),
      });

      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.error).toBe("CONFLICT");
    });

    it("should reject agent creation with invalid name or malformed wallet", async () => {
      // Empty name
      const res1 = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });
      expect(res1.status).toBe(400);

      // Whitespace only
      const res2 = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      });
      expect(res2.status).toBe(400);

      // Invalid wallet address format
      const res3 = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bad Wallet Agent", walletAddress: "invalid-not-evm" }),
      });
      expect(res3.status).toBe(400);
      const body3 = (await res3.json()) as any;
      expect(body3.message).toContain("walletAddress");
    });
  });

  describe("B. Authoritative Lifecycle State Machine Transitions", () => {
    let testAgentId: string;

    beforeAll(async () => {
      const res = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Lifecycle Tester Agent" }),
      });
      const body = (await res.json()) as any;
      testAgentId = body.id;
    });

    it("should allow transition: ACTIVE -> SUSPENDED", async () => {
      const res = await fetch(`${baseUrl}/agents/${testAgentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus: "SUSPENDED",
          reason: "Routine security review",
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.agent.status).toBe("SUSPENDED");
      expect(body.previousStatus).toBe("ACTIVE");
      expect(body.reason).toBe("Routine security review");
    });

    it("should allow transition: SUSPENDED -> ACTIVE", async () => {
      const res = await fetch(`${baseUrl}/agents/${testAgentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus: "ACTIVE",
          reason: "Security review completed",
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.agent.status).toBe("ACTIVE");
      expect(body.previousStatus).toBe("SUSPENDED");
    });

    it("should allow transition: ACTIVE -> REVOKED", async () => {
      const res = await fetch(`${baseUrl}/agents/${testAgentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus: "REVOKED",
          reason: "Emergency permanent shutdown",
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.agent.status).toBe("REVOKED");
      expect(body.previousStatus).toBe("ACTIVE");
    });

    it("should prohibit transition out of REVOKED terminal state (REVOKED -> ACTIVE)", async () => {
      const res = await fetch(`${baseUrl}/agents/${testAgentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus: "ACTIVE",
          reason: "Attempt unauthorized reactivation",
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe("INVALID_TRANSITION");

      // Verify status remains REVOKED
      const getRes = await fetch(`${baseUrl}/agents/${testAgentId}`);
      const getBody = (await getRes.json()) as any;
      expect(getBody.status).toBe("REVOKED");
    });

    it("should return 404 for unknown agent transition", async () => {
      const res = await fetch(`${baseUrl}/agents/agent_nonexistent_999/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "SUSPENDED" }),
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toBe("NOT_FOUND");
    });
  });

  describe("C. Server-Side Agent Lifecycle Authorization Enforcement", () => {
    let agentId: string;
    let capabilityToken: string;

    beforeAll(async () => {
      // 1. Register dedicated agent for execution testing
      const agentRes = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Execution Gate Agent" }),
      });
      const agentBody = (await agentRes.json()) as any;
      agentId = agentBody.id;

      // 2. Issue capability bound to this agent
      const polRes = await fetch(`${baseUrl}/policies`);
      const policies = (await polRes.json()) as any;

      const capRes = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: policies[0].id,
          requestedBudget: 50,
          requestedTtlSeconds: 3600,
          agentId,
        }),
      });

      expect(capRes.status).toBe(201);
      const capBody = (await capRes.json()) as any;
      expect(capBody.agentId).toBe(agentId);
      capabilityToken = capBody.token;
    });

    it("should allow metered request when agent is ACTIVE", async () => {
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": capabilityToken,
          "x-payment-amount": "10",
        },
        body: JSON.stringify({ prompt: "Summarize test payload" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.status).toBe("SUCCESS");
      expect(body.agentId).toBe(agentId);
      expect(body.agentStatus).toBe("ACTIVE");
      expect(body.amountCharged).toBe(10);
      expect(body.budgetRemaining).toBe(40);

      // Verify agent activity is tracked
      const agentGet = await fetch(`${baseUrl}/agents/${agentId}`);
      const agentBody = (await agentGet.json()) as any;
      expect(agentBody.totalSpentHbar).toBe(10);
      expect(agentBody.totalCallsExecuted).toBe(1);
    });

    it("should FAIL CLOSED (HTTP 403 AGENT_SUSPENDED) when agent is SUSPENDED", async () => {
      // Suspend agent
      await fetch(`${baseUrl}/agents/${agentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "SUSPENDED", reason: "Rate spike observed" }),
      });

      // Attempt metered call with identical valid token
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": capabilityToken,
          "x-payment-amount": "10",
        },
        body: JSON.stringify({ prompt: "Unauthorized call during suspension" }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe("AGENT_SUSPENDED");
      expect(body.agentId).toBe(agentId);
      expect(body.message).toContain("SUSPENDED");

      // Verify rejected call incremented rejection count
      const agentGet = await fetch(`${baseUrl}/agents/${agentId}`);
      const agentBody = (await agentGet.json()) as any;
      expect(agentBody.totalCallsRejected).toBe(1);
    });

    it("should resume execution when agent is transitioned back to ACTIVE", async () => {
      // Resume agent
      await fetch(`${baseUrl}/agents/${agentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "ACTIVE", reason: "Resumed by operator" }),
      });

      // Metered call should now succeed
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": capabilityToken,
          "x-payment-amount": "10",
        },
        body: JSON.stringify({ prompt: "Call after resume" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.status).toBe("SUCCESS");
      expect(body.budgetRemaining).toBe(30);
    });

    it("should permanently FAIL CLOSED (HTTP 403 AGENT_REVOKED) when agent is REVOKED", async () => {
      // Revoke agent
      await fetch(`${baseUrl}/agents/${agentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "REVOKED", reason: "Decommissioned agent" }),
      });

      // Attempt call
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": capabilityToken,
          "x-payment-amount": "10",
        },
        body: JSON.stringify({ prompt: "Call after revocation" }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe("AGENT_REVOKED");
      expect(body.agentId).toBe(agentId);
    });

    it("should log audit trail events to HCS timeline for all agent lifecycle actions", async () => {
      const feedRes = await fetch(`${baseUrl}/audit-feed`);
      expect(feedRes.status).toBe(200);

      const events = (await feedRes.json()) as any;
      const registeredEvents = events.filter((e: any) => e.type === "AGENT_REGISTERED");
      const statusChangedEvents = events.filter((e: any) => e.type === "AGENT_STATUS_CHANGED");
      const deniedEvents = events.filter((e: any) => e.type === "AGENT_AUTHORIZATION_DENIED");

      expect(registeredEvents.length).toBeGreaterThan(0);
      expect(statusChangedEvents.length).toBeGreaterThan(0);
      expect(deniedEvents.length).toBeGreaterThan(0);
    });
  });
});
