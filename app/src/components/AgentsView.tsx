"use client";

import React, { useState } from "react";
import { Agent, Capability, PaymentAttempt, createAgent, transitionAgentStatus } from "@/lib/api";
import {
  Bot,
  Search,
  Filter,
  KeyRound,
  ArrowRight,
  Info,
  Lock,
  Calendar,
  Wallet,
  Clock,
  ShieldCheck,
  Plus,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  XCircle,
  CheckCircle2,
  RefreshCw,
  Coins,
  Activity,
  X
} from "lucide-react";

interface AgentsViewProps {
  agents: Agent[];
  capabilities: Capability[];
  payments: PaymentAttempt[];
  onNavigate: (tab: string) => void;
  onRefresh?: () => void;
}

export const AgentsView: React.FC<AgentsViewProps> = ({
  agents,
  capabilities,
  payments,
  onNavigate,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // Registration Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Lifecycle Transition Confirmation Modal State
  const [transitionTarget, setTransitionTarget] = useState<"ACTIVE" | "SUSPENDED" | "REVOKED" | null>(null);
  const [transitionReason, setTransitionReason] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const filteredAgents = agents.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.walletAddress.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Agent["status"]) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            ACTIVE &bull; OPERATIONAL
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            SUSPENDED &bull; PAUSED
          </span>
        );
      case "REVOKED":
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-[10px] font-mono font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            REVOKED &bull; TERMINAL
          </span>
        );
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const trimmedName = newName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setCreateError("Agent name must be at least 2 characters.");
      return;
    }

    if (newWalletAddress.trim() && !/^0x[a-fA-F0-9]{40}$/.test(newWalletAddress.trim())) {
      setCreateError("Wallet address must be a valid 20-byte EVM address starting with 0x.");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createAgent({
        name: trimmedName,
        description: newDescription.trim() || undefined,
        walletAddress: newWalletAddress.trim() || undefined,
      });

      setIsCreateModalOpen(false);
      setNewName("");
      setNewDescription("");
      setNewWalletAddress("");
      if (onRefresh) onRefresh();
      setSelectedAgent(created);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create agent");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteTransition = async () => {
    if (!selectedAgent || !transitionTarget) return;

    setTransitionError(null);
    setIsTransitioning(true);

    try {
      const result = await transitionAgentStatus(
        selectedAgent.id,
        transitionTarget,
        transitionReason.trim() || undefined
      );

      // Update local state
      const updatedAgent: Agent = {
        ...selectedAgent,
        status: result.agent.status,
        lastActiveAt: new Date().toISOString(),
      };
      setSelectedAgent(updatedAgent);
      setTransitionTarget(null);
      setTransitionReason("");

      if (onRefresh) onRefresh();
    } catch (err: any) {
      setTransitionError(err.message || "Failed to execute lifecycle transition");
    } finally {
      setIsTransitioning(false);
    }
  };

  // Filter capabilities & payments for currently inspected agent
  const agentCapabilities = selectedAgent
    ? capabilities.filter((c) => (c as any).agentId === selectedAgent.id || selectedAgent.id === "agent_alpha")
    : [];

  const agentPayments = selectedAgent
    ? payments.filter((p) => p.agentId === selectedAgent.id || selectedAgent.id === "agent_alpha")
    : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="glass-card rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 text-xs font-mono mb-1 font-bold">
            <Bot className="w-4 h-4" />
            AUTONOMOUS AGENT IDENTITY &amp; LIFECYCLE MANAGEMENT
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            Autonomous Agent Fleet ({agents.length})
          </h2>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Autonomous software actors executing pay-per-call services within strict capability boundaries. Lifecycle state is enforced server-side before request authorization.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold font-mono transition-all shadow-md shadow-sky-600/15 cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Register Agent
          </button>
          <button
            onClick={() => onNavigate("agent")}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5"
          >
            Terminal &rarr;
          </button>
        </div>
      </div>

      {/* Controls & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search agents or wallet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {["ALL", "ACTIVE", "SUSPENDED", "REVOKED"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === status
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Agents Grid */}
      {filteredAgents.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 space-y-3">
          <Bot className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
            No Agents Found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || statusFilter !== "ALL"
              ? "No agents match the specified search query or lifecycle status filter."
              : "No autonomous agents have been registered yet."}
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-mono font-bold cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Register First Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className={`glass-card rounded-2xl p-5 border transition-all duration-200 hover:shadow-md flex flex-col justify-between space-y-4 ${
                agent.status === "ACTIVE"
                  ? "border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/40"
                  : agent.status === "SUSPENDED"
                  ? "border-amber-200/90 dark:border-amber-900/40 hover:border-amber-500/40 bg-amber-500/2"
                  : "border-rose-200/90 dark:border-rose-900/40 hover:border-rose-500/40 opacity-75"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {agent.id}
                  </span>
                  {getStatusBadge(agent.status)}
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-sky-500" />
                  {agent.name}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {agent.description || "Autonomous actor operating under scoped broker permissions."}
                </p>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-slate-400 block text-[9px]">CAPABILITIES:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <KeyRound className="w-3 h-3 text-sky-500" />
                      {agent.capabilitiesCount} Granted
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-slate-400 block text-[9px]">TOTAL SPENT:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Coins className="w-3 h-3 text-purple-500" />
                      {agent.totalSpentHbar} HBAR
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1 truncate max-w-[170px]">
                    <Wallet className="w-3 h-3 shrink-0 text-slate-500" />
                    {agent.walletAddress.slice(0, 6)}...{agent.walletAddress.slice(-4)}
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {new Date(agent.lastActiveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <button
                  onClick={() => setSelectedAgent(agent)}
                  className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  Manage Agent &amp; Lifecycle &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agent Detail & Lifecycle Drawer / Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {selectedAgent.id}
                  </span>
                  {selectedAgent.isDemoFixture && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      Simulated Demo Fixture
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1.5 font-mono flex items-center gap-2">
                  <Bot className="w-5 h-5 text-sky-500" />
                  {selectedAgent.name}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {selectedAgent.description || "Autonomous software agent in the Vaultbreaker fleet."}
                </p>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="text-xs font-mono p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Operational Metrics & Identity */}
            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 font-sans text-xs font-medium">Authoritative Lifecycle Status:</span>
                  {getStatusBadge(selectedAgent.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-sans text-xs font-medium">Bound Network Rail:</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">{selectedAgent.network}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-sans text-xs font-medium">Hardware Wallet Reference:</span>
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1 font-mono text-[11px]">
                    <Wallet className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    {selectedAgent.walletAddress}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-center">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans block">Total Spent</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{selectedAgent.totalSpentHbar} HBAR</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans block">Calls Executed</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{selectedAgent.totalCallsExecuted ?? 0}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans block">Calls Rejected</span>
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{selectedAgent.totalCallsRejected ?? 0}</span>
                  </div>
                </div>
              </div>

              {/* Lifecycle Actions Bar */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white font-sans text-xs flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-sky-500" />
                    Lifecycle Controls (Server-Side Enforced)
                  </h4>
                  <span className="text-[10px] text-slate-400 font-sans">
                    Current: <strong className="font-mono text-slate-700 dark:text-slate-300">{selectedAgent.status}</strong>
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 font-sans">
                  {selectedAgent.status === "ACTIVE" && (
                    <button
                      onClick={() => setTransitionTarget("SUSPENDED")}
                      className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <PauseCircle className="w-3.5 h-3.5" /> Suspend Agent
                    </button>
                  )}

                  {selectedAgent.status === "SUSPENDED" && (
                    <button
                      onClick={() => setTransitionTarget("ACTIVE")}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <PlayCircle className="w-3.5 h-3.5" /> Resume Agent
                    </button>
                  )}

                  {selectedAgent.status !== "REVOKED" && (
                    <button
                      onClick={() => setTransitionTarget("REVOKED")}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Permanent Revocation
                    </button>
                  )}

                  {selectedAgent.status === "REVOKED" && (
                    <div className="w-full p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-300 font-sans">
                      <strong>Terminal State:</strong> This agent has been permanently revoked. According to the authoritative state machine, revoked agents cannot be reactivated or execute any protected calls.
                    </div>
                  )}
                </div>
              </div>

              {/* Cross-Resource Navigation */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white font-sans text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-500" /> Connected Resource Navigation
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans">
                  <button
                    onClick={() => {
                      setSelectedAgent(null);
                      onNavigate("capabilities");
                    }}
                    className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 text-left font-mono text-xs text-sky-800 dark:text-sky-300 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <span>View Capabilities ({agentCapabilities.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      setSelectedAgent(null);
                      onNavigate("payments");
                    }}
                    className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-800 text-left font-mono text-xs text-purple-800 dark:text-purple-300 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <span>Payment Activity ({agentPayments.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Registered: {new Date(selectedAgent.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Last Active: {new Date(selectedAgent.lastActiveAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lifecycle Transition Confirmation Modal */}
      {transitionTarget && selectedAgent && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/85 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2.5">
              {transitionTarget === "SUSPENDED" && <PauseCircle className="w-6 h-6 text-amber-500 shrink-0" />}
              {transitionTarget === "ACTIVE" && <PlayCircle className="w-6 h-6 text-emerald-500 shrink-0" />}
              {transitionTarget === "REVOKED" && <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0" />}
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                  Confirm Transition: {transitionTarget}
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  Agent: {selectedAgent.name} ({selectedAgent.id})
                </span>
              </div>
            </div>

            {transitionError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-mono">
                {transitionError}
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
              {transitionTarget === "SUSPENDED" && (
                <p>
                  <strong>Suspension Semantics:</strong> The agent will be temporarily paused. Any metered requests made using capabilities bound to this agent will immediately be <strong>rejected server-side</strong> with HTTP 403 <code className="font-mono text-amber-600 dark:text-amber-400">AGENT_SUSPENDED</code>. Active capability balances remain intact and can be resumed later.
                </p>
              )}
              {transitionTarget === "ACTIVE" && (
                <p>
                  <strong>Resume Semantics:</strong> The agent will be restored to operational status. It will resume executing metered calls constrained by its existing valid capabilities, policy price ceilings, and daily budget balances.
                </p>
              )}
              {transitionTarget === "REVOKED" && (
                <p>
                  <strong className="text-rose-600 dark:text-rose-400">Permanent Action Warning:</strong> This agent will be permanently revoked. According to the state machine, revoked agents <strong>cannot be reactivated</strong>. An immutable audit record will be submitted to the Hedera HCS timeline.
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-500 mb-1">
                Reason / Justification (Logged to Audit Trail):
              </label>
              <input
                type="text"
                placeholder={
                  transitionTarget === "SUSPENDED"
                    ? "e.g. Rate surge observed / routine security review"
                    : transitionTarget === "ACTIVE"
                    ? "e.g. Security review concluded"
                    : "e.g. Agent decommissioned permanently"
                }
                value={transitionReason}
                onChange={(e) => setTransitionReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setTransitionTarget(null);
                  setTransitionError(null);
                }}
                disabled={isTransitioning}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteTransition}
                disabled={isTransitioning}
                className={`px-4 py-2 rounded-xl text-white text-xs font-mono font-bold cursor-pointer transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5 ${
                  transitionTarget === "SUSPENDED"
                    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                    : transitionTarget === "ACTIVE"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                }`}
              >
                {isTransitioning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Transitioning...
                  </>
                ) : (
                  <>Confirm Transition &rarr;</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Agent Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                  <Plus className="w-5 h-5 text-sky-500" />
                  Register Autonomous Agent
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register a new autonomous software actor in the Vaultbreaker permission fleet.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-xs font-mono p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-mono">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateAgent} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Agent Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Liquidity Arbitrageur Node"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Scans Hedera DEX liquidity pools and executes automated rebalances under daily budget."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Hardware Wallet Reference Address (Optional)
                </label>
                <input
                  type="text"
                  placeholder="0x... (leave blank to auto-generate safe reference)"
                  value={newWalletAddress}
                  onChange={(e) => setNewWalletAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 font-mono"
                />
              </div>

              {/* Security Enclave Notice */}
              <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-[11px] text-sky-900 dark:text-sky-300 leading-relaxed font-sans flex items-start gap-2">
                <Lock className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Zero-Exposure Guarantee:</strong> Autonomous agents never hold raw private keys or seed phrases. All settlement credentials remain isolated in the Ledger KeyRing hardware enclave.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-mono font-bold cursor-pointer transition-all shadow-md shadow-sky-600/15 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Registering...
                    </>
                  ) : (
                    <>Register Agent &rarr;</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
