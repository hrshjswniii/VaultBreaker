// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CapabilityRegistry
 * @notice On-chain enforcement registry for Vaultbreaker AI agent scoped capabilities.
 * Tracks remaining spend budget, expiration, and revocation status for each capability token hash.
 * Secrets and exact policy details stay off-chain; only cryptographic hashes and accounting live on-chain.
 */
contract CapabilityRegistry is Ownable {
    struct Capability {
        bytes32 policyHash;
        address service;
        uint256 budgetRemaining;
        uint256 expiry;
        address issuer;
        bool revoked;
    }

    // Storage
    mapping(bytes32 => Capability) public capabilities;
    mapping(address => bool) public authorizedFacilitators;
    uint256 private nonce;

    // Events
    event CapabilityIssued(
        bytes32 indexed capId,
        address indexed service,
        uint256 budget,
        uint256 expiry,
        address indexed issuer
    );
    event CapabilitySpent(bytes32 indexed capId, uint256 amount, uint256 remaining);
    event CapabilityRevoked(bytes32 indexed capId);
    event CapabilityRejected(bytes32 indexed capId, string reason);
    event FacilitatorStatusUpdated(address indexed facilitator, bool authorized);

    // Custom Errors
    error CapabilityExpired();
    error CapabilityRevokedError();
    error InsufficientBudget();
    error UnauthorizedCaller();
    error CapabilityNotFound();
    error InvalidService();
    error InvalidBudget();

    modifier onlyFacilitator() {
        if (!authorizedFacilitators[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedCaller();
        }
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        // Owner is authorized by default
        authorizedFacilitators[initialOwner] = true;
    }

    /**
     * @notice Authorize or deauthorize an x402 facilitator adapter.
     */
    function setFacilitator(address facilitator, bool authorized) external onlyOwner {
        if (facilitator == address(0)) revert InvalidService();
        authorizedFacilitators[facilitator] = authorized;
        emit FacilitatorStatusUpdated(facilitator, authorized);
    }

    /**
     * @notice Issues a new scoped capability with policy hash, service endpoint binding, budget, and expiry.
     */
    function issueCapability(
        bytes32 policyHash,
        address service,
        uint256 budget,
        uint256 expiry
    ) external returns (bytes32 capId) {
        if (service == address(0)) revert InvalidService();
        if (budget == 0) revert InvalidBudget();
        if (expiry <= block.timestamp) revert CapabilityExpired();

        nonce++;
        capId = keccak256(abi.encodePacked(policyHash, service, budget, expiry, msg.sender, nonce, block.chainid));

        capabilities[capId] = Capability({
            policyHash: policyHash,
            service: service,
            budgetRemaining: budget,
            expiry: expiry,
            issuer: msg.sender,
            revoked: false
        });

        emit CapabilityIssued(capId, service, budget, expiry, msg.sender);
    }

    /**
     * @notice Enforces policy limits on-chain and decrements capability remaining budget per service call.
     * Can only be called by an authorized x402 facilitator adapter.
     */
    function spend(bytes32 capId, uint256 amount) external onlyFacilitator {
        Capability storage cap = capabilities[capId];

        if (cap.service == address(0)) {
            emit CapabilityRejected(capId, "NOT_FOUND");
            revert CapabilityNotFound();
        }
        if (cap.revoked) {
            emit CapabilityRejected(capId, "REVOKED");
            revert CapabilityRevokedError();
        }
        if (block.timestamp >= cap.expiry) {
            emit CapabilityRejected(capId, "EXPIRED");
            revert CapabilityExpired();
        }
        if (cap.budgetRemaining < amount) {
            emit CapabilityRejected(capId, "INSUFFICIENT_BUDGET");
            revert InsufficientBudget();
        }

        cap.budgetRemaining -= amount;

        emit CapabilitySpent(capId, amount, cap.budgetRemaining);
    }

    /**
     * @notice Revokes a capability. May be called by the issuing developer or contract owner.
     */
    function revoke(bytes32 capId) external {
        Capability storage cap = capabilities[capId];
        if (cap.service == address(0)) revert CapabilityNotFound();
        if (msg.sender != cap.issuer && msg.sender != owner()) revert UnauthorizedCaller();

        cap.revoked = true;
        emit CapabilityRevoked(capId);
    }

    /**
     * @notice Returns complete capability state by ID.
     */
    function getCapability(bytes32 capId) external view returns (Capability memory) {
        return capabilities[capId];
    }
}
