// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

library SignatureCheck {
    using ECDSA for bytes32;

    function isValidSignature(
        address _from,
        address _token,
        uint256 _amount,
        uint256 _expiration,
        bytes memory signature
    ) internal pure returns (bool) {
        // Construct the message hash
        bytes32 messageHash = keccak256(abi.encodePacked(_from, _token, _amount, _expiration));
        
        // Convert the message hash into an Ethereum signed message
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();

        // Recover the address that signed the ethSignedMessageHash
        address recoveredAddress = ethSignedMessageHash.recover(signature);

        // Check if the recovered address matches the `_from` address
        return (recoveredAddress == _from);
    }
}
