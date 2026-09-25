// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {RWATokenFactory} from "../src/RWATokenFactory.sol";
import {RWAToken} from "../src/RWAToken.sol";
import {IRWAToken} from "../src/interfaces/IRWAToken.sol";

abstract contract BaseTest is Test {
    RWATokenFactory internal factory;
    RWAToken internal token;

    address internal owner = makeAddr("owner");
    address internal issuer = makeAddr("issuer");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal eve = makeAddr("eve");

    uint256 internal constant CAP = 1_000_000e18;

    function setUp() public virtual {
        factory = new RWATokenFactory(owner);
        vm.prank(owner);
        factory.setIssuer(issuer, true);

        vm.prank(issuer);
        token = RWAToken(factory.createToken(_params("Zurich Office Building", "ZOB", CAP)));
    }

    function _assetInfo() internal pure returns (IRWAToken.AssetInfo memory) {
        return IRWAToken.AssetInfo({
            assetType: "Real estate",
            jurisdiction: "CH",
            description: "Office building, Bahnhofstrasse, Zurich",
            legalEntity: "ZOB Property AG",
            valuation: 25_000_000_00,
            valuationCurrency: "CHF",
            valuationTimestamp: 0,
            metadataURI: "ipfs://bafyMetadata"
        });
    }

    function _params(string memory name, string memory symbol, uint256 cap)
        internal
        pure
        returns (RWATokenFactory.CreateParams memory)
    {
        return RWATokenFactory.CreateParams({
            name: name, symbol: symbol, decimals: 18, cap: cap, assetInfo: _assetInfo()
        });
    }

    function _allow(address a) internal {
        vm.prank(issuer);
        token.setAllowed(a, true);
    }

    function _allowAndMint(address a, uint256 amount) internal {
        vm.startPrank(issuer);
        token.setAllowed(a, true);
        token.mint(a, amount);
        vm.stopPrank();
    }
}
