// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITreasury {
    function releaseFunds(address payable recipient, uint256 amount) external;
}

contract SocietyGovernor {
    enum ProposalStatus { Active, Passed, Rejected, Vetoed, Executed }

    struct Proposal {
        string title;
        string description;
        uint256 budget;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 vetoVotes;
        uint256 deadline;
        uint256 quorum;
        ProposalStatus status;
        address payable recipient;
        bool exists;
    }

    address public treasury;
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    // proposalId => voter => hasVoted
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed proposalId, string title, uint256 budget, uint256 deadline);
    event VoteCast(uint256 indexed proposalId, address indexed voter, uint8 choice, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId, address recipient, uint256 amount);
    event ProposalVetoed(uint256 indexed proposalId);

    constructor(address _treasury) {
        treasury = _treasury;
    }

    function propose(
        string memory _title,
        string memory _description,
        uint256 _budget,
        uint256 _votingPeriodSeconds,
        uint256 _quorum,
        address payable _recipient
    ) external returns (uint256) {
        uint256 proposalId = proposalCount++;
        proposals[proposalId] = Proposal({
            title: _title,
            description: _description,
            budget: _budget,
            yesVotes: 0,
            noVotes: 0,
            vetoVotes: 0,
            deadline: block.timestamp + _votingPeriodSeconds,
            quorum: _quorum,
            status: ProposalStatus.Active,
            recipient: _recipient,
            exists: true
        });

        emit ProposalCreated(proposalId, _title, _budget, block.timestamp + _votingPeriodSeconds);
        return proposalId;
    }

    function castVote(uint256 _proposalId, uint8 _choice) external {
        Proposal storage prop = proposals[_proposalId];
        require(prop.exists, "Proposal does not exist");
        require(block.timestamp < prop.deadline, "Voting period has ended");
        require(!hasVoted[_proposalId][msg.sender], "Voter has already cast a vote");

        hasVoted[_proposalId][msg.sender] = true;
        uint256 weight = 1; // Simplify to 1 member = 1 vote for the prototype

        if (_choice == 0) {
            prop.yesVotes += weight;
        } else if (_choice == 1) {
            prop.noVotes += weight;
        } else if (_choice == 2) {
            prop.vetoVotes += weight;
        } else {
            revert("Invalid choice: 0=Yes, 1=No, 2=Veto");
        }

        emit VoteCast(_proposalId, msg.sender, _choice, weight);

        // Instant Veto Check: If vetoes reach or exceed 33% of total votes cast
        uint256 totalVotes = prop.yesVotes + prop.noVotes + prop.vetoVotes;
        if (totalVotes > 0 && (prop.vetoVotes * 100) / totalVotes >= 33) {
            prop.status = ProposalStatus.Vetoed;
            emit ProposalVetoed(_proposalId);
        }
    }

    function execute(uint256 _proposalId) external {
        Proposal storage prop = proposals[_proposalId];
        require(prop.exists, "Proposal does not exist");
        require(block.timestamp >= prop.deadline || prop.status == ProposalStatus.Vetoed, "Voting period not finished");
        require(prop.status == ProposalStatus.Active, "Proposal is not active for execution");

        uint256 totalVotes = prop.yesVotes + prop.noVotes + prop.vetoVotes;
        require(totalVotes >= prop.quorum, "Quorum not met");

        if ((prop.vetoVotes * 100) / totalVotes >= 33) {
            prop.status = ProposalStatus.Vetoed;
            emit ProposalVetoed(_proposalId);
            return;
        }

        if (prop.yesVotes > prop.noVotes) {
            prop.status = ProposalStatus.Executed;
            if (prop.budget > 0 && treasury != address(0)) {
                ITreasury(treasury).releaseFunds(prop.recipient, prop.budget);
            }
            emit ProposalExecuted(_proposalId, prop.recipient, prop.budget);
        } else {
            prop.status = ProposalStatus.Rejected;
        }
    }
}
