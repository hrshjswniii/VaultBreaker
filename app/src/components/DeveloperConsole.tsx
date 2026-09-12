"use client";

import React, { useState } from "react";
import { Policy, Capability, createPolicy, issueCapability, revokeCapability } from "@/lib/api";
import { ShieldCheck, Plus, RefreshCw, KeyRound, AlertTriangle, Lock } from "lucide-react";

interface DeveloperConsoleProps {
  policies: Policy[];
  capabilities: Capability[];
  onRefresh: () => void;
  onSelectCapabilityForAgent: (cap: Capability) => void;
}

export const DeveloperConsole: React.FC<DeveloperConsoleProps> = ({
  policies,
  capabilities,
  onRefresh,
  onSelectCapabilityForAgent,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [serviceAddress, setServiceAddress] = useState("0x0000000000000000000000000000000000000004");
  const [maxPrice, setMaxPrice] = useState("10");
  const [dailyBudget, setDailyBudget] = useState("50");
  const [ttl, setTtl] = useState("3600");
  const [loading, setLoading] = useState(false);

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createPolicy({
        name,
        serviceEndpoint: "/api/metered-service",
        serviceAddress,
        maxPricePerCall: Number(maxPrice),
        dailyBudget: Number(dailyBudget),
        ttlSeconds: Number(ttl),
      });
      setShowCreateModal(false);
      setName("");
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueToken = async (policyId: string) => {
    try {
      const cap = await issueCapability(policyId);
      onRefresh();
      onSelectCapabilityForAgent(cap);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRevokeToken = async (capId: string) => {
    if (!confirm("Revoke this capability token on-chain?")) return;
    try {
      await revokeCapability(capId);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const inputCls = "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl p-2.5 text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 focus:border-sky-500 focus:outline-none";

  return (
    <div className="space-y-8">
      {/* Overview Banner */}
      <div className="glass-card-glow rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 text-xs font-mono mb-1 font-bold">
              <Lock className="w-3.5 h-3.5" />
              LEDGER KEY RING PROTECTED SERVICE REGISTRY
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono">Metered Service & Spend Policy Console</h2>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Register pay-per-call API endpoints, specify hard daily budget ceilings, and issue short-lived scoped capabilities to AI agents.
              Underlying settlement credentials are encrypted by Ledger seed key ring; agents never touch raw private keys.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-sky-600/15 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Register Spend Policy
          </button>
        </div>
      </div>

      {/* Registered Policies */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono">
            <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            Registered Metered Policies ({policies.length})
          </h3>
          <button onClick={onRefresh} className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 font-mono font-medium">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((p) => (
            <div key={p.id} className="glass-card rounded-2xl p-5 hover:border-sky-300 dark:hover:border-sky-700 transition-all space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950 border border-sky-200/80 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-bold">
                    {p.id}
                  </span>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">{p.name}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{p.serviceEndpoint}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700 text-xs font-mono">
                <div>
                  <span className="text-slate-400 text-[10px] block font-sans">MAX CALL</span>
                  <span className="text-sky-700 dark:text-sky-400 font-bold">{p.maxPricePerCall} HBAR/call</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-sans">DAILY BUDGET</span>
                  <span className="text-slate-900 dark:text-white font-bold">{p.dailyBudget} HBAR</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-sans">TTL</span>
                  <span className="text-slate-700 dark:text-slate-300 font-bold">{p.ttlSeconds}s</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                  <KeyRound className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Ledger Enclave Protected
                </span>
                <button
                  onClick={() => handleIssueToken(p.id)}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-bold text-xs transition-all flex items-center gap-1.5 shadow-2xs"
                >
                  Issue Token to Agent &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Issued Capabilities */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono">
          <KeyRound className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          Active Scoped Capabilities ({capabilities.length})
        </h3>

        {capabilities.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
            No capabilities issued yet. Click &quot;Issue Token to Agent&quot; on any registered policy above.
          </div>
        ) : (
          <div className="space-y-3">
            {capabilities.map((cap) => (
              <div
                key={cap.capId}
                className={`glass-card rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  cap.revoked ? "border-rose-200 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20" : ""
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-900 dark:text-white font-bold">
                      CapID: {cap.capId.slice(0, 14)}...{cap.capId.slice(-6)}
                    </span>
                    {cap.revoked ? (
                      <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Revoked On-Chain
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400">
                        Active & Valid
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Policy Hash: <span className="text-slate-700 dark:text-slate-300">{cap.policyHash.slice(0, 20)}...</span>
                  </div>
                </div>

                <div className="w-full md:w-48 space-y-1 font-mono">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-sans">Budget:</span>
                    <span className={cap.budgetRemaining === 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-emerald-700 dark:text-emerald-400 font-bold"}>
                      {cap.budgetRemaining} / {cap.budgetTotal} HBAR
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600">
                    <div
                      className={`h-full transition-all duration-500 ${cap.budgetRemaining === 0 ? "bg-rose-500" : "bg-sky-500"}`}
                      style={{ width: `${(cap.budgetRemaining / cap.budgetTotal) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onSelectCapabilityForAgent(cap)}
                    disabled={cap.revoked}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs disabled:opacity-40 shadow-xs"
                  >
                    Select for Agent
                  </button>
                  {!cap.revoked && (
                    <button
                      onClick={() => handleRevokeToken(cap.capId)}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 font-bold text-xs shadow-2xs"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Policy Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white font-mono">Register Metered Spend Policy</h3>
            <form onSubmit={handleCreatePolicy} className="space-y-3">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1">Service Name</label>
                <input type="text" required placeholder="e.g. AI Text Summarizer API" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1">Max Price Per Call (HBAR / Units)</label>
                <input type="number" required value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1">Daily Hard Budget Ceiling (HBAR)</label>
                <input type="number" required value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1">Token TTL Expiry (Seconds)</label>
                <input type="number" required value={ttl} onChange={(e) => setTtl(e.target.value)} className={inputCls} />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-600/20 disabled:opacity-50">
                  {loading ? "Registering..." : "Save Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
