"use client";

import React from "react";
import Image from "next/image";
import { Cpu, KeyRound, Radio, ShieldCheck } from "lucide-react";
import { KeyRingStatus } from "@/lib/api";

interface NavbarProps {
  keyringStatus: KeyRingStatus | null;
  activeTab: "developer" | "agent" | "audit";
  setActiveTab: (tab: "developer" | "agent" | "audit") => void;
}

export const Navbar: React.FC<NavbarProps> = ({ keyringStatus, activeTab, setActiveTab }) => {
  return (
    <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-xl sticky top-0 z-50 px-6 py-3.5 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Official Vaultbreaker Logo Brand Header */}
        <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => setActiveTab("developer")}>
          <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-sky-200 shadow-sm group bg-slate-50">
            <Image
              src="/logo.jpg"
              alt="Vaultbreaker Official Logo"
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 font-mono">
                VAULT<span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-violet-600">BREAKER</span>
              </h1>
              <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-bold">
                ETHOnline 2026
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono tracking-tight flex items-center gap-1.5">
              <span>UNLOCK</span> &bull; <span>ACCESS</span> &bull; <span>OWN</span>
              <span className="text-slate-300">|</span>
              <span className="text-sky-700 font-semibold">Ledger Seed + Hedera x402</span>
            </p>
          </div>
        </div>

        {/* Sponsor Badges */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50/90 border border-sky-200/80 text-sky-900 text-xs font-mono shadow-2xs">
            <KeyRound className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-slate-500">LEDGER:</span>
            <span className="font-bold text-slate-900">
              {keyringStatus?.mode === "LEDGER_CLI" ? "KeyRing CLI Active" : "Seed Enclave"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50/90 border border-purple-200/80 text-purple-900 text-xs font-mono shadow-2xs">
            <Radio className="w-3.5 h-3.5 animate-pulse text-purple-600" />
            <span className="text-slate-500">HEDERA:</span>
            <span className="font-bold text-slate-900">Testnet (296)</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setActiveTab("developer")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "developer"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Developer Console
          </button>
          <button
            onClick={() => setActiveTab("agent")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "agent"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-sky-600" />
            Agent Console (x402)
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "audit"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            HCS Audit Trail
          </button>
        </div>
      </div>
    </header>
  );
};
