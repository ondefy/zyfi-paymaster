// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;
import {Errors} from "./libraries/Errors.sol";

contract SponsorshipVault {
    // Used to identify the contract version
    string public constant version = "1.0";
    
    // Mapping from address to amount of ETH
    mapping(address => uint256) public balances;

    // The paymaster address that can withdraw from any account
    address public immutable paymaster;

    // Event for logging ETH deposits
    event Deposited(address indexed account, uint256 amount);
    // Event for logging ETH withdrawals
    event Withdrawn(address indexed account, uint256 amount);
    // Event for logging sponsorship payments
    event paidSponsorship(address indexed account, uint256 amount);
    // Event for logging sponsorship refunds
    event refundedSponsorship(address indexed account, uint256 amount);

    // Constructor to set the paymaster address
    // A paymaster can migrate to a new vault, but a vault cannot change its paymaster
    // The paymaster is immutable for extra security
    constructor(address _paymaster) {
        if (_paymaster == address(0)) revert Errors.InvalidAddress();
        paymaster = _paymaster;
    }

    /**
     * @dev Modifier to restrict access to only the paymaster.
     */
    modifier onlyPaymaster() {
        if (msg.sender != paymaster) revert Errors.NotFromPaymaster();
        _;
    }

    /**
     * @notice Deposits Ether to the specified protocol account.
     * @param account The address of the account to deposit the Ether to.
     * @dev Requires the account address to be valid.
     * Emits a `Deposited` event with the account address and the deposited amount.
     */
    function depositToAccount(address account) public payable {
        if (account == address(0)) revert Errors.InvalidAddress();
        unchecked {
            balances[account] += msg.value;
        }
        emit Deposited(account, msg.value);
    }

    // Function to withdraw ETH from sender's account
    /**
     * @notice Allows a given protocol to withdraw a certain amount.
     * @param amount The amount of Ether to withdraw.
     * @dev The caller must have a sufficient balance to withdraw the specified amount.
     * @dev The Ether is transferred to the caller's address.
     */
    function withdraw(uint256 amount) public {
        if (amount > balances[msg.sender]) revert Errors.NotEnoughFunds();
        unchecked {
            balances[msg.sender] -= amount;
        }
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert Errors.FailedWithdrawal();
        emit Withdrawn(msg.sender, amount);
    }

    // Function to allow the paymaster to withdraw ETH from any account to sponsor a transaction
    /**
     * @notice Allows the paymaster to withdraw sponsorship funds from a specific account.
     * @param account The address of the account from which the funds will be withdrawn.
     * @param amount The amount of funds to be withdrawn.
     * @dev Only the paymaster is allowed to call this function.
     * @dev The account must have sufficient balance to cover the withdrawal amount.
     */
    function getSponsorship(
        address account,
        uint256 amount
    ) public onlyPaymaster {
        if (amount > balances[account]) revert Errors.NotEnoughFunds();
        unchecked {
            balances[account] -= amount;
        }
        (bool sent, ) = payable(paymaster).call{value: amount}("");
        if (!sent) revert Errors.FailedTransferToPaymaster();
        emit paidSponsorship(account, amount);
    }

    /**
     * @notice Refunds the sponsorship amount to the specified account.
     * @param account The account to refund the sponsorship to.
     * @dev Only the paymaster is allowed to call this function, to allow for easier tracking
     */
    function refundSponsorship(address account) public payable onlyPaymaster {
        unchecked {
            balances[account] += msg.value;
        }
        emit refundedSponsorship(account, msg.value);
    }

    // Fallback function to handle receiving ETH
    receive() external payable {
        depositToAccount(msg.sender);
    }
}
