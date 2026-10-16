import crypto from "crypto";

export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED"
  | "CONSUMED";

export type ApprovalScope = "ONE_TIME" | "TEMPORARY_INCREASE";

export interface ApprovalRequestParams {
  agentId: string;
  capId: string;
  serviceAddress: string;
  targetResource: string;
  requestedAction: string;
  requestedAmount: number;
  asset?: string;
  policyId: string;
  policyVersion?: number;
  reason: string;
  policyThreshold?: number;
  approvalScope?: ApprovalScope;
  ttlSeconds?: number;
  metadata?: Record<string, any>;
}

export interface ApprovalRequest {
  approvalId: string;
  id: string; // convenient alias
  correlationId: string;
  agentId: string;
  capId: string;
  serviceAddress: string;
  targetResource: string;
  requestedAction: string;
  requestedAmount: number;
  asset: string;
  policyId: string;
  policyVersion: number;
  reason: string;
  policyThreshold: number;
  approvalScope: ApprovalScope;
  status: ApprovalStatus;
  requestFingerprint: string;
  createdAt: string;
  expiresAt: string;
  decidedAt?: string;
  decisionAt?: string; // alias
  decidedBy?: string;
  decisionBy?: string; // alias
  decisionReason?: string;
  rejectionReason?: string; // alias
  consumedAt?: string;
  metadata?: Record<string, any>;
}

/**
 * Computes a deterministic cryptographic SHA-256 integrity binding for an approval request.
 * Any modification to the agent, capability, service, resource, action, amount, or policy
 * produces a completely different hash, preventing request tampering between approval and execution.
 */
export function computeRequestFingerprint(params: {
  agentId: string;
  capId: string;
  serviceAddress: string;
  targetResource: string;
  requestedAction: string;
  requestedAmount: number;
  asset?: string;
  policyId: string;
  policyVersion?: number;
}): string {
  const canonicalString = [
    params.agentId.trim(),
    params.capId.trim(),
    params.serviceAddress.trim().toLowerCase(),
    params.targetResource.trim().toLowerCase(),
    params.requestedAction.trim(),
    Number(params.requestedAmount).toFixed(4),
    (params.asset || "HBAR").trim().toUpperCase(),
    params.policyId.trim(),
    String(params.policyVersion ?? 1),
  ].join("|");

  return crypto.createHash("sha256").update(canonicalString).digest("hex");
}

export class ApprovalStore {
  private approvals: Map<string, ApprovalRequest> = new Map();

  /**
   * Creates a new pending approval request with cryptographic integrity binding.
   */
  createRequest(params: ApprovalRequestParams): ApprovalRequest {
    if (!params.agentId || !params.agentId.trim()) {
      throw new Error("VALIDATION_ERROR: 'agentId' is required for approval request");
    }
    if (!params.capId || !params.capId.trim()) {
      throw new Error("VALIDATION_ERROR: 'capId' is required for approval request");
    }
    if (isNaN(params.requestedAmount) || params.requestedAmount <= 0) {
      throw new Error("VALIDATION_ERROR: 'requestedAmount' must be a positive number");
    }

    const approvalId = `appr_${crypto.randomBytes(8).toString("hex")}`;
    const correlationId = `req_${crypto.randomBytes(8).toString("hex")}`;
    const now = new Date();
    const ttlSeconds = params.ttlSeconds && params.ttlSeconds > 0 ? params.ttlSeconds : 900; // Default: 15 minutes
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    const fingerprint = computeRequestFingerprint({
      agentId: params.agentId,
      capId: params.capId,
      serviceAddress: params.serviceAddress,
      targetResource: params.targetResource,
      requestedAction: params.requestedAction,
      requestedAmount: params.requestedAmount,
      asset: params.asset || "HBAR",
      policyId: params.policyId,
      policyVersion: params.policyVersion ?? 1,
    });

    const approval: ApprovalRequest = {
      approvalId,
      id: approvalId,
      correlationId,
      agentId: params.agentId,
      capId: params.capId,
      serviceAddress: params.serviceAddress,
      targetResource: params.targetResource,
      requestedAction: params.requestedAction,
      requestedAmount: params.requestedAmount,
      asset: params.asset || "HBAR",
      policyId: params.policyId,
      policyVersion: params.policyVersion ?? 1,
      reason: params.reason || "High value transaction exceeds automated policy threshold",
      policyThreshold: params.policyThreshold ?? 0,
      approvalScope: params.approvalScope || "ONE_TIME",
      status: "PENDING",
      requestFingerprint: fingerprint,
      createdAt: now.toISOString(),
      expiresAt,
      metadata: params.metadata,
    };

    this.approvals.set(approvalId, approval);
    return approval;
  }

  /**
   * Retrieves an approval request and checks for expiration using authoritative server time.
   */
  getRequest(approvalId: string): ApprovalRequest | undefined {
    const approval = this.approvals.get(approvalId);
    if (!approval) return undefined;

    // Check expiration on-the-fly
    if (approval.status === "PENDING") {
      const nowMs = Date.now();
      const expiryMs = new Date(approval.expiresAt).getTime();
      if (nowMs >= expiryMs) {
        approval.status = "EXPIRED";
      }
    }

    return approval;
  }

  /**
   * Lists all approval requests, filtering by status or agentId if provided.
   */
  listRequests(filter?: { status?: ApprovalStatus; agentId?: string; limit?: number }): ApprovalRequest[] {
    const nowMs = Date.now();
    const result: ApprovalRequest[] = [];

    for (const approval of this.approvals.values()) {
      // Lazy expiry evaluation
      if (approval.status === "PENDING" && nowMs >= new Date(approval.expiresAt).getTime()) {
        approval.status = "EXPIRED";
      }

      if (filter?.status && approval.status !== filter.status) {
        continue;
      }
      if (filter?.agentId && approval.agentId !== filter.agentId) {
        continue;
      }

      result.push(approval);
    }

    // Return newest first
    const sorted = result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return filter?.limit ? sorted.slice(0, filter.limit) : sorted;
  }

  /**
   * Approves a pending request.
   * Enforces: Must be in PENDING state and unexpired.
   */
  approve(approvalId: string, approverId: string, decisionReason?: string): ApprovalRequest {
    const approval = this.getRequest(approvalId);
    if (!approval) {
      throw new Error(`NOT_FOUND: Approval request '${approvalId}' does not exist`);
    }

    if (approval.status === "EXPIRED") {
      throw new Error("APPROVAL_EXPIRED: Cannot approve an expired request");
    }

    if (approval.status !== "PENDING") {
      throw new Error(
        `INVALID_STATE_TRANSITION: Cannot approve request in '${approval.status}' state (must be PENDING)`
      );
    }

    approval.status = "APPROVED";
    approval.decidedAt = new Date().toISOString();
    approval.decisionAt = approval.decidedAt;
    approval.decidedBy = approverId;
    approval.decisionBy = approverId;
    approval.decisionReason = decisionReason || "Approved by administrator";

    return approval;
  }

  /**
   * Rejects a pending request.
   * Enforces: Must be in PENDING state. Reason is required.
   */
  reject(approvalId: string, approverId: string, reason: string): ApprovalRequest {
    if (!reason || !reason.trim()) {
      throw new Error("VALIDATION_ERROR: Rejection reason is required");
    }

    const approval = this.getRequest(approvalId);
    if (!approval) {
      throw new Error(`NOT_FOUND: Approval request '${approvalId}' does not exist`);
    }

    if (approval.status !== "PENDING") {
      throw new Error(
        `INVALID_STATE_TRANSITION: Cannot reject request in '${approval.status}' state (must be PENDING)`
      );
    }

    approval.status = "REJECTED";
    approval.decidedAt = new Date().toISOString();
    approval.decisionAt = approval.decidedAt;
    approval.decidedBy = approverId;
    approval.decisionBy = approverId;
    approval.decisionReason = reason.trim();
    approval.rejectionReason = reason.trim();

    return approval;
  }

  /**
   * Cancels a pending request.
   */
  cancel(approvalId: string, actorIdOrReason?: string, reason?: string): ApprovalRequest {
    const approval = this.getRequest(approvalId);
    if (!approval) {
      throw new Error(`NOT_FOUND: Approval request '${approvalId}' does not exist`);
    }

    if (approval.status !== "PENDING") {
      throw new Error(
        `INVALID_STATE_TRANSITION: Cannot cancel request in '${approval.status}' state (must be PENDING)`
      );
    }

    const actor = reason ? actorIdOrReason || "workflow_initiator" : "workflow_initiator";
    const decisionReason = reason || actorIdOrReason || "Cancelled by initiator or administrator";

    approval.status = "CANCELLED";
    approval.decidedAt = new Date().toISOString();
    approval.decisionAt = approval.decidedAt;
    approval.decidedBy = actor;
    approval.decisionBy = actor;
    approval.decisionReason = decisionReason;
    approval.rejectionReason = decisionReason;

    return approval;
  }

  /**
   * Consumes an approved request exactly once.
   * Transitions state from APPROVED -> CONSUMED.
   * Throws if not APPROVED, expired, or already CONSUMED (replay prevention).
   */
  consume(
    approvalId: string,
    currentRequestFingerprint: string
  ): { approval: ApprovalRequest; verified: boolean } {
    const approval = this.getRequest(approvalId);
    if (!approval) {
      throw new Error(`NOT_FOUND: Approval request '${approvalId}' does not exist`);
    }

    if (approval.status === "CONSUMED") {
      throw new Error(
        "APPROVAL_ALREADY_CONSUMED: This approval has already been consumed and cannot be replayed"
      );
    }

    if (approval.status === "EXPIRED") {
      throw new Error("APPROVAL_EXPIRED: Approval validity period has expired");
    }

    if (approval.status !== "APPROVED") {
      throw new Error(
        `APPROVAL_NOT_APPROVED: Approval status is '${approval.status}' (must be APPROVED)`
      );
    }

    // Verify request integrity binding
    if (approval.requestFingerprint !== currentRequestFingerprint) {
      throw new Error(
        "APPROVAL_INTEGRITY_MISMATCH: Current execution parameters do not match approved operation"
      );
    }

    // Replay protection: Immediately mark consumed
    approval.status = "CONSUMED";
    approval.consumedAt = new Date().toISOString();

    return { approval, verified: true };
  }

  /**
   * Clears in-memory approvals (test helper).
   */
  clear(): void {
    this.approvals.clear();
  }
}
