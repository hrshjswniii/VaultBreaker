"use client";

import React, { useEffect, useState } from "react";
import { HCSAuditEvent, fetchAuditFeed } from "@/lib/api";
import { Radio, RefreshCw, ExternalLink, ShieldCheck, ShieldAlert, KeyRound, AlertTriangle } from "lucide-react";

export const AuditFeedTimeline: React.FC = () => {
  const [feed, setFeed] = useState<HCSAuditEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const data = await fetchAuditFeed();
      setFeed(data);
    } catch (err: any) {
      console.warn("Audit feed fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
    const interval = setInterval(loadFeed, 3000);
    return () => clearInterval(interval);
  }, []);

  const getEventBadge = (type: HCSAuditEvent["type"]) => {
    switch (type) {
      case "CAPABILITY_ISSUED":
        return (
          <span className="px-2.5 py-1 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono text-[10px] font-bold flex items-center gap-1">
            <KeyRound className="w-3 h-3" /> CAPABILITY ISSUED
          </span>
        );
      case "CAPABILITY_SPENT":
        return (
          <span className="px-2.5 py-1 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> CAPABILITY SPENT
          </span>
        );
      case "CAPABILITY_REJECTED":
        return (
          <span className="px-2.5 py-1 rounded bg-red-950 border border-red-500/50 text-red-300 font-mono text-[10px] font-bold flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-red-400" /> REJECTED ON-CHAIN
          </span>
        );
      case "CAPABILITY_REVOKED":
        return (
          <span className="px-2.5 py-1 rounded bg-purple-950 border border-purple-500/40 text-purple-300 font-mono text-[10px] font-bold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> CAPABILITY REVOKED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-purple-400 text-xs font-mono mb-1">
            <Radio className="w-4 h-4 animate-pulse" />
            HEDERA CONSENSUS SERVICE (HCS) TAMPER-EVIDENT AUDIT TRAIL
          </div>
          <h2 className="text-2xl font-bold text-white">Live On-Chain Event Timeline</h2>
          <p className="text-sm text-gray-400 mt-1">
            Every capability issuance, micropayment spend, on-chain rejection, and revocation is immutably logged to Hedera HCS.
          </p>
        </div>

        <button
          onClick={loadFeed}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-gray-300 flex items-center gap-2 transition-all shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-400" : ""}`} />
          Refresh Topic Log
        </button>
      </div>

      {feed.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-gray-400 text-sm">
          No HCS audit events logged yet. Issue or execute capability calls to populate the on-chain audit stream.
        </div>
      ) : (
        <div className="relative border-l-2 border-slate-800 ml-4 pl-6 space-y-6">
          {feed.map((event, idx) => (
            <div key={idx} className="relative group">
              {/* Timeline Dot */}
              <div
                className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 ${
                  event.type === "CAPABILITY_REJECTED"
                    ? "bg-red-500 border-red-400 shadow-lg shadow-red-500/50"
                    : event.type === "CAPABILITY_SPENT"
                    ? "bg-emerald-500 border-emerald-400"
                    : "bg-cyan-500 border-cyan-400"
                }`}
              />

              <div
                className={`glass-card rounded-xl p-4 transition-all ${
                  event.type === "CAPABILITY_REJECTED" ? "border-red-500/30 bg-red-950/10" : ""
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  {getEventBadge(event.type)}
                  <span className="text-[11px] font-mono text-gray-500">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="font-mono text-xs space-y-1 text-gray-300">
                  <div>
                    CapID: <span className="text-white font-bold">{event.capId?.slice(0, 16)}...</span>
                  </div>
                  {event.amount !== undefined && event.amount > 0 && (
                    <div>
                      Amount Charged: <span className="text-emerald-400 font-bold">{event.amount} HBAR</span>
                    </div>
                  )}
                  {event.budgetRemaining !== undefined && (
                    <div>
                      Remaining Budget: <span className="text-cyan-300 font-bold">{event.budgetRemaining} HBAR</span>
                    </div>
                  )}
                  {event.reason && (
                    <div className="text-red-400 font-bold">
                      Rejection Reason: {event.reason}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-900 mt-3 flex items-center justify-between text-[10px] font-mono text-gray-500">
                  <span>Topic: {process.env.NEXT_PUBLIC_HCS_TOPIC_ID || "0.0.654321"}</span>
                  <a
                    href={`https://hashscan.io/testnet/topic/${process.env.NEXT_PUBLIC_HCS_TOPIC_ID || "0.0.654321"}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    View on HashScan <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
