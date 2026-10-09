"use client";

import React, { useState } from "react";
import { Agent, Capability, PaymentAttempt } from "@/lib/api";
import {
  Bot,
  Search,
  Filter,
  KeyRound,
  ArrowRight,
  Info,
  Lock,
  Calendar,
  Wallet,
  Clock,
  ShieldCheck
} from "lucide-react";

interface AgentsViewProps {
  agents: Agent[];
  capabilities: Capability[];
  payments: PaymentAttempt[];
  onNavigate: (tab: string) => void;
  onSelectAgentForCapability?: (agentId: string) => void;
}

export const AgentsView: React.FC<AgentsViewProps> = ({
  agents,
  capabilities,
  payments,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const filteredAgents = agents.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.walletAddress.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Agent["status"]) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-bold">
            ACTIVE &bull; OPERATIONAL
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[10px] font-mono font-bold">
            SUSPENDED
          </span>
        );
      case "REVOKED":
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-[10px] font-mono font-bold">
            REVOKED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="glass-card rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 text-xs font-mono mb-1 font-bold">
            <Bot className="w-4 h-4" />
            AUTONOMOUS AGENT IDENTITY &amp; PERMISSION REGISTRY
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            Autonomous Agent Fleet ({agents.length})
          </h2>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Autonomous actors operating under scoped capabilities. Agents hold zero raw private keys; credentials remain isolated inside the Ledger KeyRing enclave.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigate("agent")}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold font-mono transition-all shadow-md shadow-sky-600/15 cursor-pointer flex items-center gap-1.5"
          >
            Run Agent Terminal &rarr;
          </button>
        </div>
      </div>

      {/* Controls & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by agent name, ID, or wallet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700 overflow-x-auto">
          <div className="flex items-center gap-1 text-slate-400 font-mono text-xs px-2.5 py-1 font-bold">
            <Filter className="w-3.5 h-3.5" /> Status:
          </div>
          {["ALL", "ACTIVE", "SUSPENDED", "REVOKED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === s
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-600"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Agent List Cards */}
      {filteredAgents.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-sans">
            No agents found matching your filter criteria.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("ALL");
            }}
            className="text-xs font-mono text-sky-600 dark:text-sky-400 font-bold hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="glass-card rounded-2xl p-5 hover:border-sky-300 dark:hover:border-sky-700 transition-all space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                      ID: {agent.id}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5 flex items-center gap-2">
                      {agent.name}
                    </h3>
                  </div>
                  {getStatusBadge(agent.status)}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
                  {agent.description}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 text-[10px] block font-sans">WALLET ADDRESS</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">
                      {agent.walletAddress.slice(0, 10)}...
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block font-sans font-normal">CAPABILITIES</span>
                    <span className="text-sky-700 dark:text-sky-400 font-bold">
                      {agent.capabilitiesCount} Granted
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 font-mono text-xs">
                  {agent.isDemoFixture && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold">
                      Demo Fixture Agent
                    </span>
                  )}
                  <button
                    onClick={() => setSelectedAgent(agent)}
                    className="ml-auto text-xs text-sky-600 dark:text-sky-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    View Details <Info className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agent Detail Modal / Drawer */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-xl w-full space-y-5 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {selectedAgent.id}
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
                  {selectedAgent.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">LIFECYCLE STATUS:</span>
                  {getStatusBadge(selectedAgent.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">NETWORK:</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">{selectedAgent.network}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">WALLET ADDRESS:</span>
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5 text-sky-500" /> {selectedAgent.walletAddress}
                  </span>
                </div>
              </div>

              {/* Cross-Resource Links */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white font-sans text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-500" /> Connected Resource Navigation
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans">
                  <button
                    onClick={() => {
                      setSelectedAgent(null);
                      onNavigate("capabilities");
                    }}
                    className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 text-left font-mono text-xs text-sky-800 dark:text-sky-300 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <span>View Capabilities ({capabilities.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      setSelectedAgent(null);
                      onNavigate("payments");
                    }}
                    className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-800 text-left font-mono text-xs text-purple-800 dark:text-purple-300 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <span>Payment Activity ({payments.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Created: {new Date(selectedAgent.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Last Active: {new Date(selectedAgent.lastActiveAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
