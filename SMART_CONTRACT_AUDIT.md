# KorriPay Smart Contract Security Audit Report

This document reports the smart contract security audit findings for the KorriPay core contracts: `KorriSettlement.sol`, `KorriTreasury.sol`, and `MockKRWStable.sol`.

---

## 1. Executive Summary
An inspection of the KorriPay Solidity contracts (`pragma solidity ^0.8.20`) was performed to evaluate their readiness for mainnet production deployment. 

The contracts use modern OpenZeppelin security modules (`SafeERC20`, `ReentrancyGuard`, `AccessControl`) and are architecturally sound. However, key improvements in Denial of Service (DoS) resilience, administrative pause mechanisms, and gas optimization are recommended before public deployment.

---

## 2. Vulnerability Assessment & Findings

### 2.1 Denial of Service (DoS) in Refund Transactions (Medium)
* **Contract:** `KorriSettlement.sol`
* **Function:** `refundSettlement(uint256, string)`
* **Vulnerability:** 
  When refunding native ETH settlements, the contract performs a push transfer to the initiator's address:
  ```solidity
  (bool success, ) = req.initiator.call{value: req.amount}("");
  require(success, "Failed to refund ETH");
  ```
  If the initiator is a smart contract that does not accept native ETH (i.e. lacks a `receive` or `fallback` handler, or explicitly reverts), the call will fail, causing the entire `refundSettlement` transaction to revert. This results in a permanent Denial of Service (DoS) for that specific settlement refund.
* **Remediation:** 
  Implement a pull-payment design for refunds, or transfer the native ETH to a dedicated escrow contract where users must claim their refunds.

### 2.2 Lack of Emergency Stop / Circuit Breaker (Low)
* **Contracts:** `KorriSettlement.sol`, `KorriTreasury.sol`
* **Vulnerability:** 
  Neither contract includes an emergency pause mechanism (`Pausable`). If a security vulnerability is identified in the settlement router or the network registry, there is no way to instantly freeze incoming settlements or treasury transfers.
* **Remediation:** 
  Inherit from OpenZeppelin’s `Pausable` contract and apply the `whenNotPaused` modifier to `initiateSettlement`, `deposit`, and `transferAssets` functions.

### 2.3 Bypass of Allowance Check in Token Burning (Informational)
* **Contract:** `MockKRWStable.sol`
* **Function:** `burnFromAddress(address, uint256)`
* **Description:** 
  The function uses internal `_burn()` to burn tokens directly from a target address without checking or decrementing the caller's allowance:
  ```solidity
  function burnFromAddress(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
      _burn(from, amount);
  }
  ```
  Although restricted to the `BURNER_ROLE`, this deviates from standard ERC20 behavior where a caller must be allowed by the token owner.
* **Remediation:** 
  Ensure this administrative superpower is documented for the bridge or minting coordinator integrations.

---

## 3. Gas & Operational Optimizations

### 3.1 Unchecked Increments for Gas Savings
* **Contract:** `KorriSettlement.sol`
* **Optimization:** 
  `nextSettlementId++` can be wrapped in an `unchecked` block, since it starts at 0 and cannot overflow in normal operation.
  ```solidity
  unchecked {
      nextSettlementId++;
  }
  ```

### 3.2 Struct Packing in Settlement Requests
* **Contract:** `KorriSettlement.sol`
* **Optimization:** 
  The `SettlementRequest` struct can be rearranged to optimize storage layout slot packing:
  ```solidity
  struct SettlementRequest {
      uint256 id;
      uint256 amount;
      uint256 timestamp;
      address initiator;
      address fromToken;
      address toToken;
      SettlementStatus status; // uint8 (packs in same slot with addresses)
      string recipientDetails; // dynamically sized (always starts a new slot)
  }
  ```
  Grouping `address` variables and the `SettlementStatus` enum together saves gas on state storage.

---

## 4. Contract-by-Contract Security Scorecard

| Check Item | KorriSettlement | KorriTreasury | MockKRWStable | Status |
|---|---|---|---|---|
| **Access Control** | Enforced | Enforced | Enforced | Passed |
| **Reentrancy Protection** | Guarded | Guarded | N/A | Passed |
| **Overflow / Underflow** | Managed (0.8.x) | Managed (0.8.x) | Managed (0.8.x) | Passed |
| **Front-running Resilience**| High | High | High | Passed |
| **Denial of Service** | Medium Risk | Low Risk | Low Risk | Remediation Needed |
| **Approval Race Conditions**| N/A | N/A | N/A | Passed |
| **Upgradeability Risk** | N/A | N/A | N/A | Passed |
| **Emergency Pause** | Absent | Absent | N/A | Optimization Needed |
