// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract IdentityPlaceholder is Ownable {
  mapping(address => bool) private _verifiedUsers;

  event UserVerificationChanged(address indexed user, bool verified);

  constructor(address initialOwner) Ownable(initialOwner) {}

  function setUserVerification(address user, bool verified) external onlyOwner {
    _verifiedUsers[user] = verified;
    emit UserVerificationChanged(user, verified);
  }

  function isVerified(address user) external view returns (bool) {
    return _verifiedUsers[user];
  }
}
