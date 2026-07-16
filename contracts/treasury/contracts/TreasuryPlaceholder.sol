// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract TreasuryPlaceholder is Ownable {
  event FundsReceived(address indexed sender, uint256 amount);

  constructor(address initialOwner) Ownable(initialOwner) {}

  receive() external payable {
    emit FundsReceived(msg.sender, msg.value);
  }
}
