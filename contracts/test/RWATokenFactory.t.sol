// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./Base.t.sol";
import {RWATokenFactory} from "../src/RWATokenFactory.sol";
import {RWAToken} from "../src/RWAToken.sol";
import {IRWAToken} from "../src/interfaces/IRWAToken.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract RWATokenFactoryTest is BaseTest {
    function test_ownerAndImplementation() public view {
        assertEq(factory.owner(), owner);
        assertTrue(factory.implementation().code.length > 0);
    }

    function test_createToken_setsEverything() public view {
        assertEq(token.name(), "Zurich Office Building");
        assertEq(token.symbol(), "ZOB");
        assertEq(token.decimals(), 18);
        assertEq(token.cap(), CAP);
        assertEq(token.factory(), address(factory));
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), issuer));
        assertTrue(token.hasRole(token.AGENT_ROLE(), issuer));
        assertTrue(token.isAllowed(issuer));
        assertFalse(token.hasRole(token.DEFAULT_ADMIN_ROLE(), owner));

        IRWAToken.AssetInfo memory info = token.assetInfo();
        assertEq(info.assetType, "Real estate");
        assertEq(info.jurisdiction, "CH");
        assertEq(info.valuation, 25_000_000_00);
        assertEq(info.valuationTimestamp, block.timestamp);

        assertEq(factory.tokenCount(), 1);
        assertEq(factory.allTokens()[0], address(token));
        assertEq(factory.tokensOf(issuer)[0], address(token));
        assertTrue(factory.isFactoryToken(address(token)));
        assertEq(factory.tokenBySymbol(keccak256("ZOB")), address(token));
    }

    function test_createToken_emitsEvent() public {
        vm.expectEmit(false, true, false, true, address(factory));
        emit RWATokenFactory.TokenCreated(address(0), issuer, "Gold Bar Vault", "GOLD", "Real estate", 1);
        vm.prank(issuer);
        factory.createToken(_params("Gold Bar Vault", "GOLD", 0));
    }

    function test_createToken_revertsForNonIssuer() public {
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(RWATokenFactory.NotIssuer.selector, eve));
        factory.createToken(_params("X", "X", 0));
    }

    function test_createToken_revertsWhenRevoked() public {
        vm.prank(owner);
        factory.setIssuer(issuer, false);
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(RWATokenFactory.NotIssuer.selector, issuer));
        factory.createToken(_params("X", "X", 0));
    }

    function test_createToken_revertsOnDuplicateSymbol() public {
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(RWATokenFactory.SymbolTaken.selector, "ZOB"));
        factory.createToken(_params("Other", "ZOB", 0));
    }

    function test_createToken_revertsOnEmptyName() public {
        vm.prank(issuer);
        vm.expectRevert(RWATokenFactory.EmptyNameOrSymbol.selector);
        factory.createToken(_params("", "ABC", 0));
    }

    function test_createToken_revertsOnBadDecimals() public {
        RWATokenFactory.CreateParams memory p = _params("Bad", "BAD", 0);
        p.decimals = 19;
        vm.prank(issuer);
        vm.expectRevert(IRWAToken.InvalidDecimals.selector);
        factory.createToken(p);
    }

    function test_setIssuer_onlyOwner() public {
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, eve));
        factory.setIssuer(eve, true);
    }

    function test_setIssuer_revertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(RWATokenFactory.ZeroAddress.selector);
        factory.setIssuer(address(0), true);
    }

    function test_ownershipTransferIsTwoStep() public {
        vm.prank(owner);
        factory.transferOwnership(alice);
        assertEq(factory.owner(), owner);
        vm.prank(alice);
        factory.acceptOwnership();
        assertEq(factory.owner(), alice);
    }

    function test_implementationCannotBeInitialized() public {
        RWAToken impl = RWAToken(factory.implementation());
        IRWAToken.InitParams memory p = IRWAToken.InitParams({
            name: "X", symbol: "X", decimals: 18, cap: 0, issuer: eve, assetInfo: _assetInfo()
        });
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        impl.initialize(p);
    }

    function test_cloneCannotBeReinitialized() public {
        IRWAToken.InitParams memory p = IRWAToken.InitParams({
            name: "X", symbol: "X", decimals: 18, cap: 0, issuer: eve, assetInfo: _assetInfo()
        });
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        token.initialize(p);
    }

    function test_pagination() public {
        vm.startPrank(issuer);
        factory.createToken(_params("A", "A", 0));
        factory.createToken(_params("B", "B", 0));
        vm.stopPrank();

        address[] memory page = factory.tokensPaginated(1, 10);
        assertEq(page.length, 2);
        assertEq(factory.tokensPaginated(3, 10).length, 0);
        assertEq(factory.tokensPaginated(0, 2).length, 2);
    }

    function test_clonesAreIndependent() public {
        vm.prank(owner);
        factory.setIssuer(alice, true);
        vm.prank(alice);
        RWAToken t2 = RWAToken(factory.createToken(_params("Alice Fund", "AF", 0)));

        assertTrue(t2.hasRole(t2.AGENT_ROLE(), alice));
        assertFalse(t2.hasRole(t2.AGENT_ROLE(), issuer));
        vm.prank(issuer);
        vm.expectRevert();
        t2.mint(issuer, 1);
    }
}
