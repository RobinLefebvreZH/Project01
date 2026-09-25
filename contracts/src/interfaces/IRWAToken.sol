// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IRWAToken
/// @notice Interface of a permissioned ERC-20 representing a real-world asset.
interface IRWAToken {
    /// @notice Description of the underlying real-world asset.
    struct AssetInfo {
        string assetType; // e.g. "Real estate", "Private credit", "Commodity", "Art"
        string jurisdiction; // e.g. "CH", "LU", "US-DE"
        string description; // short human-readable description
        string legalEntity; // issuing SPV / legal owner of the asset
        uint256 valuation; // asset valuation in the smallest unit of `valuationCurrency` (e.g. cents)
        string valuationCurrency; // ISO 4217 code, e.g. "CHF", "USD"
        uint64 valuationTimestamp; // set automatically on update
        string metadataURI; // optional off-chain JSON (e.g. ipfs://...)
    }

    /// @notice A legal document attached to the token (ERC-1643 style).
    struct Document {
        string uri; // e.g. ipfs://<cid>
        bytes32 hash; // keccak256 of the file contents
        uint64 timestamp; // last modification
    }

    struct InitParams {
        string name;
        string symbol;
        uint8 decimals;
        uint256 cap; // 0 = uncapped
        address issuer;
        AssetInfo assetInfo;
    }

    event AllowlistSet(address indexed account, bool allowed, address indexed agent);
    event FrozenSet(address indexed account, bool frozen, address indexed agent);
    event ForcedTransfer(address indexed from, address indexed to, uint256 amount, address indexed agent);
    event AssetInfoUpdated(
        string assetType, string jurisdiction, uint256 valuation, string valuationCurrency
    );
    event ValuationUpdated(uint256 valuation, string currency, uint256 timestamp);
    event DocumentUpdated(bytes32 indexed name, string uri, bytes32 documentHash);
    event DocumentRemoved(bytes32 indexed name, string uri, bytes32 documentHash);

    error ZeroAddress();
    error InvalidDecimals();
    error NotAllowed(address account);
    error AccountFrozen(address account);
    error CapExceeded(uint256 supply, uint256 cap);
    error LengthMismatch();
    error InvalidDocument();

    function initialize(InitParams calldata p) external;

    /// @notice Maximum total supply (0 = uncapped).
    function cap() external view returns (uint256);
    /// @notice Factory that deployed this token.
    function factory() external view returns (address);
    function isAllowed(address account) external view returns (bool);
    function isFrozen(address account) external view returns (bool);
    function assetInfo() external view returns (AssetInfo memory);
    function getDocument(bytes32 name)
        external
        view
        returns (string memory uri, bytes32 hash, uint256 timestamp);
    function getAllDocuments() external view returns (bytes32[] memory);
    /// @notice Whether a regular transfer of `amount` from `from` to `to` would succeed.
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);

    function setAllowed(address account, bool allowed) external;
    function batchSetAllowed(address[] calldata accounts, bool allowed) external;
    function setFrozen(address account, bool frozen) external;
    function mint(address to, uint256 amount) external;
    function batchMint(address[] calldata to, uint256[] calldata amounts) external;
    /// @notice Burn tokens from a holder (e.g. on redemption). Agent only.
    function burn(address from, uint256 amount) external;
    /// @notice Move tokens without the holder's signature (lost keys, court order). Agent only.
    function forcedTransfer(address from, address to, uint256 amount) external;
    function setAssetInfo(AssetInfo calldata info) external;
    function updateValuation(uint256 valuation, string calldata currency) external;
    function setDocument(bytes32 name, string calldata uri, bytes32 hash) external;
    function removeDocument(bytes32 name) external;
}
