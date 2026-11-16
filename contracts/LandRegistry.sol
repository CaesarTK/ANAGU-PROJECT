// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "./LandTitleNFT.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title LandRegistry
 * @notice Orchestrates verified land registration transactions, NFT issuance,
 *         and registry-controlled transfers on the PoA-QBFT-DPoS Besu network.
 */
contract LandRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    LandTitleNFT public immutable titleNft;

    struct RegistrationLog {
        bytes32 applicationId;
        bytes32 parcelIdHash;
        bytes32 spatialHash;
        bytes32 oracleHash;
        uint256 tokenId;
        uint64 recordedAt;
    }

    mapping(bytes32 => RegistrationLog) public registrations;

    event LandRegistered(
        bytes32 indexed applicationId,
        bytes32 indexed parcelIdHash,
        uint256 indexed tokenId,
        address owner
    );

    constructor(address _titleNft, address admin, address registrar, address governor) {
        titleNft = LandTitleNFT(_titleNft);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, registrar);
        _grantRole(GOVERNOR_ROLE, governor);
    }

    function executeRegistration(
        bytes32 applicationId,
        address owner,
        bytes32 parcelIdHash,
        bytes32 spatialHash,
        bytes32 oracleHash
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256 tokenId) {
        require(registrations[applicationId].tokenId == 0, "LandRegistry: already registered");
        tokenId = titleNft.mintTitle(owner, parcelIdHash, spatialHash, oracleHash);

        registrations[applicationId] = RegistrationLog({
            applicationId: applicationId,
            parcelIdHash: parcelIdHash,
            spatialHash: spatialHash,
            oracleHash: oracleHash,
            tokenId: tokenId,
            recordedAt: uint64(block.timestamp)
        });

        emit LandRegistered(applicationId, parcelIdHash, tokenId, owner);
    }

    function transferTitle(address from, address to, uint256 tokenId)
        external
        onlyRole(REGISTRAR_ROLE)
    {
        titleNft.registryTransfer(from, to, tokenId);
    }
}
