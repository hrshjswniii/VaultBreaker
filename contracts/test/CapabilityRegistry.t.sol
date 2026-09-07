// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {CapabilityRegistry} from "../src/CapabilityRegistry.sol";
import {X402FacilitatorAdapter} from "../src/X402FacilitatorAdapter.sol";

contract CapabilityRegistryTest is Test {
    CapabilityRegistry public registry;
    X402FacilitatorAdapter public adapter;

    address public owner = address(1);
    address public facilitator = address(2);
    address public issuer = address(3);
    address public service = address(4);
    address public unauthorizedUser = address(5);

    bytes32 public samplePolicyHash = keccak256("policy:max_price_0.10_daily_1.00");

    function setUp() public {
        vm.startPrank(owner);
        registry = new CapabilityRegistry(owner);
        adapter = new X402FacilitatorAdapter(address(registry), owner);

        // Authorize facilitator and adapter in registry
        registry.setFacilitator(facilitator, true);
        registry.setFacilitator(address(adapter), true);
        vm.stopPrank();
    }

    function test_IssueCapability() public {
        vm.startPrank(issuer);
        uint256 budget = 1000;
        uint256 expiry = block.timestamp + 3600;

        bytes32 capId = registry.issueCapability(samplePolicyHash, service, budget, expiry);
        vm.stopPrank();

        CapabilityRegistry.Capability memory cap = registry.getCapability(capId);
        assertEq(cap.policyHash, samplePolicyHash);
        assertEq(cap.service, service);
        assertEq(cap.budgetRemaining, budget);
        assertEq(cap.expiry, expiry);
        assertEq(cap.issuer, issuer);
        assertFalse(cap.revoked);
    }

    function test_SpendUntilBudgetExhausted() public {
        vm.prank(issuer);
        bytes32 capId = registry.issueCapability(samplePolicyHash, service, 100, block.timestamp + 3600);

        // Spend 40
        vm.prank(facilitator);
        registry.spend(capId, 40);
        assertEq(registry.getCapability(capId).budgetRemaining, 60);

        // Spend 60
        vm.prank(facilitator);
        registry.spend(capId, 60);
        assertEq(registry.getCapability(capId).budgetRemaining, 0);

        // Third spend should revert with InsufficientBudget
        vm.prank(facilitator);
        vm.expectRevert(CapabilityRegistry.InsufficientBudget.selector);
        registry.spend(capId, 1);
    }

    function test_SpendRevertsWhenExpired() public {
        vm.prank(issuer);
        uint256 expiry = block.timestamp + 60;
        bytes32 capId = registry.issueCapability(samplePolicyHash, service, 500, expiry);

        // Warp time past expiry
        vm.warp(block.timestamp + 61);

        vm.prank(facilitator);
        vm.expectRevert(CapabilityRegistry.CapabilityExpired.selector);
        registry.spend(capId, 10);
    }

    function test_SpendRevertsWhenRevoked() public {
        vm.prank(issuer);
        bytes32 capId = registry.issueCapability(samplePolicyHash, service, 500, block.timestamp + 3600);

        // Issuer revokes
        vm.prank(issuer);
        registry.revoke(capId);

        assertTrue(registry.getCapability(capId).revoked);

        // Spend attempt should revert
        vm.prank(facilitator);
        vm.expectRevert(CapabilityRegistry.CapabilityRevokedError.selector);
        registry.spend(capId, 50);
    }

    function test_UnauthorizedCallerCannotSpend() public {
        vm.prank(issuer);
        bytes32 capId = registry.issueCapability(samplePolicyHash, service, 500, block.timestamp + 3600);

        vm.prank(unauthorizedUser);
        vm.expectRevert(CapabilityRegistry.UnauthorizedCaller.selector);
        registry.spend(capId, 10);
    }

    function test_ExactAccountingMultiplePartialSpends() public {
        vm.prank(issuer);
        bytes32 capId = registry.issueCapability(samplePolicyHash, service, 1000, block.timestamp + 3600);

        uint256[4] memory spends = [uint256(123), uint256(456), uint256(200), uint256(221)];
        uint256 expectedRemaining = 1000;

        for (uint256 i = 0; i < spends.length; i++) {
            vm.prank(facilitator);
            registry.spend(capId, spends[i]);
            expectedRemaining -= spends[i];
            assertEq(registry.getCapability(capId).budgetRemaining, expectedRemaining);
        }

        assertEq(registry.getCapability(capId).budgetRemaining, 0);
    }

    function test_AdapterProcessPaymentAndSpend() public {
        vm.prank(issuer);
        bytes32 capId = registry.issueCapability(samplePolicyHash, service, 500, block.timestamp + 3600);

        vm.prank(facilitator);
        adapter.processPaymentAndSpend(capId, 150, service);

        assertEq(registry.getCapability(capId).budgetRemaining, 350);
    }

    function test_AdapterRevertsOnServiceMismatch() public {
        vm.prank(issuer);
        bytes32 capId = registry.issueCapability(samplePolicyHash, service, 500, block.timestamp + 3600);

        vm.prank(facilitator);
        vm.expectRevert(abi.encodeWithSelector(X402FacilitatorAdapter.CapabilitySpendFailed.selector, "SERVICE_MISMATCH"));
        adapter.processPaymentAndSpend(capId, 150, address(0x999));
    }
}
