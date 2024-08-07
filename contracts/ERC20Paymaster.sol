// SPDX-License-Identifier: GPL-3.0

//        @@@@%%%%%%%@@@
//      @@@%%%%%%%%%%%%@@@             @%%%%%%%%%%@@                 @@@  @@
//    @@%%%%%%%%%%%%%%%%%%@@          @%%%%%%%%%%@@               @@@%%@@%%@@
//   @@%%%%%%%@@  @%%%%%%%%@@                  @%@@               @%@     @@
//  @@%%%%%%@@@    @@%%%%%%%@@               @@%@@                @%@
//  @%%%%%@@@        @@%%%%%%@              @@@@   @%@@       @@%%@%@%%@@@%@@
//  @%%%%@@            @%%%%%@             @@@@     @@@@     @@%@@@%@@@@ @%@@
//  @%%%%%%%%%@@    @%%%%%%%%@            @@@@      @@%@     @%@@ @%@    @%@@
//  @@%%%%%%%%%%@   @%%%%%%%%@           @@@@        @@@@   @@@@  @%@    @%@@
//   @%%%%%%%@@%%@@ @%%%%%%%@@          @@@@          @@@@ @@@@   @%@    @%@@
//   @@%%%%%%@@@%@@@@%%%%%%@@          @@@@            @@@@@@@    @%@    @%@@
//     @%%%%%@ @@%%%@%%%%%@           @%@@@@@@@@@@@     @%%%@     @%@    @%@@
//      @@@@%@   @@%%%@@@@           @@@@@@@@@@@@@@     @@@@      @@@    @@@@
//         @@@    @@@@@                                 @@@@
//                                                     @@@@
//                                                    @@%@

pragma solidity ^0.8.19;

import {IPaymaster, ExecutionResult, PAYMASTER_VALIDATION_SUCCESS_MAGIC} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import {IPaymasterFlow} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import {TransactionHelper, Transaction} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Errors} from "./libraries/Errors.sol";

contract ERC20Paymaster is IPaymaster, Ownable {
    using ECDSA for bytes32;
    // Using OpenZeppelin's SafeERC20 library to perform token transfers
    using SafeERC20 for IERC20;

    // Public address of the Zyfi signer
    address public verifier;

    // Used to identify the contract version
    string public constant version = "1.0";

    event ERC20PaymasterTransaction(
        address token, 
        uint256 amount
    );
    event RefundedToken(
        address indexed account,
        address indexed token,
        uint256 amount
    );
    event VerifierChanged(address indexed newVerifier);

    modifier onlyBootloader() {
        if (msg.sender != BOOTLOADER_FORMAL_ADDRESS) {
            revert Errors.NotFromBootloader();
        }
        // Continue execution if called from the bootloader.
        _;
    }

    constructor(address _verifier) {
        if (_verifier == address(0)) revert Errors.InvalidAddress();
        verifier = _verifier;
        emit VerifierChanged(_verifier);
    }

    function validateAndPayForPaymasterTransaction(
        bytes32 /* _txHash */,
        bytes32 /* _suggestedSignedHash */,
        Transaction calldata _transaction
    )
        external
        payable
        onlyBootloader
        returns (bytes4 magic, bytes memory context)
    {
        // By default we consider the transaction as accepted.
        magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;
        if (_transaction.paymasterInput.length < 4)
            revert Errors.ShortPaymasterInput();

        bytes4 paymasterInputSelector = bytes4(
            _transaction.paymasterInput[0:4]
        );
        if (paymasterInputSelector != IPaymasterFlow.approvalBased.selector)
            revert Errors.UnsupportedPaymasterFlow();

        // @dev amount is calculated by the api as the maximum amount of the token that the user is required to pay
        // amount = _transaction.gasLimit * _transaction.maxFeePerGas (using gasPrice) * markup (e.g 110_00 for +10%) * ETH/token ratio
        // Markup could be less than 100_00, signifying a sponsorship made by Zyfi

        (address token, uint256 amount, bytes memory data) = abi.decode(
            _transaction.paymasterInput[4:],
            (address, uint256, bytes)
        );

        /**
         * Decode the additional information provided by the Zyfi api for validation
         * expirationTime - the block.timestamp at which the transaction expires
         * signedMessage - the message signed by the api constructed with all the parameters
         */
        (uint64 expirationTime, bytes memory signedMessage) = abi.decode(
            data,
            (uint64, bytes)
        );

        // Validate that the transaction generated by the API is not expired
        if (block.timestamp > expirationTime)
            revert Errors.TransactionExpired();

        address userAddress = address(uint160(_transaction.from));

        //Validate that the message was signed by the Zyfi api
        if (
            !_isValidSignature(
                signedMessage,
                userAddress,
                address(uint160(_transaction.to)),
                token,
                amount,
                expirationTime,
                _transaction.maxFeePerGas,
                _transaction.gasLimit
            )
        ) {
            // While this means that the transaction was not generated by the Zyfi API, and the transaction should not be accepted,
            // magic is set to 0 so it fails on mainnet while still allowing for gas estimation
            magic = bytes4(0);
        }

        address thisAddress = address(this);

        // Note, that while the minimal amount of ETH needed is tx.gasPrice * tx.gasLimit,
        // neither paymaster nor account are allowed to access this context variable.
        uint256 requiredETH = _transaction.gasLimit * _transaction.maxFeePerGas;

        // Flow if the user is required pay with a given token
        if (amount > 0) {
            // Verifies the user has provided enough allowance
            if (IERC20(token).allowance(userAddress, thisAddress) < amount)
                revert Errors.AllowanceTooLow();

            IERC20(token).safeTransferFrom(userAddress, thisAddress, amount);
        }

        // The bootloader never returns any data, so it can safely be ignored here.
        (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{
            value: requiredETH
        }("");
        if (!success) revert Errors.FailedTransferToBootloader();

        // Encode context to process refunds
        context = abi.encode(token, amount);

        emit ERC20PaymasterTransaction(token, amount);
    }

    function postTransaction(
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32 /* _txHash */,
        bytes32 /* _suggestedSignedHash */,
        ExecutionResult /* _txResult */,
        uint256 _maxRefundedGas
    ) external payable override onlyBootloader {
        (address token, uint256 amount) = abi.decode(
            _context,
            (address, uint256)
        );

        // Refund the user
        if (amount > 0) {
            address userAddress = address(uint160(_transaction.from));

            uint256 refundAmount = (amount * _maxRefundedGas) /
                _transaction.gasLimit;
            IERC20(token).safeTransfer(userAddress, refundAmount);
            emit RefundedToken(userAddress, token, refundAmount);
        }
    }

    /**
     * @notice Checks the validity of the API signature.
     * @param _signature The signature to be validated.
     * @param _from The address of the sender.
     * @param _to The address of the recipient.
     * @param _token The address of the token being transferred.
     * @param _amount The amount of tokens being transferred.
     * @param _expirationTime The expiration time for the transaction.
     * @param _maxFeePerGas The maximum fee per gas for the transaction.
     * @param _gasLimit The gas limit for the transaction.
     * @return A boolean indicating whether the signature is valid or not.
     */
    function _isValidSignature(
        bytes memory _signature,
        address _from,
        address _to,
        address _token,
        uint256 _amount,
        uint64 _expirationTime,
        uint256 _maxFeePerGas,
        uint256 _gasLimit
    ) internal view returns (bool) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                _from,
                _to,
                _token,
                _amount,
                _expirationTime,
                _maxFeePerGas,
                _gasLimit
            )
        );

        bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(
            messageHash
        );

        (address recoveredAddress, ECDSA.RecoverError error2) = ECDSA
            .tryRecover(ethSignedMessageHash, _signature);
        if (error2 != ECDSA.RecoverError.NoError) {
            return false;
        }
        return recoveredAddress == verifier;
    }

    // --- ADMIN FUNCTIONS ---

    /**
     * @notice Sets the verifier address.
     * @param _newVerifier The new verifier address.
     */
    function setVerifier(address _newVerifier) external onlyOwner {
        if (_newVerifier == address(0)) revert Errors.InvalidAddress();
        verifier = _newVerifier;
        emit VerifierChanged(_newVerifier);
    }

    /**
     * @notice Withdraws a specified amount of ETH from the paymaster contract and sends it to the given address.
     * Can only be called by the contract owner.
     * @param to The address to which the ETH will be sent.
     * @param amount The amount of ETH to be withdrawn.
     */
    function withdrawETH(address to, uint256 amount) external onlyOwner {
        _withdrawETH(to, amount);
    }

    /**
     * @dev Withdraws all ETH from the contract and transfers it to the specified address.
     * Can only be called by the contract owner.
     * @param to The address to transfer the ETH to.
     */
    function withdrawAllETH(address to) external onlyOwner {
        _withdrawETH(to, address(this).balance);
    }

    /**
     * @dev Internal function to withdraw ETH from the contract.
     * @param to The address to which the ETH will be transferred.
     * @param amount The amount of ETH to be withdrawn.
     */
    function _withdrawETH(address to, uint256 amount) internal {
        if (to == address(0)) revert Errors.InvalidAddress();
        (bool success, ) = payable(to).call{value: amount}("");
        if (!success) revert Errors.FailedTransfer();
    }

    /**
     * @notice Withdraws ERC20 tokens from the contract.
     * @param token The address of the ERC20 token to withdraw.
     * @param to The address to transfer the tokens to.
     * @param amount The amount of tokens to withdraw.
     */
    function withdrawERC20(
        address to,
        address token,
        uint256 amount
    ) external onlyOwner {
        if (to == address(0)) revert Errors.InvalidAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * @notice Withdraws multiple ERC20 tokens to a specified address.
     * @param to The address to which the tokens will be withdrawn.
     * @param tokens An array of ERC20 token addresses.
     * @param amounts An array of corresponding token amounts to be withdrawn.
     * Requirements:
     * - The `to` address must not be the zero address.
     * - The `tokens` and `amounts` arrays must have the same length.
     */
    function withdrawERC20Batch(
        address to,
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external onlyOwner {
        if (to == address(0)) revert Errors.InvalidAddress();

        if (tokens.length != amounts.length)
            revert Errors.ArraysLengthMismatch();

        for (uint i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).safeTransfer(to, amounts[i]);
        }
    }

    /**
     * @dev The Ownable renounceOwnership function is overridden to prevent a premature call from locking up the contract's ETH or ERC20s balance.
     */
    function renounceOwnership() public override onlyOwner {}

    receive() external payable {}
}
