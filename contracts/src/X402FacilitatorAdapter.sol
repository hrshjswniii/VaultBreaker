// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CapabilityRegistry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title X402FacilitatorAdapter
 * @notice Adapter interface between Blocky402 x402 payment facilitator flow and CapabilityRegistry.
 * Ensures payment settlement occurs only if capability spend budget and expiration checks succeed.
 */
contract X402FacilitatorAdapter is Ownable {
    CapabilityRegistry public immutable registry;

    event FacilitatorPaymentProcessed(
        bytes32 indexed capId,
        uint256 amount,
        address indexed serviceEndpoint,
        address indexed payer
    );

    error CapabilitySpendFailed(string reason);

    constructor(address _registry, address initialOwner) Ownable(initialOwner) {
        require(_registry != address(0), "Invalid registry address");
        registry = CapabilityRegistry(_registry);
    }

    /**
     * @notice Validates payment callback and triggers on-chain capability budget decrement.
     * Reverts entire transaction if capability registry spend fails.
     */
    function processPaymentAndSpend(
        bytes32 capId,
        uint256 amount,
        address serviceEndpoint
    ) external {
        CapabilityRegistry.Capability memory cap = registry.getCapability(capId);

        if (cap.service != serviceEndpoint) {
            revert CapabilitySpendFailed("SERVICE_MISMATCH");
        }

        // Trigger on-chain spend accounting; reverts if cap expired, revoked, or insufficient budget
        registry.spend(capId, amount);

        emit FacilitatorPaymentProcessed(capId, amount, serviceEndpoint, msg.sender);
    }
}
