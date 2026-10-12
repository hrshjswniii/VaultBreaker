import crypto from "crypto";

export type AgentStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface AgentEntity {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  walletAddress: string;
  network: string;
  totalSpentHbar: number;
  totalCallsExecuted: number;
  totalCallsRejected: number;
  createdAt: string;
  lastActiveAt: string;
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  walletAddress?: string;
}

export interface LifecycleTransitionResult {
  agent: AgentEntity;
  previousStatus: AgentStatus;
  reason?: string;
}

/**
 * Authoritative lifecycle state machine transitions for Vaultbreaker agents.
 * - ACTIVE: Operating normally. Protected operations permitted.
 * - SUSPENDED: Temporarily paused. Protected operations rejected with AGENT_SUSPENDED.
 * - REVOKED: Permanently deactivated. Terminal state.
 */
export const ALLOWED_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  ACTIVE: ["SUSPENDED", "REVOKED"],
  SUSPENDED: ["ACTIVE", "REVOKED"],
  REVOKED: [], // Terminal state: cannot transition out
};

export class AgentRegistry {
  private agents: Map<string, AgentEntity> = new Map();

  constructor() {
    this.seedDefaultAgents();
  }

  private seedDefaultAgents() {
    const defaultAgents: AgentEntity[] = [
      {
        id: "agent_alpha",
        name: "Agent Alpha (Summarizer)",
        description: "Autonomous LLM agent executing pay-per-call text summarization via x402 metered API.",
        status: "ACTIVE",
        walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        network: "Hedera Testnet (296)",
        totalSpentHbar: 20,
        totalCallsExecuted: 2,
        totalCallsRejected: 0,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        lastActiveAt: new Date().toISOString(),
      },
      {
        id: "agent_beta",
        name: "Agent Beta (Arbitrageur)",
        description: "DeFi liquidity scanner monitoring Hedera DEX pools and submitting oracle verification calls.",
        status: "ACTIVE",
        walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        network: "Hedera Testnet (296)",
        totalSpentHbar: 0,
        totalCallsExecuted: 0,
        totalCallsRejected: 0,
        createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        lastActiveAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        id: "agent_gamma",
        name: "Agent Gamma (Data Scraper)",
        description: "Web data crawler fetching external financial feeds under scoped bandwidth policies.",
        status: "SUSPENDED",
        walletAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        network: "Hedera Testnet (296)",
        totalSpentHbar: 10,
        totalCallsExecuted: 1,
        totalCallsRejected: 1,
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        lastActiveAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
    ];

    for (const agent of defaultAgents) {
      this.agents.set(agent.id, agent);
    }
  }

  /**
   * Retrieves all registered agents.
   */
  listAgents(): AgentEntity[] {
    return Array.from(this.agents.values());
  }

  /**
   * Retrieves an agent by its unique identifier.
   */
  getAgent(id: string): AgentEntity | undefined {
    return this.agents.get(id);
  }

  /**
   * Registers a new agent in the authoritative registry.
   * Enforces input validation, name uniqueness, and wallet format constraints.
   * Raw private keys are never accepted or stored.
   */
  createAgent(input: CreateAgentInput): AgentEntity {
    if (!input || typeof input !== "object") {
      throw new Error("MALFORMED_INPUT: Request payload must be a JSON object");
    }

    const rawName = input.name;
    if (!rawName || typeof rawName !== "string") {
      throw new Error("VALIDATION_ERROR: 'name' is required and must be a string");
    }

    const name = rawName.trim();
    if (name.length < 2 || name.length > 64) {
      throw new Error("VALIDATION_ERROR: 'name' must be between 2 and 64 characters");
    }

    // Name uniqueness check (case-insensitive)
    for (const existing of this.agents.values()) {
      if (existing.name.toLowerCase() === name.toLowerCase()) {
        throw new Error(`CONFLICT: Agent with name '${name}' already exists`);
      }
    }

    let description = "";
    if (input.description) {
      if (typeof input.description !== "string") {
        throw new Error("VALIDATION_ERROR: 'description' must be a string");
      }
      description = input.description.trim();
      if (description.length > 256) {
        throw new Error("VALIDATION_ERROR: 'description' cannot exceed 256 characters");
      }
    }

    let walletAddress: string;
    if (input.walletAddress) {
      const trimmedWallet = input.walletAddress.trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedWallet)) {
        throw new Error("VALIDATION_ERROR: 'walletAddress' must be a valid 20-byte EVM address (0x...)");
      }
      walletAddress = trimmedWallet;
    } else {
      // Safely generate an unexposed simulated wallet reference address for Hedera EVM
      const randomBytes = crypto.randomBytes(20).toString("hex");
      walletAddress = `0x${randomBytes}`;
    }

    const id = `agent_${crypto.randomBytes(4).toString("hex")}`;
    const now = new Date().toISOString();

    const newAgent: AgentEntity = {
      id,
      name,
      description,
      status: "ACTIVE", // Canonical initial operational state
      walletAddress,
      network: "Hedera Testnet (296)",
      totalSpentHbar: 0,
      totalCallsExecuted: 0,
      totalCallsRejected: 0,
      createdAt: now,
      lastActiveAt: now,
    };

    this.agents.set(id, newAgent);
    return newAgent;
  }

  /**
   * Executes a lifecycle state transition according to the authoritative state machine.
   * Returns structured result on success; throws structured error on invalid transition.
   */
  transitionStatus(
    id: string,
    targetStatus: AgentStatus,
    reason?: string
  ): LifecycleTransitionResult {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`NOT_FOUND: Agent '${id}' not found`);
    }

    if (agent.status === targetStatus) {
      return { agent, previousStatus: agent.status, reason };
    }

    const allowed = ALLOWED_TRANSITIONS[agent.status];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new Error(
        `INVALID_TRANSITION: Cannot transition agent '${id}' from '${agent.status}' to '${targetStatus}'. Allowed target states: [${(allowed || []).join(", ")}]`
      );
    }

    const previousStatus = agent.status;
    agent.status = targetStatus;

    return {
      agent,
      previousStatus,
      reason,
    };
  }

  /**
   * Records operational activity metrics for an agent.
   */
  recordActivity(id: string, amount: number, success: boolean): void {
    const agent = this.agents.get(id);
    if (!agent) return;

    if (success) {
      agent.totalSpentHbar += amount;
      agent.totalCallsExecuted += 1;
    } else {
      agent.totalCallsRejected += 1;
    }
    agent.lastActiveAt = new Date().toISOString();
  }
}
