import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vaultbreaker — Scoped-Capability Broker for AI Agents",
  description: "Narrow, expiring, revocable spend-limited capability objects for autonomous AI agents. Powered by Ledger Key Ring and Hedera x402.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

