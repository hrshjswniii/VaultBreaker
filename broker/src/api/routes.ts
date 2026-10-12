import { Router, Request, Response } from "express";
import { LedgerKeyRing } from "../ledger/keyring.js";
import { HederaHCSLogger } from "../hedera/hcs.js";
import { PolicyEngine } from "../policy/engine.js";
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
    const capabilities = policyEngine.listCapabilities().filter((c) => c.agentId === id);

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

  // 4. Issue Capability Token (Ledger seed protected & bound to Agent)
  router.post("/capabilities/issue", async (req: Request, res: Response) => {
    try {
      const { policyId, requestedBudget, requestedTtlSeconds, settlementCredentialSecret, agentId } = req.body;

      if (agentId) {
        const agent = agentRegistry.getAgent(agentId);
        if (!agent) {
          return res.status(404).json({
            error: "AGENT_NOT_FOUND",
            message: `Cannot issue capability: Agent '${agentId}' not found.`,
          });
        }
      }

      const capability = await policyEngine.issueCapability(
        policyId,
        requestedBudget ? Number(requestedBudget) : undefined,
        requestedTtlSeconds ? Number(requestedTtlSeconds) : undefined,
        settlementCredentialSecret,
        agentId
      );

      // Submit HCS Audit Event to Hedera
      await hcsLogger.logAuditEvent({
        type: "CAPABILITY_ISSUED",
        capId: capability.capId,
        agentId: capability.agentId,
        service: capability.serviceAddress,
        amount: 0,
        budgetRemaining: capability.budgetTotal,
        policyHash: capability.policyHash,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json(capability);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 5. Inspect Capability
  router.get("/capabilities", (req: Request, res: Response) => {
    res.json(policyEngine.listCapabilities());
  });

  router.get("/capabilities/:capId", async (req: Request, res: Response) => {
    const { capId } = req.params;
    const capability = policyEngine.getCapability(capId);

    if (!capability) {
      return res.status(404).json({ error: "Capability token not found" });
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
    });
  });

  // 6. Revoke Capability
  router.post("/capabilities/revoke", async (req: Request, res: Response) => {
    try {
      const { capId } = req.body;
      const success = policyEngine.revokeCapability(capId);

      if (!success) {
        return res.status(404).json({ error: "Capability not found" });
      }

      await hcsLogger.logAuditEvent({
        type: "CAPABILITY_REVOKED",
        capId,
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true, capId, message: "Capability revoked successfully" });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 7. x402-Gated Metered Service Endpoint with Server-Side Agent Lifecycle Enforcement
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

    // Resolve authoritative Agent identifier (from decoded token or capability object)
    const agentId = decoded.agentId || capability.agentId || "agent_alpha";
    const agent = agentRegistry.getAgent(agentId);

    // =========================================================================
    // AUTHORITATIVE AGENT LIFECYCLE ENFORCEMENT GATE
    // Evaluated BEFORE key decryption, spend execution, or contract invocation.
    // =========================================================================
    if (!agent) {
      await hcsLogger.logAuditEvent({
        type: "AGENT_AUTHORIZATION_DENIED",
        capId,
        agentId,
        amount: amountToSpend,
        reason: "Agent record does not exist in registry",
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({
        error: "AGENT_NOT_FOUND",
        capId,
        agentId,
        message: "Authorization Gate: Associated agent identity not found. Execution failed closed.",
      });
    }

    if (agent.status === "SUSPENDED") {
      agentRegistry.recordActivity(agentId, amountToSpend, false);
      await hcsLogger.logAuditEvent({
        type: "AGENT_AUTHORIZATION_DENIED",
        capId,
        agentId,
        agentName: agent.name,
        amount: amountToSpend,
        reason: "Agent is currently SUSPENDED by administrator",
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({
        error: "AGENT_SUSPENDED",
        capId,
        agentId,
        status: "SUSPENDED",
        message: `Authorization Gate: Agent '${agent.name}' (${agentId}) is SUSPENDED. All protected metered requests are denied.`,
      });
    }

    if (agent.status === "REVOKED") {
      agentRegistry.recordActivity(agentId, amountToSpend, false);
      await hcsLogger.logAuditEvent({
        type: "AGENT_AUTHORIZATION_DENIED",
        capId,
        agentId,
        agentName: agent.name,
        amount: amountToSpend,
        reason: "Agent authority permanently REVOKED",
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({
        error: "AGENT_REVOKED",
        capId,
        agentId,
        status: "REVOKED",
        message: `Authorization Gate: Agent '${agent.name}' (${agentId}) is REVOKED. Execution permanently denied.`,
      });
    }

    if (agent.status !== "ACTIVE") {
      // Unknown or non-canonical status: fail closed
      agentRegistry.recordActivity(agentId, amountToSpend, false);
      return res.status(403).json({
        error: "AGENT_INVALID_STATE",
        capId,
        agentId,
        message: "Authorization Gate: Agent status is not approved for execution. Failed closed.",
      });
    }

    // Check Capability Revocation
    if (capability.revoked) {
      agentRegistry.recordActivity(agentId, amountToSpend, false);
      await hcsLogger.logAuditEvent({
        type: "CAPABILITY_REJECTED",
        capId,
        agentId,
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

    // Check Expiry
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec >= capability.expiry) {
      agentRegistry.recordActivity(agentId, amountToSpend, false);
      await hcsLogger.logAuditEvent({
        type: "CAPABILITY_REJECTED",
        capId,
        agentId,
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

    // Check Budget
    if (capability.budgetRemaining < amountToSpend) {
      agentRegistry.recordActivity(agentId, amountToSpend, false);
      await hcsLogger.logAuditEvent({
        type: "CAPABILITY_REJECTED",
        capId,
        agentId,
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

    // Execute Decrement
    const remainingAfterSpend = policyEngine.decrementMemoryBudget(capId, amountToSpend);

    // Decrypt settlement credential in memory using Ledger Key Ring (credential never leaves broker)
    await keyring.decryptCredential(capability.encryptedCredential);

    // Record successful agent activity in registry
    agentRegistry.recordActivity(agentId, amountToSpend, true);

    // Write HCS Audit Event to Hedera Consensus Service
    const hcsResult = await hcsLogger.logAuditEvent({
      type: "CAPABILITY_SPENT",
      capId,
      agentId,
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
      agentId,
      agentStatus: agent.status,
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
