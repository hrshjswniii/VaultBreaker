"use client";

import React, { useState } from "react";
import {
  Policy,
  Capability,
  PaymentAttempt,
  Agent,
  PolicyEffect,
  PolicyEvaluationResult,
  togglePolicy,
  createPolicy,
  evaluatePolicyDryRun,
} from "@/lib/api";
import {
  ShieldCheck,
  Search,
  Plus,
  Info,
  CheckCircle2,
  AlertOctagon,
  FileCode,
  Play,
  Sliders,
  Clock,
  Gauge,
  Ban,
  AlertTriangle,
  X,
  RefreshCw,
  Power,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface PoliciesViewProps {
  policies: Policy[];
  capabilities: Capability[];
  payments: PaymentAttempt[];
  agents?: Agent[];
  onRefresh?: () => Promise<void> | void;
  onNavigate: (tab: string) => void;
  onIssueTokenForPolicy: (policyId: string) => void;
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({
  policies,
  capabilities,
  payments,
  agents = [],
  onRefresh,
  onNavigate,
  onIssueTokenForPolicy,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [effectFilter, setEffectFilter] = useState<"ALL" | "ALLOW" | "DENY" | "DISABLED">("ALL");
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDryRunOpen, setIsDryRunOpen] = useState(true);
  const [togglingPolicyId, setTogglingPolicyId] = useState<string | null>(null);

  // Dry Run Simulator State
  const [simAgentId, setSimAgentId] = useState<string>(agents[0]?.id || "agent_alpha");
  const [simServiceAddress, setSimServiceAddress] = useState<string>(
    "0x0000000000000000000000000000000000000004"
  );
  const [simAction, setSimAction] = useState<string>("EXECUTE_METERED_SERVICE");
  const [simResource, setSimResource] = useState<string>("/api/metered-service");
  const [simAmount, setSimAmount] = useState<number>(10);
  const [evalResult, setEvalResult] = useState<PolicyEvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Create Policy Modal Form State
  const [newPolicyName, setNewPolicyName] = useState("");
  const [newPolicyDescription, setNewPolicyDescription] = useState("");
  const [newPolicyEffect, setNewPolicyEffect] = useState<PolicyEffect>("ALLOW");
  const [newPolicyPriority, setNewPolicyPriority] = useState<number>(100);
  const [newPolicyEndpoint, setNewPolicyEndpoint] = useState("/api/metered-service");
  const [newPolicyServiceAddress, setNewPolicyServiceAddress] = useState("*");
  const [newPolicyMaxPrice, setNewPolicyMaxPrice] = useState<number>(10);
  const [newPolicyDailyBudget, setNewPolicyDailyBudget] = useState<number>(50);
  const [newPolicyTtlSeconds, setNewPolicyTtlSeconds] = useState<number>(3600);
  const [newPolicyMaxVelocity, setNewPolicyMaxVelocity] = useState<string>("");
  const [newPolicyStartHour, setNewPolicyStartHour] = useState<string>("");
  const [newPolicyEndHour, setNewPolicyEndHour] = useState<string>("");
  const [newPolicyBlockedActions, setNewPolicyBlockedActions] = useState<string>("");
  const [newPolicyBlockedResources, setNewPolicyBlockedResources] = useState<string>("");
  const [isSubmittingPolicy, setIsSubmittingPolicy] = useState<boolean>(false);
  const [createPolicyError, setCreatePolicyError] = useState<string | null>(null);

  // Filtering
  const filteredPolicies = policies.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.serviceEndpoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (effectFilter === "ALLOW") return p.enabled && p.effect === "ALLOW";
    if (effectFilter === "DENY") return p.enabled && p.effect === "DENY";
    if (effectFilter === "DISABLED") return !p.enabled;
    return true;
  });

  // Toggle Policy Handler
  const handleTogglePolicy = async (policy: Policy) => {
    try {
      setTogglingPolicyId(policy.id);
      await togglePolicy(policy.id);
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      alert(`Failed to toggle policy: ${err.message}`);
    } finally {
      setTogglingPolicyId(null);
    }
  };

  // Run Dry-Run Evaluation
  const handleExecuteDryRun = async () => {
    setIsEvaluating(true);
    try {
      const res = await evaluatePolicyDryRun({
        agentId: simAgentId,
        serviceAddress: simServiceAddress,
        action: simAction,
        resource: simResource,
        amount: simAmount,
      });
      setEvalResult(res);
    } catch (err: any) {
      alert(`Dry-run evaluation failed: ${err.message}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Create Policy Handler
  const handleCreatePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatePolicyError(null);
    setIsSubmittingPolicy(true);

    try {
      const blockedActions = newPolicyBlockedActions
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const blockedResources = newPolicyBlockedResources
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      let allowedHoursUtc: { startHour: number; endHour: number } | undefined = undefined;
      if (newPolicyStartHour !== "" && newPolicyEndHour !== "") {
        allowedHoursUtc = {
          startHour: parseInt(newPolicyStartHour, 10),
          endHour: parseInt(newPolicyEndHour, 10),
        };
      }

      const conditions: any = {
        maxPricePerCall: newPolicyMaxPrice,
        dailyBudget: newPolicyDailyBudget,
      };
      if (newPolicyMaxVelocity) {
        conditions.maxCallsPerMinute = parseInt(newPolicyMaxVelocity, 10);
      }
      if (allowedHoursUtc) {
        conditions.allowedHoursUtc = allowedHoursUtc;
      }
      if (blockedActions.length > 0) {
        conditions.blockedActions = blockedActions;
      }
      if (blockedResources.length > 0) {
        conditions.blockedResources = blockedResources;
      }

      await createPolicy({
        name: newPolicyName,
        description: newPolicyDescription,
        effect: newPolicyEffect,
        priority: newPolicyPriority,
        serviceEndpoint: newPolicyEndpoint,
        serviceAddress: newPolicyServiceAddress,
        maxPricePerCall: newPolicyMaxPrice,
        dailyBudget: newPolicyDailyBudget,
        ttlSeconds: newPolicyTtlSeconds,
        conditions,
      });

      if (onRefresh) await onRefresh();
      setIsCreateModalOpen(false);
      // Reset form
      setNewPolicyName("");
      setNewPolicyDescription("");
      setNewPolicyMaxPrice(10);
      setNewPolicyDailyBudget(50);
      setNewPolicyMaxVelocity("");
      setNewPolicyStartHour("");
      setNewPolicyEndHour("");
      setNewPolicyBlockedActions("");
      setNewPolicyBlockedResources("");
    } catch (err: any) {
      setCreatePolicyError(err.message || "Failed to register policy");
    } finally {
      setIsSubmittingPolicy(false);
    }
  };

  // Stats calculation
  const totalPoliciesCount = policies.length;
  const activePoliciesCount = policies.filter((p) => p.enabled).length;
  const denyGuardsCount = policies.filter((p) => p.enabled && p.effect === "DENY").length;
  const highestPriority = policies.reduce((max, p) => (p.priority > max ? p.priority : max), 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="glass-card rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 text-xs font-mono mb-1 font-bold">
            <ShieldCheck className="w-4 h-4" />
            DETERMINISTIC POLICY EVALUATOR &amp; AUTHORIZATION ENGINE
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            Spend &amp; Security Policies ({totalPoliciesCount})
          </h2>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Precedence-based policy decision engine with explicit <code className="text-rose-600 dark:text-rose-400 font-bold">DENY</code> overrides,
            velocity rate limits, price ceilings, and UTC time-window restrictions. Zero budget deductions on rejection.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsDryRunOpen(!isDryRunOpen)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 text-sky-500" />
            Dry-Run Sandbox {isDryRunOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold font-mono transition-all shadow-md shadow-sky-600/15 cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Register Policy
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800">
          <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">Total Rules</span>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{totalPoliciesCount}</div>
          <span className="text-[11px] text-slate-400 font-sans">Defined in Engine</span>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800">
          <span className="text-[10px] font-mono uppercase text-emerald-600 dark:text-emerald-400">Active Policies</span>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{activePoliciesCount}</div>
          <span className="text-[11px] text-slate-400 font-sans">Enforcing in Pipeline</span>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800">
          <span className="text-[10px] font-mono uppercase text-rose-600 dark:text-rose-400">Deny Guardrails</span>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">{denyGuardsCount}</div>
          <span className="text-[11px] text-slate-400 font-sans">Precedence Overrides</span>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800">
          <span className="text-[10px] font-mono uppercase text-sky-600 dark:text-sky-400">Max Priority</span>
          <div className="text-xl font-black text-sky-600 dark:text-sky-400 font-mono mt-0.5">{highestPriority}</div>
          <span className="text-[11px] text-slate-400 font-sans">Highest Precedence</span>
        </div>
      </div>

      {/* Interactive Dry-Run Sandbox Section */}
      {isDryRunOpen && (
        <div className="glass-card rounded-3xl p-6 border-2 border-sky-500/30 dark:border-sky-500/20 bg-sky-500/5 space-y-5 animate-in slide-in-from-top-3 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-100 dark:border-sky-950 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-sky-500 text-white shadow-sm">
                <Play className="w-4 h-4 fill-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                  POLICY EVALUATION SANDBOX (DRY-RUN INSPECTOR)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                  Simulate authorization decisions without invoking real services or deducting on-chain budget tokens.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsDryRunOpen(false)}
              className="text-xs font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer self-end sm:self-center"
            >
              Minimize
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs font-mono">
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Target Agent ID</label>
              <input
                type="text"
                value={simAgentId}
                onChange={(e) => setSimAgentId(e.target.value)}
                placeholder="agent_alpha"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Service Address</label>
              <input
                type="text"
                value={simServiceAddress}
                onChange={(e) => setSimServiceAddress(e.target.value)}
                placeholder="0x000...004"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Action Name</label>
              <input
                type="text"
                value={simAction}
                onChange={(e) => setSimAction(e.target.value)}
                placeholder="EXECUTE_METERED_SERVICE"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Resource Path</label>
              <input
                type="text"
                value={simResource}
                onChange={(e) => setSimResource(e.target.value)}
                placeholder="/api/metered-service"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Cost (HBAR)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={simAmount}
                  onChange={(e) => setSimAmount(Number(e.target.value))}
                  min={1}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:border-sky-500"
                />
                <button
                  onClick={handleExecuteDryRun}
                  disabled={isEvaluating}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl font-bold font-mono transition-all cursor-pointer shrink-0 shadow-sm"
                >
                  {isEvaluating ? "..." : "Evaluate"}
                </button>
              </div>
            </div>
          </div>

          {/* Dry Run Outcome Panel */}
          {evalResult && (
            <div className="p-4 bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-mono font-black px-3 py-1 rounded-xl uppercase tracking-wider ${
                      evalResult.allowed
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-700"
                    }`}
                  >
                    DECISION: {evalResult.outcome}
                  </span>

                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    Code: <code className="font-bold text-slate-800 dark:text-slate-200">{evalResult.reasonCode}</code>
                  </span>
                </div>

                <div className="text-[11px] font-mono text-slate-400">
                  Decision ID: {evalResult.decisionId}
                </div>
              </div>

              <div className="text-xs font-mono">
                <span className="text-slate-500 block mb-0.5">Primary Decision Rationale:</span>
                <p className="text-slate-800 dark:text-slate-200 font-semibold bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  {evalResult.primaryReason}
                </p>
              </div>

              {evalResult.matchedPolicyId && (
                <div className="text-xs font-mono flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <span>Matched Policy: <b className="text-sky-600 dark:text-sky-400">{evalResult.matchedPolicyName || evalResult.matchedPolicyId}</b></span>
                  {evalResult.matchedPolicyVersion && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">
                      v{evalResult.matchedPolicyVersion}
                    </span>
                  )}
                </div>
              )}

              {/* Evaluation Step Trace */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-mono uppercase text-slate-400 font-bold block">
                  Deterministic Evaluation Pipeline Trace ({evalResult.evaluationTrace.length} Steps):
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {evalResult.evaluationTrace.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-start justify-between gap-2 text-[11px] font-mono"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            step.status === "PASS"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : step.status === "FAIL"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {step.status}
                        </span>
                        <div>
                          <span className="font-bold text-slate-700 dark:text-slate-300 mr-2">{step.stage}:</span>
                          <span className="text-slate-600 dark:text-slate-400">{step.detail}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {step.timestamp.split("T")[1]?.slice(0, 8)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search policies by name, ID, or endpoint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 font-mono"
          />
        </div>

        {/* Effect Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono">
          <button
            onClick={() => setEffectFilter("ALL")}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              effectFilter === "ALL"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            All ({policies.length})
          </button>
          <button
            onClick={() => setEffectFilter("ALLOW")}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              effectFilter === "ALLOW"
                ? "bg-emerald-600 text-white font-bold shadow-xs"
                : "text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            ALLOW Rules
          </button>
          <button
            onClick={() => setEffectFilter("DENY")}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              effectFilter === "DENY"
                ? "bg-rose-600 text-white font-bold shadow-xs"
                : "text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
            }`}
          >
            DENY Guards
          </button>
          <button
            onClick={() => setEffectFilter("DISABLED")}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              effectFilter === "DISABLED"
                ? "bg-slate-600 text-white font-bold shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Disabled
          </button>
        </div>
      </div>

      {/* Policies List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPolicies.map((policy) => {
          const matchingCaps = capabilities.filter((c) => c.policyId === policy.id);
          const isToggling = togglingPolicyId === policy.id;
          const cond = policy.conditions || {};

          return (
            <div
              key={policy.id}
              className={`glass-card rounded-2xl p-5 hover:border-sky-300 dark:hover:border-sky-700 transition-all space-y-4 flex flex-col justify-between ${
                !policy.enabled ? "opacity-75 bg-slate-50/50 dark:bg-slate-900/40" : ""
              }`}
            >
              <div className="space-y-3">
                {/* Policy Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-bold">
                        {policy.id}
                      </span>

                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold uppercase ${
                          policy.effect === "DENY"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                        }`}
                      >
                        EFFECT: {policy.effect || "ALLOW"}
                      </span>

                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Priority {policy.priority || 100}
                      </span>

                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                        v{policy.version || 1}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white pt-1">{policy.name}</h3>

                    {policy.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {policy.description}
                      </p>
                    )}

                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      Endpoint: {policy.serviceEndpoint}
                      {policy.serviceAddress && policy.serviceAddress !== "*" && (
                        <span className="ml-2 text-slate-400">({policy.serviceAddress.slice(0, 10)}...)</span>
                      )}
                    </p>
                  </div>

                  {/* Toggle Button */}
                  <button
                    onClick={() => handleTogglePolicy(policy)}
                    disabled={isToggling}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shrink-0 border ${
                      policy.enabled
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700 hover:bg-slate-200"
                    }`}
                    title={policy.enabled ? "Click to Disable Policy" : "Click to Enable Policy"}
                  >
                    <Power className={`w-3.5 h-3.5 ${isToggling ? "animate-spin" : ""}`} />
                    {policy.enabled ? "ACTIVE" : "DISABLED"}
                  </button>
                </div>

                {/* Conditions Metric Box */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 text-[10px] block font-sans">PRICE CEILING</span>
                    <span className="text-sky-700 dark:text-sky-400 font-bold">
                      {policy.maxPricePerCall || cond.maxPricePerCall || 10} HBAR
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block font-sans">DAILY CEILING</span>
                    <span className="text-slate-900 dark:text-white font-bold">
                      {policy.dailyBudget || cond.dailyBudget || 50} HBAR
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block font-sans">TTL LIFESPAN</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">{policy.ttlSeconds}s</span>
                  </div>
                </div>

                {/* Additional Advanced Conditions Badges */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono">
                  {cond.maxCallsPerMinute && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      <Gauge className="w-3 h-3" /> Velocity: {cond.maxCallsPerMinute}/min
                    </span>
                  )}

                  {cond.allowedHoursUtc && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {cond.allowedHoursUtc.startHour}:00 - {cond.allowedHoursUtc.endHour}:00 UTC
                    </span>
                  )}

                  {cond.blockedActions && cond.blockedActions.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-center gap-1">
                      <Ban className="w-3 h-3" /> Blocked Actions ({cond.blockedActions.length})
                    </span>
                  )}

                  {cond.blockedResources && cond.blockedResources.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-center gap-1">
                      <Ban className="w-3 h-3" /> Blocked Resources ({cond.blockedResources.length})
                    </span>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-mono text-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  {matchingCaps.length} Active Tokens Issued
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedPolicy(policy)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="View Policy Specification & Trace"
                  >
                    <Info className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      setSimServiceAddress(policy.serviceAddress === "*" ? "0x0000000000000000000000000000000000000004" : policy.serviceAddress);
                      setSimResource(policy.serviceEndpoint);
                      setIsDryRunOpen(true);
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="Load into Dry-Run Sandbox"
                  >
                    <Play className="w-4 h-4 text-sky-500" />
                  </button>

                  <button
                    onClick={() => onIssueTokenForPolicy(policy.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-2xs cursor-pointer"
                  >
                    Issue Token
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Policy Detail & Specification Modal */}
      {selectedPolicy && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-xl w-full space-y-5 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold">
                  POLICY SPECIFICATION &amp; RESOLUTION ORDER
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
                  {selectedPolicy.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPolicy(null)}
                className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="text-slate-400">Policy ID:</span> <b>{selectedPolicy.id}</b></div>
                  <div><span className="text-slate-400">Effect:</span> <b className={selectedPolicy.effect === "DENY" ? "text-rose-500" : "text-emerald-500"}>{selectedPolicy.effect}</b></div>
                  <div><span className="text-slate-400">Precedence Priority:</span> <b>{selectedPolicy.priority}</b></div>
                  <div><span className="text-slate-400">Version:</span> <b>v{selectedPolicy.version}</b></div>
                  <div><span className="text-slate-400">Service Target:</span> <b>{selectedPolicy.serviceAddress}</b></div>
                  <div><span className="text-slate-400">Status:</span> <b>{selectedPolicy.enabled ? "ACTIVE" : "DISABLED"}</b></div>
                </div>
              </div>

              {/* Precedence Notice */}
              <div className="p-3.5 rounded-xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 space-y-1.5 font-sans">
                <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 block">
                  Deterministic Precedence Guarantees:
                </span>
                <p className="text-[11px] text-slate-700 dark:text-slate-300">
                  1. Explicit <b>DENY</b> rules take precedence over ALLOW rules.<br />
                  2. Higher priority numbers evaluate first (priority {selectedPolicy.priority}).<br />
                  3. If rejected, capability budget is untouched (zero deduction guarantee).
                </p>
              </div>

              {/* JSON Spec */}
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">Declared Conditions Schema:</span>
                <pre className="p-3 bg-slate-900 text-sky-300 rounded-xl overflow-x-auto text-[11px] font-mono">
                  {JSON.stringify(selectedPolicy.conditions || {}, null, 2)}
                </pre>
              </div>

              <div className="pt-2 flex items-center justify-between font-sans">
                <button
                  onClick={() => {
                    setSelectedPolicy(null);
                    onNavigate("capabilities");
                  }}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-mono text-xs font-bold cursor-pointer flex items-center gap-1"
                >
                  View Capabilities ({capabilities.length}) &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register New Policy Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-2xl w-full space-y-5 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold">
                  STAGE 6 POLICY AUTHORIZATION ENGINE
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
                  Register Spend &amp; Security Policy
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {createPolicyError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {createPolicyError}
              </div>
            )}

            <form onSubmit={handleCreatePolicySubmit} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Policy Name *</label>
                  <input
                    type="text"
                    required
                    value={newPolicyName}
                    onChange={(e) => setNewPolicyName(e.target.value)}
                    placeholder="e.g. Production Compute Guardrail"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Policy Effect *</label>
                  <select
                    value={newPolicyEffect}
                    onChange={(e) => setNewPolicyEffect(e.target.value as PolicyEffect)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="ALLOW">ALLOW (Authorizes valid calls)</option>
                    <option value="DENY">DENY (Explicit Guardrail / Ceiling)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Description</label>
                <input
                  type="text"
                  value={newPolicyDescription}
                  onChange={(e) => setNewPolicyDescription(e.target.value)}
                  placeholder="Explains operational bounds and intent of this rule..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Priority (Precedence)</label>
                  <input
                    type="number"
                    value={newPolicyPriority}
                    onChange={(e) => setNewPolicyPriority(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Max Price / Call (HBAR)</label>
                  <input
                    type="number"
                    value={newPolicyMaxPrice}
                    onChange={(e) => setNewPolicyMaxPrice(Number(e.target.value))}
                    min={1}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Daily Ceiling (HBAR)</label>
                  <input
                    type="number"
                    value={newPolicyDailyBudget}
                    onChange={(e) => setNewPolicyDailyBudget(Number(e.target.value))}
                    min={1}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Service Address (* for all)</label>
                  <input
                    type="text"
                    value={newPolicyServiceAddress}
                    onChange={(e) => setNewPolicyServiceAddress(e.target.value)}
                    placeholder="*"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Service Endpoint Path</label>
                  <input
                    type="text"
                    value={newPolicyEndpoint}
                    onChange={(e) => setNewPolicyEndpoint(e.target.value)}
                    placeholder="/api/metered-service"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Advanced Conditions Section */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  Advanced Condition Controls (Optional):
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-500 text-[10px] mb-1">Velocity Limit (calls/min)</label>
                    <input
                      type="number"
                      value={newPolicyMaxVelocity}
                      onChange={(e) => setNewPolicyMaxVelocity(e.target.value)}
                      placeholder="e.g. 60"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 text-[10px] mb-1">Start UTC Hour (0-23)</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={newPolicyStartHour}
                      onChange={(e) => setNewPolicyStartHour(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 text-[10px] mb-1">End UTC Hour (0-23)</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={newPolicyEndHour}
                      onChange={(e) => setNewPolicyEndHour(e.target.value)}
                      placeholder="23"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 text-[10px] mb-1">Blocked Actions (comma-separated)</label>
                    <input
                      type="text"
                      value={newPolicyBlockedActions}
                      onChange={(e) => setNewPolicyBlockedActions(e.target.value)}
                      placeholder="EXPORT_DB, ADMIN_EXECUTE"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 text-[10px] mb-1">Blocked Resources (comma-separated)</label>
                    <input
                      type="text"
                      value={newPolicyBlockedResources}
                      onChange={(e) => setNewPolicyBlockedResources(e.target.value)}
                      placeholder="/api/admin, /api/root"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPolicy}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold cursor-pointer shadow-md shadow-sky-600/20"
                >
                  {isSubmittingPolicy ? "Registering..." : "Register Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
