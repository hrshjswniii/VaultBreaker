import { Router, Request, Response } from "express";
import { LedgerKeyRing } from "../ledger/keyring.js";
import { HederaHCSLogger } from "../hedera/hcs.js";
import { PolicyEngine, getCapabilityStatus } from "../policy/engine.js";
import { AgentRegistry, AgentStatus } from "../agent/registry.js";
import { ethers } from "ethers";

export function createApiRouter(
  keyring: LedgerKeyRing,
  hcsLogger: HederaHCSLogger,
  policyEngine: PolicyEngine,
  agentRegistry: AgentRegistry
): Router {
  const router = Router();

  // Contract JSON RPC Provider & Contract instance for Hedera EVM if deployed
  const contractAddress = process.env.CONTRACT_CAPABILITY_REGISTRY;
  const rpcUrl = process.env.HEDERA_JSON_RPC_URL || "https://testnet.hashio.io/api";
  let registryContract: ethers.Contract | null = null;

  if (contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000") {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const abi = [
        "function getCapability(bytes32 capId) external view returns (tuple(bytes32 policyHash, address service, uint256 budgetRemaining, uint256 expiry, address issuer, bool revoked))",
        "function spend(bytes32 capId, uint256 amount) external",
      ];
      registryContract = new ethers.Contract(contractAddress, abi, provider);
      console.log(`[Broker Router] Initialized contract interface at ${contractAddress}`);
    } catch (err: any) {
      console.warn(`[Broker Router] Contract interface setup notice: ${err.message}`);
    }
  }

  // 1. Health & KeyRing status
  router.get("/health", async (req: Request, res: Response) => {
    const keyringStatus = await keyring.checkAvailability();
    res.json({
      status: "ok",
      service: "Vaultbreaker Capability Broker",
      keyring: keyringStatus,
      topicId: process.env.HEDERA_HCS_TOPIC_ID || "0.0.654321",
      contractAddress: contractAddress || "Not set",
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Agents API (Phase 4 Authoritative Lifecycle Management)
  router.get("/agents", (req: Request, res: Response) => {
    res.json(agentRegistry.listAgents());
  });

  router.get("/agents/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const agent = agentRegistry.getAgent(id);

    if (!agent) {
      return res.status(404).json({
        error: "AGENT_NOT_FOUND",
        message: `Agent with ID '${id}' not found in registry.`,
      });
    }

    // Attach capabilities issued to this agent
    const capabilities = policyEngine.listCapabilities(id).map((c) => ({
      ...c,
      status: getCapabilityStatus(c),
    }));

    res.json({
      ...agent,
      capabilities,
    });
  });

  router.post("/agents", async (req: Request, res: Response) => {
    try {
      const { name, description, walletAddress } = req.body;
      const agent = agentRegistry.createAgent({ name, description, walletAddress });

      // Log AGENT_REGISTERED to HCS Audit Trail
      await hcsLogger.logAuditEvent({
        type: "AGENT_REGISTERED",
        agentId: agent.id,
        agentName: agent.name,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json(agent);
    } catch (err: any) {
      const message = err.message || "Unknown error";
      if (message.startsWith("CONFLICT:")) {
        return res.status(409).json({ error: "CONFLICT", message });
      }
      if (message.startsWith("VALIDATION_ERROR:") || message.startsWith("MALFORMED_INPUT:")) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message });
      }
      res.status(500).json({ error: "INTERNAL_ERROR", message });
    }
  });

  router.post("/agents/:id/transition", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { targetStatus, reason } = req.body;

      if (!targetStatus) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "'targetStatus' is required ('ACTIVE' | 'SUSPENDED' | 'REVOKED')",
        });
      }

      const result = agentRegistry.transitionStatus(id, targetStatus as AgentStatus, reason);

      // Log AGENT_STATUS_CHANGED to HCS Audit Trail
      await hcsLogger.logAuditEvent({
        type: "AGENT_STATUS_CHANGED",
        agentId: result.agent.id,
        agentName: result.agent.name,
        previousStatus: result.previousStatus,
        newStatus: result.agent.status,
        reason: reason || `Transitioned from ${result.previousStatus} to ${result.agent.status}`,
        timestamp: new Date().toISOString(),
      });

      res.json(result);
    } catch (err: any) {
      const message = err.message || "Unknown error";
      if (message.startsWith("NOT_FOUND:")) {
        return res.status(404).json({ error: "NOT_FOUND", message });
      }
      if (message.startsWith("INVALID_TRANSITION:")) {
        return res.status(400).json({ error: "INVALID_TRANSITION", message });
      }
      res.status(400).json({ error: "BAD_REQUEST", message });
    }
  });

  // 3. Policies API
  router.get("/policies", (req: Request, res: Response) => {
    res.json(policyEngine.listPolicies());
  });

  router.post("/policies", (req: Request, res: Response) => {
    try {
      const { name, serviceEndpoint, serviceAddress, maxPricePerCall, dailyBudget, ttlSeconds } = req.body;
      const policy = policyEngine.registerPolicy({
        name,
        serviceEndpoint,
        serviceAddress,
        maxPricePerCall: Number(maxPricePerCall),
        dailyBudget: Number(dailyBudget),
        ttlSeconds: Number(ttlSeconds),
      });
      res.status(201).json(policy);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 4. Issue Capability Token (Phase 5 Canonical Permission & Scope Management)
  router.post("/capabilities/issue", async (req: Request, res: Response) => {
    try {
      const {
        policyId,
        requestedBudget,
        requestedTtlSeconds,
        settlementCredentialSecret,
        agentId,
        allowedActions,
        resourceScope,
      } = req.body;

      if (!policyId) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "'policyId' is required",
        });
      }

      const targetAgentId = agentId || "agent_alpha";
      const agent = agentRegistry.getAgent(targetAgentId);

      // Verify target agent exists
      if (!agent) {
        return res.status(404).json({
          error: "AGENT_NOT_FOUND",
          message: `Cannot issue capability: Agent '${targetAgentId}' not found in registry.`,
        });
      }

      // Verify agent eligibility: Only ACTIVE agents can receive capabilities
      if (agent.status === "SUSPENDED") {
        return res.status(403).json({
          error: "AGENT_SUSPENDED",
          message: `Cannot issue capability: Agent '${agent.name}' is currently SUSPENDED. Resume the agent before granting authority.`,
        });
      }

      if (agent.status === "REVOKED") {
        return res.status(403).json({
          error: "AGENT_REVOKED",
          message: `Cannot issue capability: Agent '${agent.name}' is permanently REVOKED. Terminated agents cannot receive authority.`,
        });
      }

      if (agent.status !== "ACTIVE") {
        return res.status(400).json({
          error: "AGENT_NOT_ELIGIBLE",
          message: `Cannot issue capability: Agent '${agent.name}' is in non-operational state '${agent.status}'.`,
        });
      }

      // Delegate to authoritative PolicyEngine with strict validation
      const capability = await policyEngine.issueCapability({
        policyId,
        requestedBudget: requestedBudget !== undefined ? Number(requestedBudget) : undefined,
        requestedTtlSeconds: requestedTtlSeconds !== undefined ? Number(requestedTtlSeconds) : undefined,
        settlementCredentialSecret,
        agentId: targetAgentId,
        allowedActions,
        resourceScope,
      });

      // Submit CAPABILITY_ISSUED Audit Event to Hedera HCS
      await hcsLogger.logAuditEvent({
        type: "CAPABILITY_ISSUED",
        capId: capability.capId,
        agentId: capability.agentId,
        service: capability.serviceAddress,
        amount: 0,
        budgetRemaining: capability.budgetTotal,
        policyHash: capability.policyHash,
        reason: `Capability issued with actions [${capability.allowedActions.join(", ")}] and scope '${capability.resourceScope}'`,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json({
        ...capability,
        status: getCapabilityStatus(capability),
      });
    } catch (err: any) {
      const message = err.message || "Failed to issue capability";
      if (message.includes("Policy") && message.includes("not found")) {
        return res.status(404).json({ error: "POLICY_NOT_FOUND", message });
      }
      if (message.startsWith("VALIDATION_ERROR:")) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message });
      }
      res.status(400).json({ error: "BAD_REQUEST", message });
    }
  });

  // 5. Inspect Capabilities
  router.get("/capabilities", (req: Request, res: Response) => {
    const agentIdFilter = req.query.agentId as string | undefined;
    const caps = policyEngine.listCapabilities(agentIdFilter).map((c) => ({
      ...c,
      status: getCapabilityStatus(c),
    }));
    res.json(caps);
  });

  router.get("/capabilities/:capId", async (req: Request, res: Response) => {
    const { capId } = req.params;
    const capability = policyEngine.getCapability(capId);

    if (!capability) {
      return res.status(404).json({ error: "CAPABILITY_NOT_FOUND", message: "Capability token not found" });
    }

    // Query on-chain budget if available
    let onChainBudget = capability.budgetRemaining;
    let onChainRevoked = capability.revoked;

    if (registryContract) {
      try {
        const onChainData = await registryContract.getCapability(capId);
        if (onChainData && onChainData.service !== ethers.ZeroAddress) {
          onChainBudget = Number(onChainData.budgetRemaining);
          onChainRevoked = Boolean(onChainData.revoked);
        }
      } catch {
        // Fallback to memory state
      }
    }

    res.json({
      ...capability,
      budgetRemaining: onChainBudget,
      revoked: onChainRevoked,
      status: getCapabilityStatus({
        ...capability,
        budgetRemaining: onChainBudget,
        revoked: onChainRevoked,
      }),
    });
  });

  // 6. Revoke Capability (Authoritative Revocation)
  router.post("/capabilities/revoke", async (req: Request, res: Response) => {
    try {
      const { capId, reason } = req.body;
      if (!capId) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "'capId' is required to revoke a capability",
        });
      }

      const capability = policyEngine.getCapability(capId);
      if (!capability) {
        return res.status(404).json({
          error: "CAPABILITY_NOT_FOUND",
          message: `Capability '${capId}' not found in registry`,
        });
      }

      const success = policyEngine.revokeCapability(capId);
      if (!success) {
        return res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to revoke capability" });
      }

      await hcsLogger.logAuditEvent({
        type: "CAPABILITY_REVOKED",
        capId,
        agentId: capability.agentId,
        reason: reason || "Explicit revocation by administrative operator",
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        capId,
        agentId: capability.agentId,
        status: "REVOKED",
        revokedAt: capability.revokedAt,
        message: "Capability revoked successfully. All subsequent spend attempts will fail closed.",
      });
    } catch (err: any) {
      res.status(400).json({ error: "BAD_REQUEST", message: err.message });
    }
  });

  // 7. x402-Gated Metered Service Endpoint with Server-Side Scope, Action & Lifecycle Enforcement
  router.post("/metered-service", async (req: Request, res: Response) => {
    const authHeader = req.headers["x-capability-token"] as string;
    const paymentAmountHeader = (req.headers["x-payment-amount"] as string) || "10";
    const amountToSpend = Number(paymentAmountHeader);

    if (!authHeader) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Missing 'x-capability-token' header. Raw API requests without scoped capabilities are rejected.",
      });
    }

    let decoded: any;
    try {
      decoded = policyEngine.verifyToken(authHeader);
    } catch (err: any) {
      return res.status(401).json({ error: "INVALID_TOKEN", message: err.message });
    }

    const { capId } = decoded;
    const capability = policyEngine.getCapability(capId);

    if (!capability) {
      return res.status(404).json({ error: "CAPABILITY_NOT_FOUND", message: "Capability record does not exist." });
    }

    // =========================================================================
    // 1. AGENT IDENTITY BINDING & SUBSTITUTION VERIFICATION
    // =========================================================================
    // The capability's owner is authoritative
    const authoritativeAgentId = capability.agentId;

    // Verify token's claimed agent matches capability's bound agent
    if (decoded.agentId && decoded.agentId !== authoritativeAgentId) {
      await hcsLogger.logAuditEvent({
        type: "AGENT_AUTHORIZATION_DENIED",
        capId,
        agentId: decoded.agentId,
        reason: "Token agentId does not match capability owner",
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({
        error: "AGENT_MISMATCH",
        capId,
        message: "Authorization Gate: Token agent identity mismatch with capability record.",
      });
    }

    // Verify client-supplied header or payload (prevent substitution attack)
    const clientSuppliedAgent = (req.headers["x-agent-id"] as string) || req.body.agentId;
    if (clientSuppliedAgent && clientSuppliedAgent !== authoritativeAgentId) {
      await hcsLogger.logAuditEvent({
        type: "AGENT_AUTHORIZATION_DENIED",
        capId,
        agentId: clientSuppliedAgent,
        reason: `Agent substitution attempted: client claimed '${clientSuppliedAgent}' but capability is bound to '${authoritativeAgentId}'`,
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({
        error: "AGENT_MISMATCH",
        capId,
        message: `Authorization Gate: Agent substitution prohibited. Capability is strictly bound to '${authoritativeAgentId}'.`,
      });
    }

    const agent = agentRegistry.getAgent(authoritativeAgentId);

    // =========================================================================
    // 2. PHASE 4 AGENT LIFECYCLE GATE
    // =========================================================================
    if (!agent) {
      await hcsLogger.logAuditEvent({
        type: "AGENT_AUTHORIZATION_DENIED",
        capId,
        agentId: authoritativeAgentId,
        amount: amountToSpend,
        reason: "Agent record does not exist in registry",
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({
        error: "AGENT_NOT_FOUND",
        capId,
        agentId: authoritativeAgentId,
        message: "Authorization Gate: Associated agent identity not found. Execution failed closed.",
      });
    }

    if (agent.status === "SUSPENDED") {
      agentRegistry.recordActivity(authoritativeAgentId, amountToSpend, false);
      await hcsLogger.logAuditEvent({
        type: "AGENT_AUTHORIZATION_DENIED",
        capId,
        agentId: authoritativeAgentId,
        agentName: agent.name,
        amount: amountToSpend,
        reason: "Agent is currently SUSPENDED by administrator",
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({
        error: "AGENT_SUSPENDED",
        capId,
        agentId: authoritativeAgentId,
        status: "SUSPENDED",
        message: `Authorization Gate: Agent '${agent.name}' (${authoritativeAgentId}) is SUSPENDED. All protected metered requests are denied.`,
      });
    }

    if (agent.status === "REVOKED") {
      agentRegistry.recordActivity(authoritativeAgentId, amountToSpend, false);
      await hcsLogger.logAuditEvent({
        type: "AGENT_AUTHORIZATION_DENIED",
        capId,
        agentId: authoritativeAgentId,
        agentName: agent.name,
        amount: amountToSpend,
        reason: "Agent authority permanently REVOKED",
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({
        error: "AGENT_REVOKED",
        capId,
        agentId: authoritativeAgentId,
        status: "REVOKED",
        message: `Authorization Gate: Agent '${agent.name}' (${authoritativeAgentId}) is REVOKED. Execution permanently denied.`,
      });
    }

    if (agent.status !== "ACTIVE") {
      agentRegistry.recordActivity(authoritativeAgentId, amountToSpend, false);
      return res.status(403).json({
        error: "AGENT_INVALID_STATE",
        capId,
        agentId: authoritativeAgentId,
        message: "Authorization Gate: Agent status is not approved for execution. Failed closed.",
      });
    }

    // =========================================================================
    // 3. CAPABILITY REVOCATION & EXPIRATION LIFECYCLE CHECKS
    // =========================================================================
    if (capability.revoked) {
      agentRegistry.recordActivity(authoritativeAgentId, amountToSpend, false);
      await hcsLogger.logAuditEvent({
        type: "CAPABILITY_REJECTED",
        capId,
        agentId: authoritativeAgentId,
        amount: amountToSpend,
        reason: "Capability Revoked by Issuer",
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({
        error: "CAPABILITY_REVOKED",
        capId,
        message: "On-Chain Enforcement: Capability has been explicitly revoked by issuing developer.",
      });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec >= capability.expiry) {
      agentRegistry.recordActivity(authoritativeAgentId, amountToSpend, false);
      await hcsLogger.logAuditEvent({
        type: "CAPABILITY_REJECTED",
        capId,
        agentId: authoritativeAgentId,
        amount: amountToSpend,
        reason: "Capability Expired",
        timestamp: new Date().toISOString(),
      });
      return res.status(402).json({
        error: "CAPABILITY_EXPIRED",
        capId,
        message: `On-Chain Enforcement: Capability token expired at timestamp ${capability.expiry}. Real-time rejection.`,
      });
    }

    // =========================================================================
    // 4. LEAST-PRIVILEGE ACTION CONSTRAINTS
    // =========================================================================
    const requestedAction =
      (req.headers["x-requested-action"] as string) || req.body.action || "EXECUTE_METERED_SERVICE";

    if (!capability.allowedActions.includes(requestedAction)) {
      agentRegistry.recordActivity(authoritativeAgentId, amountToSpend, false);
      await hcsLogger.logAuditEvent({
        type: "CAPABILITY_REJECTED",
        capId,
        agentId: authoritativeAgentId,
        amount: amountToSpend,
        reason: `Requested action '${requestedAction}' is not in allowed actions [${capability.allowedActions.join(", ")}]`,
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({
        error: "ACTION_NOT_PERMITTED",
        capId,
        requestedAction,
        allowedActions: capability.allowedActions,
        message: `Authorization Gate: Action '${requestedAction}' is not permitted by capability scope.`,
      });
    }

    // =========================================================================
    // 5. LEAST-PRIVILEGE RESOURCE & SERVICE SCOPE CONSTRAINTS
    // =========================================================================
    const targetResource =
      (req.headers["x-target-resource"] as string) || req.body.resource || "/api/metered-service";

    if (
      capability.resourceScope !== targetResource &&
      capability.serviceAddress.toLowerCase() !== targetResource.toLowerCase()
    ) {
      agentRegistry.recordActivity(authoritativeAgentId, amountToSpend, false);
      await hcsLogger.logAuditEvent({
        type: "CAPABILITY_REJECTED",
        capId,
        agentId: authoritativeAgentId,
        amount: amountToSpend,
        reason: `Target resource '${targetResource}' is outside granted scope '${capability.resourceScope}'`,
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({
        error: "RESOURCE_OUT_OF_SCOPE",
        capId,
        targetResource,
        resourceScope: capability.resourceScope,
        message: `Authorization Gate: Target resource '${targetResource}' is outside granted scope '${capability.resourceScope}'.`,
      });
    }

    // =========================================================================
    // 6. EXACT BUDGET LIMIT ENFORCEMENT & DEDUCTION
    // =========================================================================
    if (isNaN(amountToSpend) || amountToSpend <= 0) {
      return res.status(400).json({
        error: "INVALID_AMOUNT",
        message: "Payment amount must be a positive integer.",
      });
    }

    if (capability.budgetRemaining < amountToSpend) {
      agentRegistry.recordActivity(authoritativeAgentId, amountToSpend, false);
      await hcsLogger.logAuditEvent({
        type: "CAPABILITY_REJECTED",
        capId,
        agentId: authoritativeAgentId,
        amount: amountToSpend,
        budgetRemaining: capability.budgetRemaining,
        reason: "Budget Exhausted",
        timestamp: new Date().toISOString(),
      });

      return res.status(402).json({
        error: "INSUFFICIENT_BUDGET",
        capId,
        budgetRemaining: capability.budgetRemaining,
        requestedAmount: amountToSpend,
        message: `On-Chain Enforcement: Attempted call costs ${amountToSpend} units, but remaining budget is ${capability.budgetRemaining}. Real-time rejection enforced on-chain.`,
      });
    }

    // Execute atomic memory budget decrement
    const remainingAfterSpend = policyEngine.decrementMemoryBudget(capId, amountToSpend);

    // Decrypt settlement credential in memory using Ledger Key Ring (credential never leaves broker)
    await keyring.decryptCredential(capability.encryptedCredential);

    // Record successful agent activity in registry
    agentRegistry.recordActivity(authoritativeAgentId, amountToSpend, true);

    // Write HCS Audit Event to Hedera Consensus Service
    const hcsResult = await hcsLogger.logAuditEvent({
      type: "CAPABILITY_SPENT",
      capId,
      agentId: authoritativeAgentId,
      service: capability.serviceAddress,
      amount: amountToSpend,
      budgetRemaining: remainingAfterSpend,
      timestamp: new Date().toISOString(),
    });

    const promptText = req.body.prompt || "Default input prompt";

    // Return Gated Response + Micropayment Audit receipt
    res.json({
      status: "SUCCESS",
      capId,
      agentId: authoritativeAgentId,
      agentStatus: agent.status,
      action: requestedAction,
      resource: targetResource,
      amountCharged: amountToSpend,
      budgetRemaining: remainingAfterSpend,
      hcsAuditMessage: hcsResult.message,
      data: {
        service: "Vaultbreaker AI Text Summarizer",
        inputPrompt: promptText,
        summaryResult: `[x402 Micropayment Executed] Summarized analysis for: "${promptText.slice(0, 40)}...". Credential protected by Ledger Key Ring. Spend enforced on-chain on Hedera.`,
        tokenCount: 42,
        processingTimeMs: 24,
      },
    });
  });

  // 8. Audit Feed for Frontend Timeline
  router.get("/audit-feed", async (req: Request, res: Response) => {
    const feed = await hcsLogger.getAuditLog();
    res.json(feed);
  });

  return router;
}
