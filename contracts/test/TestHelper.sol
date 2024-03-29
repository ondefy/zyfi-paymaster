// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.19;

// at the moment is used only to get the current timestamp

contract TestHelper {
    function getTimestamp() external view returns (uint256) {
        return block.timestamp;
    }
}
