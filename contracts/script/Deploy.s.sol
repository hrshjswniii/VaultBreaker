// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CapabilityRegistry} from "../src/CapabilityRegistry.sol";
import {X402FacilitatorAdapter} from "../src/X402FacilitatorAdapter.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);

        console.log("Deploying Vaultbreaker contracts with deployer:", deployerAddress);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy CapabilityRegistry
        CapabilityRegistry registry = new CapabilityRegistry(deployerAddress);
        console.log("CapabilityRegistry deployed at:", address(registry));

        // 2. Deploy X402FacilitatorAdapter
        X402FacilitatorAdapter adapter = new X402FacilitatorAdapter(address(registry), deployerAddress);
        console.log("X402FacilitatorAdapter deployed at:", address(adapter));

        // 3. Authorize Facilitator Adapter in Registry
        registry.setFacilitator(address(adapter), true);
        console.log("Authorized adapter in CapabilityRegistry");

        vm.stopBroadcast();
    }
}
