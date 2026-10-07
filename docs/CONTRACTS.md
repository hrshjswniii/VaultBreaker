# Vaultbreaker Smart Contract Audit

## 1. Inventory & Overview

The smart contract suite resides under `/contracts` and is built using **Solidity 0.8.20** and **Foundry**.

| Contract File | Purpose | Inheritance | License |
|---|---|---|---|
| `CapabilityRegistry.sol` | Core stateful registry enforcing capability budget, expiry, revocation, and facilitator authorization. | `Ownable` (OpenZeppelin 5.x) | MIT |
| `X402FacilitatorAdapter.sol` | Facilitator entrypoint that validates service endpoint bindings before invoking `CapabilityRegistry.spend()`. | `Ownable` (OpenZeppelin 5.x) | MIT |
| `Deploy.s.sol` | Deployment script for Hedera EVM Testnet. | `Script` (Forge Standard) | MIT |
| `CapabilityRegistry.t.sol` | Comprehensive Foundry unit test suite (8 tests passing). | `Test` (Forge Standard) | MIT |

---

## 2. Contract Audit: `CapabilityRegistry.sol`

### Data Structures & State Variables

```solidity
struct Capability {
    bytes32 policyHash;
    address service;
    uint256 budgetRemaining;
    uint256 expiry;
    address issuer;
    bool revoked;
}

mapping(bytes32 => Capability) public capabilities;
mapping(address => bool) public authorizedFacilitators;
uint256 private nonce;
```

### Functions & Access Control

1. `constructor(address initialOwner)`: Sets `initialOwner` via OpenZeppelin `Ownable` and authorizes `initialOwner` as a facilitator (`authorizedFacilitators[initialOwner] = true`).
2. `setFacilitator(address facilitator, bool authorized)` (`onlyOwner`): Adds/removes authorized facilitators. Reverts with `InvalidService()` if `facilitator == address(0)`.
3. `issueCapability(bytes32 policyHash, address service, uint256 budget, uint256 expiry)` (`external`):
   - Validates `service != address(0)` (`InvalidService`).
   - Validates `budget > 0` (`InvalidBudget`).
   - Validates `expiry > block.timestamp` (`CapabilityExpired`).
   - Increments internal `nonce`.
   - Computes `capId = keccak256(abi.encodePacked(policyHash, service, budget, expiry, msg.sender, nonce, block.chainid))`.
   - Stores capability struct in `capabilities[capId]`.
   - Emits `CapabilityIssued(capId, service, budget, expiry, msg.sender)`.
4. `spend(bytes32 capId, uint256 amount)` (`external onlyFacilitator`):
   - Validates capability exists (`cap.service != address(0)` -> emits `CapabilityRejected(capId, "NOT_FOUND")` & reverts `CapabilityNotFound`).
   - Validates capability not revoked (`!cap.revoked` -> emits `CapabilityRejected(capId, "REVOKED")` & reverts `CapabilityRevokedError`).
   - Validates timestamp (`block.timestamp < cap.expiry` -> emits `CapabilityRejected(capId, "EXPIRED")` & reverts `CapabilityExpired`).
   - Validates budget (`cap.budgetRemaining >= amount` -> emits `CapabilityRejected(capId, "INSUFFICIENT_BUDGET")` & reverts `InsufficientBudget`).
   - Decrements `cap.budgetRemaining -= amount`.
   - Emits `CapabilitySpent(capId, amount, cap.budgetRemaining)`.
5. `revoke(bytes32 capId)` (`external`):
   - Validates capability exists (`cap.service != address(0)` -> reverts `CapabilityNotFound`).
   - Validates caller is issuer or contract owner (`msg.sender == cap.issuer || msg.sender == owner()` -> reverts `UnauthorizedCaller`).
   - Sets `cap.revoked = true`.
   - Emits `CapabilityRevoked(capId)`.
6. `getCapability(bytes32 capId)` (`external view`): Returns `Capability` struct.

---

## 3. Contract Audit: `X402FacilitatorAdapter.sol`

### Data Structures & Functions

```solidity
CapabilityRegistry public immutable registry;
```

1. `constructor(address _registry, address initialOwner)`: Sets immutable reference to `CapabilityRegistry`.
2. `processPaymentAndSpend(bytes32 capId, uint256 amount, address serviceEndpoint)` (`external`):
   - Fetches capability struct via `registry.getCapability(capId)`.
   - Asserts `cap.service == serviceEndpoint` (reverts `CapabilitySpendFailed("SERVICE_MISMATCH")`).
   - Calls `registry.spend(capId, amount)`.
   - Emits `FacilitatorPaymentProcessed(capId, amount, serviceEndpoint, msg.sender)`.

---

## 4. Contract Findings & Security Assessment

### Findings Categorization

#### [MEDIUM] Missing Reentrancy Protection on Native Value Transfers (Future Precaution)
- **Detail**: Neither `CapabilityRegistry` nor `X402FacilitatorAdapter` currently hold or transfer ETH / HBAR native tokens directly (they only track accounting units in uint256). However, if native token settlement is added directly to `processPaymentAndSpend`, non-reentrant modifiers will be required.

#### [LOW] Permanent Storage Expansion Without Deletion
- **Detail**: Issued capabilities remain in `capabilities` mapping indefinitely after expiry or revocation. While harmless on Hedera EVM (low storage cost), an explicit cleanup / prune function could refund gas/storage on EVM chains.

#### [LOW] Nonce Generation Uses `block.chainid` in `abi.encodePacked`
- **Detail**: `capId` hashing uses `abi.encodePacked` with multiple dynamic types including `nonce` and `block.chainid`. Using `abi.encode` is recommended by Solidity best practices to prevent hash collision edge cases, although the fixed struct argument sizes prevent collision in this specific layout.

#### [INFO] Absence of Direct Native HBAR / ERC-20 Escrow in Adapter
- **Detail**: `X402FacilitatorAdapter` tracks capability spend decrements, but does not lock HBAR or ERC20 tokens in contract escrow upon capability creation. Micropayments rely on off-chain settlement or facilitator callbacks.
