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
          <span className="px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 font-mono text-[10px] font-bold flex items-center gap-1">
            <KeyRound className="w-3 h-3 text-sky-600" /> CAPABILITY ISSUED
          </span>
        );
      case "CAPABILITY_SPENT":
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-[10px] font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" /> CAPABILITY SPENT
          </span>
        );
      case "CAPABILITY_REJECTED":
        return (
          <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 font-mono text-[10px] font-bold flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-rose-600" /> REJECTED ON-CHAIN
          </span>
        );
      case "CAPABILITY_REVOKED":
        return (
          <span className="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-800 font-mono text-[10px] font-bold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-purple-600" /> CAPABILITY REVOKED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6 flex items-center justify-between border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-purple-700 text-xs font-mono mb-1 font-bold">
            <Radio className="w-4 h-4 text-purple-600 animate-pulse" />
            HEDERA CONSENSUS SERVICE (HCS) TAMPER-EVIDENT AUDIT TRAIL
          </div>
          <h2 className="text-2xl font-black text-slate-900 font-mono">Live On-Chain Event Timeline</h2>
          <p className="text-xs md:text-sm text-slate-600 mt-1">
            Every capability issuance, micropayment spend, on-chain rejection, and revocation is immutably logged to Hedera HCS.
          </p>
        </div>

        <button
          onClick={loadFeed}
          className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 font-bold flex items-center gap-2 transition-all shrink-0 shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-600" : ""}`} />
          Refresh Topic Log
        </button>
      </div>

      {feed.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-slate-500 text-sm">
          No HCS audit events logged yet. Issue or execute capability calls to populate the on-chain audit stream.
        </div>
      ) : (
        <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
          {feed.map((event, idx) => (
            <div key={idx} className="relative group">
              {/* Timeline Dot */}
              <div
                className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white ${
                  event.type === "CAPABILITY_REJECTED"
                    ? "bg-rose-500 shadow-md shadow-rose-500/30"
                    : event.type === "CAPABILITY_SPENT"
                    ? "bg-emerald-500 shadow-2xs"
                    : "bg-sky-500 shadow-2xs"
                }`}
              />

              <div
                className={`glass-card rounded-2xl p-4 transition-all ${
                  event.type === "CAPABILITY_REJECTED" ? "border-rose-200 bg-rose-50/20" : "bg-white"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  {getEventBadge(event.type)}
                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="font-mono text-xs space-y-1 text-slate-700">
                  <div>
                    CapID: <span className="text-slate-900 font-bold">{event.capId?.slice(0, 16)}...</span>
                  </div>
                  {event.amount !== undefined && event.amount > 0 && (
                    <div>
                      Amount Charged: <span className="text-emerald-700 font-bold">{event.amount} HBAR</span>
                    </div>
                  )}
                  {event.budgetRemaining !== undefined && (
                    <div>
                      Remaining Budget: <span className="text-sky-700 font-bold">{event.budgetRemaining} HBAR</span>
                    </div>
                  )}
                  {event.reason && (
                    <div className="text-rose-700 font-bold">
                      Rejection Reason: {event.reason}
                    </div>
                  )}
                </div>

                <div className="pt-2.5 border-t border-slate-100 mt-3 flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>Topic: {process.env.NEXT_PUBLIC_HCS_TOPIC_ID || "0.0.654321"}</span>
                  <a
                    href={`https://hashscan.io/testnet/topic/${process.env.NEXT_PUBLIC_HCS_TOPIC_ID || "0.0.654321"}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-700 hover:text-purple-900 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 flex items-center gap-1 font-bold transition-all"
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
