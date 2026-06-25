// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./KorriTreasury.sol";

contract KorriSettlement is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum SettlementStatus { Pending, Completed, Refunded }

    struct SettlementRequest {
        uint256 id;
        address initiator;
        address fromToken;
        address toToken;
        uint256 amount;
        string recipientDetails;
        SettlementStatus status;
        uint256 timestamp;
    }

    KorriTreasury public treasury;
    uint256 public nextSettlementId;

    mapping(uint256 => SettlementRequest) public settlements;

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TransferCreated(
        uint256 indexed id,
        address indexed initiator,
        address fromToken,
        address toToken,
        uint256 amount,
        string recipientDetails
    );
    event TransferConfirmed(uint256 indexed id, bytes32 indexed externalTxHash);
    event SettlementRefunded(uint256 indexed settlementId, string reason);

    constructor(address initialAdmin, address payable initialTreasury) {
        require(initialAdmin != address(0), "Admin address cannot be zero");
        require(initialTreasury != address(0), "Invalid treasury address");
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(OPERATOR_ROLE, initialAdmin);
        
        treasury = KorriTreasury(initialTreasury);
        emit TreasuryUpdated(address(0), initialTreasury);
    }

    /**
     * @notice Update the associated KorriTreasury contract. Restricted to DEFAULT_ADMIN_ROLE.
     */
    function setTreasury(address payable newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTreasury != address(0), "Invalid treasury address");
        emit TreasuryUpdated(address(treasury), newTreasury);
        treasury = KorriTreasury(newTreasury);
    }

    /**
     * @notice Initiate a cross-border or local settlement. Escrows the funds in this contract.
     */
    function initiateSettlement(
        address fromToken,
        address toToken,
        uint256 amount,
        string calldata recipientDetails
    ) external payable nonReentrant returns (uint256) {
        require(amount > 0, "Amount must be greater than zero");
        require(bytes(recipientDetails).length > 0, "Recipient details cannot be empty");

        uint256 settlementId = nextSettlementId++;
        
        if (fromToken == address(0)) {
            require(msg.value == amount, "Sent ETH amount mismatch");
        } else {
            require(msg.value == 0, "Should not send ETH with ERC20");
            IERC20(fromToken).safeTransferFrom(msg.sender, address(this), amount);
        }

        settlements[settlementId] = SettlementRequest({
            id: settlementId,
            initiator: msg.sender,
            fromToken: fromToken,
            toToken: toToken,
            amount: amount,
            recipientDetails: recipientDetails,
            status: SettlementStatus.Pending,
            timestamp: block.timestamp
        });

        emit TransferCreated(settlementId, msg.sender, fromToken, toToken, amount, recipientDetails);
        return settlementId;
    }

    /**
     * @notice Complete the settlement by transferring the escrowed funds to the treasury.
     * Restricted to OPERATOR_ROLE.
     */
    function completeSettlement(
        uint256 settlementId,
        bytes32 externalTxHash
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        SettlementRequest storage req = settlements[settlementId];
        require(req.status == SettlementStatus.Pending, "Settlement is not pending");
        require(externalTxHash != bytes32(0), "Invalid transaction hash");

        req.status = SettlementStatus.Completed;

        // Forward escrowed funds to the treasury
        if (req.fromToken == address(0)) {
            (bool success, ) = address(treasury).call{value: req.amount}("");
            require(success, "Failed to send ETH to treasury");
        } else {
            // Approve treasury transfer from settlement contract or just transfer directly
            IERC20(req.fromToken).safeTransfer(address(treasury), req.amount);
        }

        emit TransferConfirmed(settlementId, externalTxHash);
    }

    /**
     * @notice Refund an initiated settlement back to the initiator.
     * Restricted to OPERATOR_ROLE.
     */
    function refundSettlement(
        uint256 settlementId,
        string calldata reason
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        SettlementRequest storage req = settlements[settlementId];
        require(req.status == SettlementStatus.Pending, "Settlement is not pending");

        req.status = SettlementStatus.Refunded;

        // Return escrowed funds to the initiator
        if (req.fromToken == address(0)) {
            (bool success, ) = req.initiator.call{value: req.amount}("");
            require(success, "Failed to refund ETH");
        } else {
            IERC20(req.fromToken).safeTransfer(req.initiator, req.amount);
        }

        emit SettlementRefunded(settlementId, reason);
    }
}
