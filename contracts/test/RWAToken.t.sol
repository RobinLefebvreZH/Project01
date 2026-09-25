// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./Base.t.sol";
import {IRWAToken} from "../src/interfaces/IRWAToken.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

contract RWATokenTest is BaseTest {
    // ------------------------------------------------------------------ allowlist

    function test_mint_requiresAllowlist() public {
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(IRWAToken.NotAllowed.selector, alice));
        token.mint(alice, 1e18);
    }

    function test_mint_toAllowed() public {
        _allowAndMint(alice, 100e18);
        assertEq(token.balanceOf(alice), 100e18);
        assertEq(token.totalSupply(), 100e18);
    }

    function test_transfer_betweenAllowed() public {
        _allowAndMint(alice, 100e18);
        _allow(bob);
        vm.prank(alice);
        token.transfer(bob, 40e18);
        assertEq(token.balanceOf(bob), 40e18);
    }

    function test_transfer_toNonAllowedReverts() public {
        _allowAndMint(alice, 100e18);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IRWAToken.NotAllowed.selector, eve));
        token.transfer(eve, 1e18);
    }

    function test_transfer_fromRemovedHolderReverts() public {
        _allowAndMint(alice, 100e18);
        _allow(bob);
        vm.prank(issuer);
        token.setAllowed(alice, false);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IRWAToken.NotAllowed.selector, alice));
        token.transfer(bob, 1e18);
    }

    function test_transferFrom_enforcesCompliance() public {
        _allowAndMint(alice, 100e18);
        vm.prank(alice);
        token.approve(bob, 50e18);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IRWAToken.NotAllowed.selector, eve));
        token.transferFrom(alice, eve, 10e18);
    }

    function test_batchSetAllowed() public {
        address[] memory list = new address[](2);
        list[0] = alice;
        list[1] = bob;
        vm.prank(issuer);
        token.batchSetAllowed(list, true);
        assertTrue(token.isAllowed(alice));
        assertTrue(token.isAllowed(bob));
    }

    function test_setAllowed_onlyAgent() public {
        bytes32 role = token.AGENT_ROLE();
        vm.prank(eve);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, eve, role)
        );
        token.setAllowed(eve, true);
    }

    function test_setAllowed_zeroAddressReverts() public {
        vm.prank(issuer);
        vm.expectRevert(IRWAToken.ZeroAddress.selector);
        token.setAllowed(address(0), true);
    }

    // ------------------------------------------------------------------ freeze

    function test_frozenSenderCannotTransfer() public {
        _allowAndMint(alice, 100e18);
        _allow(bob);
        vm.prank(issuer);
        token.setFrozen(alice, true);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IRWAToken.AccountFrozen.selector, alice));
        token.transfer(bob, 1e18);
    }

    function test_frozenReceiverCannotReceive() public {
        _allowAndMint(alice, 100e18);
        _allow(bob);
        vm.prank(issuer);
        token.setFrozen(bob, true);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IRWAToken.AccountFrozen.selector, bob));
        token.transfer(bob, 1e18);
    }

    function test_unfreezeRestoresTransfers() public {
        _allowAndMint(alice, 100e18);
        _allow(bob);
        vm.startPrank(issuer);
        token.setFrozen(alice, true);
        token.setFrozen(alice, false);
        vm.stopPrank();
        vm.prank(alice);
        token.transfer(bob, 1e18);
        assertEq(token.balanceOf(bob), 1e18);
    }

    // ------------------------------------------------------------------ pause

    function test_pauseBlocksTransfersAndMint() public {
        _allowAndMint(alice, 100e18);
        _allow(bob);
        vm.prank(issuer);
        token.pause();

        vm.prank(alice);
        vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
        token.transfer(bob, 1e18);

        vm.prank(issuer);
        vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
        token.mint(alice, 1e18);

        vm.prank(issuer);
        token.unpause();
        vm.prank(alice);
        token.transfer(bob, 1e18);
    }

    function test_pause_onlyAgent() public {
        vm.prank(eve);
        vm.expectRevert();
        token.pause();
    }

    // ------------------------------------------------------------------ supply

    function test_capEnforced() public {
        _allow(alice);
        vm.startPrank(issuer);
        token.mint(alice, CAP);
        vm.expectRevert(abi.encodeWithSelector(IRWAToken.CapExceeded.selector, CAP + 1, CAP));
        token.mint(alice, 1);
        vm.stopPrank();
    }

    function test_uncappedToken() public {
        vm.prank(issuer);
        IRWAToken t = IRWAToken(factory.createToken(_params("Uncapped", "UNC", 0)));
        vm.startPrank(issuer);
        t.setAllowed(alice, true);
        t.mint(alice, type(uint128).max);
        vm.stopPrank();
    }

    function test_batchMint() public {
        _allow(alice);
        _allow(bob);
        address[] memory to = new address[](2);
        to[0] = alice;
        to[1] = bob;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10e18;
        amounts[1] = 20e18;
        vm.prank(issuer);
        token.batchMint(to, amounts);
        assertEq(token.balanceOf(alice), 10e18);
        assertEq(token.balanceOf(bob), 20e18);
    }

    function test_batchMint_lengthMismatch() public {
        address[] memory to = new address[](2);
        uint256[] memory amounts = new uint256[](1);
        vm.prank(issuer);
        vm.expectRevert(IRWAToken.LengthMismatch.selector);
        token.batchMint(to, amounts);
    }

    function test_burn_worksEvenWhenFrozenOrPaused() public {
        _allowAndMint(alice, 100e18);
        vm.startPrank(issuer);
        token.setFrozen(alice, true);
        token.pause();
        token.burn(alice, 30e18);
        vm.stopPrank();
        assertEq(token.balanceOf(alice), 70e18);
        assertEq(token.totalSupply(), 70e18);
    }

    function test_burn_onlyAgent() public {
        _allowAndMint(alice, 100e18);
        vm.prank(alice);
        vm.expectRevert();
        token.burn(alice, 1e18);
    }

    function test_mint_onlyAgent() public {
        _allow(alice);
        vm.prank(alice);
        vm.expectRevert();
        token.mint(alice, 1e18);
    }

    // ------------------------------------------------------------------ forced transfer

    function test_forcedTransfer_recoversFromFrozenWallet() public {
        _allowAndMint(alice, 100e18);
        _allow(bob);
        vm.startPrank(issuer);
        token.setFrozen(alice, true);
        vm.expectEmit(true, true, true, true, address(token));
        emit IRWAToken.ForcedTransfer(alice, bob, 100e18, issuer);
        token.forcedTransfer(alice, bob, 100e18);
        vm.stopPrank();
        assertEq(token.balanceOf(bob), 100e18);
        assertEq(token.balanceOf(alice), 0);
    }

    function test_forcedTransfer_receiverMustBeAllowed() public {
        _allowAndMint(alice, 100e18);
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(IRWAToken.NotAllowed.selector, eve));
        token.forcedTransfer(alice, eve, 1e18);
    }

    function test_forcedTransfer_onlyAgent() public {
        _allowAndMint(alice, 100e18);
        _allow(bob);
        vm.prank(bob);
        vm.expectRevert();
        token.forcedTransfer(alice, bob, 1e18);
    }

    function test_forcedFlagResetAfterForcedTransfer() public {
        _allowAndMint(alice, 100e18);
        _allow(bob);
        vm.startPrank(issuer);
        token.setFrozen(alice, true);
        token.forcedTransfer(alice, bob, 1e18);
        vm.stopPrank();
        // regular transfer from the frozen wallet must still fail
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IRWAToken.AccountFrozen.selector, alice));
        token.transfer(bob, 1e18);
    }

    // ------------------------------------------------------------------ canTransfer

    function test_canTransfer() public {
        _allowAndMint(alice, 100e18);
        _allow(bob);
        assertTrue(token.canTransfer(alice, bob, 100e18));
        assertFalse(token.canTransfer(alice, bob, 101e18));
        assertFalse(token.canTransfer(alice, eve, 1e18));
        vm.prank(issuer);
        token.setFrozen(bob, true);
        assertFalse(token.canTransfer(alice, bob, 1e18));
    }

    // ------------------------------------------------------------------ roles

    function test_issuerCanAddAgent() public {
        bytes32 agentRole = token.AGENT_ROLE();
        vm.prank(issuer);
        token.grantRole(agentRole, bob);
        vm.prank(bob);
        token.setAllowed(alice, true);
        assertTrue(token.isAllowed(alice));
    }

    function test_agentCannotGrantRoles() public {
        bytes32 agentRole = token.AGENT_ROLE();
        vm.prank(issuer);
        token.grantRole(agentRole, bob);
        vm.prank(bob);
        vm.expectRevert();
        token.grantRole(agentRole, eve);
    }

    // ------------------------------------------------------------------ asset info & documents

    function test_updateValuation() public {
        vm.warp(block.timestamp + 30 days);
        vm.prank(issuer);
        token.updateValuation(26_000_000_00, "CHF");
        IRWAToken.AssetInfo memory info = token.assetInfo();
        assertEq(info.valuation, 26_000_000_00);
        assertEq(info.valuationTimestamp, block.timestamp);
        assertEq(info.assetType, "Real estate");
    }

    function test_setAssetInfo() public {
        IRWAToken.AssetInfo memory info = _assetInfo();
        info.description = "Updated";
        vm.prank(issuer);
        token.setAssetInfo(info);
        assertEq(token.assetInfo().description, "Updated");
    }

    function test_setAssetInfo_onlyAgent() public {
        vm.prank(eve);
        vm.expectRevert();
        token.setAssetInfo(_assetInfo());
    }

    function test_documents_addUpdateRemove() public {
        bytes32 prospectus = "prospectus";
        bytes32 deed = "land-registry-deed";
        bytes32 audit = "audit-2026";

        vm.startPrank(issuer);
        token.setDocument(prospectus, "ipfs://p1", keccak256("p1"));
        token.setDocument(deed, "ipfs://d1", keccak256("d1"));
        token.setDocument(audit, "ipfs://a1", keccak256("a1"));
        token.setDocument(prospectus, "ipfs://p2", keccak256("p2")); // update, no duplicate
        vm.stopPrank();

        bytes32[] memory names = token.getAllDocuments();
        assertEq(names.length, 3);
        (string memory uri, bytes32 h,) = token.getDocument(prospectus);
        assertEq(uri, "ipfs://p2");
        assertEq(h, keccak256("p2"));

        vm.prank(issuer);
        token.removeDocument(prospectus);
        names = token.getAllDocuments();
        assertEq(names.length, 2);
        assertEq(names[0], audit); // last element moved into the gap
        assertEq(names[1], deed);
        (uri,,) = token.getDocument(prospectus);
        assertEq(bytes(uri).length, 0);

        vm.startPrank(issuer);
        token.removeDocument(audit);
        token.removeDocument(deed);
        vm.stopPrank();
        assertEq(token.getAllDocuments().length, 0);
    }

    function test_setDocument_invalid() public {
        vm.startPrank(issuer);
        vm.expectRevert(IRWAToken.InvalidDocument.selector);
        token.setDocument(bytes32(0), "ipfs://x", 0);
        vm.expectRevert(IRWAToken.InvalidDocument.selector);
        token.setDocument("x", "", 0);
        vm.expectRevert(IRWAToken.InvalidDocument.selector);
        token.removeDocument("missing");
        vm.stopPrank();
    }

    function test_setDocument_onlyAgent() public {
        vm.prank(eve);
        vm.expectRevert();
        token.setDocument("x", "ipfs://x", 0);
    }

    // ------------------------------------------------------------------ fuzz

    function testFuzz_transferConservesSupply(uint256 minted, uint256 sent) public {
        minted = bound(minted, 1, CAP);
        sent = bound(sent, 0, minted);
        _allowAndMint(alice, minted);
        _allow(bob);
        vm.prank(alice);
        token.transfer(bob, sent);
        assertEq(token.balanceOf(alice) + token.balanceOf(bob), minted);
        assertEq(token.totalSupply(), minted);
    }

    function testFuzz_nonAllowedNeverReceives(address receiver, uint256 amount) public {
        vm.assume(receiver != address(0) && receiver != issuer && receiver != alice);
        amount = bound(amount, 1, CAP);
        _allowAndMint(alice, amount);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IRWAToken.NotAllowed.selector, receiver));
        token.transfer(receiver, amount);
    }

    function testFuzz_mintNeverExceedsCap(uint256 a, uint256 b) public {
        a = bound(a, 0, CAP);
        b = bound(b, 0, CAP);
        _allow(alice);
        vm.startPrank(issuer);
        token.mint(alice, a);
        if (a + b > CAP) {
            vm.expectRevert(abi.encodeWithSelector(IRWAToken.CapExceeded.selector, a + b, CAP));
        }
        token.mint(alice, b);
        vm.stopPrank();
        assertLe(token.totalSupply(), CAP);
    }

    function testFuzz_onlyAgentCanMint(address caller) public {
        vm.assume(caller != issuer);
        _allow(alice);
        bytes32 role = token.AGENT_ROLE();
        vm.prank(caller);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, caller, role)
        );
        token.mint(alice, 1);
    }
}
