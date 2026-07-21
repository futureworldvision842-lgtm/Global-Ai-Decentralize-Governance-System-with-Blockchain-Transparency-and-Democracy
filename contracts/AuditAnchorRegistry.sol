// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Publishes existence receipts for off-chain GAIGS audit batches.
/// @dev An anchor proves only that a publisher recorded a root at a block time.
///      It does not validate the truth, legality, or governance outcome of data.
contract AuditAnchorRegistry {
    struct Anchor {
        bytes32 scopeHash;
        uint64 anchoredAt;
        address publisher;
        string metadataUri;
    }

    address public owner;
    address public pendingOwner;
    mapping(bytes32 => Anchor) private anchors;

    event RootAnchored(bytes32 indexed merkleRoot, bytes32 indexed scopeHash, address indexed publisher, string metadataUri);
    event OwnershipTransferStarted(address indexed currentOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error InvalidRoot();
    error AlreadyAnchored();
    error InvalidOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert InvalidOwner();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function anchor(bytes32 merkleRoot, bytes32 scopeHash, string calldata metadataUri) external onlyOwner {
        if (merkleRoot == bytes32(0)) revert InvalidRoot();
        if (anchors[merkleRoot].anchoredAt != 0) revert AlreadyAnchored();
        anchors[merkleRoot] = Anchor({scopeHash: scopeHash, anchoredAt: uint64(block.timestamp), publisher: msg.sender, metadataUri: metadataUri});
        emit RootAnchored(merkleRoot, scopeHash, msg.sender, metadataUri);
    }

    function getAnchor(bytes32 merkleRoot) external view returns (Anchor memory) {
        return anchors[merkleRoot];
    }

    function beginOwnershipTransfer(address nextOwner) external onlyOwner {
        if (nextOwner == address(0)) revert InvalidOwner();
        pendingOwner = nextOwner;
        emit OwnershipTransferStarted(owner, nextOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address previous = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(previous, owner);
    }
}
