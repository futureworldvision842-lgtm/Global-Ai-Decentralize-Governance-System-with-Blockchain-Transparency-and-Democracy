// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GigEscrow {
    enum GigStatus { Created, Funded, Completed, Released, Disputed }

    struct Gig {
        address client;
        address worker;
        uint256 value;
        string jobDetailsHash; // IPFS hash or metadata ID
        GigStatus status;
        bool clientApproved;
        bool workerApproved;
    }

    uint256 public gigCount;
    mapping(uint256 => Gig) public gigs;

    event GigCreated(uint256 indexed gigId, address indexed client, address indexed worker, uint256 value);
    event GigFunded(uint256 indexed gigId, uint256 amount);
    event GigCompleted(uint256 indexed gigId);
    event GigReleased(uint256 indexed gigId, address worker, uint256 amount);
    event GigDisputed(uint256 indexed gigId);

    modifier onlyClient(uint256 gigId) {
        require(msg.sender == gigs[gigId].client, "Only the client can perform this action");
        _;
    }

    modifier onlyWorker(uint256 gigId) {
        require(msg.sender == gigs[gigId].worker, "Only the worker can perform this action");
        _;
    }

    function createGig(address _worker, string memory _jobDetailsHash) external payable returns (uint256) {
        require(_worker != address(0), "Invalid worker address");
        require(msg.value > 0, "Gig value must be greater than zero");

        uint256 gigId = gigCount++;
        gigs[gigId] = Gig({
            client: msg.sender,
            worker: _worker,
            value: msg.value,
            jobDetailsHash: _jobDetailsHash,
            status: GigStatus.Funded,
            clientApproved: false,
            workerApproved: false
        });

        emit GigCreated(gigId, msg.sender, _worker, msg.value);
        emit GigFunded(gigId, msg.value);
        return gigId;
    }

    function markCompleted(uint256 gigId) external onlyWorker(gigId) {
        Gig storage gig = gigs[gigId];
        require(gig.status == GigStatus.Funded, "Gig is not in funded status");
        
        gig.status = GigStatus.Completed;
        emit GigCompleted(gigId);
    }

    function releaseEscrow(uint256 gigId) external onlyClient(gigId) {
        Gig storage gig = gigs[gigId];
        require(gig.status == GigStatus.Completed || gig.status == GigStatus.Funded, "Invalid status to release funds");
        require(gig.value > 0, "No funds available to release");

        uint256 payment = gig.value;
        gig.value = 0;
        gig.status = GigStatus.Released;

        payable(gig.worker).transfer(payment);
        emit GigReleased(gigId, gig.worker, payment);
    }

    function dispute(uint256 gigId) external {
        Gig storage gig = gigs[gigId];
        require(msg.sender == gig.client || msg.sender == gig.worker, "Only involved parties can dispute");
        require(gig.status == GigStatus.Funded || gig.status == GigStatus.Completed, "Cannot dispute");

        gig.status = GigStatus.Disputed;
        emit GigDisputed(gigId);
    }
}
