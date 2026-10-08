"use client";

import React from "react";
import { AlertCircle, Wifi, Database } from "lucide-react";

interface ConnectionBannerProps {
  isBrokerOnline: boolean;
  onRetry: () => void;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ isBrokerOnline, onRetry }) => {
  if (isBrokerOnline) {
    return (
      <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1.5 text-xs text-emerald-800 dark:text-emerald-300 font-mono flex items-center justify-between">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-bold flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              CONNECTED TO LIVE BROKER CONTROL PLANE (http://localhost:3001)
            </span>
          </div>
          <span className="hidden md:inline text-[10px] text-emerald-700 dark:text-emerald-400 uppercase tracking-wider font-semibold">
            Hedera Testnet EVM &amp; HCS Topic Active
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-900 dark:text-amber-300 font-mono">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <strong className="font-bold flex items-center gap-1">
              <Database className="w-3.5 h-3.5" /> BROKER DISCONNECTED — DEMO FALLBACK MODE ACTIVE
            </strong>
            <span className="text-[11px] text-amber-700 dark:text-amber-400 block sm:inline sm:ml-2">
              (Local Node.js Broker at localhost:3001 is offline. Running client-side simulation.)
            </span>
          </div>
        </div>
        <button
          onClick={onRetry}
          className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition-all shadow-xs shrink-0 cursor-pointer"
        >
          Reconnect Broker &rarr;
        </button>
      </div>
    </div>
  );
};
