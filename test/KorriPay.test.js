import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("KorriPay Smart Contracts", function () {
  let admin, manager, operator, user, stranger;
  let mockKRW, treasury, settlement;
  const initialSupply = ethers.parseEther("1000000"); // 1M tokens

  beforeEach(async function () {
    [admin, manager, operator, user, stranger] = await ethers.getSigners();

    // 1. Deploy MockKRWStable
    const MockKRWStable = await ethers.getContractFactory("MockKRWStable");
    mockKRW = await MockKRWStable.deploy(admin.address, initialSupply);
    await mockKRW.waitForDeployment();

    // 2. Deploy KorriTreasury
    const KorriTreasury = await ethers.getContractFactory("KorriTreasury");
    treasury = await KorriTreasury.deploy(admin.address);
    await treasury.waitForDeployment();

    // 3. Deploy KorriSettlement
    const KorriSettlement = await ethers.getContractFactory("KorriSettlement");
    settlement = await KorriSettlement.deploy(admin.address, await treasury.getAddress());
    await settlement.waitForDeployment();

    // Configure Roles
    const MANAGER_ROLE = await treasury.MANAGER_ROLE();
    const SETTLEMENT_ROLE = await treasury.SETTLEMENT_ROLE();
    const OPERATOR_ROLE = await settlement.OPERATOR_ROLE();

    await treasury.grantRole(MANAGER_ROLE, manager.address);
    await treasury.grantRole(SETTLEMENT_ROLE, await settlement.getAddress());
    await settlement.grantRole(OPERATOR_ROLE, operator.address);
  });

  describe("Constructor Requirements", function () {
    it("should revert if admin is zero address in MockKRWStable", async function () {
      const MockKRWStable = await ethers.getContractFactory("MockKRWStable");
      await expect(MockKRWStable.deploy(ethers.ZeroAddress, 0))
        .to.be.revertedWith("Admin address cannot be zero");
    });

    it("should revert if admin is zero address in KorriTreasury", async function () {
      const KorriTreasury = await ethers.getContractFactory("KorriTreasury");
      await expect(KorriTreasury.deploy(ethers.ZeroAddress))
        .to.be.revertedWith("Admin address cannot be zero");
    });

    it("should revert if admin or treasury is zero address in KorriSettlement", async function () {
      const KorriSettlement = await ethers.getContractFactory("KorriSettlement");
      await expect(KorriSettlement.deploy(ethers.ZeroAddress, await treasury.getAddress()))
        .to.be.revertedWith("Admin address cannot be zero");
      await expect(KorriSettlement.deploy(admin.address, ethers.ZeroAddress))
        .to.be.revertedWith("Invalid treasury address");
    });
  });

  describe("MockKRWStable", function () {
    it("should set initial parameters correctly", async function () {
      expect(await mockKRW.name()).to.equal("Mock Korean Won");
      expect(await mockKRW.symbol()).to.equal("MockKRW");
      expect(await mockKRW.decimals()).to.equal(18);
      expect(await mockKRW.balanceOf(admin.address)).to.equal(initialSupply);
    });

    it("should allow deploying with initialSupply of 0", async function () {
      const MockKRWStable = await ethers.getContractFactory("MockKRWStable");
      const zeroSupplyToken = await MockKRWStable.deploy(admin.address, 0);
      await zeroSupplyToken.waitForDeployment();
      expect(await zeroSupplyToken.balanceOf(admin.address)).to.equal(0);
    });

    it("should allow minter to mint new tokens", async function () {
      const mintAmount = ethers.parseEther("5000");
      await expect(mockKRW.connect(admin).mint(user.address, mintAmount))
        .to.emit(mockKRW, "TokenMinted")
        .withArgs(user.address, mintAmount);

      expect(await mockKRW.balanceOf(user.address)).to.equal(mintAmount);
    });

    it("should reject minting to zero address", async function () {
      const mintAmount = ethers.parseEther("5000");
      await expect(mockKRW.connect(admin).mint(ethers.ZeroAddress, mintAmount))
        .to.be.revertedWith("Cannot mint to zero address");
    });

    it("should reject minting from unauthorized users", async function () {
      const mintAmount = ethers.parseEther("5000");
      const MINTER_ROLE = await mockKRW.MINTER_ROLE();
      await expect(mockKRW.connect(stranger).mint(user.address, mintAmount))
        .to.be.revertedWithCustomError(mockKRW, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, MINTER_ROLE);
    });

    it("should allow burner to burn tokens", async function () {
      const burnAmount = ethers.parseEther("1000");
      await expect(mockKRW.connect(admin).burnFromAddress(admin.address, burnAmount))
        .to.emit(mockKRW, "TokenBurned")
        .withArgs(admin.address, burnAmount);

      expect(await mockKRW.balanceOf(admin.address)).to.equal(initialSupply - burnAmount);
    });

    it("should reject burning from unauthorized users", async function () {
      const burnAmount = ethers.parseEther("1000");
      const BURNER_ROLE = await mockKRW.BURNER_ROLE();
      await expect(mockKRW.connect(stranger).burnFromAddress(admin.address, burnAmount))
        .to.be.revertedWithCustomError(mockKRW, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, BURNER_ROLE);
    });
  });

  describe("KorriTreasury", function () {
    it("should allow native deposits (receive function)", async function () {
      const depositVal = ethers.parseEther("10");
      await expect(user.sendTransaction({
        to: await treasury.getAddress(),
        value: depositVal
      })).to.emit(treasury, "Deposited")
        .withArgs(ethers.ZeroAddress, user.address, depositVal);

      expect(await ethers.provider.getBalance(await treasury.getAddress())).to.equal(depositVal);
    });

    it("should allow ERC20 deposits", async function () {
      const depositAmount = ethers.parseEther("10000");
      await mockKRW.connect(admin).transfer(user.address, depositAmount);
      await mockKRW.connect(user).approve(await treasury.getAddress(), depositAmount);

      await expect(treasury.connect(user).deposit(await mockKRW.getAddress(), depositAmount))
        .to.emit(treasury, "Deposited")
        .withArgs(await mockKRW.getAddress(), user.address, depositAmount);

      expect(await mockKRW.balanceOf(await treasury.getAddress())).to.equal(depositAmount);
    });

    it("should reject deposit with zero token address or zero amount", async function () {
      await expect(treasury.connect(user).deposit(ethers.ZeroAddress, 100))
        .to.be.revertedWith("Invalid token address");
      await expect(treasury.connect(user).deposit(await mockKRW.getAddress(), 0))
        .to.be.revertedWith("Amount must be greater than zero");
    });

    it("should allow manager to withdraw native ETH", async function () {
      const depositVal = ethers.parseEther("5");
      await admin.sendTransaction({
        to: await treasury.getAddress(),
        value: depositVal
      });

      const recipientBalanceBefore = await ethers.provider.getBalance(user.address);
      await expect(treasury.connect(manager).withdraw(ethers.ZeroAddress, user.address, depositVal))
        .to.emit(treasury, "Withdrawn")
        .withArgs(ethers.ZeroAddress, user.address, depositVal);

      expect(await ethers.provider.getBalance(user.address)).to.equal(recipientBalanceBefore + depositVal);
    });

    it("should reject manager withdrawing native ETH with insufficient balance", async function () {
      await expect(treasury.connect(manager).withdraw(ethers.ZeroAddress, user.address, ethers.parseEther("10")))
        .to.be.revertedWith("Insufficient ETH balance");
    });

    it("should allow manager to withdraw ERC20 tokens", async function () {
      const depositAmount = ethers.parseEther("5000");
      await mockKRW.connect(admin).transfer(await treasury.getAddress(), depositAmount);

      await expect(treasury.connect(manager).withdraw(await mockKRW.getAddress(), user.address, depositAmount))
        .to.emit(treasury, "Withdrawn")
        .withArgs(await mockKRW.getAddress(), user.address, depositAmount);

      expect(await mockKRW.balanceOf(user.address)).to.equal(depositAmount);
    });

    it("should reject manager withdrawing ERC20 with insufficient balance", async function () {
      await expect(treasury.connect(manager).withdraw(await mockKRW.getAddress(), user.address, 100))
        .to.be.revertedWith("Insufficient token balance");
    });

    it("should reject withdrawals to zero address or with zero amount", async function () {
      await expect(treasury.connect(manager).withdraw(ethers.ZeroAddress, ethers.ZeroAddress, 100))
        .to.be.revertedWith("Invalid recipient address");
      await expect(treasury.connect(manager).withdraw(ethers.ZeroAddress, user.address, 0))
        .to.be.revertedWith("Amount must be greater than zero");
    });

    it("should reject withdrawals from non-managers", async function () {
      const MANAGER_ROLE = await treasury.MANAGER_ROLE();
      await expect(treasury.connect(stranger).withdraw(ethers.ZeroAddress, user.address, ethers.parseEther("1")))
        .to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, MANAGER_ROLE);
    });

    it("should allow transferAssets of native ETH (SETTLEMENT_ROLE)", async function () {
      const depositVal = ethers.parseEther("2");
      await admin.sendTransaction({
        to: await treasury.getAddress(),
        value: depositVal
      });

      // Grant SETTLEMENT_ROLE to admin to test directly
      const SETTLEMENT_ROLE = await treasury.SETTLEMENT_ROLE();
      await treasury.grantRole(SETTLEMENT_ROLE, admin.address);

      const balanceBefore = await ethers.provider.getBalance(user.address);
      await expect(treasury.connect(admin).transferAssets(ethers.ZeroAddress, user.address, depositVal))
        .to.emit(treasury, "Transferred")
        .withArgs(ethers.ZeroAddress, user.address, depositVal);

      expect(await ethers.provider.getBalance(user.address)).to.equal(balanceBefore + depositVal);
    });

    it("should allow transferAssets of ERC20 (SETTLEMENT_ROLE)", async function () {
      const transferAmount = ethers.parseEther("1000");
      await mockKRW.connect(admin).transfer(await treasury.getAddress(), transferAmount);

      const SETTLEMENT_ROLE = await treasury.SETTLEMENT_ROLE();
      await treasury.grantRole(SETTLEMENT_ROLE, admin.address);

      await expect(treasury.connect(admin).transferAssets(await mockKRW.getAddress(), user.address, transferAmount))
        .to.emit(treasury, "Transferred")
        .withArgs(await mockKRW.getAddress(), user.address, transferAmount);

      expect(await mockKRW.balanceOf(user.address)).to.equal(transferAmount);
    });

    it("should reject transferAssets if inputs are invalid or balances are insufficient", async function () {
      const SETTLEMENT_ROLE = await treasury.SETTLEMENT_ROLE();
      await treasury.grantRole(SETTLEMENT_ROLE, admin.address);

      await expect(treasury.connect(admin).transferAssets(ethers.ZeroAddress, ethers.ZeroAddress, 100))
        .to.be.revertedWith("Invalid recipient address");
      await expect(treasury.connect(admin).transferAssets(ethers.ZeroAddress, user.address, 0))
        .to.be.revertedWith("Amount must be greater than zero");
      await expect(treasury.connect(admin).transferAssets(ethers.ZeroAddress, user.address, ethers.parseEther("10")))
        .to.be.revertedWith("Insufficient ETH balance");
      await expect(treasury.connect(admin).transferAssets(await mockKRW.getAddress(), user.address, 100))
        .to.be.revertedWith("Insufficient token balance");
    });
  });

  describe("KorriSettlement", function () {
    let settlementAmount = ethers.parseEther("200");

    beforeEach(async function () {
      // Transfer MockKRW to user to execute settlements
      await mockKRW.connect(admin).transfer(user.address, ethers.parseEther("10000"));
    });

    it("should allow administrator to update treasury address", async function () {
      const KorriTreasury = await ethers.getContractFactory("KorriTreasury");
      const newTreasury = await KorriTreasury.deploy(admin.address);
      await newTreasury.waitForDeployment();

      await expect(settlement.connect(admin).setTreasury(await newTreasury.getAddress()))
        .to.emit(settlement, "TreasuryUpdated")
        .withArgs(await treasury.getAddress(), await newTreasury.getAddress());

      expect(await settlement.treasury()).to.equal(await newTreasury.getAddress());
    });

    it("should reject setTreasury to zero address", async function () {
      await expect(settlement.connect(admin).setTreasury(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid treasury address");
    });

    it("should reject setTreasury from non-admin accounts", async function () {
      const newTreasuryAddress = user.address;
      const ADMIN_ROLE = await settlement.DEFAULT_ADMIN_ROLE();
      await expect(settlement.connect(stranger).setTreasury(newTreasuryAddress))
        .to.be.revertedWithCustomError(settlement, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, ADMIN_ROLE);
    });

    it("should allow users to initiate ERC20 settlements", async function () {
      await mockKRW.connect(user).approve(await settlement.getAddress(), settlementAmount);

      await expect(settlement.connect(user).initiateSettlement(
        await mockKRW.getAddress(),
        ethers.ZeroAddress, // target output (mock native/other)
        settlementAmount,
        "Recipient IBAN: KR7600200..."
      )).to.emit(settlement, "TransferCreated")
        .withArgs(0, user.address, await mockKRW.getAddress(), ethers.ZeroAddress, settlementAmount, "Recipient IBAN: KR7600200...");

      // Funds must be escrowed in settlement contract
      expect(await mockKRW.balanceOf(await settlement.getAddress())).to.equal(settlementAmount);
    });

    it("should allow users to initiate native ETH settlements", async function () {
      await expect(settlement.connect(user).initiateSettlement(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        settlementAmount,
        "Recipient IBAN: KR7600200...",
        { value: settlementAmount }
      )).to.emit(settlement, "TransferCreated")
        .withArgs(0, user.address, ethers.ZeroAddress, ethers.ZeroAddress, settlementAmount, "Recipient IBAN: KR7600200...");

      expect(await ethers.provider.getBalance(await settlement.getAddress())).to.equal(settlementAmount);
    });

    it("should reject native ETH settlements on msg.value mismatch", async function () {
      await expect(settlement.connect(user).initiateSettlement(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        settlementAmount,
        "Recipient IBAN: KR7600200...",
        { value: settlementAmount - 1n }
      )).to.be.revertedWith("Sent ETH amount mismatch");
    });

    it("should reject ERC20 settlements if msg.value is greater than 0", async function () {
      await mockKRW.connect(user).approve(await settlement.getAddress(), settlementAmount);
      await expect(settlement.connect(user).initiateSettlement(
        await mockKRW.getAddress(),
        ethers.ZeroAddress,
        settlementAmount,
        "Recipient IBAN: KR7600200...",
        { value: 100n }
      )).to.be.revertedWith("Should not send ETH with ERC20");
    });

    it("should reject initiateSettlement if amount is zero or recipientDetails is empty", async function () {
      await expect(settlement.connect(user).initiateSettlement(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        0,
        "Recipient IBAN"
      )).to.be.revertedWith("Amount must be greater than zero");

      await expect(settlement.connect(user).initiateSettlement(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        100,
        ""
      )).to.be.revertedWith("Recipient details cannot be empty");
    });

    it("should allow operator to complete settlement (transfers funds to treasury)", async function () {
      await mockKRW.connect(user).approve(await settlement.getAddress(), settlementAmount);
      await settlement.connect(user).initiateSettlement(
        await mockKRW.getAddress(),
        ethers.ZeroAddress,
        settlementAmount,
        "Recipient IBAN: KR7600200..."
      );

      const txHash = ethers.id("some-external-bank-transfer-ref");

      await expect(settlement.connect(operator).completeSettlement(0, txHash))
        .to.emit(settlement, "TransferConfirmed")
        .withArgs(0, txHash);

      // Status must update
      const req = await settlement.settlements(0);
      expect(req.status).to.equal(1); // Completed

      // Funds must be forwarded from settlement contract to treasury contract
      expect(await mockKRW.balanceOf(await settlement.getAddress())).to.equal(0);
      expect(await mockKRW.balanceOf(await treasury.getAddress())).to.equal(settlementAmount);
    });

    it("should allow operator to complete ETH settlements", async function () {
      await settlement.connect(user).initiateSettlement(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        settlementAmount,
        "Recipient IBAN: KR7600200...",
        { value: settlementAmount }
      );

      const txHash = ethers.id("some-external-bank-transfer-ref");
      const treasuryBalanceBefore = await ethers.provider.getBalance(await treasury.getAddress());

      await expect(settlement.connect(operator).completeSettlement(0, txHash))
        .to.emit(settlement, "TransferConfirmed")
        .withArgs(0, txHash);

      expect(await ethers.provider.getBalance(await treasury.getAddress())).to.equal(treasuryBalanceBefore + settlementAmount);
    });

    it("should reject completeSettlement with invalid txHash or if status is not Pending", async function () {
      await mockKRW.connect(user).approve(await settlement.getAddress(), settlementAmount);
      await settlement.connect(user).initiateSettlement(
        await mockKRW.getAddress(),
        ethers.ZeroAddress,
        settlementAmount,
        "Recipient"
      );

      await expect(settlement.connect(operator).completeSettlement(0, ethers.ZeroHash))
        .to.be.revertedWith("Invalid transaction hash");

      // Complete it
      await settlement.connect(operator).completeSettlement(0, ethers.id("hash"));

      // Try completing again
      await expect(settlement.connect(operator).completeSettlement(0, ethers.id("hash2")))
        .to.be.revertedWith("Settlement is not pending");
    });

    it("should allow operator to refund settlement to initiator", async function () {
      await mockKRW.connect(user).approve(await settlement.getAddress(), settlementAmount);
      await settlement.connect(user).initiateSettlement(
        await mockKRW.getAddress(),
        ethers.ZeroAddress,
        settlementAmount,
        "Recipient IBAN: KR7600200..."
      );

      const userBalanceBefore = await mockKRW.balanceOf(user.address);

      await expect(settlement.connect(operator).refundSettlement(0, "Invalid recipient details"))
        .to.emit(settlement, "SettlementRefunded")
        .withArgs(0, "Invalid recipient details");

      // Status must update
      const req = await settlement.settlements(0);
      expect(req.status).to.equal(2); // Refunded

      // Escrowed funds must return to initiator
      expect(await mockKRW.balanceOf(await settlement.getAddress())).to.equal(0);
      expect(await mockKRW.balanceOf(user.address)).to.equal(userBalanceBefore + settlementAmount);
    });

    it("should allow operator to refund ETH settlements", async function () {
      await settlement.connect(user).initiateSettlement(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        settlementAmount,
        "Recipient IBAN: KR7600200...",
        { value: settlementAmount }
      );

      const userBalanceBefore = await ethers.provider.getBalance(user.address);

      // We need to account for transaction costs if user initiates, but since operator does the refund,
      // user receives full amount.
      await expect(settlement.connect(operator).refundSettlement(0, "Refunded"))
        .to.emit(settlement, "SettlementRefunded")
        .withArgs(0, "Refunded");

      expect(await ethers.provider.getBalance(user.address)).to.equal(userBalanceBefore + settlementAmount);
    });

    it("should reject refundSettlement if status is not Pending", async function () {
      await mockKRW.connect(user).approve(await settlement.getAddress(), settlementAmount);
      await settlement.connect(user).initiateSettlement(
        await mockKRW.getAddress(),
        ethers.ZeroAddress,
        settlementAmount,
        "Recipient"
      );

      // Refund it
      await settlement.connect(operator).refundSettlement(0, "Refunded");

      // Try refunding again
      await expect(settlement.connect(operator).refundSettlement(0, "Refunded again"))
        .to.be.revertedWith("Settlement is not pending");
    });

    it("should reject settlement completion/refund by non-operators", async function () {
      await mockKRW.connect(user).approve(await settlement.getAddress(), settlementAmount);
      await settlement.connect(user).initiateSettlement(
        await mockKRW.getAddress(),
        ethers.ZeroAddress,
        settlementAmount,
        "Recipient IBAN: KR7600200..."
      );

      const OPERATOR_ROLE = await settlement.OPERATOR_ROLE();
      await expect(settlement.connect(stranger).completeSettlement(0, ethers.id("hash")))
        .to.be.revertedWithCustomError(settlement, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, OPERATOR_ROLE);
    });
  });
});

