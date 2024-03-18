// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

interface ISponsorshipVault {
    // Events
    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event paidSponsorship(address indexed account, uint256 amount);
    event refundedSponsorship(address indexed account, uint256 amount);

    // Read the paymaster address
    function paymaster() external view returns (address);

    // Read the balance of an account
    function balances(address account) external view returns (uint256);

    // Deposit ETH to a specific account
    function depositToAccount(address account) external payable;

    // Withdraw ETH from sender's account
    function withdraw(uint256 amount) external;

    // Allow the paymaster to withdraw ETH for sponsorship
    function getSponsorship(address account, uint256 amount) external;

    // Refund the sponsorship amount to the specified account
    function refundSponsorship(address account) external payable;
}
