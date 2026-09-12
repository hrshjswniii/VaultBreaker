"use client";

import React, { useState } from "react";
import { Capability, executeMeteredCall } from "@/lib/api";
import { Cpu, Send, CheckCircle2, AlertOctagon, KeyRound, Lock, Radio } from "lucide-react";

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
      if (!res.ok) setRejectionModalData(res.data);
    } catch (err: any) {
      setLastResponse({ status: 500, ok: false, data: { error: err.message } });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-600 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 focus:border-sky-500 focus:outline-none font-mono";

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="glass-card rounded-2xl p-6 border-slate-200/90 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 text-xs font-mono mb-1 font-bold">
              <Cpu className="w-4 h-4" />
              SIMULATED AUTONOMOUS AI AGENT LOOP (x402 Micropayments)
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono">Agent Scoped Micropayment Terminal</h2>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              The AI agent presents its scoped capability token to pay-per-call services. Authority is spend-limited and expiring.
              The agent holds zero raw private keys.
            </p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-mono shrink-0">
            <span className="text-slate-400 block text-[10px] font-sans">SELECTED TOKEN:</span>
            {selectedCapability ? (
              <span className="text-sky-700 dark:text-sky-400 font-bold">{selectedCapability.capId.slice(0, 12)}...</span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400 font-bold">No capability selected</span>
            )}
          </div>
        </div>
      </div>

      {/* Budget Gauge */}
      {selectedCapability && (
        <div className="glass-card-glow rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-slate-900 dark:text-white font-bold">Active Capability Scope:</span>
              <span className="text-slate-600 dark:text-slate-400">{selectedCapability.serviceAddress}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 dark:text-slate-400 font-sans">Remaining Budget: </span>
              <span className={selectedCapability.budgetRemaining === 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-emerald-700 dark:text-emerald-400 font-bold"}>
                {selectedCapability.budgetRemaining} / {selectedCapability.budgetTotal} HBAR
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600">
            <div
              className={`h-full transition-all duration-500 ${selectedCapability.budgetRemaining === 0 ? "bg-rose-500" : "bg-sky-500"}`}
              style={{ width: `${(selectedCapability.budgetRemaining / selectedCapability.budgetTotal) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Execution Form */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono">
          <Send className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          Execute Gated Metered Call (x402 Micropayment)
        </h3>
        <form onSubmit={handleExecuteCall} className="space-y-4">
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1">Input Prompt for Metered Service</label>
            <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1">Payment Amount Per Call (HBAR / Units)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading || !selectedCapability}
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-sky-600/15 disabled:opacity-40"
              >
                {loading ? "Processing Micropayment..." : "Submit Agent Request & Pay via x402"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Success Response */}
      {lastResponse && lastResponse.ok && (
        <div className="glass-card-glow rounded-2xl p-6 border-emerald-200/80 dark:border-emerald-800 space-y-4">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 text-sm font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            x402 Micropayment Executed & Validated On-Chain
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 font-mono text-xs space-y-2 shadow-2xs">
            <div className="flex justify-between text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 pb-2 font-sans">
              <span>Charged: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">{lastResponse.data.amountCharged} HBAR</strong></span>
              <span>Remaining Budget: <strong className="text-slate-900 dark:text-white font-mono">{lastResponse.data.budgetRemaining} HBAR</strong></span>
            </div>
            <div className="text-slate-800 dark:text-slate-200 pt-1">
              <strong className="text-slate-900 dark:text-white font-sans">Service Output:</strong> {lastResponse.data.data?.summaryResult}
            </div>
          </div>
        </div>
      )}

      {/* On-Chain Rejection Modal */}
      {rejectionModalData && (
        <div className="glass-card-rejection rounded-2xl p-6 space-y-5 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight font-mono">
                  REJECTED ON-CHAIN IN REAL-TIME
                </h3>
                <p className="text-xs text-rose-700 dark:text-rose-400 font-mono font-medium">
                  Real-Time Enforcement Verified: Cap Limit Exceeded / Token Invalidated
                </p>
              </div>
            </div>
            <span className="text-xs uppercase font-mono px-3 py-1 rounded-full bg-rose-600 text-white font-bold shadow-2xs">
              HTTP {lastResponse?.status || 402} PAYMENT REQUIRED
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-200 dark:border-rose-800 font-mono text-xs space-y-3 shadow-2xs">
            <div className="grid grid-cols-2 gap-2 text-slate-800 dark:text-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">REJECTION REASON:</span>
                <span className="text-rose-700 dark:text-rose-400 font-bold text-sm">{rejectionModalData.error}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-sans">CAPABILITY ID:</span>
                <span className="text-slate-900 dark:text-white font-bold">{rejectionModalData.capId?.slice(0, 16)}...</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-300 text-xs leading-relaxed">
              {rejectionModalData.message}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700 font-sans">
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                <Lock className="w-3.5 h-3.5" /> Zero Credential Exposure (Raw Key Never Leaked)
              </span>
              <span className="flex items-center gap-1 text-purple-700 dark:text-purple-400 font-medium">
                <Radio className="w-3.5 h-3.5" /> Audit Event Logged to Hedera HCS Topic
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
