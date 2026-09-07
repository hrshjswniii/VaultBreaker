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
    <div className="min-h-screen bg-[#03050c] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950">
      <Navbar keyringStatus={keyringStatus} activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Official Vaultbreaker Cover Banner Hero Section */}
        <div className="relative rounded-3xl overflow-hidden border border-cyan-500/30 shadow-2xl shadow-cyan-950/50 bg-slate-950 group">
          <div className="relative w-full h-56 md:h-72">
            <Image
              src="/banner.png"
              alt="Vaultbreaker Official Cover Banner"
              fill
              priority
              className="object-cover object-center group-hover:scale-102 transition-transform duration-700 opacity-90"
            />
            {/* Subtle Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#03050c] via-[#03050c]/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#03050c]/90 via-transparent to-[#03050c]/90" />
          </div>

          <div className="absolute bottom-6 left-6 right-6 flex flex-col md:flex-row items-start md:items-end justify-between gap-4 z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-cyan-950/90 border border-cyan-400/50 text-cyan-300 shadow-md">
                  THE NEXT GENERATION OF ONCHAIN ACCESS
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-purple-950/90 border border-purple-400/50 text-purple-300 shadow-md flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" /> LEDGER &bull; HEDERA x402
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white font-mono tracking-tight drop-shadow-md">
                UNLOCK &bull; ACCESS &bull; OWN
              </h2>
              <p className="text-xs md:text-sm text-gray-300 max-w-2xl font-sans drop-shadow">
                Scoped-capability authority objects protecting settlement credentials via Ledger seed hardware enclave and enforcing micropayment spend limits on-chain in real time.
              </p>
            </div>

            {/* Quick Action Pills */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveTab("developer")}
                className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-cyan-500/30 flex items-center gap-1.5"
              >
                Register Policy <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveTab("agent")}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition-all shadow-lg shadow-purple-600/30 flex items-center gap-1.5"
              >
                <Cpu className="w-3.5 h-3.5" /> Run Agent Terminal
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

      <footer className="border-t border-cyan-500/20 bg-slate-950/80 p-6 text-center text-xs text-gray-400 font-mono space-y-2">
        <div className="flex items-center justify-center gap-4 text-[11px] text-cyan-400/90 font-bold uppercase tracking-wider">
          <span>AI AGENTS</span> &bull; <span>ONCHAIN FINANCE</span> &bull; <span>REAL SERVICES</span> &bull; <span>VERIFIED IDENTITY</span>
        </div>
        <p>
          Vaultbreaker &copy; 2026 ETHOnline Submission &bull; Powered by Hedera Testnet (EVM + HCS) &amp; Ledger Key Ring CLI
        </p>
      </footer>
    </div>
  );
}
