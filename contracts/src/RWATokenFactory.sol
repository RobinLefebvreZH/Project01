// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IRWAToken} from "./interfaces/IRWAToken.sol";
import {RWAToken} from "./RWAToken.sol";

/// @title RWATokenFactory
/// @notice Deploys permissioned RWA tokens as immutable EIP-1167 clones of a single implementation.
///         Only issuers approved by the platform owner can create tokens.
contract RWATokenFactory is Ownable2Step {
    /// @notice Token implementation every clone delegates to. Deployed once, never changes.
    address public immutable implementation;

    mapping(address issuer => bool) public isIssuer;
    mapping(address token => bool) public isFactoryToken;
    mapping(bytes32 symbolHash => address token) public tokenBySymbol;

    address[] private _tokens;
    mapping(address issuer => address[]) private _tokensByIssuer;

    struct CreateParams {
        string name;
        string symbol;
        uint8 decimals;
        uint256 cap;
        IRWAToken.AssetInfo assetInfo;
    }

    event IssuerSet(address indexed issuer, bool approved);
    event TokenCreated(
        address indexed token,
        address indexed issuer,
        string name,
        string symbol,
        string assetType,
        uint256 index
    );

    error NotIssuer(address account);
    error SymbolTaken(string symbol);
    error EmptyNameOrSymbol();
    error ZeroAddress();

    constructor(address initialOwner) Ownable(initialOwner) {
        implementation = address(new RWAToken());
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    /// @notice Approve or revoke an issuer. Revoking does not affect tokens already created.
    function setIssuer(address issuer, bool approved) external onlyOwner {
        if (issuer == address(0)) revert ZeroAddress();
        isIssuer[issuer] = approved;
        emit IssuerSet(issuer, approved);
    }

    // ---------------------------------------------------------------------
    // Issuers
    // ---------------------------------------------------------------------

    /// @notice Create a new RWA token. The caller becomes its admin and agent.
    function createToken(CreateParams calldata p) external returns (address token) {
        if (!isIssuer[msg.sender]) revert NotIssuer(msg.sender);
        if (bytes(p.name).length == 0 || bytes(p.symbol).length == 0) revert EmptyNameOrSymbol();

        bytes32 symbolHash = keccak256(bytes(p.symbol));
        if (tokenBySymbol[symbolHash] != address(0)) revert SymbolTaken(p.symbol);

        token = Clones.clone(implementation);
        IRWAToken(token)
            .initialize(
                IRWAToken.InitParams({
                name: p.name,
                symbol: p.symbol,
                decimals: p.decimals,
                cap: p.cap,
                issuer: msg.sender,
                assetInfo: p.assetInfo
            })
            );

        tokenBySymbol[symbolHash] = token;
        isFactoryToken[token] = true;
        _tokens.push(token);
        _tokensByIssuer[msg.sender].push(token);

        emit TokenCreated(token, msg.sender, p.name, p.symbol, p.assetInfo.assetType, _tokens.length - 1);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function tokenCount() external view returns (uint256) {
        return _tokens.length;
    }

    function allTokens() external view returns (address[] memory) {
        return _tokens;
    }

    /// @notice Paginated token list for large registries.
    function tokensPaginated(uint256 offset, uint256 limit) external view returns (address[] memory page) {
        uint256 len = _tokens.length;
        if (offset >= len) return new address[](0);
        uint256 end = offset + limit > len ? len : offset + limit;
        page = new address[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = _tokens[i];
        }
    }

    function tokensOf(address issuer) external view returns (address[] memory) {
        return _tokensByIssuer[issuer];
    }
}
