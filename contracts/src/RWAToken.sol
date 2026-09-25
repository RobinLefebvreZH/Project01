// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {
    AccessControlUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {IRWAToken} from "./interfaces/IRWAToken.sol";

/// @title RWAToken
/// @notice Permissioned ERC-20 representing a real-world asset.
/// @dev Deployed as an immutable EIP-1167 clone by {RWATokenFactory}.
///      - Only allowlisted (KYC'd) wallets can receive, hold and send tokens.
///      - Agents can freeze wallets, pause all transfers, mint, burn and force transfers.
///      - Asset metadata and legal documents (URI + content hash) are recorded on-chain.
contract RWAToken is IRWAToken, ERC20Upgradeable, PausableUpgradeable, AccessControlUpgradeable {
    /// @notice Role allowed to manage investors, supply and documents. The issuer holds it by default.
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    uint8 private _decimals;

    /// @inheritdoc IRWAToken
    uint256 public cap;

    /// @inheritdoc IRWAToken
    address public factory;

    mapping(address account => bool) private _allowed;
    mapping(address account => bool) private _frozen;

    AssetInfo private _assetInfo;

    mapping(bytes32 name => Document) private _documents;
    bytes32[] private _documentNames;
    mapping(bytes32 name => uint256) private _documentIndex; // index + 1, 0 = absent

    /// @dev Set only for the duration of a forced transfer / burn to bypass pause and freeze checks.
    bool private _forced;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @inheritdoc IRWAToken
    function initialize(InitParams calldata p) external initializer {
        if (p.issuer == address(0)) revert ZeroAddress();
        if (p.decimals > 18) revert InvalidDecimals();

        __ERC20_init(p.name, p.symbol);
        __Pausable_init();
        __AccessControl_init();

        _decimals = p.decimals;
        cap = p.cap;
        factory = msg.sender;
        _setAssetInfo(p.assetInfo);

        _grantRole(DEFAULT_ADMIN_ROLE, p.issuer);
        _grantRole(AGENT_ROLE, p.issuer);
        _setAllowed(p.issuer, true);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @inheritdoc IRWAToken
    function isAllowed(address account) external view returns (bool) {
        return _allowed[account];
    }

    /// @inheritdoc IRWAToken
    function isFrozen(address account) external view returns (bool) {
        return _frozen[account];
    }

    /// @inheritdoc IRWAToken
    function assetInfo() external view returns (AssetInfo memory) {
        return _assetInfo;
    }

    /// @inheritdoc IRWAToken
    function getDocument(bytes32 name)
        external
        view
        returns (string memory uri, bytes32 hash, uint256 timestamp)
    {
        Document storage d = _documents[name];
        return (d.uri, d.hash, d.timestamp);
    }

    /// @inheritdoc IRWAToken
    function getAllDocuments() external view returns (bytes32[] memory) {
        return _documentNames;
    }

    /// @inheritdoc IRWAToken
    function canTransfer(address from, address to, uint256 amount) public view returns (bool) {
        if (paused()) return false;
        if (!_allowed[from] || !_allowed[to]) return false;
        if (_frozen[from] || _frozen[to]) return false;
        return balanceOf(from) >= amount;
    }

    // ---------------------------------------------------------------------
    // Investor management (agent)
    // ---------------------------------------------------------------------

    /// @inheritdoc IRWAToken
    function setAllowed(address account, bool allowed) external onlyRole(AGENT_ROLE) {
        _setAllowed(account, allowed);
    }

    /// @inheritdoc IRWAToken
    function batchSetAllowed(address[] calldata accounts, bool allowed) external onlyRole(AGENT_ROLE) {
        for (uint256 i; i < accounts.length; ++i) {
            _setAllowed(accounts[i], allowed);
        }
    }

    /// @inheritdoc IRWAToken
    function setFrozen(address account, bool frozen) external onlyRole(AGENT_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        _frozen[account] = frozen;
        emit FrozenSet(account, frozen, msg.sender);
    }

    function pause() external onlyRole(AGENT_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(AGENT_ROLE) {
        _unpause();
    }

    // ---------------------------------------------------------------------
    // Supply (agent)
    // ---------------------------------------------------------------------

    /// @inheritdoc IRWAToken
    function mint(address to, uint256 amount) external onlyRole(AGENT_ROLE) {
        _mint(to, amount);
    }

    /// @inheritdoc IRWAToken
    function batchMint(address[] calldata to, uint256[] calldata amounts) external onlyRole(AGENT_ROLE) {
        if (to.length != amounts.length) revert LengthMismatch();
        for (uint256 i; i < to.length; ++i) {
            _mint(to[i], amounts[i]);
        }
    }

    /// @inheritdoc IRWAToken
    function burn(address from, uint256 amount) external onlyRole(AGENT_ROLE) {
        _forced = true;
        _burn(from, amount);
        _forced = false;
    }

    /// @inheritdoc IRWAToken
    function forcedTransfer(address from, address to, uint256 amount) external onlyRole(AGENT_ROLE) {
        if (!_allowed[to]) revert NotAllowed(to);
        _forced = true;
        _transfer(from, to, amount);
        _forced = false;
        emit ForcedTransfer(from, to, amount, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Asset metadata & documents (agent)
    // ---------------------------------------------------------------------

    /// @inheritdoc IRWAToken
    function setAssetInfo(AssetInfo calldata info) external onlyRole(AGENT_ROLE) {
        _setAssetInfo(info);
    }

    /// @inheritdoc IRWAToken
    function updateValuation(uint256 valuation, string calldata currency) external onlyRole(AGENT_ROLE) {
        _assetInfo.valuation = valuation;
        _assetInfo.valuationCurrency = currency;
        _assetInfo.valuationTimestamp = uint64(block.timestamp);
        emit ValuationUpdated(valuation, currency, block.timestamp);
    }

    /// @inheritdoc IRWAToken
    function setDocument(bytes32 name, string calldata uri, bytes32 hash) external onlyRole(AGENT_ROLE) {
        if (name == bytes32(0) || bytes(uri).length == 0) revert InvalidDocument();
        _documents[name] = Document(uri, hash, uint64(block.timestamp));
        if (_documentIndex[name] == 0) {
            _documentNames.push(name);
            _documentIndex[name] = _documentNames.length;
        }
        emit DocumentUpdated(name, uri, hash);
    }

    /// @inheritdoc IRWAToken
    function removeDocument(bytes32 name) external onlyRole(AGENT_ROLE) {
        uint256 idx = _documentIndex[name];
        if (idx == 0) revert InvalidDocument();
        Document memory d = _documents[name];

        uint256 last = _documentNames.length;
        if (idx != last) {
            bytes32 moved = _documentNames[last - 1];
            _documentNames[idx - 1] = moved;
            _documentIndex[moved] = idx;
        }
        _documentNames.pop();
        delete _documentIndex[name];
        delete _documents[name];
        emit DocumentRemoved(name, d.uri, d.hash);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _setAllowed(address account, bool allowed) private {
        if (account == address(0)) revert ZeroAddress();
        _allowed[account] = allowed;
        emit AllowlistSet(account, allowed, msg.sender);
    }

    function _setAssetInfo(AssetInfo memory info) private {
        info.valuationTimestamp = uint64(block.timestamp);
        _assetInfo = info;
        emit AssetInfoUpdated(info.assetType, info.jurisdiction, info.valuation, info.valuationCurrency);
    }

    /// @dev Compliance hook for every balance change.
    ///      Mint:     receiver must be allowlisted and not frozen; token not paused; cap respected.
    ///      Transfer: both parties allowlisted and not frozen; token not paused.
    ///      Burn:     only through {burn}, which is an agent action (bypasses pause/freeze).
    ///      Forced transfers bypass pause and freeze, but the receiver must still be allowlisted.
    function _update(address from, address to, uint256 value) internal override {
        if (!_forced) {
            if (paused()) revert EnforcedPause();
            if (from != address(0)) {
                if (!_allowed[from]) revert NotAllowed(from);
                if (_frozen[from]) revert AccountFrozen(from);
            }
            if (to != address(0)) {
                if (!_allowed[to]) revert NotAllowed(to);
                if (_frozen[to]) revert AccountFrozen(to);
            }
        }
        super._update(from, to, value);
        if (from == address(0) && cap != 0 && totalSupply() > cap) revert CapExceeded(totalSupply(), cap);
    }
}
