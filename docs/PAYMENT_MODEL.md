# Vaultbreaker 2.0 Payment Model

## 1. Executive Payment Lifecycle Overview

Vaultbreaker provides financial control for agentic micropayments. The payment model ensures that every asset transfer is pre-authorized by a valid capability, tracked on-chain, and recorded in an immutable audit trail.

```
[AGENT REQUEST]
       │
       ▼
1. Policy & Budget Verification (Check budgetRemaining >= amount)
       │
       ▼
2. Payment Authorization (Decrypt credential in Ledger KeyRing Enclave)
       │
       ▼
3. Capability Budget Decrement (Memory budgetRemaining -= amount)
       │
       ▼
4. On-Chain Settlement (Invoke CapabilityRegistry.sol spend() / x402 Facilitator)
       │
       ▼
5. Service Execution (Forward prompt & execute metered API work)
       │
       ▼
6. Audit Logging (Submit CAPABILITY_SPENT message to Hedera HCS Topic)
       │
       ▼
[SERVICE RESPONSE + AUDIT RECEIPT TO AGENT]
```

---

## 2. Payment Entity Schema

```typescript
export interface PaymentEntity {
  paymentId: string;
  capId: string;
  agentId: string;
  serviceAddress: string;
  
  // Financial Details
  amount: number;              // In HBAR / Tinybar / Wei
  asset: "HBAR" | "USDC" | "ETH";
  networkId: number;           // e.g. 296 (Hedera Testnet)
  
  // Credentials & Execution
  keyringMode: "LEDGER_CLI" | "SEED_ENCLAVE";
  status: "INITIATED" | "AUTHORIZED" | "PENDING_SETTLEMENT" | "SETTLED" | "FAILED" | "REJECTED";
  
  // Blockchain References
  txHash?: string;
  hcsSequenceNumber?: number;
  failureReason?: string;
  
  timestamp: string;
}
```

---

## 3. Failure & Edge-Case Handling Protocol

| Failure Scenario | Error Code | System Action | Payment & Budget Outcome |
|---|---|---|---|
| **Policy Denies / Unauthorized Service** | `UNAUTHORIZED_SERVICE` | Request rejected immediately. | Zero charge; budget untouched; `CAPABILITY_REJECTED` logged to HCS. |
| **Insufficient Budget** | `INSUFFICIENT_BUDGET` | HTTP 402 returned with remaining balance. | Zero charge; budget remains at 0; `CAPABILITY_REJECTED` logged to HCS. |
| **Capability Token Expired** | `CAPABILITY_EXPIRED` | HTTP 402 returned with expiration timestamp. | Zero charge; budget untouched; `CAPABILITY_REJECTED` logged to HCS. |
| **Capability Revoked** | `CAPABILITY_REVOKED` | HTTP 403 returned. | Zero charge; budget untouched; `CAPABILITY_REJECTED` logged to HCS. |
| **Ledger Decryption Failure** | `KEYRING_DECRYPT_ERROR` | Request halts before on-chain execution. | Zero charge; budget rolled back; error logged to HCS. |
| **On-Chain EVM Tx Reverts** | `EVM_REVERT` | Transaction fails on-chain. | Memory budget restored; error logged to HCS. |
| **Metered Service Failure** | `SERVICE_ERROR` (500) | Protected API crashes during processing. | Auto-refund: memory budget restored; `PAYMENT_REFUNDED` logged to HCS. |
| **Expiry Mid-Flow** | `EXPIRED_MID_FLOW` | Expiry timestamp reached during service execution. | Request succeeds if authorized at initial timestamp; budget decremented. |
