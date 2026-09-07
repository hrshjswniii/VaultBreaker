export interface Policy {
  id: string;
  name: string;
  serviceEndpoint: string;
  serviceAddress: string;
  maxPricePerCall: number;
  dailyBudget: number;
  ttlSeconds: number;
  createdAt: string;
}

export interface Capability {
  capId: string;
  policyId: string;
  policyHash: string;
  serviceAddress: string;
  budgetTotal: number;
  budgetRemaining: number;
  expiry: number;
  issuer: string;
  encryptedCredential: string;
  token: string;
  revoked: boolean;
  createdAt: string;
}

export interface HCSAuditEvent {
  type: "CAPABILITY_ISSUED" | "CAPABILITY_SPENT" | "CAPABILITY_REJECTED" | "CAPABILITY_REVOKED";
  capId: string;
  service?: string;
  amount?: number;
  budgetRemaining?: number;
  reason?: string;
  policyHash?: string;
  timestamp: string;
  txHash?: string;
}

export interface KeyRingStatus {
  mode: "LEDGER_CLI" | "SIMULATED_KEYRING";
  initialized: boolean;
  cliPath: string;
  seedFingerprint?: string;
}

const BROKER_BASE_URL = process.env.NEXT_PUBLIC_BROKER_URL || "http://localhost:3001";

export async function fetchHealth() {
  const res = await fetch(`${BROKER_BASE_URL}/api/health`);
  return res.json();
}

export async function fetchPolicies(): Promise<Policy[]> {
  const res = await fetch(`${BROKER_BASE_URL}/api/policies`);
  return res.json();
}

export async function createPolicy(policy: Partial<Policy>): Promise<Policy> {
  const res = await fetch(`${BROKER_BASE_URL}/api/policies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(policy),
  });
  return res.json();
}

export async function issueCapability(policyId: string, budget?: number): Promise<Capability> {
  const res = await fetch(`${BROKER_BASE_URL}/api/capabilities/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ policyId, requestedBudget: budget }),
  });
  return res.json();
}

export async function fetchCapabilities(): Promise<Capability[]> {
  const res = await fetch(`${BROKER_BASE_URL}/api/capabilities`);
  return res.json();
}

export async function revokeCapability(capId: string) {
  const res = await fetch(`${BROKER_BASE_URL}/api/capabilities/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ capId }),
  });
  return res.json();
}

export async function executeMeteredCall(token: string, promptText: string, amount: number = 10) {
  const res = await fetch(`${BROKER_BASE_URL}/api/metered-service`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-capability-token": token,
      "x-payment-amount": String(amount),
    },
    body: JSON.stringify({ prompt: promptText }),
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

export async function fetchAuditFeed(): Promise<HCSAuditEvent[]> {
  const res = await fetch(`${BROKER_BASE_URL}/api/audit-feed`);
  return res.json();
}
