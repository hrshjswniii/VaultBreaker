"use client";

import React, { useState } from "react";
import { Capability, executeMeteredCall } from "@/lib/api";
import { Cpu, Send, ShieldAlert, CheckCircle2, AlertOctagon, KeyRound, Lock, Radio } from "lucide-react";

interface AgentConsoleProps {
  selectedCapability: Capability | null;
  onRefresh: () => void;
}

export const AgentConsole: React.FC<AgentConsoleProps> = ({ selectedCapability, onRefresh }) => {
  const [prompt, setPrompt] = useState("Summarize market sentiment for Hedera HBAR & x402 micropayments in Q3 2026.");
  const [amount, setAmount] = useState("10");
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [rejectionModalData, setRejectionModalData] = useState<any>(null);

  const handleExecuteCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCapability) {
      alert("Please select or issue a capability token first in Developer Console!");
      return;
    }

    setLoading(true);
    setLastResponse(null);
    setRejectionModalData(null);

    try {
      const res = await executeMeteredCall(selectedCapability.token, prompt, Number(amount));
      setLastResponse(res);
      onRefresh();

      if (!res.ok) {
        // Prominent On-Chain Rejection Event triggered!
        setRejectionModalData(res.data);
      }
    } catch (err: any) {
      setLastResponse({ status: 500, ok: false, data: { error: err.message } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="glass-card rounded-2xl p-6 border-cyan-500/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono mb-1">
              <Cpu className="w-4 h-4" />
              SIMULATED AUTONOMOUS AI AGENT LOOP (x402 Micropayments)
            </div>
            <h2 className="text-2xl font-bold text-white">Agent Scoped Micropayment Terminal</h2>
            <p className="text-sm text-gray-400 mt-1 max-w-2xl">
              The AI agent presents its scoped capability token to pay-per-call services. Authority is spend-limited and expiring.
              The agent holds zero raw private keys.
            </p>
          </div>

          <div className="px-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono shrink-0">
            <span className="text-gray-500 block">SELECTED TOKEN:</span>
            {selectedCapability ? (
              <span className="text-cyan-300 font-bold">{selectedCapability.capId.slice(0, 12)}...</span>
            ) : (
              <span className="text-amber-400 font-bold">No capability selected</span>
            )}
          </div>
        </div>
      </div>

      {/* Selected Capability Budget Gauge */}
      {selectedCapability && (
        <div className="glass-card-glow rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-bold">Active Capability Scope:</span>
              <span className="text-gray-400">{selectedCapability.serviceAddress}</span>
            </div>

            <div className="text-right">
              <span className="text-gray-400">Remaining Budget: </span>
              <span className={selectedCapability.budgetRemaining === 0 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                {selectedCapability.budgetRemaining} / {selectedCapability.budgetTotal} HBAR
              </span>
            </div>
          </div>

          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-500 ${
                selectedCapability.budgetRemaining === 0 ? "bg-red-500 animate-pulse" : "bg-emerald-500"
              }`}
              style={{ width: `${(selectedCapability.budgetRemaining / selectedCapability.budgetTotal) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Agent Call Execution Form */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Send className="w-4 h-4 text-cyan-400" />
          Execute Gated Metered Call (x402 Micropayment)
        </h3>

        <form onSubmit={handleExecuteCall} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Input Prompt for Metered Service</label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Payment Amount Per Call (HBAR / Units)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading || !selectedCapability}
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-40"
              >
                {loading ? "Processing Micropayment..." : "Submit Agent Request & Pay via x402"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Successful Response Display */}
      {lastResponse && lastResponse.ok && (
        <div className="glass-card-glow rounded-2xl p-6 border-emerald-500/40 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
            <CheckCircle2 className="w-5 h-5" />
            x402 Micropayment Executed & Validated On-Chain
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 font-mono text-xs space-y-2">
            <div className="flex justify-between text-gray-400 border-b border-slate-900 pb-2">
              <span>Charged: <strong className="text-emerald-400">{lastResponse.data.amountCharged} HBAR</strong></span>
              <span>Remaining Budget: <strong className="text-white">{lastResponse.data.budgetRemaining} HBAR</strong></span>
            </div>
            <div className="text-gray-300 pt-1">
              <strong>Service Output:</strong> {lastResponse.data.data?.summaryResult}
            </div>
          </div>
        </div>
      )}

      {/* KEY DEMO MOMENT — Prominent Cyber-Alert On-Chain Rejection Modal */}
      {rejectionModalData && (
        <div className="glass-card-rejection rounded-2xl p-6 border-red-500/50 space-y-5 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between border-b border-red-500/30 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-950 border border-red-500/60 text-red-400">
                <AlertOctagon className="w-7 h-7 neon-text-red animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-white tracking-wide flex items-center gap-2">
                  REJECTED ON-CHAIN IN REAL-TIME
                </h3>
                <p className="text-xs text-red-300 font-mono">
                  Real-Time Enforcement Verified: Cap Limit Exceeded / Token Invalidated
                </p>
              </div>
            </div>

            <span className="text-xs uppercase font-mono px-3 py-1 rounded bg-red-950 border border-red-500 text-red-400 font-bold">
              HTTP {lastResponse?.status || 402} PAYMENT REQUIRED
            </span>
          </div>

          <div className="bg-slate-950/90 p-4 rounded-xl border border-red-900/60 font-mono text-xs space-y-3">
            <div className="grid grid-cols-2 gap-2 text-gray-300">
              <div>
                <span className="text-gray-500 block text-[10px]">REJECTION REASON:</span>
                <span className="text-red-400 font-bold text-sm">{rejectionModalData.error}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">CAPABILITY ID:</span>
                <span className="text-white font-bold">{rejectionModalData.capId?.slice(0, 16)}...</span>
              </div>
            </div>

            <div className="p-3 rounded bg-red-950/40 border border-red-900/40 text-red-200 text-xs">
              {rejectionModalData.message}
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-slate-900">
              <span className="flex items-center gap-1 text-emerald-400">
                <Lock className="w-3 h-3" /> Zero Credential Exposure (Raw Key Never Leaked)
              </span>
              <span className="flex items-center gap-1 text-purple-400">
                <Radio className="w-3 h-3" /> Audit Event Logged to Hedera HCS Topic
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
