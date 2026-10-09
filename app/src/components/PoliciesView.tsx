"use client";

import React, { useState } from "react";
import { Policy, Capability, PaymentAttempt } from "@/lib/api";
import {
  ShieldCheck,
  Search,
  Lock,
  Plus,
  ArrowRight,
  Info,
  CheckCircle2,
  AlertOctagon,
  HelpCircle,
  FileCode
} from "lucide-react";

interface PoliciesViewProps {
  policies: Policy[];
  capabilities: Capability[];
  payments: PaymentAttempt[];
  onNavigate: (tab: string) => void;
  onIssueTokenForPolicy: (policyId: string) => void;
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({
  policies,
  capabilities,
  payments,
  onNavigate,
  onIssueTokenForPolicy,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);

  const filteredPolicies = policies.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.serviceEndpoint.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="glass-card rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 text-xs font-mono mb-1 font-bold">
            <ShieldCheck className="w-4 h-4" />
            DECLARATIVE SPEND POLICY &amp; RULE FRAMEWORK
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            Spend Policies ({policies.length})
          </h2>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Policy templates defining maximum price per call, daily hard budget ceilings, and TTL lifespans.
            Evaluation rules are tested and enforced on-chain via <code className="text-sky-600 dark:text-sky-400 font-mono">CapabilityRegistry.sol</code>.
          </p>
        </div>

        <button
          onClick={() => onNavigate("developer")}
          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold font-mono transition-all shadow-md shadow-sky-600/15 cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" /> Register New Policy
        </button>
      </div>

      {/* Search Filter */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search policies by name, ID, or endpoint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 font-mono"
          />
        </div>
      </div>

      {/* Policies List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPolicies.map((policy) => {
          const matchingCaps = capabilities.filter((c) => c.policyId === policy.id);

          return (
            <div
              key={policy.id}
              className="glass-card rounded-2xl p-5 hover:border-sky-300 dark:hover:border-sky-700 transition-all space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-bold">
                      {policy.id}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">{policy.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      Endpoint: {policy.serviceEndpoint}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 text-[10px] block font-sans">MAX PRICE</span>
                    <span className="text-sky-700 dark:text-sky-400 font-bold">{policy.maxPricePerCall} HBAR</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block font-sans">DAILY CEILING</span>
                    <span className="text-slate-900 dark:text-white font-bold">{policy.dailyBudget} HBAR</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block font-sans">TTL LIFESPAN</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">{policy.ttlSeconds}s</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-mono text-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  {matchingCaps.length} Active Tokens Issued
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedPolicy(policy)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="View Policy Evaluation Trace &amp; Details"
                  >
                    <Info className="w-4 h-4" />
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

      {/* Policy Detail & Evaluation Trace Modal */}
      {selectedPolicy && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-xl w-full space-y-5 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold">
                  POLICY SPECIFICATION &amp; TRACE
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
              {/* Evaluation Trace Sequence Visualization */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white font-sans text-xs flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-sky-500" /> Evaluation Pipeline Sequence
                </h4>

                <div className="space-y-2 text-[11px] font-mono">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                    <span>1. Request Received &amp; JWT Verified</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                    <span>2. Service Endpoint Binding Checked ({selectedPolicy.serviceAddress.slice(0, 10)}...)</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                    <span>3. Price Cap Evaluated (&lt;= {selectedPolicy.maxPricePerCall} HBAR)</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                    <span>4. Daily Budget Remaining Decremented</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                </div>
              </div>

              {/* Supported Rejection Categories */}
              <div className="p-3.5 rounded-xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 space-y-2 font-sans">
                <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 block">
                  Supported Rejection Categories:
                </span>
                <div className="grid grid-cols-2 gap-1 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                  <div>&bull; INSUFFICIENT_BUDGET</div>
                  <div>&bull; CAPABILITY_EXPIRED</div>
                  <div>&bull; CAPABILITY_REVOKED</div>
                  <div>&bull; SERVICE_MISMATCH</div>
                </div>
              </div>

              {/* Cross-Resource Nav */}
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
    </div>
  );
};
