"use client";

import React from "react";
import Image from "next/image";
import { Cpu, KeyRound, Radio } from "lucide-react";
import { KeyRingStatus } from "@/lib/api";

interface NavbarProps {
  keyringStatus: KeyRingStatus | null;
  activeTab: "developer" | "agent" | "audit";
  setActiveTab: (tab: "developer" | "agent" | "audit") => void;
}

export const Navbar: React.FC<NavbarProps> = ({ keyringStatus, activeTab, setActiveTab }) => {
  return (
    <header className="border-b border-cyan-500/20 bg-slate-950/85 backdrop-blur-xl sticky top-0 z-50 px-6 py-3.5 shadow-2xl shadow-cyan-950/40">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Official Vaultbreaker Logo Brand Header */}
        <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => setActiveTab("developer")}>
          <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-cyan-400/40 shadow-lg shadow-cyan-500/30 group">
            <Image
              src="/logo.jpg"
              alt="Vaultbreaker Official Logo"
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-wider text-white flex items-center font-mono">
                VAULT<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">BREAKER</span>
              </h1>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold">
                ETHOnline 2026
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-mono tracking-tight flex items-center gap-1.5">
              <span>UNLOCK</span> &bull; <span>ACCESS</span> &bull; <span>OWN</span>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-400/90">Ledger Seed + Hedera x402</span>
            </p>
          </div>
        </div>

        {/* Sponsor Badges */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/70 border border-cyan-500/35 text-cyan-300 text-xs font-mono shadow-md">
            <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-gray-400">LEDGER:</span>
            <span className="font-bold text-white">
              {keyringStatus?.mode === "LEDGER_CLI" ? "KeyRing CLI Active" : "Seed Enclave"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/70 border border-purple-500/35 text-purple-300 text-xs font-mono shadow-md">
            <Radio className="w-3.5 h-3.5 animate-pulse text-purple-400" />
            <span className="text-gray-400">HEDERA:</span>
            <span className="font-bold text-white">Testnet (296)</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-xl border border-cyan-500/20">
          <button
            onClick={() => setActiveTab("developer")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "developer"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Developer Console
          </button>
          <button
            onClick={() => setActiveTab("agent")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "agent"
                ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-slate-950 shadow-lg shadow-purple-500/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Agent Console (x402)
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "audit"
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30"
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
