// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {VerifiedMemberRegistry} from "./VerifiedMemberRegistry.sol";

/// @notice One verified wallet, one vote. Token balances never determine voting power.
contract CivicGovernorV1 is ReentrancyGuard {
    enum VoteType { Against, For, Abstain }

    struct Proposal {
        address proposer;
        bytes32 metadataHash;
        bytes32 actionsHash;
        uint48 snapshotBlock;
        uint48 voteStart;
        uint48 voteEnd;
        uint48 eta;
        uint64 eligibleSnapshot;
        uint64 againstVotes;
        uint64 forVotes;
        uint64 abstainVotes;
        bool queued;
        bool executed;
        bool canceled;
    }

    VerifiedMemberRegistry public immutable registry;
    uint48 public immutable votingDelay;
    uint48 public immutable votingPeriod;
    uint48 public immutable executionDelay;
    uint16 public immutable quorumBps;
    uint16 public immutable approvalBps;
    uint256 public proposalCount;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, bytes32 metadataHash, bytes32 actionsHash, uint48 voteStart, uint48 voteEnd, uint64 eligibleSnapshot);
    event VoteCast(uint256 indexed proposalId, address indexed voter, VoteType choice);
    event ProposalQueued(uint256 indexed proposalId, uint48 eta);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);

    constructor(VerifiedMemberRegistry memberRegistry, uint48 delaySeconds, uint48 periodSeconds, uint48 timelockSeconds, uint16 requiredQuorumBps, uint16 requiredApprovalBps) {
        require(address(memberRegistry) != address(0), "registry required");
        require(periodSeconds > 0 && requiredQuorumBps <= 10_000 && requiredApprovalBps <= 10_000, "invalid policy");
        registry = memberRegistry;
        votingDelay = delaySeconds;
        votingPeriod = periodSeconds;
        executionDelay = timelockSeconds;
        quorumBps = requiredQuorumBps;
        approvalBps = requiredApprovalBps;
    }

    receive() external payable {}

    function hashActions(address[] calldata targets, uint256[] calldata values, bytes[] calldata calldatas) public pure returns (bytes32) {
        return keccak256(abi.encode(targets, values, calldatas));
    }

    function propose(bytes32 metadataHash, bytes32 actionsHash) external returns (uint256 proposalId) {
        uint48 snapshot = uint48(block.number - 1);
        require(registry.isEligibleAt(msg.sender, snapshot), "member required");
        uint256 eligible = registry.activeMemberCountAt(snapshot);
        require(eligible > 0 && eligible <= type(uint64).max, "invalid electorate");
        proposalId = ++proposalCount;
        uint48 start = uint48(block.timestamp) + votingDelay;
        uint48 end = start + votingPeriod;
        proposals[proposalId] = Proposal({proposer:msg.sender,metadataHash:metadataHash,actionsHash:actionsHash,snapshotBlock:snapshot,voteStart:start,voteEnd:end,eta:0,eligibleSnapshot:uint64(eligible),againstVotes:0,forVotes:0,abstainVotes:0,queued:false,executed:false,canceled:false});
        emit ProposalCreated(proposalId, msg.sender, metadataHash, actionsHash, start, end, uint64(eligible));
    }

    function castVote(uint256 proposalId, VoteType choice) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposer != address(0) && !proposal.canceled, "unknown proposal");
        require(block.timestamp >= proposal.voteStart && block.timestamp < proposal.voteEnd, "voting closed");
        require(registry.isEligibleAt(msg.sender, proposal.snapshotBlock), "not in snapshot");
        require(!hasVoted[proposalId][msg.sender], "already voted");
        hasVoted[proposalId][msg.sender] = true;
        if (choice == VoteType.For) proposal.forVotes += 1;
        else if (choice == VoteType.Against) proposal.againstVotes += 1;
        else proposal.abstainVotes += 1;
        emit VoteCast(proposalId, msg.sender, choice);
    }

    function result(uint256 proposalId) public view returns (bool quorumMet, bool approvalMet, bool passed) {
        Proposal storage proposal = proposals[proposalId];
        uint256 cast = uint256(proposal.forVotes) + proposal.againstVotes + proposal.abstainVotes;
        uint256 decisive = uint256(proposal.forVotes) + proposal.againstVotes;
        quorumMet = cast * 10_000 >= uint256(proposal.eligibleSnapshot) * quorumBps;
        approvalMet = decisive > 0 && uint256(proposal.forVotes) * 10_000 >= decisive * approvalBps;
        passed = quorumMet && approvalMet;
    }

    function queue(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.voteEnd && !proposal.queued && !proposal.canceled, "not queueable");
        (,,bool passed) = result(proposalId);
        require(passed, "proposal failed");
        proposal.queued = true;
        proposal.eta = uint48(block.timestamp) + executionDelay;
        emit ProposalQueued(proposalId, proposal.eta);
    }

    function execute(uint256 proposalId, address[] calldata targets, uint256[] calldata values, bytes[] calldata calldatas) external payable nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.queued && !proposal.executed && !proposal.canceled && block.timestamp >= proposal.eta, "not executable");
        require(targets.length == values.length && targets.length == calldatas.length, "length mismatch");
        require(hashActions(targets, values, calldatas) == proposal.actionsHash, "actions mismatch");
        proposal.executed = true;
        for (uint256 i = 0; i < targets.length; i++) {
            (bool ok, bytes memory response) = targets[i].call{value: values[i]}(calldatas[i]);
            if (!ok) assembly { revert(add(response, 32), mload(response)) }
        }
        emit ProposalExecuted(proposalId);
    }

    function cancelBeforeVoting(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(msg.sender == proposal.proposer && block.timestamp < proposal.voteStart && !proposal.queued, "cannot cancel");
        proposal.canceled = true;
        emit ProposalCanceled(proposalId);
    }
}
