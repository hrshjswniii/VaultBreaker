"use client";

import React from "react";
import { Policy, Capability, KeyRingStatus, HCSAuditEvent } from "@/lib/api";
import {
  ShieldCheck,
  KeyRound,
  Cpu,
  Radio,
  Plus,
  ArrowRight,
  Lock,
  Zap,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

interface DashboardViewProps {
  policies: Policy[];
  capabilities: Capability[];
  auditFeed: HCSAuditEvent[];
  keyringStatus: KeyRingStatus | null;
  isBrokerOnline: boolean;
  onNavigate: (tab: "dashboard" | "developer" | "agent" | "audit") => void;
  onIssueTokenClick: (policyId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  policies,
  capabilities,
  auditFeed,
  keyringStatus,
  isBrokerOnline,
  onNavigate,
  onIssueTokenClick,
}) => {
  const activeCapabilities = capabilities.filter((c) => !c.revoked && c.budgetRemaining > 0);
  const revokedCapabilities = capabilities.filter((c) => c.revoked);
  const totalSpentHbar = capabilities.reduce((acc, c) => acc + (c.budgetTotal - c.budgetRemaining), 0);
  const totalBudgetAssigned = capabilities.reduce((acc, c) => acc + c.budgetTotal, 0);

  const spentEvents = auditFeed.filter((e) => e.type === "CAPABILITY_SPENT");
  const rejectedEvents = auditFeed.filter((e) => e.type === "CAPABILITY_REJECTED");

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Metered Policies */}
        <div className="glass-card rounded-2xl p-5 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-mono text-xs">
            <span className="font-bold uppercase tracking-wider">Metered Policies</span>
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
              {policies.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-sans mt-0.5">
              Registered API Guardrails
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
            <span className="text-sky-700 dark:text-sky-400 font-bold">Max Cap: 10 HBAR/call</span>
            <button
              onClick={() => onNavigate("developer")}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 font-bold cursor-pointer"
            >
              View <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Stat 2: Active Capabilities */}
        <div className="glass-card rounded-2xl p-5 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-mono text-xs">
            <span className="font-bold uppercase tracking-wider">Active Capabilities</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
                {activeCapabilities.length}
              </span>
              <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                / {capabilities.length} total
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-sans mt-0.5">
              Scoped JWT Tokens Issued
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
            <span className="text-purple-700 dark:text-purple-400 font-bold">
              {revokedCapabilities.length} Revoked
            </span>
            <button
              onClick={() => onNavigate("developer")}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 font-bold cursor-pointer"
            >
              Manage <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Stat 3: Executed Volume */}
        <div className="glass-card rounded-2xl p-5 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-mono text-xs">
            <span className="font-bold uppercase tracking-wider">Volume Executed</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black font-mono text-emerald-700 dark:text-emerald-400 tracking-tight">
              {totalSpentHbar} <span className="text-lg">HBAR</span>
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-sans mt-0.5">
              Across {spentEvents.length} Micropayments
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-600 dark:text-slate-400">Ceiling: {totalBudgetAssigned} HBAR</span>
            <button
              onClick={() => onNavigate("agent")}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 font-bold cursor-pointer"
            >
              Terminal <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Stat 4: Hardware Enclave */}
        <div className="glass-card rounded-2xl p-5 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-mono text-xs">
            <span className="font-bold uppercase tracking-wider">Ledger Security</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-base font-bold font-mono text-slate-900 dark:text-white block">
              {keyringStatus?.mode === "LEDGER_CLI" ? "Ledger KeyRing CLI" : "AES-256 Seed Enclave"}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-sans mt-0.5">
              FP: {keyringStatus?.seedFingerprint || "a81feebf"}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
            <span className="text-indigo-700 dark:text-indigo-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Zero Key Leak
            </span>
            <span className="text-slate-400 text-[10px]">Active</span>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Quick Action Banner & Policy Shortcuts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions Panel */}
          <div className="glass-card-glow rounded-3xl p-6 relative overflow-hidden space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-sky-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 text-xs font-mono font-bold mb-1">
                  <Zap className="w-4 h-4" /> QUICK DEPLOYMENT SHORTCUTS
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white font-mono">
                  Autonomous Agent Access Control
                </h3>
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-sky-100 dark:bg-sky-950 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-bold">
                Hedera Testnet (296)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => onNavigate("developer")}
                className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-500 text-left space-y-2 transition-all group shadow-xs cursor-pointer"
              >
                <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 w-fit group-hover:scale-105 transition-transform">
                  <Plus className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs font-mono">1. Register Policy</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
                  Specify max price &amp; daily hard budget ceiling.
                </p>
              </button>

              <button
                onClick={() => onNavigate("developer")}
                className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500 text-left space-y-2 transition-all group shadow-xs cursor-pointer"
              >
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 w-fit group-hover:scale-105 transition-transform">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs font-mono">2. Mint Token</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
                  Issue short-lived JWT token to AI agent.
                </p>
              </button>

              <button
                onClick={() => onNavigate("agent")}
                className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 text-left space-y-2 transition-all group shadow-xs cursor-pointer"
              >
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 w-fit group-hover:scale-105 transition-transform">
                  <Cpu className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs font-mono">3. Test Terminal</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
                  Execute metered call &amp; trigger rejection moment.
                </p>
              </button>
            </div>
          </div>

          {/* Active Policies Preview */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Active Spend Policies ({policies.length})
              </h3>
              <button
                onClick={() => onNavigate("developer")}
                className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-mono font-bold flex items-center gap-1 cursor-pointer"
              >
                Manage All &rarr;
              </button>
            </div>

            <div className="space-y-3">
              {policies.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">{p.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {p.id}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans block mt-0.5">
                      Endpoint: {p.serviceEndpoint} &bull; Address: {p.serviceAddress.slice(0, 10)}...
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-sky-700 dark:text-sky-400 font-bold block">{p.maxPricePerCall} HBAR/call</span>
                      <span className="text-slate-400 text-[10px]">Daily: {p.dailyBudget} HBAR</span>
                    </div>
                    <button
                      onClick={() => {
                        onNavigate("developer");
                        onIssueTokenClick(p.id);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-all shadow-2xs cursor-pointer"
                    >
                      Issue Token
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): System Status & Audit Stream */}
        <div className="space-y-6">
          {/* System Infrastructure Health Widget */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Infrastructure Status
            </h3>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Control Plane:</span>
                <span className={`font-bold flex items-center gap-1.5 ${isBrokerOnline ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                  <span className={`w-2 h-2 rounded-full ${isBrokerOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {isBrokerOnline ? "Express Broker (3001)" : "Client Demo Mock"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">KeyRing Enclave:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  {keyringStatus?.mode === "LEDGER_CLI" ? "Ledger CLI" : "Seed Enclave"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Hedera Network:</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">Testnet (Chain 296)</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">HCS Audit Topic:</span>
                <span className="font-bold text-slate-900 dark:text-white">0.0.654321</span>
              </div>
            </div>
          </div>

          {/* Recent Audit Stream Feed */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                <Radio className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
                Latest Audit Events
              </h3>
              <button
                onClick={() => onNavigate("audit")}
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-mono font-bold cursor-pointer"
              >
                Full Timeline &rarr;
              </button>
            </div>

            {auditFeed.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 font-sans italic text-center py-4">
                No audit events logged yet.
              </p>
            ) : (
              <div className="space-y-2 font-mono text-xs">
                {auditFeed.slice(0, 4).map((e, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      e.type === "CAPABILITY_REJECTED"
                        ? "bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                        : e.type === "CAPABILITY_SPENT"
                        ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                        : "bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-300"
                    }`}
                  >
                    <div>
                      <span className="font-bold text-[11px] block flex items-center gap-1">
                        {e.type === "CAPABILITY_REJECTED" && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                        {e.type}
                      </span>
                      <span className="text-[10px] opacity-75 block font-sans">
                        Cap: {e.capId?.slice(0, 10)}...
                      </span>
                    </div>

                    <span className="font-bold text-xs">
                      {e.amount !== undefined && e.amount > 0 ? `${e.amount} HBAR` : "-"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
