// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPaymaster, ExecutionResult, PAYMASTER_VALIDATION_SUCCESS_MAGIC} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import {IPaymasterFlow} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import {TransactionHelper, Transaction} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";

contract Paymaster is IPaymaster, Ownable {
    using ECDSA for bytes32;

    // Public address of the Zyfi signer
    address public verifier;

    event VerifierChanged(address indexed newVerifier);

    modifier onlyBootloader() {
        require(
            msg.sender == BOOTLOADER_FORMAL_ADDRESS,
            "Only bootloader can call this method"
        );
        // Continue execution if called from the bootloader.
        _;
    }

    constructor(address _verifier) {
        verifier = _verifier;
    }

    function validateAndPayForPaymasterTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    )
        external
        payable
        onlyBootloader
        returns (bytes4 magic, bytes memory context)
    {
        // By default we consider the transaction as accepted.
        magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;
        require(
            _transaction.paymasterInput.length >= 4,
            "The standard paymaster input must be at least 4 bytes long"
        );

        bytes4 paymasterInputSelector = bytes4(
            _transaction.paymasterInput[0:4]
        );
        if (paymasterInputSelector == IPaymasterFlow.approvalBased.selector) {
            // While the transaction data consists of address, uint256 and bytes data,
            // the data is not needed for this paymaster
            (address token, uint256 amount, bytes memory signedMessage) = abi
                .decode(
                    _transaction.paymasterInput[4:],
                    (address, uint256, bytes)
                );

            //Validate that the message was signed by the Zyfi api
            require(
                _isValidSignature(
                    signedMessage,
                    address(uint160(_transaction.from)), //conver user address
                    address(uint160(_transaction.to)),
                    token,
                    amount,
                    _transaction.maxFeePerGas,
                    _transaction.gasLimit
                ),
                "Invalid signature"
            );

            // We verify that the user has provided enough allowance
            address userAddress = address(uint160(_transaction.from));

            address thisAddress = address(this);

            uint256 providedAllowance = IERC20(token).allowance(
                userAddress,
                thisAddress
            );

            require(providedAllowance >= amount, "Min allowance too low");

            // Note, that while the minimal amount of ETH needed is tx.gasPrice * tx.gasLimit,
            // neither paymaster nor account are allowed to access this context variable.
            uint256 requiredETH = _transaction.gasLimit *
                _transaction.maxFeePerGas;

            try
                IERC20(token).transferFrom(userAddress, thisAddress, amount)
            {} catch (bytes memory revertReason) {
                // If the revert reason is empty or represented by just a function selector,
                // we replace the error with a more user-friendly message
                if (revertReason.length <= 4) {
                    revert("Failed to transferFrom from users' account");
                } else {
                    assembly {
                        revert(add(0x20, revertReason), mload(revertReason))
                    }
                }
            }

            // The bootloader never returns any data, so it can safely be ignored here.
            (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{
                value: requiredETH
            }("");
            require(success, "Failed to transfer funds to the bootloader");
        } else {
            revert("Unsupported paymaster flow");
        }
    }

    function postTransaction(
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32,
        bytes32,
        ExecutionResult _txResult,
        uint256 _maxRefundedGas
    ) external payable override onlyBootloader {
        // Refunds are not supported yet.
    }

    //Changes the verifier address
    function setVerifier(address _newVerifier) external onlyOwner {
        verifier = _newVerifier;
        emit VerifierChanged(_newVerifier);
    }

    function withdrawERC20(address _ERC20) external onlyOwner {
        IERC20 token = IERC20(_ERC20);
        token.transfer(msg.sender, token.balanceOf(address(this)));
    }

    function withdraw(address payable _to) external onlyOwner {
        // send paymaster funds to the owner
        uint256 balance = address(this).balance;
        (bool success, ) = _to.call{value: balance}("");
        require(success, "Failed to withdraw funds from paymaster.");
    }

    function _isValidSignature(
        bytes memory _signature,
        address _from,
        address _to,
        address _token,
        uint256 _amount,
        uint256 _maxFeePerGas,
        uint256 _gasLimit
    ) internal view returns (bool) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                _from,
                _to,
                _token,
                _amount,
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

    receive() external payable {}
}
