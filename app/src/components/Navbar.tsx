"use client";

import React from "react";
import { ShieldCheck, Cpu, KeyRound, Radio } from "lucide-react";
import { KeyRingStatus } from "@/lib/api";

interface NavbarProps {
  keyringStatus: KeyRingStatus | null;
  activeTab: "developer" | "agent" | "audit";
  setActiveTab: (tab: "developer" | "agent" | "audit") => void;
}

export const Navbar: React.FC<NavbarProps> = ({ keyringStatus, activeTab, setActiveTab }) => {
  return (
    <header className="border-b border-gray-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck className="w-6 h-6 neon-text-green" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">VAULTBREAKER</h1>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-400">
                ETHOnline 2026
              </span>
            </div>
            <p className="text-xs text-gray-400">Scoped-Capability Broker for AI Agents on Hedera + Ledger Hardware Seed</p>
          </div>
        </div>

        {/* Sponsor Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            <KeyRound className="w-3.5 h-3.5" />
            <span>LEDGER:</span>
            <span className="font-semibold text-white">
              {keyringStatus?.mode === "LEDGER_CLI" ? "KeyRing CLI Active" : "Hardware Seed Enclave"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>HEDERA:</span>
            <span className="font-semibold text-white">Testnet (Chain 296)</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-xl border border-gray-800">
          <button
            onClick={() => setActiveTab("developer")}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === "developer"
                ? "bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Developer Console
          </button>
          <button
            onClick={() => setActiveTab("agent")}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "agent"
                ? "bg-cyan-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Agent Console (x402)
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === "audit"
                ? "bg-purple-500 text-slate-950 font-semibold shadow-lg shadow-purple-500/20"
                : "text-gray-400 hover:text-white"
            }`}
          >
            HCS Audit Trail
          </button>
        </div>
      </div>
    </header>
  );
};
