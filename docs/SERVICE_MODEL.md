# Vaultbreaker 2.0 Service Model

## 1. Overview: What is a "Service" in Vaultbreaker?

In Vaultbreaker, a **Service** represents a pay-per-call API endpoint, compute resource, AI model gateway, or data feed protected by Vaultbreaker capability authorization.

Vaultbreaker acts as an explicit security proxy and settlement gateway between autonomous AI agents and metered services.

```
┌──────────────┐       1. Request + JWT Token       ┌────────────────────────┐       2. Forward Request       ┌──────────────────┐
│  AI Agent    │ ─────────────────────────────────> │  Vaultbreaker Broker   │ ─────────────────────────────> │ Protected Service│
│ (Consumer)   │ <───────────────────────────────── │   (AuthZ & Ledger)     │ <───────────────────────────── │   (API Provider) │
└──────────────┘      4. Gated Output Response      └────────────────────────┘        3. Service Data          └──────────────────┘
```

---

## 2. Service Domain Entity Schema

```typescript
export interface ServiceEntity {
  serviceId: string;
  orgId: string;
  name: string;
  description: string;
  
  // Endpoint Details
  serviceEndpoint: string;       // e.g. "/api/metered-service"
  serviceAddress: string;        // On-chain EVM address binding (e.g. 0x000...004)
  
  // Pricing & Settlement
  pricing: {
    pricePerCall: number;        // Cost in HBAR / Tinybar / Wei
    currency: "HBAR" | "USDC" | "ETH";
    settlementWalletAddress: string;
  };
  
  // Supported Infrastructure
  networkId: number;             // e.g. 296 (Hedera Testnet)
  status: "REGISTERED" | "ACTIVE" | "MAINTENANCE" | "DEPRECATED";
  
  createdAt: string;
  updatedAt: string;
}
```

---

## 3. Real-World Service Examples

### Example A: AI Text Summarizer API
- **Endpoint**: `/api/metered-service`
- **Address**: `0x0000000000000000000000000000000000000004`
- **Pricing**: `10 HBAR` per call
- **Behavior**: Accepts text prompt, verifies capability token, decrypts settlement credential, decrements budget, returns summarized output.

### Example B: Financial Market Data Feed
- **Endpoint**: `/api/v1/market-data`
- **Address**: `0x0000000000000000000000000000000000000005`
- **Pricing**: `2 HBAR` per ticker query
- **Behavior**: Returns real-time market sentiment and pricing array.

---

## 4. Service Registration & Binding Workflow

1. **Registration**: A Service Provider registers a service definition via `/api/policies` or the Developer Console, specifying endpoint path, pricing, and on-chain address.
2. **Policy Creation**: Developers create spend policies specifying allowed service addresses (`allowedServiceAddresses: ["0x000...004"]`).
3. **Capability Binding**: When a capability is issued, `serviceAddress` is permanently hashed into `policyHash` and stored in `CapabilityRegistry.sol`.
4. **Service Misbinding Rejection**: If an agent presents a capability issued for Service A (`0x...04`) to Service B (`0x...05`), the adapter immediately reverts with `SERVICE_MISMATCH`.
