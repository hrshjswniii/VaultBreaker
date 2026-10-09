"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Cpu,
  KeyRound,
  Radio,
  Moon,
  Sun,
  LayoutDashboard,
  Bot,
  ShieldCheck,
  Server,
  TrendingUp,
  FileCode,
  Menu,
  X
} from "lucide-react";
import { KeyRingStatus } from "@/lib/api";

export type NavTab =
  | "dashboard"
  | "agents"
  | "capabilities"
  | "policies"
  | "services"
  | "payments"
  | "audit"
  | "agent";

interface NavbarProps {
  keyringStatus: KeyRingStatus | null;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  keyringStatus,
  activeTab,
  setActiveTab,
  darkMode,
  toggleDarkMode,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-3.5 h-3.5 text-sky-500" /> },
    { id: "agents", label: "Agents", icon: <Bot className="w-3.5 h-3.5 text-indigo-500" /> },
    { id: "capabilities", label: "Capabilities", icon: <KeyRound className="w-3.5 h-3.5 text-purple-500" /> },
    { id: "policies", label: "Policies", icon: <FileCode className="w-3.5 h-3.5 text-sky-600" /> },
    { id: "services", label: "Services", icon: <Server className="w-3.5 h-3.5 text-amber-500" /> },
    { id: "payments", label: "Payments", icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> },
    { id: "audit", label: "HCS Audit", icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> },
    { id: "agent", label: "Agent Terminal", icon: <Cpu className="w-3.5 h-3.5 text-purple-600" /> },
  ];

  return (
    <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl sticky top-0 z-50 px-4 sm:px-6 py-3 shadow-2xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => handleNavClick("dashboard")}>
          <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-sky-200 dark:border-sky-800 shadow-sm group bg-slate-50 dark:bg-slate-800 shrink-0">
            <Image
              src="/logo.jpg"
              alt="Vaultbreaker Logo"
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
                VAULT<span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-violet-600">BREAKER</span>
              </h1>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 border border-indigo-200/80 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold hidden sm:inline">
                2.0 PRODUCT
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tracking-tight hidden sm:flex items-center gap-1.5">
              <span>UNLOCK</span> &bull; <span>ACCESS</span> &bull; <span>OWN</span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-sky-700 dark:text-sky-400 font-semibold">Ledger Seed + Hedera x402</span>
            </p>
          </div>
        </div>

        {/* Sponsor Badges (Desktop) */}
        <div className="hidden lg:flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50/90 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800 text-sky-900 dark:text-sky-300 text-xs font-mono shadow-2xs">
            <KeyRound className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span className="text-slate-500 dark:text-slate-400">LEDGER:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {keyringStatus?.mode === "LEDGER_CLI" ? "KeyRing CLI" : "Seed Enclave"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50/90 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800 text-purple-900 dark:text-purple-300 text-xs font-mono shadow-2xs">
            <Radio className="w-3.5 h-3.5 animate-pulse text-purple-600 dark:text-purple-400" />
            <span className="text-slate-500 dark:text-slate-400">HEDERA:</span>
            <span className="font-bold text-slate-900 dark:text-white">Testnet (296)</span>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <div className="hidden xl:flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer font-mono whitespace-nowrap ${
                  activeTab === item.id
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-slate-600"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs cursor-pointer"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
          </button>
        </div>

        {/* Mobile / Compact Menu Button */}
        <div className="flex items-center gap-2 xl:hidden">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-slate-200 dark:border-slate-800 mt-3 pt-3 grid grid-cols-2 gap-2 animate-in slide-in-from-top-2 duration-200 font-mono text-xs">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`p-2.5 rounded-xl font-bold text-left flex items-center gap-2 ${
                activeTab === item.id
                  ? "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                  : "text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800"
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};
