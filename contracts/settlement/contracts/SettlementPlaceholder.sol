// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract SettlementPlaceholder is Ownable {
  event PlaceholderTriggered(address indexed initiator);

  constructor(address initialOwner) Ownable(initialOwner) {}

  function triggerPlaceholder() external {
    emit PlaceholderTriggered(msg.sender);
  }
}
