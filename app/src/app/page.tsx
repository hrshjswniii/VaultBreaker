"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { DeveloperConsole } from "@/components/DeveloperConsole";
import { AgentConsole } from "@/components/AgentConsole";
import { AuditFeedTimeline } from "@/components/AuditFeedTimeline";
import { Policy, Capability, KeyRingStatus, fetchHealth, fetchPolicies, fetchCapabilities } from "@/lib/api";
import { ShieldCheck, Lock, Cpu, Sparkles, ArrowRight } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"developer" | "agent" | "audit">("developer");
  const [keyringStatus, setKeyringStatus] = useState<KeyRingStatus | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [selectedCapability, setSelectedCapability] = useState<Capability | null>(null);

  const loadData = async () => {
    try {
      const health = await fetchHealth();
      setKeyringStatus(health.keyring);

      const pols = await fetchPolicies();
      setPolicies(pols);

      const caps = await fetchCapabilities();
      setCapabilities(caps);

      if (!selectedCapability && caps.length > 0) {
        setSelectedCapability(caps[0]);
      }
    } catch (err: any) {
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

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col selection:bg-sky-500 selection:text-white">
      <Navbar keyringStatus={keyringStatus} activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Official Vaultbreaker Cover Banner Hero Section */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-200/90 shadow-sm bg-white group">
          <div className="relative w-full h-56 md:h-64">
            <Image
              src="/banner.png"
              alt="Vaultbreaker Official Cover Banner"
              fill
              priority
              className="object-cover object-center group-hover:scale-101 transition-transform duration-700 opacity-25 mix-blend-multiply"
            />
            {/* Subtle Gradient Fading Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-white/60" />
          </div>

          <div className="absolute bottom-6 left-6 right-6 flex flex-col md:flex-row items-start md:items-end justify-between gap-4 z-10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200/80 text-sky-800 shadow-2xs font-mono">
                  THE NEXT GENERATION OF ONCHAIN ACCESS
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200/80 text-purple-800 shadow-2xs font-mono flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-600" /> LEDGER &bull; HEDERA x402
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 font-mono tracking-tight">
                UNLOCK &bull; <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-violet-600">ACCESS</span> &bull; OWN
              </h2>
              <p className="text-xs md:text-sm text-slate-600 max-w-2xl font-sans leading-relaxed">
                Scoped-capability authority objects protecting settlement credentials via Ledger seed hardware enclave and enforcing micropayment spend limits on-chain in real time.
              </p>
            </div>

            {/* Quick Action Pills */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveTab("developer")}
                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-all shadow-md shadow-sky-600/15 flex items-center gap-1.5"
              >
                Register Policy <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveTab("agent")}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 font-bold text-xs transition-all shadow-xs flex items-center gap-1.5"
              >
                <Cpu className="w-3.5 h-3.5 text-purple-600" /> Run Agent Terminal
              </button>
            </div>
          </div>
        </div>

        {/* Tab Views */}
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

      <footer className="border-t border-slate-200/80 bg-white/70 backdrop-blur-md p-6 text-center text-xs text-slate-500 font-mono space-y-2">
        <div className="flex items-center justify-center gap-4 text-[11px] text-slate-700 font-bold uppercase tracking-wider">
          <span>AI AGENTS</span> &bull; <span>ONCHAIN FINANCE</span> &bull; <span>REAL SERVICES</span> &bull; <span>VERIFIED IDENTITY</span>
        </div>
        <p className="text-slate-400">
          Vaultbreaker &copy; 2026 ETHOnline Submission &bull; Powered by Hedera Testnet (EVM + HCS) &amp; Ledger Key Ring CLI
        </p>
      </footer>
    </div>
  );
}
