// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Per-project public balances and milestone releases controlled only by an executed governance action.
contract CivicProjectVault is ReentrancyGuard {
    enum MilestoneState { Planned, EvidenceSubmitted, Released, Rejected }
    struct Project { uint256 budget; uint256 deposited; uint256 released; bool exists; }
    struct Milestone { address payable provider; uint256 amount; bytes32 evidenceHash; MilestoneState state; }

    address public immutable governor;
    address public pauseGuardian;
    bool public paused;
    mapping(bytes32 => Project) public projects;
    mapping(bytes32 => mapping(uint256 => Milestone)) public milestones;
    mapping(address => uint256) public claimable;

    event ProjectCreated(bytes32 indexed projectId, uint256 budget);
    event Deposited(bytes32 indexed projectId, address indexed contributor, uint256 amount);
    event EvidenceSubmitted(bytes32 indexed projectId, uint256 indexed milestoneId, bytes32 evidenceHash);
    event ReleaseApproved(bytes32 indexed projectId, uint256 indexed milestoneId, address indexed provider, uint256 amount);
    event Withdrawal(address indexed provider, uint256 amount);
    event Paused(address indexed guardian);
    event Unpaused();

    modifier onlyGovernor() { require(msg.sender == governor, "governor only"); _; }
    modifier whenNotPaused() { require(!paused, "paused"); _; }

    constructor(address governorAddress, address guardian) {
        require(governorAddress != address(0) && guardian != address(0), "address required");
        governor = governorAddress;
        pauseGuardian = guardian;
    }

    function createProject(bytes32 projectId, uint256 budget, address payable[] calldata providers, uint256[] calldata amounts) external onlyGovernor {
        require(projectId != bytes32(0) && budget > 0 && !projects[projectId].exists, "invalid project");
        require(providers.length == amounts.length && providers.length > 0, "invalid milestones");
        uint256 allocated;
        projects[projectId] = Project({budget:budget,deposited:0,released:0,exists:true});
        for (uint256 i = 0; i < providers.length; i++) { require(providers[i] != address(0) && amounts[i] > 0, "invalid milestone"); allocated += amounts[i]; milestones[projectId][i] = Milestone(providers[i], amounts[i], bytes32(0), MilestoneState.Planned); }
        require(allocated <= budget, "over budget");
        emit ProjectCreated(projectId, budget);
    }

    function deposit(bytes32 projectId) external payable whenNotPaused {
        Project storage project = projects[projectId];
        require(project.exists && msg.value > 0 && project.deposited + msg.value <= project.budget, "invalid deposit");
        project.deposited += msg.value;
        emit Deposited(projectId, msg.sender, msg.value);
    }

    function submitEvidence(bytes32 projectId, uint256 milestoneId, bytes32 evidenceHash) external whenNotPaused {
        Milestone storage milestone = milestones[projectId][milestoneId];
        require(msg.sender == milestone.provider && milestone.state == MilestoneState.Planned && evidenceHash != bytes32(0), "invalid evidence");
        milestone.evidenceHash = evidenceHash;
        milestone.state = MilestoneState.EvidenceSubmitted;
        emit EvidenceSubmitted(projectId, milestoneId, evidenceHash);
    }

    function approveRelease(bytes32 projectId, uint256 milestoneId, bytes32 expectedEvidenceHash) external onlyGovernor whenNotPaused {
        Project storage project = projects[projectId];
        Milestone storage milestone = milestones[projectId][milestoneId];
        require(milestone.state == MilestoneState.EvidenceSubmitted && milestone.evidenceHash == expectedEvidenceHash, "evidence mismatch");
        require(project.released + milestone.amount <= project.deposited, "insufficient project funds");
        milestone.state = MilestoneState.Released;
        project.released += milestone.amount;
        claimable[milestone.provider] += milestone.amount;
        emit ReleaseApproved(projectId, milestoneId, milestone.provider, milestone.amount);
    }

    function withdraw() external nonReentrant whenNotPaused {
        uint256 amount = claimable[msg.sender];
        require(amount > 0, "nothing to withdraw");
        claimable[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "transfer failed");
        emit Withdrawal(msg.sender, amount);
    }

    function pause() external { require(msg.sender == pauseGuardian, "guardian only"); paused = true; emit Paused(msg.sender); }
    function unpause() external onlyGovernor { paused = false; emit Unpaused(); }
    function replacePauseGuardian(address nextGuardian) external onlyGovernor { require(nextGuardian != address(0), "guardian required"); pauseGuardian = nextGuardian; }
}
