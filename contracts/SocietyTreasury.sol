// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SocietyTreasury {
    address public governor;
    address public admin;

    event FundsReceived(address indexed from, uint256 amount);
    event FundsReleased(address indexed recipient, uint256 amount);

    modifier onlyGovernor() {
        require(msg.sender == governor, "Only the Governor contract can authorize releases");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only the admin can perform this action");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function setGovernor(address _governor) external onlyAdmin {
        require(_governor != address(0), "Invalid governor address");
        governor = _governor;
    }

    function releaseFunds(address payable recipient, uint256 amount) external onlyGovernor {
        require(address(this).balance >= amount, "Insufficient treasury balance");
        recipient.transfer(amount);
        emit FundsReleased(recipient, amount);
    }

    // Accept community contributions
    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }
}
