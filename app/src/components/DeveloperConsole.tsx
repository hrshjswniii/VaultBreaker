"use client";

import React, { useState } from "react";
import { Policy, Capability, createPolicy, issueCapability, revokeCapability } from "@/lib/api";
import { ShieldCheck, Plus, RefreshCw, KeyRound, AlertTriangle, ExternalLink, Lock } from "lucide-react";

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

  return (
    <div className="space-y-8">
      {/* Overview Banner */}
      <div className="glass-card-glow rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono mb-1">
              <Lock className="w-3.5 h-3.5" />
              LEDGER KEY RING PROTECTED SERVICE REGISTRY
            </div>
            <h2 className="text-2xl font-bold text-white">Metered Service & Spend Policy Console</h2>
            <p className="text-sm text-gray-400 mt-1 max-w-2xl">
              Register pay-per-call API endpoints, specify hard daily budget ceilings, and issue short-lived scoped capabilities to AI agents.
              Underlying settlement credentials are encrypted by Ledger seed key ring; agents never touch raw private keys.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/25 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Register Spend Policy
          </button>
        </div>
      </div>

      {/* Registered Policies Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Registered Metered Policies ({policies.length})
          </h3>
          <button onClick={onRefresh} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((p) => (
            <div key={p.id} className="glass-card rounded-xl p-5 hover:border-emerald-500/40 transition-all space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400">
                    {p.id}
                  </span>
                  <h4 className="text-base font-bold text-white mt-1">{p.name}</h4>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{p.serviceEndpoint}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-lg border border-slate-900 text-xs font-mono">
                <div>
                  <span className="text-gray-500 text-[10px] block">MAX CALL</span>
                  <span className="text-emerald-400 font-bold">{p.maxPricePerCall} HBAR/call</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">DAILY BUDGET</span>
                  <span className="text-white font-bold">{p.dailyBudget} HBAR</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">TTL</span>
                  <span className="text-gray-300 font-bold">{p.ttlSeconds}s</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-gray-400 flex items-center gap-1 font-mono">
                  <KeyRound className="w-3 h-3 text-cyan-400" /> Ledger Enclave Protected
                </span>
                <button
                  onClick={() => handleIssueToken(p.id)}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-semibold text-xs transition-all flex items-center gap-1.5"
                >
                  Issue Token to Agent &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Issued Capabilities Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-cyan-400" />
          Active Scoped Capabilities ({capabilities.length})
        </h3>

        {capabilities.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center text-gray-400 text-sm">
            No capabilities issued yet. Click &quot;Issue Token to Agent&quot; on any registered policy above.
          </div>
        ) : (
          <div className="space-y-3">
            {capabilities.map((cap) => (
              <div
                key={cap.capId}
                className={`glass-card rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  cap.revoked ? "border-red-500/40 bg-red-950/20" : "border-slate-800"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-cyan-300 font-bold">CapID: {cap.capId.slice(0, 14)}...{cap.capId.slice(-6)}</span>
                    {cap.revoked ? (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-red-950 border border-red-500/50 text-red-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Revoked On-Chain
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-400">
                        Active & Valid
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 font-mono">
                    Policy Hash: <span className="text-gray-300">{cap.policyHash.slice(0, 20)}...</span>
                  </div>
                </div>

                {/* Budget Gauge */}
                <div className="w-full md:w-48 space-y-1 font-mono">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-400">Budget:</span>
                    <span className={cap.budgetRemaining === 0 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                      {cap.budgetRemaining} / {cap.budgetTotal} HBAR
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        cap.budgetRemaining === 0 ? "bg-red-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${(cap.budgetRemaining / cap.budgetTotal) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onSelectCapabilityForAgent(cap)}
                    disabled={cap.revoked}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-semibold text-xs disabled:opacity-40"
                  >
                    Select for Agent
                  </button>
                  {!cap.revoked && (
                    <button
                      onClick={() => handleRevokeToken(cap.capId)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400 font-semibold text-xs"
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

      {/* Modal for Creating Policy */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card-glow rounded-2xl p-6 max-w-md w-full space-y-4 border border-emerald-500/40">
            <h3 className="text-xl font-bold text-white">Register Metered Spend Policy</h3>
            <form onSubmit={handleCreatePolicy} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Service Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Text Summarizer API"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Max Price Per Call (HBAR / Units)</label>
                <input
                  type="number"
                  required
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Daily Hard Budget Ceiling (HBAR)</label>
                <input
                  type="number"
                  required
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Token TTL Expiry (Seconds)</label>
                <input
                  type="number"
                  required
                  value={ttl}
                  onChange={(e) => setTtl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-xs font-semibold text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20"
                >
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
