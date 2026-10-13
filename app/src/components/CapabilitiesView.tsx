"use client";

import React, { useState } from "react";
import {
  Capability,
  Policy,
  Agent,
  getCapabilityStatus,
  CapabilityStatus,
  issueCapability,
  revokeCapability,
} from "@/lib/api";
import {
  KeyRound,
  Search,
  Filter,
  AlertTriangle,
  Lock,
  ArrowRight,
  Info,
  Check,
  Copy,
  Clock,
  ShieldCheck,
  Plus,
  Ban,
  X,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

interface CapabilitiesViewProps {
  capabilities: Capability[];
  policies: Policy[];
  agents?: Agent[];
  onRefresh: () => void;
  onNavigate: (tab: string) => void;
  onSelectCapabilityForAgent: (cap: Capability) => void;
}

const SUPPORTED_ACTIONS = [
  { id: "EXECUTE_METERED_SERVICE", label: "Execute Metered Service", desc: "Allows calling protected x402 endpoints" },
  { id: "READ_TELEMETRY", label: "Read Telemetry", desc: "Allows querying execution traces and metrics" },
  { id: "SUBMIT_TRANSACTION", label: "Submit Transaction", desc: "Permits autonomous micropayment settlement" },
];

export const CapabilitiesView: React.FC<CapabilitiesViewProps> = ({
  capabilities,
  policies,
  agents = [],
  onRefresh,
  onNavigate,
  onSelectCapabilityForAgent,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"NEWEST" | "EXPIRING_SOON" | "BUDGET_LOW">("NEWEST");
  const [selectedCap, setSelectedCap] = useState<Capability | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Mint modal state
  const [showMintModal, setShowMintModal] = useState(false);
  const [mintAgentId, setMintAgentId] = useState<string>(agents[0]?.id || "agent_alpha");
  const [mintPolicyId, setMintPolicyId] = useState<string>(policies[0]?.id || "");
  const [mintBudget, setMintBudget] = useState<number>(25);
  const [mintActions, setMintActions] = useState<string[]>(["EXECUTE_METERED_SERVICE"]);
  const [mintScope, setMintScope] = useState<string>("/api/metered-service");
  const [mintTtl, setMintTtl] = useState<number>(3600);
  const [isIssuing, setIsIssuing] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintSuccess, setMintSuccess] = useState<Capability | null>(null);

  // Revoke modal state
  const [revokingCap, setRevokingCap] = useState<Capability | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>("Operator administrative revocation");
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Filter & sort logic
  const filteredCaps = capabilities
    .filter((c) => {
      const status = getCapabilityStatus(c);
      const matchesStatus = statusFilter === "ALL" || status === statusFilter;

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        c.capId.toLowerCase().includes(q) ||
        c.serviceAddress.toLowerCase().includes(q) ||
        c.policyId.toLowerCase().includes(q) ||
        (c.agentId && c.agentId.toLowerCase().includes(q)) ||
        (c.resourceScope && c.resourceScope.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === "EXPIRING_SOON") return a.expiry - b.expiry;
      if (sortBy === "BUDGET_LOW") return a.budgetRemaining - b.budgetRemaining;
      // Default: newest first
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

  const selectedMintAgent = agents.find((a) => a.id === mintAgentId);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleActionToggle = (actionId: string) => {
    if (mintActions.includes(actionId)) {
      if (mintActions.length === 1) return; // Prevent empty actions
      setMintActions(mintActions.filter((a) => a !== actionId));
    } else {
      setMintActions([...mintActions, actionId]);
    }
  };

  const handleMintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMintError(null);

    if (!mintPolicyId) {
      setMintError("Please select a policy template.");
      return;
    }
    if (mintBudget <= 0) {
      setMintError("Spending limit must be greater than 0 HBAR.");
      return;
    }
    if (mintActions.length === 0) {
      setMintError("At least one allowed action must be selected.");
      return;
    }
    if (!mintScope.trim()) {
      setMintError("Resource scope cannot be empty.");
      return;
    }

    try {
      setIsIssuing(true);
      const newCap = await issueCapability(mintPolicyId, {
        agentId: mintAgentId,
        budget: mintBudget,
        allowedActions: mintActions,
        resourceScope: mintScope.trim(),
        ttlSeconds: mintTtl,
      });

      setMintSuccess(newCap);
      onRefresh();
    } catch (err: any) {
      setMintError(err.message || "Failed to issue capability.");
    } finally {
      setIsIssuing(false);
    }
  };

  const handleRevokeSubmit = async () => {
    if (!revokingCap) return;
    setRevokeError(null);
    try {
      setIsRevoking(true);
      await revokeCapability(revokingCap.capId, revokeReason);
      onRefresh();
      if (selectedCap && selectedCap.capId === revokingCap.capId) {
        setSelectedCap((prev) => (prev ? { ...prev, revoked: true, status: "REVOKED" } : null));
      }
      setRevokingCap(null);
    } catch (err: any) {
      setRevokeError(err.message || "Failed to revoke capability.");
    } finally {
      setIsRevoking(false);
    }
  };

  const renderStatusBadge = (status: CapabilityStatus) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            ACTIVE
          </span>
        );
      case "EXHAUSTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 shadow-xs">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            EXHAUSTED
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-xs">
            <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
            EXPIRED
          </span>
        );
      case "REVOKED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-300 shadow-xs">
            <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            REVOKED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* Header Banner */}
      <div className="glass-card rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 text-xs font-mono mb-1 font-bold">
            <KeyRound className="w-4 h-4" />
            SCOPED AUTHORITY OBJECT REGISTRY &bull; PHASE 5
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            Capability Objects ({capabilities.length})
          </h2>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Cryptographically bounded authority objects bound to specific agents, enforced actions, resource scopes, and non-negative integer budget ceilings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer transition-all"
            title="Refresh capabilities"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setMintSuccess(null);
              setMintError(null);
              setShowMintModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold font-mono transition-all shadow-md shadow-purple-600/20 cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Mint Capability
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by CapID, Agent, Scope..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <span className="shrink-0 font-bold">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="NEWEST">Newest First</option>
              <option value="EXPIRING_SOON">Expiring Soonest</option>
              <option value="BUDGET_LOW">Lowest Budget Remaining</option>
            </select>
          </div>
        </div>

        {/* State Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700 overflow-x-auto">
          <div className="flex items-center gap-1 text-slate-400 font-mono text-xs px-2.5 py-1 font-bold">
            <Filter className="w-3.5 h-3.5" /> State:
          </div>
          {(["ALL", "ACTIVE", "EXHAUSTED", "EXPIRED", "REVOKED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === s
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-600"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Capability List */}
      {filteredCaps.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center space-y-3 font-sans border border-dashed border-slate-200 dark:border-slate-800">
          <KeyRound className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No capabilities found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            No capability objects match your current filter criteria. Mint a new capability or adjust your search filters.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("ALL");
            }}
            className="text-xs font-mono text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredCaps.map((cap) => {
            const status = getCapabilityStatus(cap);
            const isUsable = status === "ACTIVE";
            const associatedAgent = agents.find((a) => a.id === cap.agentId);

            return (
              <div
                key={cap.capId}
                className={`glass-card rounded-2xl p-5 border transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 ${
                  status === "REVOKED"
                    ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/15 dark:bg-rose-950/20"
                    : status === "EXHAUSTED"
                    ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/15 dark:bg-amber-950/20"
                    : status === "EXPIRED"
                    ? "border-slate-300 dark:border-slate-800 opacity-80"
                    : "border-slate-200/90 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800"
                }`}
              >
                {/* Left Section: Identifiers, Scope, Actions */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-slate-900 dark:text-white font-black tracking-tight">
                      {cap.capId.slice(0, 14)}...{cap.capId.slice(-6)}
                    </span>
                    <button
                      onClick={() => copyToClipboard(cap.capId, cap.capId)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title="Copy full CapID"
                    >
                      {copiedId === cap.capId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {renderStatusBadge(status)}

                    {associatedAgent && (
                      <span
                        onClick={() => onNavigate("agents")}
                        className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 cursor-pointer hover:underline flex items-center gap-1"
                        title="View agent"
                      >
                        Agent: {associatedAgent.name.split(" ")[0]} ({associatedAgent.id})
                      </span>
                    )}
                  </div>

                  {/* Scopes & Actions */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 px-2 py-0.5 rounded-md text-[11px] border border-slate-200 dark:border-slate-700">
                      Scope: <strong className="text-slate-900 dark:text-white font-bold">{cap.resourceScope || cap.serviceAddress}</strong>
                    </span>

                    {cap.allowedActions && cap.allowedActions.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-purple-700 dark:text-purple-300 font-bold bg-purple-50 dark:bg-purple-950/70 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
                        {cap.allowedActions.join(", ")}
                      </span>
                    )}

                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Expires: {new Date(cap.expiry * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                {/* Middle: Spending & Budget Progress */}
                <div className="w-full lg:w-56 space-y-1.5 font-mono">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] font-sans">Remaining Budget:</span>
                    <span
                      className={`font-black ${
                        cap.budgetRemaining === 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {cap.budgetRemaining} / {cap.budgetTotal} {cap.currency || "HBAR"}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600">
                    <div
                      className={`h-full transition-all duration-500 ${
                        cap.budgetRemaining === 0 ? "bg-rose-500" : "bg-sky-500"
                      }`}
                      style={{
                        width: `${Math.max(0, Math.min(100, (cap.budgetRemaining / cap.budgetTotal) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedCap(cap)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                    title="Inspect capability details"
                  >
                    <Info className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onSelectCapabilityForAgent(cap)}
                    disabled={!isUsable}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-mono shadow-xs transition-colors"
                  >
                    Use in Agent
                  </button>

                  {!cap.revoked && (
                    <button
                      onClick={() => {
                        setRevokeError(null);
                        setRevokingCap(cap);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 font-bold text-xs cursor-pointer font-mono transition-colors flex items-center gap-1"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mint Capability Modal */}
      {showMintModal && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full space-y-5 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800">
                  PHASE 5 CAPABILITY ISSUANCE GATE
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1 font-mono">
                  Mint Authorized Capability
                </h3>
              </div>
              <button
                onClick={() => setShowMintModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {mintSuccess ? (
              <div className="space-y-4 font-mono">
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                    <ShieldCheck className="w-5 h-5" />
                    Capability Minted Successfully
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-sans">
                    Authoritative capability issued, signed with broker key, and registered on HCS audit feed.
                  </p>
                  <div className="pt-2 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                    <div>CapID: <span className="font-bold text-slate-900 dark:text-white">{mintSuccess.capId}</span></div>
                    <div>Agent: <span className="font-bold">{mintSuccess.agentId}</span></div>
                    <div>Budget Ceiling: <span className="font-bold">{mintSuccess.budgetTotal} HBAR</span></div>
                    <div>Scope: <span className="font-bold">{mintSuccess.resourceScope}</span></div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      onSelectCapabilityForAgent(mintSuccess);
                      setShowMintModal(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    Select in Agent Terminal
                  </button>
                  <button
                    onClick={() => setShowMintModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleMintSubmit} className="space-y-4 text-xs font-mono">
                {mintError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{mintError}</span>
                  </div>
                )}

                {/* Target Agent Selection */}
                <div className="space-y-1.5">
                  <label className="text-slate-700 dark:text-slate-300 font-bold flex items-center justify-between">
                    <span>1. Target Agent:</span>
                    {selectedMintAgent?.status !== "ACTIVE" && selectedMintAgent && (
                      <span className="text-rose-600 dark:text-rose-400 text-[10px] uppercase font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Agent {selectedMintAgent.status}
                      </span>
                    )}
                  </label>
                  <select
                    value={mintAgentId}
                    onChange={(e) => setMintAgentId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.name} ({ag.id}) — [{ag.status}]
                      </option>
                    ))}
                  </select>
                  {selectedMintAgent?.status !== "ACTIVE" && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-sans">
                      Warning: The broker will strictly reject capability issuance for suspended or revoked agents.
                    </p>
                  )}
                </div>

                {/* Policy Template */}
                <div className="space-y-1.5">
                  <label className="text-slate-700 dark:text-slate-300 font-bold">
                    2. Policy Template:
                  </label>
                  <select
                    value={mintPolicyId}
                    onChange={(e) => setMintPolicyId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    {policies.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Max: {p.dailyBudget} HBAR, Endpoint: {p.serviceEndpoint})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Allowed Actions */}
                <div className="space-y-1.5">
                  <label className="text-slate-700 dark:text-slate-300 font-bold">
                    3. Allowed Action Constraints:
                  </label>
                  <div className="space-y-1.5 pt-1">
                    {SUPPORTED_ACTIONS.map((action) => {
                      const checked = mintActions.includes(action.id);
                      return (
                        <div
                          key={action.id}
                          onClick={() => handleActionToggle(action.id)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-colors flex items-center justify-between ${
                            checked
                              ? "bg-purple-50/70 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-200"
                              : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          <div>
                            <div className="font-bold">{action.label}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">{action.desc}</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}}
                            className="w-4 h-4 text-purple-600 rounded-sm cursor-pointer"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resource Scope */}
                <div className="space-y-1.5">
                  <label className="text-slate-700 dark:text-slate-300 font-bold">
                    4. Resource Scope:
                  </label>
                  <input
                    type="text"
                    value={mintScope}
                    onChange={(e) => setMintScope(e.target.value)}
                    placeholder="/api/metered-service"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400">Quick scopes:</span>
                    {["/api/metered-service", "/api/v1/market-data", "*"].map((sc) => (
                      <button
                        type="button"
                        key={sc}
                        onClick={() => setMintScope(sc)}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        {sc}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget Limit & Expiration Duration */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-bold">
                      Spending Limit (HBAR):
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={mintBudget}
                      onChange={(e) => setMintBudget(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-bold">
                      TTL Duration:
                    </label>
                    <select
                      value={mintTtl}
                      onChange={(e) => setMintTtl(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                    >
                      <option value={300}>5 minutes (300s)</option>
                      <option value={3600}>1 hour (3600s)</option>
                      <option value={86400}>24 hours (86400s)</option>
                      <option value={604800}>7 days (604800s)</option>
                    </select>
                  </div>
                </div>

                {/* Security Implications Note */}
                <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/60 text-[11px] font-sans text-purple-900 dark:text-purple-300 space-y-1">
                  <div className="flex items-center gap-1 font-bold">
                    <Lock className="w-3.5 h-3.5" />
                    Cryptographic Assurance &amp; Least Privilege
                  </div>
                  <p>
                    Issued tokens cannot exceed the specified budget ceiling or execute unauthorized actions. Revocations are authoritative and effective immediately across broker evaluation gates.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowMintModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isIssuing}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                  >
                    {isIssuing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Issuing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Issue Capability
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Revocation Confirmation Modal */}
      {revokingCap && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 border border-rose-200 dark:border-rose-800 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white font-mono">
                  Revoke Authority Object
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-sans">
                  Are you sure you want to revoke capability <strong className="font-mono text-slate-900 dark:text-white">{revokingCap.capId.slice(0, 16)}...</strong>?
                </p>
              </div>
            </div>

            {revokeError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs">
                {revokeError}
              </div>
            )}

            <div className="space-y-1.5 font-mono text-xs">
              <label className="text-slate-700 dark:text-slate-300 font-bold">
                Revocation Reason (Logged to HCS Audit Topic):
              </label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Reason for revoking capability"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
              Revocation is immediate and permanent. Subsequent requests will return HTTP 403 <code className="font-mono text-rose-600">CAPABILITY_REVOKED</code>. Resuming an agent will not reactivate this capability.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRevokingCap(null)}
                disabled={isRevoking}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevokeSubmit}
                disabled={isRevoking}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs font-mono"
              >
                {isRevoking ? "Revoking..." : "Confirm Revocation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Capability Detail Drawer / Modal */}
      {selectedCap && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-xl w-full space-y-5 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800">
                    CAPABILITY SCOPE DETAIL
                  </span>
                  {renderStatusBadge(getCapabilityStatus(selectedCap))}
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white font-mono break-all">
                  {selectedCap.capId}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCap(null)}
                className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">OWNING AGENT:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                    {selectedCap.agentId || "agent_alpha"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">RESOURCE SCOPE:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedCap.resourceScope || selectedCap.serviceAddress}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">ALLOWED ACTIONS:</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">
                    {selectedCap.allowedActions ? selectedCap.allowedActions.join(", ") : "EXECUTE_METERED_SERVICE"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">POLICY TEMPLATE:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{selectedCap.policyId}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">BUDGET REMAINING:</span>
                  <span
                    className={
                      selectedCap.budgetRemaining === 0
                        ? "text-rose-600 font-bold"
                        : "text-emerald-600 font-bold"
                    }
                  >
                    {selectedCap.budgetRemaining} / {selectedCap.budgetTotal} {selectedCap.currency || "HBAR"}
                  </span>
                </div>

                {selectedCap.revoked && selectedCap.revokedAt && (
                  <div className="flex items-center justify-between pt-1 border-t border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400">
                    <span className="font-sans text-[11px]">REVOKED AT:</span>
                    <span className="font-bold">{new Date(selectedCap.revokedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* JWT Token Snippet */}
              {selectedCap.token && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>BEARER CAPABILITY TOKEN:</span>
                    <button
                      onClick={() => copyToClipboard(selectedCap.token, "token")}
                      className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === "token" ? "Copied!" : "Copy Token"}
                    </button>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] break-all font-mono text-slate-600 dark:text-slate-300">
                    {selectedCap.token.slice(0, 80)}...
                  </div>
                </div>
              )}

              {/* Cross-Resource Nav */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 font-sans">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-purple-500" /> Resource Connections
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setSelectedCap(null);
                      onNavigate("agents");
                    }}
                    className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 text-sky-800 dark:text-sky-300 font-mono text-xs flex items-center justify-between cursor-pointer"
                  >
                    <span>Owning Agent</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCap(null);
                      onNavigate("policies");
                    }}
                    className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 text-purple-800 dark:text-purple-300 font-mono text-xs flex items-center justify-between cursor-pointer"
                  >
                    <span>Associated Policy</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Expires: {new Date(selectedCap.expiry * 1000).toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-500" /> Ledger Enclave Protected
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
