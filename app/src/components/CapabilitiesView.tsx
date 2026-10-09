"use client";

import React, { useState } from "react";
import { Capability, Policy, revokeCapability } from "@/lib/api";
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
  ShieldCheck
} from "lucide-react";

interface CapabilitiesViewProps {
  capabilities: Capability[];
  policies: Policy[];
  onRefresh: () => void;
  onNavigate: (tab: string) => void;
  onSelectCapabilityForAgent: (cap: Capability) => void;
}

export const CapabilitiesView: React.FC<CapabilitiesViewProps> = ({
  capabilities,
  policies,
  onRefresh,
  onNavigate,
  onSelectCapabilityForAgent,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedCap, setSelectedCap] = useState<Capability | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredCaps = capabilities.filter((c) => {
    const isExhausted = c.budgetRemaining === 0;
    const isExpired = Math.floor(Date.now() / 1000) >= c.expiry;

    let status = "ACTIVE";
    if (c.revoked) status = "REVOKED";
    else if (isExhausted) status = "EXHAUSTED";
    else if (isExpired) status = "EXPIRED";

    const matchesSearch =
      c.capId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.serviceAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.policyId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleRevoke = async (capId: string) => {
    if (!confirm("Revoke this capability token on-chain? All future spend attempts will be rejected.")) return;
    try {
      await revokeCapability(capId);
      onRefresh();
      if (selectedCap && selectedCap.capId === capId) {
        setSelectedCap((prev) => (prev ? { ...prev, revoked: true } : null));
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="glass-card rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 text-xs font-mono mb-1 font-bold">
            <KeyRound className="w-4 h-4" />
            SCOPED AUTHORITY OBJECT REGISTRY
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            Active Capability Objects ({capabilities.length})
          </h2>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Short-lived, spend-limited capabilities assigned to agents. Represents bounded authority granted for specific metered endpoints.
          </p>
        </div>

        <button
          onClick={() => onNavigate("developer")}
          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold font-mono transition-all shadow-md shadow-sky-600/15 cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          Mint New Capability &rarr;
        </button>
      </div>

      {/* Controls & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by CapID, service address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700 overflow-x-auto">
          <div className="flex items-center gap-1 text-slate-400 font-mono text-xs px-2.5 py-1 font-bold">
            <Filter className="w-3.5 h-3.5" /> State:
          </div>
          {["ALL", "ACTIVE", "EXHAUSTED", "EXPIRED", "REVOKED"].map((s) => (
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

      {/* Capabilities List */}
      {filteredCaps.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center space-y-3 font-sans">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No capabilities found matching your search filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("ALL");
            }}
            className="text-xs font-mono text-purple-600 dark:text-purple-400 font-bold hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCaps.map((cap) => {
            const isExhausted = cap.budgetRemaining === 0;
            const isExpired = Math.floor(Date.now() / 1000) >= cap.expiry;

            return (
              <div
                key={cap.capId}
                className={`glass-card rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  cap.revoked
                    ? "border-rose-200 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/20"
                    : isExhausted
                    ? "border-amber-200 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/20"
                    : ""
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-900 dark:text-white font-bold">
                      CapID: {cap.capId.slice(0, 14)}...{cap.capId.slice(-6)}
                    </span>
                    <button
                      onClick={() => copyToClipboard(cap.capId, cap.capId)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title="Copy CapID"
                    >
                      {copiedId === cap.capId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
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

                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-3">
                    <span>Target: <strong className="text-slate-700 dark:text-slate-300">{cap.serviceAddress.slice(0, 14)}...</strong></span>
                    <span>Policy: <strong className="text-sky-600 dark:text-sky-400">{cap.policyId}</strong></span>
                  </div>
                </div>

                <div className="w-full md:w-48 space-y-1 font-mono">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-sans">Remaining Budget:</span>
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
                    onClick={() => setSelectedCap(cap)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                    title="View Capability Detail"
                  >
                    <Info className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onSelectCapabilityForAgent(cap)}
                    disabled={cap.revoked}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs disabled:opacity-40 cursor-pointer font-mono shadow-xs"
                  >
                    Select for Agent
                  </button>

                  {!cap.revoked && (
                    <button
                      onClick={() => handleRevoke(cap.capId)}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 font-bold text-xs cursor-pointer font-mono"
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

      {/* Capability Detail Modal */}
      {selectedCap && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full space-y-5 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800">
                  CAPABILITY SCOPE DETAIL
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1 font-mono break-all">
                  {selectedCap.capId.slice(0, 24)}...
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
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">OWNING AGENT:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                    Agent Alpha (Summarizer)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">TARGET SERVICE ADDRESS:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedCap.serviceAddress}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">POLICY TEMPLATE:</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">{selectedCap.policyId}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">BUDGET REMAINING:</span>
                  <span className={selectedCap.budgetRemaining === 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                    {selectedCap.budgetRemaining} / {selectedCap.budgetTotal} HBAR
                  </span>
                </div>
              </div>

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
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Expires: {new Date(selectedCap.expiry * 1000).toLocaleString()}</span>
                <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-emerald-500" /> Ledger Enclave Protected</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
