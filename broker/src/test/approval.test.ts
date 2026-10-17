import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { LedgerKeyRing } from "../ledger/keyring.js";
import { HederaHCSLogger } from "../hedera/hcs.js";
import { PolicyEngine } from "../policy/engine.js";
import { AgentRegistry } from "../agent/registry.js";
import { ApprovalStore, computeRequestFingerprint } from "../approval/store.js";
import { createApiRouter } from "../api/routes.js";

describe("Phase 7: Human Approval & Escalation Test Suite", () => {
  let keyring: LedgerKeyRing;
  let hcsLogger: HederaHCSLogger;
  let policyEngine: PolicyEngine;
  let agentRegistry: AgentRegistry;
  let approvalStore: ApprovalStore;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    keyring = new LedgerKeyRing();
    hcsLogger = new HederaHCSLogger();
    policyEngine = new PolicyEngine(keyring);
    agentRegistry = new AgentRegistry();
    approvalStore = new ApprovalStore();

    const app = express();
    app.use(express.json());
    app.use("/api", createApiRouter(keyring, hcsLogger, policyEngine, agentRegistry, approvalStore));

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
  // A. CANONICAL APPROVAL STORE & STATE MACHINE UNIT GUARANTEES
  // =========================================================================
  describe("A. Approval Store Lifecycle & Cryptographic Fingerprinting", () => {
    it("should compute deterministic SHA-256 fingerprint binding all security parameters", () => {
      const params1 = {
        agentId: "agent_alpha",
        capId: "0x1234567890abcdef",
        serviceAddress: "0x0000000000000000000000000000000000000004",
        targetResource: "/api/metered-service",
        requestedAction: "EXECUTE_METERED_SERVICE",
        requestedAmount: 50,
        asset: "HBAR",
        policyId: "pol_high_value",
        policyVersion: 1,
      };

      const hash1 = computeRequestFingerprint(params1);
      const hash2 = computeRequestFingerprint({ ...params1 });
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex string

      // Any alteration produces a totally different hash
      const hashModifiedAmount = computeRequestFingerprint({ ...params1, requestedAmount: 51 });
      expect(hashModifiedAmount).not.toBe(hash1);

      const hashModifiedResource = computeRequestFingerprint({ ...params1, targetResource: "/api/other" });
      expect(hashModifiedResource).not.toBe(hash1);

      const hashModifiedAction = computeRequestFingerprint({ ...params1, requestedAction: "ADMIN_ACTION" });
      expect(hashModifiedAction).not.toBe(hash1);
    });

    it("should create approval request with PENDING state and lazy expiration", () => {
      const store = new ApprovalStore();
      const req = store.createRequest({
        agentId: "agent_test",
        capId: "0xcap1",
        serviceAddress: "0xsvc1",
        targetResource: "/api/test",
        requestedAction: "EXECUTE",
        requestedAmount: 100,
        policyId: "pol_test",
        reason: "Test escalation",
        ttlSeconds: 2, // 2 seconds TTL
      });

      expect(req.status).toBe("PENDING");
      expect(req.approvalId).toMatch(/^appr_[a-f0-9]{12,16}$/);
      expect(req.id).toBe(req.approvalId);
      expect(req.requestFingerprint).toHaveLength(64);

      const fetched = store.getRequest(req.approvalId);
      expect(fetched?.status).toBe("PENDING");
    });

    it("should transition PENDING -> APPROVED and prevent duplicate decisions", () => {
      const store = new ApprovalStore();
      const req = store.createRequest({
        agentId: "agent_test",
        capId: "0xcap1",
        serviceAddress: "0xsvc1",
        targetResource: "/api/test",
        requestedAction: "EXECUTE",
        requestedAmount: 100,
        policyId: "pol_test",
        reason: "Test escalation",
      });

      const approved = store.approve(req.approvalId, "operator_alice");
      expect(approved.status).toBe("APPROVED");
      expect(approved.decidedBy).toBe("operator_alice");
      expect(approved.decidedAt).toBeDefined();

      // Duplicate approval must throw
      expect(() => store.approve(req.approvalId, "operator_bob")).toThrow(
        /INVALID_STATE_TRANSITION/
      );

      // Rejection after approval must throw
      expect(() => store.reject(req.approvalId, "operator_bob", "Too late")).toThrow(
        /INVALID_STATE_TRANSITION/
      );
    });

    it("should transition PENDING -> REJECTED and require explicit reason", () => {
      const store = new ApprovalStore();
      const req = store.createRequest({
        agentId: "agent_test",
        capId: "0xcap1",
        serviceAddress: "0xsvc1",
        targetResource: "/api/test",
        requestedAction: "EXECUTE",
        requestedAmount: 100,
        policyId: "pol_test",
        reason: "Test escalation",
      });

      // Reject without reason fails
      expect(() => store.reject(req.approvalId, "operator_alice", "")).toThrow(
        /VALIDATION_ERROR/
      );

      const rejected = store.reject(req.approvalId, "operator_alice", "Exceeds daily risk quota");
      expect(rejected.status).toBe("REJECTED");
      expect(rejected.decisionReason).toBe("Exceeds daily risk quota");
      expect(rejected.rejectionReason).toBe("Exceeds daily risk quota");

      // Cannot reopen rejected request
      expect(() => store.approve(req.approvalId, "operator_bob")).toThrow(
        /INVALID_STATE_TRANSITION/
      );
    });

    it("should transition APPROVED -> CONSUMED atomically and prevent replay", () => {
      const store = new ApprovalStore();
      const req = store.createRequest({
        agentId: "agent_test",
        capId: "0xcap1",
        serviceAddress: "0xsvc1",
        targetResource: "/api/test",
        requestedAction: "EXECUTE",
        requestedAmount: 100,
        policyId: "pol_test",
        reason: "Test escalation",
      });

      store.approve(req.approvalId, "operator_alice");

      // Valid consumption
      const { approval, verified } = store.consume(req.approvalId, req.requestFingerprint);
      expect(verified).toBe(true);
      expect(approval.status).toBe("CONSUMED");
      expect(approval.consumedAt).toBeDefined();

      // Second consumption (Replay Attack) must throw
      expect(() => store.consume(req.approvalId, req.requestFingerprint)).toThrow(
        /APPROVAL_ALREADY_CONSUMED/
      );
    });

    it("should automatically expire pending requests after TTL passes", async () => {
      const store = new ApprovalStore();
      const req = store.createRequest({
        agentId: "agent_test",
        capId: "0xcap1",
        serviceAddress: "0xsvc1",
        targetResource: "/api/test",
        requestedAction: "EXECUTE",
        requestedAmount: 100,
        policyId: "pol_test",
        reason: "Short TTL test",
        ttlSeconds: 1, // 1 second
      });

      // Wait 1.1s for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const expired = store.getRequest(req.approvalId);
      expect(expired?.status).toBe("EXPIRED");

      // Cannot approve expired request
      expect(() => store.approve(req.approvalId, "operator_alice")).toThrow(
        /APPROVAL_EXPIRED/
      );
    });
  });

  // =========================================================================
  // B. POLICY-TO-APPROVAL ESCALATION PIPELINE
  // =========================================================================
  describe("B. Policy Escalation & Request Creation via POST /api/metered-service", () => {
    let agentId: string;
    let capToken: string;
    let policyId: string;

    beforeAll(async () => {
      // 1. Register test agent
      const agentRes = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Approval Test Agent",
          description: "Agent to test Phase 7 escalation pipeline",
          walletAddress: "0x111122223333444455556666777788889999aaaa",
        }),
      });
      const agent = (await agentRes.json()) as any;
      agentId = agent.id;

      // 2. Register high-value policy requiring approval above 20 HBAR
      policyId = `pol_esc_${Date.now()}`;
      const polRes = await fetch(`${baseUrl}/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: policyId,
          name: "High Value Escalation Policy",
          description: "Escalates any spend over 20 HBAR to human operator",
          serviceAddress: "0x0000000000000000000000000000000000000004",
          effect: "APPROVAL_REQUIRED",
          applicableAgents: [agentId],
          maxPricePerCall: 100,
          dailyBudget: 500,
          ttlSeconds: 86400,
          allowedActions: ["EXECUTE_METERED_SERVICE"],
          allowedResources: ["/api/metered-service"],
          conditions: {
            requireApprovalAbove: 20,
            requireApproval: true,
            approvalTimeoutSeconds: 3600,
          },
        }),
      });
      expect(polRes.status).toBe(201);
      const pol = (await polRes.json()) as any;
      policyId = pol.id;

      // 3. Issue capability with budget of 100
      const capRes = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          policyId,
          requestedBudget: 100,
          requestedTtlSeconds: 86400,
          allowedActions: ["EXECUTE_METERED_SERVICE"],
          resourceScope: "/api/metered-service",
        }),
      });
      expect(capRes.status).toBe(201);
      const cap = (await capRes.json()) as any;
      capToken = cap.token;
    });

    it("should allow low-value request (<= 20) without human escalation", async () => {
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": capToken,
          "x-payment-amount": "15",
          "x-requested-action": "EXECUTE_METERED_SERVICE",
          "x-target-resource": "/api/metered-service",
        },
        body: JSON.stringify({ prompt: "Standard prompt" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.status).toBe("SUCCESS");
      expect(body.amountCharged).toBe(15);
      expect(body.budgetRemaining).toBe(85);
    });

    it("should escalate high-value request (> 20) returning HTTP 202 APPROVAL_REQUIRED", async () => {
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": capToken,
          "x-payment-amount": "50",
          "x-requested-action": "EXECUTE_METERED_SERVICE",
          "x-target-resource": "/api/metered-service",
        },
        body: JSON.stringify({ prompt: "High value prompt" }),
      });

      expect(res.status).toBe(202);
      const body = (await res.json()) as any;
      expect(body.status).toBe("APPROVAL_REQUIRED");
      expect(body.approval).toBeDefined();
      expect(body.approval.id).toMatch(/^appr_/);
      expect(body.approval.status).toBe("PENDING");
      expect(body.approval.requestedAmount).toBe(50);
      expect(body.approval.fingerprint).toHaveLength(64);

      // CRITICAL GUARANTEE: Zero budget deduction while awaiting approval
      const capCheckRes = await fetch(`${baseUrl}/capabilities/${body.approval.capabilityId}`);
      const capCheck = (await capCheckRes.json()) as any;
      expect(capCheck.budgetRemaining).toBe(85); // Budget remains untouched at 85!
    });

    it("should not reinterpret explicit DENY policy as APPROVAL_REQUIRED", async () => {
      // Register a dedicated agent and explicit DENY policy
      const denyAgentRes = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Deny Test Agent",
          description: "Agent to verify non-reinterpretation of DENY",
        }),
      });
      const denyAgent = (await denyAgentRes.json()) as any;

      const denyPolId = `pol_deny_${Date.now()}`;
      await fetch(`${baseUrl}/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: denyPolId,
          name: "Strict Deny Policy",
          description: "Explicit administrative deny",
          serviceAddress: "0x0000000000000000000000000000000000000004",
          effect: "DENY",
          applicableAgents: [denyAgent.id],
          allowedActions: ["EXECUTE_METERED_SERVICE"],
          allowedResources: ["/api/metered-service"],
        }),
      });

      // Issue capability bound to DENY policy
      const denyCapRes = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: denyAgent.id,
          policyId: denyPolId,
          requestedBudget: 50,
          allowedActions: ["EXECUTE_METERED_SERVICE"],
          resourceScope: "/api/metered-service",
        }),
      });
      const denyCap = (await denyCapRes.json()) as any;

      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": denyCap.token,
          "x-payment-amount": "30",
        },
        body: JSON.stringify({ prompt: "Deny test" }),
      });

      // Must be HTTP 403 Forbidden, NOT HTTP 202
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.outcome).toBe("DENIED");
      expect(body.status).not.toBe("APPROVAL_REQUIRED");
    });
  });

  // =========================================================================
  // C. OPERATOR DECISION API & AUTHENTICATION BOUNDARY
  // =========================================================================
  describe("C. Operator Decision Workflow & Security Boundary", () => {
    let pendingApprovalId: string;
    let capToken: string;

    beforeAll(async () => {
      // Setup escalation
      const agentRes = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Decision Agent",
          description: "Agent to test operator decisions",
        }),
      });
      const agent = (await agentRes.json()) as any;

      const polId = `pol_dec_${Date.now()}`;
      const polRes = await fetch(`${baseUrl}/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: polId,
          name: "Decision Test Policy",
          effect: "APPROVAL_REQUIRED",
          applicableAgents: [agent.id],
          maxPricePerCall: 100,
          dailyBudget: 500,
          ttlSeconds: 86400,
          serviceAddress: "0x0000000000000000000000000000000000000004",
          allowedActions: ["EXECUTE_METERED_SERVICE"],
          allowedResources: ["/api/metered-service"],
          conditions: { requireApprovalAbove: 10 },
        }),
      });
      const pol = (await polRes.json()) as any;
      const resolvedPolId = pol.id || polId;

      const capRes = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          policyId: resolvedPolId,
          requestedBudget: 100,
        }),
      });
      const cap = (await capRes.json()) as any;
      capToken = cap.token;

      // Create an escalated request
      const escRes = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": capToken,
          "x-payment-amount": "40",
        },
        body: JSON.stringify({ prompt: "Escalated for operator" }),
      });
      const escBody = (await escRes.json()) as any;
      pendingApprovalId = escBody.approval.id;
    });

    it("should retrieve approval details via GET /api/approvals/:id", async () => {
      const res = await fetch(`${baseUrl}/approvals/${pendingApprovalId}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.approvalId).toBe(pendingApprovalId);
      expect(body.status).toBe("PENDING");
      expect(body.requestedAmount).toBe(40);
      expect(body.requestFingerprint).toBeDefined();
    });

    it("should report security boundary status via GET /api/approvals/status/security-boundary", async () => {
      const res = await fetch(`${baseUrl}/approvals/status/security-boundary`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.mode).toBeDefined();
      expect(body.notice).toContain("External IdP");
    });

    it("should reject approval rejection without reason (HTTP 400 REASON_REQUIRED)", async () => {
      const res = await fetch(`${baseUrl}/approvals/${pendingApprovalId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "" }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe("REASON_REQUIRED");
    });

    it("should approve pending request via POST /api/approvals/:id/approve", async () => {
      const res = await fetch(`${baseUrl}/approvals/${pendingApprovalId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Notice: Caller-supplied approvedBy must be ignored in favor of server-verified approver
          approvedBy: "malicious_fake_admin",
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.approval.status).toBe("APPROVED");
      // Authoritative identity assigned by server, not client-supplied spoof
      expect(body.approval.decidedBy).toBe("operator_demo_local");
    });

    it("should reject subsequent decision on already decided request (HTTP 409 INVALID_TRANSITION)", async () => {
      const res = await fetch(`${baseUrl}/approvals/${pendingApprovalId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Attempting to reject an already approved request" }),
      });

      expect(res.status).toBe(409);
    });
  });

  // =========================================================================
  // D. SAFE EXECUTION, TAMPER PROTECTION, & REPLAY PREVENTION
  // =========================================================================
  describe("D. Safe Resumption, Cryptographic Integrity & Replay Prevention", () => {
    let agentId: string;
    let capToken: string;
    let capId: string;
    let validApprovalId: string;

    beforeAll(async () => {
      const agentRes = await fetch(`${baseUrl}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Integrity Agent",
          description: "Agent to test execution security",
        }),
      });
      const agent = (await agentRes.json()) as any;
      agentId = agent.id;

      const polId = `pol_int_${Date.now()}`;
      const polRes = await fetch(`${baseUrl}/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: polId,
          name: "Integrity Test Policy",
          effect: "APPROVAL_REQUIRED",
          applicableAgents: [agent.id],
          maxPricePerCall: 100,
          dailyBudget: 500,
          ttlSeconds: 86400,
          serviceAddress: "0x0000000000000000000000000000000000000004",
          allowedActions: ["EXECUTE_METERED_SERVICE"],
          allowedResources: ["/api/metered-service"],
          conditions: { requireApprovalAbove: 15 },
        }),
      });
      const pol = (await polRes.json()) as any;
      const resolvedPolId = pol.id || polId;

      const capRes = await fetch(`${baseUrl}/capabilities/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          policyId: resolvedPolId,
          requestedBudget: 100,
        }),
      });
      const cap = (await capRes.json()) as any;
      capToken = cap.token;
      capId = cap.capId;

      // Trigger escalation for 35 HBAR
      const escRes = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": capToken,
          "x-payment-amount": "35",
        },
        body: JSON.stringify({ prompt: "Execution test prompt" }),
      });
      const escBody = (await escRes.json()) as any;
      validApprovalId = escBody.approval.id;

      // Approve the request
      await fetch(`${baseUrl}/approvals/${validApprovalId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    });

    it("should reject execution if request parameters are tampered (HTTP 403 REQUEST_TAMPER_DETECTED)", async () => {
      // Attempting to execute with 45 HBAR instead of the approved 35 HBAR
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": capToken,
          "x-approval-id": validApprovalId,
          "x-payment-amount": "45", // TAMPERED AMOUNT!
        },
        body: JSON.stringify({ prompt: "Tampered execution" }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe("REQUEST_TAMPER_DETECTED");
      expect(body.message).toContain("parameters do not match the cryptographically bound approval");

      // Verify budget was NOT deducted
      const capCheck = (await (await fetch(`${baseUrl}/capabilities/${capId}`)).json()) as any;
      expect(capCheck.budgetRemaining).toBe(100);
    });

    it("should successfully execute with approved x-approval-id and deduct budget exactly once", async () => {
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": capToken,
          "x-approval-id": validApprovalId,
          "x-payment-amount": "35", // EXACT BOUND AMOUNT
          "x-requested-action": "EXECUTE_METERED_SERVICE",
          "x-target-resource": "/api/metered-service",
        },
        body: JSON.stringify({ prompt: "Legitimate execution" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.status).toBe("SUCCESS");
      expect(body.amountCharged).toBe(35);
      expect(body.budgetRemaining).toBe(65);
      expect(body.approval.status).toBe("CONSUMED");

      // Verify server-side approval status is now CONSUMED
      const appCheck = (await (await fetch(`${baseUrl}/approvals/${validApprovalId}`)).json()) as any;
      expect(appCheck.status).toBe("CONSUMED");
    });

    it("should reject replay attempts using the consumed approval (HTTP 409 APPROVAL_ALREADY_CONSUMED)", async () => {
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": capToken,
          "x-approval-id": validApprovalId, // REPLAY!
          "x-payment-amount": "35",
        },
        body: JSON.stringify({ prompt: "Replay attack prompt" }),
      });

      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.error).toBe("APPROVAL_ALREADY_CONSUMED");

      // Budget remains untouched at 65 (no double spend!)
      const capCheck = (await (await fetch(`${baseUrl}/capabilities/${capId}`)).json()) as any;
      expect(capCheck.budgetRemaining).toBe(65);
    });

    it("should enforce non-overridable checks: suspended agent cannot execute even with approved request", async () => {
      // 1. Create and approve another request
      const escRes = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": capToken,
          "x-payment-amount": "20",
        },
      });
      const escBody = (await escRes.json()) as any;
      const apprId = escBody.approval.id;

      await fetch(`${baseUrl}/approvals/${apprId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // 2. Suspend agent
      await fetch(`${baseUrl}/agents/${agentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "SUSPENDED" }),
      });

      // 3. Attempt execution
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": capToken,
          "x-approval-id": apprId,
          "x-payment-amount": "20",
        },
      });

      // Suspended agent must fail closed!
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe("AGENT_SUSPENDED");

      // Reactivate agent for remaining tests
      await fetch(`${baseUrl}/agents/${agentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "ACTIVE" }),
      });
    });

    it("should enforce non-overridable checks: revoked capability cannot execute even with approved request", async () => {
      // 1. Create and approve another request
      const escRes = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": capToken,
          "x-payment-amount": "20",
        },
      });
      const escBody = (await escRes.json()) as any;
      const apprId = escBody.approval.id;

      await fetch(`${baseUrl}/approvals/${apprId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // 2. Revoke capability
      await fetch(`${baseUrl}/capabilities/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capId, reason: "Administrative security revocation" }),
      });

      // 3. Attempt execution
      const res = await fetch(`${baseUrl}/metered-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-capability-token": capToken,
          "x-approval-id": apprId,
          "x-payment-amount": "20",
        },
      });

      // Revoked capability must fail closed!
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe("CAPABILITY_REVOKED");
    });
  });

  // =========================================================================
  // E. HCS AUDIT TRAIL LOGGING
  // =========================================================================
  describe("E. Hedera Consensus Service Audit Logging", () => {
    it("should record complete approval lifecycle events in HCS audit feed", async () => {
      const res = await fetch(`${baseUrl}/audit-feed`);
      expect(res.status).toBe(200);
      const feed = (await res.json()) as any[];

      const eventTypes = feed.map((e) => e.type);
      expect(eventTypes).toContain("APPROVAL_REQUESTED");
      expect(eventTypes).toContain("APPROVAL_GRANTED");
      expect(eventTypes).toContain("APPROVAL_CONSUMED");
      expect(eventTypes).toContain("APPROVAL_EXECUTION_DENIED");

      // Verify that no secrets or private keys leaked into audit feed
      for (const event of feed) {
        const str = JSON.stringify(event);
        expect(str).not.toContain("seed");
        expect(str).not.toContain("privateKey");
        expect(str).not.toContain("settlementCredentialSecret");
      }
    });
  });
});
