// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";

/// @notice Stores wallet eligibility only. Never put CNIC, phone, email or home address on-chain.
contract VerifiedMemberRegistry is AccessControl {
    using Checkpoints for Checkpoints.Trace208;

    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    struct Membership {
        uint48 joinedBlock;
        uint48 revokedBlock;
    }

    mapping(address => Membership) public memberships;
    Checkpoints.Trace208 private _activeMemberCount;

    event MembershipGranted(address indexed account, uint48 indexed joinedBlock);
    event MembershipRevoked(address indexed account, uint48 indexed revokedBlock);

    constructor(address initialAdmin) {
        require(initialAdmin != address(0), "admin required");
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(REGISTRAR_ROLE, initialAdmin);
        _activeMemberCount.push(uint48(block.number), 0);
    }

    function grantMembership(address account) external onlyRole(REGISTRAR_ROLE) {
        require(account != address(0), "account required");
        Membership storage member = memberships[account];
        require(member.joinedBlock == 0 || member.revokedBlock != 0, "already active");
        member.joinedBlock = uint48(block.number);
        member.revokedBlock = 0;
        uint208 nextCount = _activeMemberCount.latest() + 1;
        _activeMemberCount.push(uint48(block.number), nextCount);
        emit MembershipGranted(account, uint48(block.number));
    }

    function revokeMembership(address account) external onlyRole(REGISTRAR_ROLE) {
        Membership storage member = memberships[account];
        require(member.joinedBlock != 0 && member.revokedBlock == 0, "not active");
        member.revokedBlock = uint48(block.number);
        uint208 current = _activeMemberCount.latest();
        require(current > 0, "count invariant");
        _activeMemberCount.push(uint48(block.number), current - 1);
        emit MembershipRevoked(account, uint48(block.number));
    }

    function isEligibleAt(address account, uint256 snapshotBlock) public view returns (bool) {
        Membership memory member = memberships[account];
        return member.joinedBlock != 0 && member.joinedBlock <= snapshotBlock && (member.revokedBlock == 0 || member.revokedBlock > snapshotBlock);
    }

    function activeMemberCountAt(uint256 snapshotBlock) external view returns (uint256) {
        require(snapshotBlock < block.number, "snapshot not finalized");
        return uint256(_activeMemberCount.upperLookupRecent(uint48(snapshotBlock)));
    }

    function activeMemberCount() external view returns (uint256) {
        return uint256(_activeMemberCount.latest());
    }
}
