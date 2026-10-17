"use client";

import React, { useState, useEffect } from "react";
import {
  ApprovalRequest,
  ApprovalStatus,
  SecurityBoundaryStatus,
  Agent,
  Capability,
  Policy,
  approveRequest,
  rejectRequest,
  cancelRequest,
  fetchApprovalSecurityBoundary,
} from "@/lib/api";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Check,
  X,
  FileCode,
  Copy,
  ExternalLink,
  RefreshCw,
  Info,
  Lock,
  ArrowRight,
  UserCheck,
  KeyRound,
  Coins,
  Bot,
  Zap,
} from "lucide-react";

interface ApprovalsViewProps {
  approvals: ApprovalRequest[];
  agents?: Agent[];
  capabilities?: Capability[];
  policies?: Policy[];
  onRefresh?: () => Promise<void> | void;
  onNavigate?: (tab: string) => void;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({
  approvals,
  agents = [],
  capabilities = [],
  policies = [],
  onRefresh,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Approve confirmation modal state
  const [approvingItem, setApprovingItem] = useState<ApprovalRequest | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Reject modal state
  const [rejectingItem, setRejectingItem] = useState<ApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Security boundary info
  const [boundaryStatus, setBoundaryStatus] = useState<SecurityBoundaryStatus | null>(null);
  const [copiedFingerprint, setCopiedFingerprint] = useState<string | null>(null);
  const [copiedHeader, setCopiedHeader] = useState<string | null>(null);

  // Fetch security boundary on mount
  useEffect(() => {
    fetchApprovalSecurityBoundary()
      .then(setBoundaryStatus)
      .catch(() => {
        setBoundaryStatus({
          mode: "DEVELOPMENT_DEMO_MODE",
          authMechanism: "DEMO_FALLBACK_IDENTIFIER",
          trustedIdentityEnforced: false,
          notice: "External IdP (OIDC/SAML) is required before deploying production human identity.",
        });
      });
  }, []);

  // Filter approvals
  const filteredApprovals = approvals.filter((app) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      app.approvalId.toLowerCase().includes(q) ||
      app.agentId.toLowerCase().includes(q) ||
      app.policyId.toLowerCase().includes(q) ||
      app.targetResource.toLowerCase().includes(q) ||
      app.requestedAction.toLowerCase().includes(q) ||
      (app.reason && app.reason.toLowerCase().includes(q));

    const matchesStatus = statusFilter === "ALL" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Metrics
  const pendingCount = approvals.filter((a) => a.status === "PENDING").length;
  const approvedCount = approvals.filter((a) => a.status === "APPROVED").length;
  const rejectedCount = approvals.filter((a) => a.status === "REJECTED").length;
  const consumedCount = approvals.filter((a) => a.status === "CONSUMED").length;

  const handleCopy = (text: string, type: "fingerprint" | "header") => {
    navigator.clipboard.writeText(text);
    if (type === "fingerprint") {
      setCopiedFingerprint(text);
      setTimeout(() => setCopiedFingerprint(null), 2000);
    } else {
      setCopiedHeader(text);
      setTimeout(() => setCopiedHeader(null), 2000);
    }
  };

  const handleApprove = async () => {
    if (!approvingItem) return;
    setIsApproving(true);
    setApproveError(null);
    try {
      await approveRequest(approvingItem.approvalId);
      setApprovingItem(null);
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      setApproveError(err.message || "Failed to approve request");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingItem) return;
    if (!rejectReason.trim()) {
      setRejectError("Explicit human-readable rejection reason is required.");
      return;
    }
    setIsRejecting(true);
    setRejectError(null);
    try {
      await rejectRequest(rejectingItem.approvalId, rejectReason.trim());
      setRejectingItem(null);
      setRejectReason("");
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      setRejectError(err.message || "Failed to reject request");
    } finally {
      setIsRejecting(false);
    }
  };

  const getStatusBadge = (status: ApprovalStatus) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            PENDING APPROVAL
          </span>
        );
      case "APPROVED":
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            APPROVED (AWAITING RESUMPTION)
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-300 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-xs">
            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            REJECTED
          </span>
        );
      case "EXPIRED":
        return (
          <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-400 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-xs">
            <Clock className="w-3 h-3 text-slate-500" />
            EXPIRED
          </span>
        );
      case "CONSUMED":
        return (
          <span className="px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/80 border border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-300 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-xs">
            <ShieldCheck className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            CONSUMED &amp; EXECUTED
          </span>
        );
      case "CANCELLED":
        return (
          <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-400 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-xs">
            <X className="w-3 h-3 text-slate-500" />
            CANCELLED
          </span>
        );
      default:
        return null;
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    if (minutes > 60) {
      const hours = Math.floor(minutes / 60);
      return `${hours}h ${minutes % 60}m remaining`;
    }
    return `${minutes}m ${seconds}s remaining`;
  };

  return (
    <div className="space-y-6">
      {/* Security Boundary Notice Banner */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          boundaryStatus?.mode === "PRODUCTION_AUTH_ENFORCED"
            ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-200"
            : "bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80 text-amber-950 dark:text-amber-200"
        }`}
      >
        <div className="flex items-start gap-3">
          {boundaryStatus?.mode === "PRODUCTION_AUTH_ENFORCED" ? (
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold font-mono tracking-tight text-sm">
                HUMAN OPERATOR AUTHORIZATION BOUNDARY:
              </span>
              <span
                className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase ${
                  boundaryStatus?.mode === "PRODUCTION_AUTH_ENFORCED"
                    ? "bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 border border-emerald-400"
                    : "bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-400"
                }`}
              >
                {boundaryStatus?.mode || "DEVELOPMENT_DEMO_MODE"}
              </span>
              <span className="font-mono text-[11px] opacity-80">
                Auth Mechanism: {boundaryStatus?.authMechanism || "TOKEN / DEMO FALLBACK"}
              </span>
            </div>
            <p className="font-sans leading-relaxed opacity-90">
              {boundaryStatus?.notice ||
                "Phase 7 establishes cryptographic request binding, deterministic state machine, and replay protection. External IdP (OIDC/SAML) is required before deploying production human identity."}
            </p>
          </div>
        </div>
      </div>

      {/* Header and Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-mono font-medium mb-1">
            <span>Pending Approvals</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-black font-mono ${
                pendingCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"
              }`}
            >
              {pendingCount}
            </span>
            {pendingCount > 0 && (
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">
                Action Required
              </span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-mono font-medium mb-1">
            <span>Approved (Awaiting)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {approvedCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-mono font-medium mb-1">
            <span>Rejected</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
            {rejectedCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-mono font-medium mb-1">
            <span>Consumed / Executed</span>
            <ShieldCheck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
            {consumedCount}
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Status Filter, Refresh */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Approval ID, Agent ID, Resource, Action, Reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(["ALL", "PENDING", "APPROVED", "REJECTED", "CONSUMED", "EXPIRED", "CANCELLED"] as const).map(
            (status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === status
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {status}
                {status === "PENDING" && pendingCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[9px]">
                    {pendingCount}
                  </span>
                )}
              </button>
            )
          )}

          {onRefresh && (
            <button
              onClick={() => onRefresh()}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
              title="Refresh Approvals"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Approvals Table / Card List */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-2xs overflow-hidden">
        {filteredApprovals.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold font-mono text-slate-900 dark:text-white">
              No Approval Requests Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              When an agent executes an action exceeding a policy threshold (e.g. &gt; 10 HBAR) or triggering
              mandatory human review, the escalation request will appear here for operator authorization.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredApprovals.map((app) => {
              const isPending = app.status === "PENDING";
              return (
                <div
                  key={app.approvalId}
                  className="p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                >
                  {/* Left Column: ID, Status, Agent, Action, Policy Reason */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-xs text-sky-600 dark:text-sky-400">
                        {app.approvalId}
                      </span>
                      {getStatusBadge(app.status)}
                      {isPending && (
                        <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
                          <Clock className="w-3 h-3" />
                          {getTimeRemaining(app.expiresAt)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300 font-mono">
                      <span className="flex items-center gap-1 text-slate-900 dark:text-white font-bold">
                        <Bot className="w-3.5 h-3.5 text-indigo-500" />
                        {app.agentId}
                      </span>
                      <span className="text-slate-400">&bull;</span>
                      <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        {app.requestedAction}
                      </span>
                      <span className="text-slate-400">&bull;</span>
                      <span className="text-slate-500 dark:text-slate-400 truncate max-w-xs">
                        {app.targetResource}
                      </span>
                    </div>

                    {/* Policy Reason & Escalation Trigger */}
                    <div className="text-xs text-slate-600 dark:text-slate-300 font-sans leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 max-w-2xl">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                        <FileCode className="w-3.5 h-3.5 text-sky-500" />
                        Policy: {app.policyId} (v{app.policyVersion})
                        {app.policyThreshold !== undefined && (
                          <span className="text-amber-600 dark:text-amber-400">
                            [Threshold: {app.policyThreshold} {app.asset}]
                          </span>
                        )}
                      </div>
                      <p className="text-[12px]">{app.reason}</p>
                      {app.decisionReason && (
                        <p className="mt-1 text-[11px] font-mono text-rose-600 dark:text-rose-400">
                          Rejection Reason: {app.decisionReason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Middle Column: Amount and Cryptographic Fingerprint Preview */}
                  <div className="flex flex-col items-start lg:items-end justify-center shrink-0 space-y-1.5 min-w-[160px]">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                        {app.requestedAmount}
                      </span>
                      <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                        {app.asset}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      <Lock className="w-3 h-3 text-purple-500" />
                      <span>FP: {app.requestFingerprint.slice(0, 10)}...</span>
                      <button
                        onClick={() => handleCopy(app.requestFingerprint, "fingerprint")}
                        className="hover:text-slate-900 dark:hover:text-white"
                        title="Copy full SHA-256 fingerprint"
                      >
                        {copiedFingerprint === app.requestFingerprint ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Operator Actions */}
                  <div className="flex items-center gap-2 shrink-0 w-full lg:w-auto justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => setApprovingItem(app)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => {
                            setRejectingItem(app);
                            setRejectReason("");
                            setRejectError(null);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-mono font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    ) : null}

                    <button
                      onClick={() => {
                        setSelectedApproval(app);
                        setIsDetailModalOpen(true);
                      }}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer"
                      title="Inspect Details"
                    >
                      <Info className="w-3.5 h-3.5 text-sky-500" /> Inspect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* APPROVE CONFIRMATION MODAL */}
      {approvingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-mono text-slate-900 dark:text-white">
                    Authorize Agent Execution
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Cryptographic Decision Binding &bull; {approvingItem.approvalId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setApprovingItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {approveError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-mono">
                {approveError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-sans leading-relaxed">
                <span className="font-bold">OPERATOR NOTICE:</span> You are approving an autonomous agent
                execution of <span className="font-bold font-mono">{approvingItem.requestedAmount} {approvingItem.asset}</span>.
                This decision cryptographically binds all 9 invocation parameters using SHA-256. If the agent tampers
                with any parameter during resumption, the execution will be immediately denied.
              </div>

              {/* Bound Parameters Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-[11px] font-mono">
                <div className="bg-slate-100 dark:bg-slate-800/80 px-3 py-2 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  Cryptographically Bound Parameters (SHA-256)
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-1">
                  <div className="flex justify-between py-1 px-1">
                    <span className="text-slate-500">Agent ID:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{approvingItem.agentId}</span>
                  </div>
                  <div className="flex justify-between py-1 px-1">
                    <span className="text-slate-500">Capability ID:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{approvingItem.capId}</span>
                  </div>
                  <div className="flex justify-between py-1 px-1">
                    <span className="text-slate-500">Action:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{approvingItem.requestedAction}</span>
                  </div>
                  <div className="flex justify-between py-1 px-1">
                    <span className="text-slate-500">Target Resource:</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate max-w-xs">{approvingItem.targetResource}</span>
                  </div>
                  <div className="flex justify-between py-1 px-1">
                    <span className="text-slate-500">Amount &amp; Asset:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {approvingItem.requestedAmount} {approvingItem.asset}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 px-1">
                    <span className="text-slate-500">Policy ID &amp; Version:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {approvingItem.policyId} (v{approvingItem.policyVersion})
                    </span>
                  </div>
                  <div className="flex justify-between py-1 px-1 items-center">
                    <span className="text-slate-500">SHA-256 Fingerprint:</span>
                    <span className="font-mono text-[10px] text-purple-600 dark:text-purple-400 font-bold truncate max-w-[200px]">
                      {approvingItem.requestFingerprint}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setApprovingItem(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-mono font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
              >
                {isApproving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Authorizing...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Confirm &amp; Grant Approval
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL WITH REASON INPUT */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-700 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-mono text-slate-900 dark:text-white">
                    Reject Agent Request
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Mandatory Reason Required &bull; {rejectingItem.approvalId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRejectingItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {rejectError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-mono">
                {rejectError}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
                Provide an explicit reason for rejecting this request. This reason will be recorded on the Hedera
                Consensus Service audit trail and returned to the calling agent.
              </p>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Rejection Reason (Required)
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g., Requested amount exceeds operational allowance for unattended execution."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isRejecting || !rejectReason.trim()}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-mono font-bold transition-all shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer"
              >
                {isRejecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Rejecting...
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5" /> Confirm Rejection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT DETAILS MODAL */}
      {isDetailModalOpen && selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-700 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-mono text-slate-900 dark:text-white">
                    Approval Request Dossier
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {selectedApproval.approvalId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Status and Expiration */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-500">Current Status:</span>
                  {getStatusBadge(selectedApproval.status)}
                </div>
                <div className="font-mono text-slate-500">
                  Expires: <span className="text-slate-900 dark:text-white font-bold">{new Date(selectedApproval.expiresAt).toLocaleString()}</span>
                </div>
              </div>

              {/* SHA-256 Cryptographic Fingerprint */}
              <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-purple-900 dark:text-purple-300">
                    <Lock className="w-3.5 h-3.5 text-purple-500" /> SHA-256 Request Fingerprint
                  </div>
                  <button
                    onClick={() => handleCopy(selectedApproval.requestFingerprint, "fingerprint")}
                    className="text-[11px] font-mono text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1"
                  >
                    {copiedFingerprint === selectedApproval.requestFingerprint ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy Hash
                      </>
                    )}
                  </button>
                </div>
                <div className="p-2 rounded-xl bg-purple-100/50 dark:bg-purple-900/40 font-mono text-[11px] break-all text-purple-950 dark:text-purple-200">
                  {selectedApproval.requestFingerprint}
                </div>
                <p className="text-[11px] text-purple-800 dark:text-purple-300 leading-relaxed font-sans">
                  Fingerprint canonical structure: <code className="font-mono">sha256(agentId|capId|serviceAddress|targetResource|requestedAction|requestedAmount|asset|policyId|policyVersion)</code>.
                  Resumption is rejected if any value changes.
                </p>
              </div>

              {/* 9 Bound Parameters */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden font-mono text-[11px]">
                <div className="bg-slate-100 dark:bg-slate-800/80 px-3.5 py-2 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  Bound Execution Context
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 p-3 space-y-1">
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Agent ID:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedApproval.agentId}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Capability ID:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedApproval.capId}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Service Address:</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate max-w-xs">{selectedApproval.serviceAddress}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Target Resource:</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate max-w-xs">{selectedApproval.targetResource}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Requested Action:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedApproval.requestedAction}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Requested Amount:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedApproval.requestedAmount} {selectedApproval.asset}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Asset Type:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedApproval.asset}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Matched Policy:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {selectedApproval.policyId} (v{selectedApproval.policyVersion})
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Policy Threshold:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {selectedApproval.policyThreshold !== undefined ? `${selectedApproval.policyThreshold} ${selectedApproval.asset}` : "Mandatory Approval"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lifecycle Timestamps */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-1.5 font-mono text-[11px]">
                <div className="text-slate-500 font-bold mb-1">Lifecycle Milestones</div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Created:</span>
                  <span>{new Date(selectedApproval.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Expires:</span>
                  <span>{new Date(selectedApproval.expiresAt).toLocaleString()}</span>
                </div>
                {selectedApproval.decidedAt && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Decided At:</span>
                    <span>{new Date(selectedApproval.decidedAt).toLocaleString()} ({selectedApproval.decidedBy})</span>
                  </div>
                )}
                {selectedApproval.consumedAt && (
                  <div className="flex justify-between text-purple-600 dark:text-purple-400 font-bold">
                    <span>Consumed (Executed):</span>
                    <span>{new Date(selectedApproval.consumedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Resumption Header Snippet */}
              {selectedApproval.status === "APPROVED" && (
                <div className="p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-mono font-bold text-sky-900 dark:text-sky-300">
                      <Zap className="w-3.5 h-3.5 text-sky-500" /> Resumption Header (Agent Invocation)
                    </div>
                    <button
                      onClick={() => handleCopy(`x-approval-id: ${selectedApproval.approvalId}`, "header")}
                      className="text-[11px] font-mono text-sky-700 dark:text-sky-300 hover:underline flex items-center gap-1"
                    >
                      {copiedHeader ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy Header
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-xl bg-slate-900 text-sky-300 font-mono text-[11px] overflow-x-auto">
                    {`curl -X POST https://broker.vaultbreaker.internal/api/metered-service \\
  -H "Authorization: Bearer <capability_token>" \\
  -H "x-approval-id: ${selectedApproval.approvalId}" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": ${selectedApproval.requestedAmount}}'`}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
