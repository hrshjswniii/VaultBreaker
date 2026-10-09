"use client";

import React, { useState } from "react";
import { ServiceItem, PaymentAttempt } from "@/lib/api";
import {
  Server,
  Search,
  Filter,
  ArrowRight,
  Info,
  Globe,
  Radio,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface ServicesViewProps {
  services: ServiceItem[];
  payments: PaymentAttempt[];
  onNavigate: (tab: string) => void;
}

export const ServicesView: React.FC<ServicesViewProps> = ({
  services,
  payments,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  const filteredServices = services.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.endpoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: ServiceItem["status"]) => {
    switch (status) {
      case "REACHABLE":
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> REACHABLE &amp; LIVE
          </span>
        );
      case "CONFIGURED":
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-[10px] font-mono font-bold flex items-center gap-1">
            <Radio className="w-3 h-3 text-sky-500" /> CONFIGURED
          </span>
        );
      case "SIMULATED":
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-500" /> SIMULATED FIXTURE
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
            <Server className="w-4 h-4" />
            PROTECTED METERED SERVICE REGISTRY
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            Registered Services ({services.length})
          </h2>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            API endpoints and compute services protected by Vaultbreaker capability headers and x402 micropayment settlement.
          </p>
        </div>

        <button
          onClick={() => onNavigate("developer")}
          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold font-mono transition-all shadow-md shadow-sky-600/15 cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          Register Policy &amp; Service &rarr;
        </button>
      </div>

      {/* Controls & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, endpoint, or EVM address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700 overflow-x-auto">
          <div className="flex items-center gap-1 text-slate-400 font-mono text-xs px-2.5 py-1 font-bold">
            <Filter className="w-3.5 h-3.5" /> Integration:
          </div>
          {["ALL", "REACHABLE", "CONFIGURED", "SIMULATED"].map((s) => (
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

      {/* Services List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredServices.map((srv) => (
          <div
            key={srv.id}
            className="glass-card rounded-2xl p-5 hover:border-sky-300 dark:hover:border-sky-700 transition-all space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-bold">
                    {srv.id}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">{srv.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{srv.endpoint}</p>
                </div>
                {getStatusBadge(srv.status)}
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
                {srv.description}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700 text-xs font-mono">
                <div>
                  <span className="text-slate-400 text-[10px] block font-sans">EVM ADDRESS</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">
                    {srv.address.slice(0, 12)}...
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-sans">PRICE PER CALL</span>
                  <span className="text-sky-700 dark:text-sky-400 font-bold">
                    {srv.pricePerCall} {srv.currency}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 font-mono text-xs">
                {srv.x402Supported && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 font-bold">
                    x402 Header Enabled
                  </span>
                )}
                <button
                  onClick={() => setSelectedService(srv)}
                  className="ml-auto text-xs text-sky-600 dark:text-sky-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  Inspect Service <Info className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Service Detail Modal */}
      {selectedService && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full space-y-5 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold">
                  SERVICE SPECIFICATION
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
                  {selectedService.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">STATUS:</span>
                  {getStatusBadge(selectedService.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">ENDPOINT PATH:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">{selectedService.endpoint}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">EVM CONTRACT ADDRESS:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedService.address}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-sans text-[11px]">NETWORK:</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">{selectedService.network}</span>
                </div>
              </div>

              {/* Cross-Resource Nav */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 font-sans">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1">
                  <Globe className="w-4 h-4 text-sky-500" /> Associated Activity Navigation
                </h4>
                <div className="grid grid-cols-2 gap-2 font-mono">
                  <button
                    onClick={() => {
                      setSelectedService(null);
                      onNavigate("agent");
                    }}
                    className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 text-sky-800 dark:text-sky-300 text-xs flex items-center justify-between cursor-pointer"
                  >
                    <span>Test Micropayment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedService(null);
                      onNavigate("payments");
                    }}
                    className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 text-purple-800 dark:text-purple-300 text-xs flex items-center justify-between cursor-pointer"
                  >
                    <span>View Payment History</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
