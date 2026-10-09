"use client";

import React, { useState } from "react";
import { PaymentAttempt } from "@/lib/api";
import {
  TrendingUp,
  Search,
  Filter,
  ArrowRight,
  Info,
  CheckCircle2,
  AlertOctagon,
  FileCode,
  Lock,
  Radio,
  ExternalLink
} from "lucide-react";

interface PaymentsViewProps {
  payments: PaymentAttempt[];
  onNavigate: (tab: string) => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  payments,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedPayment, setSelectedPayment] = useState<PaymentAttempt | null>(null);

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.capId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.serviceName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getDecisionBadge = (decision: PaymentAttempt["decision"]) => {
    if (decision === "ALLOWED") {
      return (
        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> ALLOWED
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-[10px] font-mono font-bold flex items-center gap-1">
        <AlertOctagon className="w-3 h-3 text-rose-500" /> DENIED
      </span>
    );
  };

  const getStatusBadge = (status: PaymentAttempt["status"]) => {
    switch (status) {
      case "AUTHORIZED":
        return (
          <span className="px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 text-[10px] font-mono font-bold">
            AUTHORIZED IN MEMORY
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-[10px] font-mono font-bold">
            REJECTED ON-CHAIN
          </span>
        );
      case "SETTLED":
        return (
          <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-bold">
            SETTLED ON-CHAIN
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="glass-card rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-mono mb-1 font-bold">
            <TrendingUp className="w-4 h-4" />
            FINANCIAL MICROPAYMENT ACTIVITY LOG
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            Payment &amp; Authorization Activity ({payments.length})
          </h2>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Real-time record of all capability spend authorizations and on-chain rejections.
            <em className="text-emerald-700 dark:text-emerald-400 font-semibold block mt-0.5">
              Note: Authorization verifies capability &amp; decrypts credentials in broker RAM; settlement transfers execute on Hedera Testnet.
            </em>
          </p>
        </div>

        <button
          onClick={() => onNavigate("agent")}
          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold font-mono transition-all shadow-md shadow-sky-600/15 cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          Execute Micropayment &rarr;
        </button>
      </div>

      {/* Controls & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Payment ID, Agent, CapID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700 overflow-x-auto">
          <div className="flex items-center gap-1 text-slate-400 font-mono text-xs px-2.5 py-1 font-bold">
            <Filter className="w-3.5 h-3.5" /> Status:
          </div>
          {["ALL", "AUTHORIZED", "REJECTED", "SETTLED"].map((s) => (
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

      {/* Payment Activity List */}
      {filteredPayments.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center space-y-3 font-sans">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No payment records found matching your filter criteria.
          </p>
          <button
            onClick={() => onNavigate("agent")}
            className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
          >
            Run Agent Terminal to Trigger Micropayments
          </button>
        </div>
      ) : (
        <div className="space-y-3 font-mono">
          {filteredPayments.map((pay) => (
            <div
              key={pay.id}
              className={`glass-card rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                pay.decision === "DENIED"
                  ? "border-rose-200 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/20"
                  : "bg-white dark:bg-slate-900"
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {pay.id}
                  </span>
                  {getDecisionBadge(pay.decision)}
                  {getStatusBadge(pay.status)}
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3">
                  <span>Agent: <strong className="text-slate-800 dark:text-slate-200">{pay.agentName}</strong></span>
                  <span>Service: <strong className="text-sky-600 dark:text-sky-400">{pay.serviceName}</strong></span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span
                  className={
                    pay.decision === "DENIED"
                      ? "text-rose-600 dark:text-rose-400 font-bold text-base block"
                      : "text-emerald-700 dark:text-emerald-400 font-bold text-base block"
                  }
                >
                  {pay.amount} {pay.asset}
                </span>
                <span className="text-[10px] text-slate-400 font-sans block">
                  {new Date(pay.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSelectedPayment(pay)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  Inspect Trace <Info className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment Detail Modal & Evaluation Trace */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-xl w-full space-y-5 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                  PAYMENT ATTEMPT &amp; EVALUATION TRACE
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
                  {selectedPayment.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPayment(null)}
                className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">DECISION &amp; STATUS:</span>
                  <div className="flex items-center gap-1.5">
                    {getDecisionBadge(selectedPayment.decision)}
                    {getStatusBadge(selectedPayment.status)}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">AMOUNT CHARGED:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {selectedPayment.amount} {selectedPayment.asset}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">ORIGINATING AGENT:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedPayment.agentName}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">DESTINATION SERVICE:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">{selectedPayment.serviceName}</span>
                </div>
              </div>

              {/* Recorded Evaluation Trace */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white font-sans text-xs flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-emerald-500" /> Recorded Evaluation Trace
                </h4>

                <div className="space-y-2 text-[11px] font-mono">
                  {selectedPayment.evaluationTrace.map((step, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        step.status === "PASS"
                          ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                          : "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                      }`}
                    >
                      <div>
                        <span className="font-bold block">{idx + 1}. {step.stage}</span>
                        <span className="text-[10px] opacity-80 block font-sans">{step.detail}</span>
                      </div>
                      {step.status === "PASS" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertOctagon className="w-4 h-4 text-rose-500 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Cross-Resource Nav */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 font-sans">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1">
                  <Radio className="w-4 h-4 text-purple-500" /> Audit Evidence Navigation
                </h4>
                <div className="grid grid-cols-2 gap-2 font-mono">
                  <button
                    onClick={() => {
                      setSelectedPayment(null);
                      onNavigate("audit");
                    }}
                    className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 text-purple-800 dark:text-purple-300 text-xs flex items-center justify-between cursor-pointer"
                  >
                    <span>View HCS Audit Feed</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href="https://hashscan.io/testnet/topic/0.0.654321"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs flex items-center justify-between font-bold"
                  >
                    <span>HashScan Explorer</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-sky-500" /> Ledger KeyRing Enclave Protected</span>
                <span>Network: {selectedPayment.network}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
