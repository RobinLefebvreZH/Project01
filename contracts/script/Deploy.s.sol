// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {RWATokenFactory} from "../src/RWATokenFactory.sol";

/// @notice Deploys the RWATokenFactory (which deploys the token implementation in its constructor).
/// @dev Env:
///      FACTORY_OWNER    - address that will own the factory (use a Safe multisig on mainnet)
///      INITIAL_ISSUERS  - optional comma-separated list of issuer addresses to approve right away
///                         (only possible when the deployer is also FACTORY_OWNER)
///
///      forge script script/Deploy.s.sol --rpc-url sepolia --account deployer --broadcast --verify
contract Deploy is Script {
    function run() external returns (RWATokenFactory factory) {
        address owner = vm.envAddress("FACTORY_OWNER");
        address[] memory issuers = vm.envOr("INITIAL_ISSUERS", ",", new address[](0));

        vm.startBroadcast();
        factory = new RWATokenFactory(owner);
        if (issuers.length > 0) {
            require(msg.sender == owner, "INITIAL_ISSUERS requires deployer == FACTORY_OWNER");
            for (uint256 i; i < issuers.length; ++i) {
                factory.setIssuer(issuers[i], true);
            }
        }
        vm.stopBroadcast();

        console2.log("RWATokenFactory :", address(factory));
        console2.log("Implementation  :", factory.implementation());
        console2.log("Owner           :", owner);
        console2.log("Chain id        :", block.chainid);
    }
}
