// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title LandTitleNFT
 * @notice ERC-721 digital land title with disabled peer-to-peer transfers,
 *         registry-controlled conveyance, and Nigeria Land Use Act (1978)
 *         Section 28 statutory revocation restricted exclusively to GOVERNOR_ROLE.
 */
contract LandTitleNFT is ERC721, AccessControl {
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    enum RevocationGround {
        OverridingPublicInterest,
        BreachOfStatutoryCondition
    }

    struct TitleRecord {
        bytes32 parcelIdHash;     // S_id: 256 bits
        bytes32 spatialHash;      // S_geom: 256 bits (keccak256 of WGS 84 WKT/GeoJSON)
        bytes32 oracleHash;       // S_oracle: 256 bits (community + institutional attestation)
        uint64 issuedAt;          // S_time: 64 bits
        uint64 revokedAt;         // 0 if active
        bool revoked;             // Statutory Section 28 state
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 => TitleRecord) public titleRecords;
    mapping(uint256 => bool) public isRevoked;
    mapping(bytes32 => uint256) public parcelToToken;

    event TitleIssued(
        uint256 indexed tokenId,
        bytes32 indexed parcelIdHash,
        bytes32 spatialHash,
        address indexed owner,
        uint64 timestamp
    );

    event RegistryTransferCompleted(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        address registrar,
        uint64 timestamp
    );

    event TitleRevoked(
        uint256 indexed tokenId,
        RevocationGround ground,
        address indexed revokedBy,
        uint256 timestamp
    );

    constructor(address admin, address governorAddress, address registrarAddress)
        ERC721("ANAGU Land Title", "ANAGU")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNOR_ROLE, governorAddress);
        _grantRole(REGISTRAR_ROLE, registrarAddress);
    }

    function mintTitle(
        address to,
        bytes32 parcelIdHash,
        bytes32 spatialHash,
        bytes32 oracleHash
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256 tokenId) {
        require(to != address(0), "LandTitleNFT: zero owner address");
        require(parcelToToken[parcelIdHash] == 0, "LandTitleNFT: parcel already tokenised");

        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        uint64 ts = uint64(block.timestamp);
        titleRecords[tokenId] = TitleRecord({
            parcelIdHash: parcelIdHash,
            spatialHash: spatialHash,
            oracleHash: oracleHash,
            issuedAt: ts,
            revokedAt: 0,
            revoked: false
        });
        parcelToToken[parcelIdHash] = tokenId;

        emit TitleIssued(tokenId, parcelIdHash, spatialHash, to, ts);
    }

    /**
     * @notice Registry-controlled transfer only; direct owner-initiated P2P transfers are disabled.
     */
    function registryTransfer(address from, address to, uint256 tokenId)
        external
        onlyRole(REGISTRAR_ROLE)
    {
        require(_ownerOf(tokenId) != address(0), "LandTitleNFT: token does not exist");
        require(!isRevoked[tokenId], "LandTitleNFT: token is revoked");
        require(ownerOf(tokenId) == from, "LandTitleNFT: from is not current owner");
        require(to != address(0), "LandTitleNFT: zero recipient");

        _update(to, tokenId, address(0));
        emit RegistryTransferCompleted(tokenId, from, to, msg.sender, uint64(block.timestamp));
    }

    /**
     * @notice Statutory revocation under Nigeria Land Use Act (1978), Section 28.
     *         Restricted exclusively to GOVERNOR_ROLE. Preserves issuance history and
     *         emits an immutable TitleRevoked audit event.
     */
    function revoke(uint256 tokenId, RevocationGround ground)
        external
        onlyRole(GOVERNOR_ROLE)
    {
        require(_ownerOf(tokenId) != address(0), "LandTitleNFT: token does not exist");
        require(!isRevoked[tokenId], "LandTitleNFT: already revoked");

        isRevoked[tokenId] = true;
        titleRecords[tokenId].revoked = true;
        titleRecords[tokenId].revokedAt = uint64(block.timestamp);

        emit TitleRevoked(tokenId, ground, msg.sender, block.timestamp);
    }

    /**
     * @dev Disable all direct peer-to-peer owner transfers; only Registrar-authorised
     *      registryTransfer() or initial minting is permitted.
     */
    function transferFrom(address, address, uint256) public pure override {
        revert("LandTitleNFT: direct P2P transfers disabled; use LandRegistry");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert("LandTitleNFT: direct P2P transfers disabled; use LandRegistry");
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        require(!isRevoked[tokenId], "LandTitleNFT: token is revoked");
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
