// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;
library Errors {
    /*//////////////////////////////////////////////////////////////
                              PAYMASTER
    //////////////////////////////////////////////////////////////*/

    error NotFromBootloader(); // 0x0e7b35b3
    error ShortPaymasterInput(); // 0x1a539700
    error UnsupportedPaymasterFlow(); // 0xff15b069
    error TransactionExpired(); // 0xe397952c
    error InvalidAddress(); // 0xe6c4247b
    error InvalidMarkup(); // 0x99c36539
    error InvalidNonce(); // 0x756688fe
    error InvalidRatio(); // 0x648564d3
    error AllowanceTooLow(); // 0xbac9b5e8
    error FailedTransferToBootloader(); // 0x9e85dbaa
    error FailedTransfer(); // 0xbfa871c5
    error ArraysLengthMismatch(); // 0xfc235960

    /*//////////////////////////////////////////////////////////////
                              VAULT
    //////////////////////////////////////////////////////////////*/
    error FailedTransferToPaymaster(); // 0x6daa2717
    error FailedWithdrawal(); // 0xa1248235
    error NotEnoughFunds(); // 0x81b5ad68
    error NotFromPaymaster(); // 0x975ba010
}
