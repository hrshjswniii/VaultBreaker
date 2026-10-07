# Vaultbreaker 2.0 Authorization Flow

## 1. Executive Authorization Pipeline Overview

The Vaultbreaker authorization flow defines the decision process when an autonomous AI agent attempts to execute a metered service request. Every request passes through seven evaluation stages:

```
[Agent Request] 
      │
      ▼
1. Authenticate Request & Verify Capability JWT Token
      │
      ▼
2. Resolve Capability & Policy Context
      │
      ▼
3. Validate Service Endpoint Binding (WHERE?)
      │
      ▼
4. Validate Time-to-Live & Expiration (WHEN?)
      │
      ▼
5. Check Revocation & Velocity Rate Limits (CONDITIONS?)
      │
      ▼
6. Evaluate Spend Amount & Remaining Budget (HOW MUCH?)
      │
      ├──> Budget Exhausted / Expired / Revoked  ──> [DENY] (HTTP 402/403 + HCS Audit)
      ├──> Amount > Approval Threshold          ──> [APPROVAL_REQUIRED] (Pause Flow)
      └──> Checks Pass                           ──> [ALLOW]
                                                        │
                                                        ▼
7. Decrypt Credential via Ledger KeyRing -> Execute -> Settle -> Audit (HCS)
```

---

## 2. Sequence Diagram 1: Capability Issuance Flow

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer / Admin User
    participant Broker as Vaultbreaker Broker Control Plane
    participant KeyRing as Ledger KeyRing (CLI / Seed Enclave)
    participant HCS as Hedera Consensus Service (HCS)
    participant Agent as Autonomous AI Agent

    Dev->>Broker: POST /api/capabilities/issue (policyId, budget, ttl)
    Broker->>Broker: Fetch Policy & Compute policyHash (Keccak256)
    Broker->>Broker: Generate Cryptographic Nonce & capId
    Broker->>KeyRing: encryptCredential(rawSecret)
    KeyRing-->>Broker: Return Encrypted Credential Payload
    Broker->>Broker: Mint Scoped JWT Token (signed with secret key)
    Broker->>HCS: Submit CAPABILITY_ISSUED Audit Event
    Broker-->>Agent: Return Capability Object (capId, token, budget, expiry)
```

---

## 3. Sequence Diagram 2: Metered Request Allowed Flow (`ALLOW`)

```mermaid
sequenceDiagram
    autonumber
    actor Agent as Autonomous AI Agent
    participant Broker as Broker / Metered Service Endpoint
    participant PolicyEng as Policy & Budget Engine
    participant KeyRing as Ledger KeyRing Enclave
    participant Contract as CapabilityRegistry.sol (Hedera EVM)
    participant HCS as Hedera HCS Topic

    Agent->>Broker: POST /api/metered-service (x-capability-token, x-payment-amount)
    Broker->>PolicyEng: Verify JWT Signature & Decode capId
    PolicyEng->>PolicyEng: Check Expiry (now < expiry)
    PolicyEng->>PolicyEng: Check Revocation (revoked == false)
    PolicyEng->>PolicyEng: Check Service Binding (service == targetAddress)
    PolicyEng->>PolicyEng: Check Budget (budgetRemaining >= amount)
    PolicyEng->>PolicyEng: Decrement Memory Budget (budgetRemaining -= amount)
    Broker->>KeyRing: decryptCredential(encryptedCredential)
    KeyRing-->>Broker: Plaintext Key (In-Memory Only)
    Broker->>Contract: spend(capId, amount) [Optional EVM Settlement]
    Broker->>HCS: Submit CAPABILITY_SPENT Audit Event
    Broker-->>Agent: HTTP 200 OK + Service Result + Audit Receipt
```

---

## 4. Sequence Diagram 3: Over-Budget Rejection Flow (`DENY`)

```mermaid
sequenceDiagram
    autonumber
    actor Agent as Autonomous AI Agent
    participant Broker as Broker / Metered Service Endpoint
    participant PolicyEng as Policy & Budget Engine
    participant HCS as Hedera HCS Topic

    Agent->>Broker: POST /api/metered-service (x-capability-token, amount=10)
    Broker->>PolicyEng: Verify JWT & Fetch Capability
    PolicyEng->>PolicyEng: Check Budget (budgetRemaining: 0 < amount: 10)
    PolicyEng-->>Broker: Throw INSUFFICIENT_BUDGET
    Broker->>HCS: Submit CAPABILITY_REJECTED Audit Event (Reason: Budget Exhausted)
    Broker-->>Agent: HTTP 402 Payment Required (INSUFFICIENT_BUDGET)
```

---

## 5. Sequence Diagram 4: Human Approval Flow (`APPROVAL_REQUIRED`)

```mermaid
sequenceDiagram
    autonumber
    actor Agent as Autonomous AI Agent
    participant Broker as Broker Control Plane
    actor Admin as Human Administrator
    participant HCS as Hedera HCS Topic

    Agent->>Broker: POST /api/metered-service (amount=100 HBAR)
    Broker->>Broker: Evaluate Policy: 100 > requireApprovalAbove (50 HBAR)
    Broker->>HCS: Submit APPROVAL_REQUESTED Audit Event
    Broker-->>Agent: HTTP 202 Accepted (Status: APPROVAL_REQUIRED, approvalId)
    
    Admin->>Broker: GET /api/approvals/pending
    Admin->>Broker: POST /api/approvals/resolve (approvalId, decision: APPROVED)
    Broker->>HCS: Submit APPROVAL_GRANTED Audit Event
    Broker->>Broker: Resume Execution & Process Spend
    Broker-->>Agent: Webhook / Polling Notification: Execution Succeeded
```
