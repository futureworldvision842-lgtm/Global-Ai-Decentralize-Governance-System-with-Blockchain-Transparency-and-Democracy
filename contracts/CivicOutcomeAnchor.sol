// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Anchors aggregate audit roots. Individual identity and ballot choices stay off-chain.
contract CivicOutcomeAnchor {
    struct Anchor { bytes32 merkleRoot; uint64 recordCount; uint48 anchoredAt; }
    address public immutable governor;
    mapping(bytes32 => Anchor) public anchors;
    event OutcomeAnchored(bytes32 indexed decisionId, bytes32 indexed merkleRoot, uint64 recordCount);

    constructor(address governorAddress) { require(governorAddress != address(0), "governor required"); governor = governorAddress; }

    function anchorOutcome(bytes32 decisionId, bytes32 merkleRoot, uint64 recordCount) external {
        require(msg.sender == governor, "governor only");
        require(decisionId != bytes32(0) && merkleRoot != bytes32(0) && recordCount > 0, "invalid anchor");
        require(anchors[decisionId].anchoredAt == 0, "already anchored");
        anchors[decisionId] = Anchor(merkleRoot, recordCount, uint48(block.timestamp));
        emit OutcomeAnchored(decisionId, merkleRoot, recordCount);
    }
}
