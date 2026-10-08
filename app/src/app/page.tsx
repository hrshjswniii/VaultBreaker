"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { DashboardView } from "@/components/DashboardView";
import { DeveloperConsole } from "@/components/DeveloperConsole";
import { AgentConsole } from "@/components/AgentConsole";
import { AuditFeedTimeline } from "@/components/AuditFeedTimeline";
import {
  Policy,
  Capability,
  KeyRingStatus,
  HCSAuditEvent,
  fetchHealth,
  fetchPolicies,
  fetchCapabilities,
  fetchAuditFeed
} from "@/lib/api";
import { Cpu, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "developer" | "agent" | "audit">("dashboard");
  const [keyringStatus, setKeyringStatus] = useState<KeyRingStatus | null>(null);
  const [isBrokerOnline, setIsBrokerOnline] = useState<boolean>(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [auditFeed, setAuditFeed] = useState<HCSAuditEvent[]>([]);
  const [selectedCapability, setSelectedCapability] = useState<Capability | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(true);

  // Apply/remove dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((d) => !d);

  const loadData = async () => {
    try {
      const health = await fetchHealth();
      setKeyringStatus(health.keyring);
      setIsBrokerOnline(health.service !== "Vaultbreaker Capability Broker (Demo Mode)");
      
      const pols = await fetchPolicies();
      setPolicies(pols);

      const caps = await fetchCapabilities();
      setCapabilities(caps);

      const feed = await fetchAuditFeed();
      setAuditFeed(feed);

      setSelectedCapability((prev) => {
        if (!prev) return caps.length > 0 ? caps[0] : null;
        const matching = caps.find((c) => c.capId === prev.capId);
        return matching || (caps.length > 0 ? caps[0] : null);
      });
    } catch (err: any) {
      setIsBrokerOnline(false);
      console.warn("Could not connect to Vaultbreaker Broker Service:", err.message);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectCapability = (cap: Capability) => {
    setSelectedCapability(cap);
    setActiveTab("agent");
  };

  const handleIssueTokenClick = async (policyId: string) => {
    const matching = capabilities.find((c) => c.policyId === policyId && !c.revoked);
    if (matching) {
      setSelectedCapability(matching);
      setActiveTab("agent");
    } else {
      setActiveTab("developer");
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col selection:bg-sky-500 selection:text-white transition-colors duration-300"
      style={
        darkMode
          ? {
              backgroundColor: "#080c14",
              backgroundImage:
                "radial-gradient(at 10% 5%, rgba(56,189,248,0.06) 0px, transparent 50%), radial-gradient(at 90% 15%, rgba(147,51,234,0.07) 0px, transparent 50%), radial-gradient(at 50% 85%, rgba(2,132,199,0.05) 0px, transparent 50%)",
              color: "#e2e8f0",
            }
          : {
              backgroundColor: "#f8fafc",
              backgroundImage:
                "radial-gradient(at 10% 5%, rgba(56,189,248,0.07) 0px, transparent 50%), radial-gradient(at 90% 15%, rgba(147,51,234,0.05) 0px, transparent 50%), radial-gradient(at 50% 85%, rgba(2,132,199,0.04) 0px, transparent 50%)",
              color: "#0f172a",
            }
      }
    >
      <Navbar
        keyringStatus={keyringStatus}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />

      <ConnectionBanner isBrokerOnline={isBrokerOnline} onRetry={loadData} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-8">
        {/* Hero Cover Banner */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900 group">
          <div className="relative w-full h-52 sm:h-60 md:h-64">
            <Image
              src={darkMode ? "/banner-dark.png" : "/banner.png"}
              alt="Vaultbreaker Cover Banner"
              fill
              priority
              className="object-cover object-center group-hover:scale-101 transition-transform duration-700 opacity-95"
            />
            <div
              className={`absolute inset-0 ${
                darkMode
                  ? "bg-gradient-to-t from-slate-900/95 via-slate-900/40 to-transparent"
                  : "bg-gradient-to-t from-white/95 via-white/40 to-transparent"
              }`}
            />
            <div
              className={`absolute inset-0 ${
                darkMode
                  ? "bg-gradient-to-r from-slate-900/90 via-transparent to-slate-900/40"
                  : "bg-gradient-to-r from-white/90 via-transparent to-white/40"
              }`}
            />
          </div>

          <div className="absolute bottom-6 left-6 right-6 flex flex-col md:flex-row items-start md:items-end justify-between gap-4 z-10">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border font-mono backdrop-blur-md shadow-xs ${
                    darkMode ? "bg-slate-900/95 border-sky-700 text-sky-300" : "bg-white/95 border-sky-200 text-sky-800"
                  }`}
                >
                  VAULTBREAKER 2.0 REBUILD
                </span>
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border font-mono backdrop-blur-md shadow-xs flex items-center gap-1 ${
                    darkMode ? "bg-slate-900/95 border-purple-700 text-purple-300" : "bg-white/95 border-purple-200 text-purple-800"
                  }`}
                >
                  <Sparkles className="w-3 h-3" /> LEDGER &bull; HEDERA x402
                </span>
              </div>

              <h2 className={`text-2xl md:text-3xl font-black font-mono tracking-tight drop-shadow-2xs ${darkMode ? "text-white" : "text-slate-900"}`}>
                UNLOCK &bull; <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-violet-500">ACCESS</span> &bull; OWN
              </h2>

              <p className={`text-xs md:text-sm max-w-2xl font-sans leading-relaxed font-medium drop-shadow-2xs ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                Authorization and financial control infrastructure for autonomous AI agents. Scoped capabilities protecting credentials via Ledger seed hardware enclave and enforcing micropayments on-chain in real time.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveTab("developer")}
                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-all shadow-md shadow-sky-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                Register Policy <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveTab("agent")}
                className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                  darkMode
                    ? "bg-slate-800 hover:bg-slate-700 text-white border-slate-600"
                    : "bg-white hover:bg-slate-50 text-slate-900 border-slate-300"
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-purple-500" /> Run Agent Terminal
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Tab Views */}
        {activeTab === "dashboard" && (
          <DashboardView
            policies={policies}
            capabilities={capabilities}
            auditFeed={auditFeed}
            keyringStatus={keyringStatus}
            isBrokerOnline={isBrokerOnline}
            onNavigate={setActiveTab}
            onIssueTokenClick={handleIssueTokenClick}
          />
        )}

        {activeTab === "developer" && (
          <DeveloperConsole
            policies={policies}
            capabilities={capabilities}
            onRefresh={loadData}
            onSelectCapabilityForAgent={handleSelectCapability}
          />
        )}

        {activeTab === "agent" && (
          <AgentConsole selectedCapability={selectedCapability} onRefresh={loadData} />
        )}

        {activeTab === "audit" && <AuditFeedTimeline />}
      </main>

      <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 text-center text-xs text-slate-500 dark:text-slate-400 font-mono space-y-2">
        <div className="flex items-center justify-center gap-4 text-[11px] text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
          <span>AI AGENTS</span> &bull; <span>ONCHAIN FINANCE</span> &bull; <span>REAL SERVICES</span> &bull; <span>VERIFIED IDENTITY</span>
        </div>
        <p className="text-slate-400 dark:text-slate-500">
          Vaultbreaker &copy; 2026 ETHOnline Rebuild &bull; Powered by Hedera Testnet (EVM + HCS) &amp; Ledger Key Ring CLI
        </p>
      </footer>
    </div>
  );
}
