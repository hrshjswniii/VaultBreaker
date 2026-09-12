"use client";

import React from "react";
import Image from "next/image";
import { Cpu, KeyRound, Radio, Moon, Sun } from "lucide-react";
import { KeyRingStatus } from "@/lib/api";

interface NavbarProps {
  keyringStatus: KeyRingStatus | null;
  activeTab: "developer" | "agent" | "audit";
  setActiveTab: (tab: "developer" | "agent" | "audit") => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ keyringStatus, activeTab, setActiveTab, darkMode, toggleDarkMode }) => {
  return (
    <header className="border-b border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl sticky top-0 z-50 px-6 py-3.5 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => setActiveTab("developer")}>
          <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-sky-200 dark:border-sky-800 shadow-sm group bg-slate-50 dark:bg-slate-800">
            <Image src="/logo.jpg" alt="Vaultbreaker Logo" fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
                VAULT<span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-violet-600">BREAKER</span>
              </h1>
              <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 border border-indigo-200/80 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-bold">
                ETHOnline 2026
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tracking-tight flex items-center gap-1.5">
              <span>UNLOCK</span> &bull; <span>ACCESS</span> &bull; <span>OWN</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-sky-700 dark:text-sky-400 font-semibold">Ledger Seed + Hedera x402</span>
            </p>
          </div>
        </div>

        {/* Sponsor Badges */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50/90 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800 text-sky-900 dark:text-sky-300 text-xs font-mono shadow-2xs">
            <KeyRound className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span className="text-slate-500 dark:text-slate-400">LEDGER:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {keyringStatus?.mode === "LEDGER_CLI" ? "KeyRing CLI Active" : "Seed Enclave"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50/90 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800 text-purple-900 dark:text-purple-300 text-xs font-mono shadow-2xs">
            <Radio className="w-3.5 h-3.5 animate-pulse text-purple-600 dark:text-purple-400" />
            <span className="text-slate-500 dark:text-slate-400">HEDERA:</span>
            <span className="font-bold text-slate-900 dark:text-white">Testnet (296)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Nav Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("developer")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "developer"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-slate-600"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Developer Console
            </button>
            <button
              onClick={() => setActiveTab("agent")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "agent"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-slate-600"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              Agent Console (x402)
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "audit"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-slate-600"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              HCS Audit Trail
            </button>
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </div>
    </header>
  );
};
