"use client";

import React, { useState } from "react";
import { Policy, Capability, createPolicy, issueCapability, revokeCapability } from "@/lib/api";
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  KeyRound,
  AlertTriangle,
  Lock,
  Search,
  Copy,
  Check,
  Info
} from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [name, setName] = useState("");
  const [serviceAddress, setServiceAddress] = useState("0x0000000000000000000000000000000000000004");
  const [maxPrice, setMaxPrice] = useState("10");
  const [dailyBudget, setDailyBudget] = useState("50");
  const [ttl, setTtl] = useState("3600");
  const [loading, setLoading] = useState(false);
  const [copiedCapId, setCopiedCapId] = useState<string | null>(null);
  const [inspectToken, setInspectToken] = useState<Capability | null>(null);

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
    if (!confirm("Revoke this capability token on-chain and invalidate all future spending?")) return;
    try {
      await revokeCapability(capId);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCapId(id);
    setTimeout(() => setCopiedCapId(null), 2000);
  };

  const filteredPolicies = policies.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const inputCls =
    "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl p-2.5 text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 focus:border-sky-500 focus:outline-none font-mono";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Overview Banner */}
      <div className="glass-card-glow rounded-3xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 text-xs font-mono mb-1 font-bold">
              <Lock className="w-3.5 h-3.5" />
              LEDGER SEED ENCLAVE &bull; POLICY &amp; CAPABILITY MANAGEMENT
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              Metered Spend Policy &amp; Token Registry
            </h2>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Register API guardrails, assign daily budget ceilings, and issue short-lived capability objects to autonomous AI agents.
              Settlement credentials remain protected by Ledger KeyRing hardware enclave.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-sky-600/15 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Register Spend Policy
            </button>
          </div>
        </div>
      </div>

      {/* Policies Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono">
            <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            Registered Spend Policies ({policies.length})
          </h3>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
            <button
              onClick={onRefresh}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-mono font-medium cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPolicies.map((p) => (
            <div
              key={p.id}
              className="glass-card rounded-2xl p-5 hover:border-sky-300 dark:hover:border-sky-700 transition-all space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950 border border-sky-200/80 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-bold">
                    {p.id}
                  </span>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">{p.name}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{p.serviceEndpoint}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700 text-xs font-mono">
                <div>
                  <span className="text-slate-400 text-[10px] block font-sans">MAX CALL</span>
                  <span className="text-sky-700 dark:text-sky-400 font-bold">{p.maxPricePerCall} HBAR</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-sans">DAILY BUDGET</span>
                  <span className="text-slate-900 dark:text-white font-bold">{p.dailyBudget} HBAR</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-sans">TTL LIFESPAN</span>
                  <span className="text-slate-700 dark:text-slate-300 font-bold">{p.ttlSeconds}s</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                  <Lock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Ledger Enclave Protected
                </span>
                <button
                  onClick={() => handleIssueToken(p.id)}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-bold text-xs transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
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
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono">
          <KeyRound className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          Active Scoped Capabilities ({capabilities.length})
        </h3>

        {capabilities.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 text-sm font-sans">
            No capabilities issued yet. Click &quot;Issue Token to Agent&quot; on any policy above.
          </div>
        ) : (
          <div className="space-y-3">
            {capabilities.map((cap) => {
              const isExhausted = cap.budgetRemaining === 0;
              const isExpired = Math.floor(Date.now() / 1000) >= cap.expiry;

              return (
                <div
                  key={cap.capId}
                  className={`glass-card rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    cap.revoked
                      ? "border-rose-200 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20"
                      : isExhausted
                      ? "border-amber-200 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/20"
                      : ""
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-900 dark:text-white font-bold">
                        CapID: {cap.capId.slice(0, 14)}...{cap.capId.slice(-6)}
                      </span>
                      <button
                        onClick={() => copyToClipboard(cap.capId, cap.capId)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title="Copy CapID"
                      >
                        {copiedCapId === cap.capId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {cap.revoked ? (
                        <span className="text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Revoked On-Chain
                        </span>
                      ) : isExhausted ? (
                        <span className="text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400">
                          Budget Exhausted
                        </span>
                      ) : isExpired ? (
                        <span className="text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          Expired
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400">
                          Active &amp; Valid
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      Service Address: <span className="text-slate-700 dark:text-slate-300">{cap.serviceAddress}</span>
                    </div>
                  </div>

                  <div className="w-full md:w-48 space-y-1 font-mono">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400 font-sans">Remaining Budget:</span>
                      <span
                        className={
                          cap.budgetRemaining === 0
                            ? "text-rose-600 dark:text-rose-400 font-bold"
                            : "text-emerald-700 dark:text-emerald-400 font-bold"
                        }
                      >
                        {cap.budgetRemaining} / {cap.budgetTotal} HBAR
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600">
                      <div
                        className={`h-full transition-all duration-500 ${
                          cap.budgetRemaining === 0 ? "bg-rose-500" : "bg-sky-500"
                        }`}
                        style={{ width: `${(cap.budgetRemaining / cap.budgetTotal) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setInspectToken(cap)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                      title="Inspect Token Payload"
                    >
                      <Info className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onSelectCapabilityForAgent(cap)}
                      disabled={cap.revoked}
                      className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs disabled:opacity-40 shadow-xs cursor-pointer"
                    >
                      Select for Agent
                    </button>

                    {!cap.revoked && (
                      <button
                        onClick={() => handleRevokeToken(cap.capId)}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 font-bold text-xs shadow-2xs cursor-pointer"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inspect Token Modal */}
      {inspectToken && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                Capability JWT Token Inspector
              </h3>
              <button
                onClick={() => setInspectToken(null)}
                className="text-xs font-mono px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">JWT BEARER TOKEN STRING:</span>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 break-all select-all">
                  {inspectToken.token}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] font-sans">ENCRYPTED CREDENTIAL (LEDGER ENCLAVE):</span>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-purple-700 dark:text-purple-300 break-all">
                  {inspectToken.encryptedCredential}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300 pt-1">
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">EXPIRY TIMESTAMP:</span>
                  <span className="font-bold">{new Date(inspectToken.expiry * 1000).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-sans">POLICY HASH:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">{inspectToken.policyHash.slice(0, 14)}...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Policy Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white font-mono">
              Register Metered Spend Policy
            </h3>
            <form onSubmit={handleCreatePolicy} className="space-y-3">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1">Service Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Text Summarizer API"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1">
                  Max Price Per Call (HBAR / Units)
                </label>
                <input
                  type="number"
                  required
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1">
                  Daily Hard Budget Ceiling (HBAR)
                </label>
                <input
                  type="number"
                  required
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1">
                  Token TTL Lifespan (Seconds)
                </label>
                <input
                  type="number"
                  required
                  value={ttl}
                  onChange={(e) => setTtl(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-600/20 disabled:opacity-50 cursor-pointer"
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
