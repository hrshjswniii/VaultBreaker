"use client";

import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { DeveloperConsole } from "@/components/DeveloperConsole";
import { AgentConsole } from "@/components/AgentConsole";
import { AuditFeedTimeline } from "@/components/AuditFeedTimeline";
import { Policy, Capability, KeyRingStatus, fetchHealth, fetchPolicies, fetchCapabilities } from "@/lib/api";

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
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      <Navbar keyringStatus={keyringStatus} activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
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

      <footer className="border-t border-slate-900 bg-slate-950/60 p-6 text-center text-xs text-gray-500 font-mono">
        Vaultbreaker &copy; 2026 ETHOnline Submission &bull; Powered by Hedera Testnet (EVM + HCS) &amp; Ledger Key Ring CLI
      </footer>
    </div>
  );
}
