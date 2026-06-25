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

  describe("MockKRWStable", function () {
    it("should set initial parameters correctly", async function () {
      expect(await mockKRW.name()).to.equal("Mock Korean Won");
      expect(await mockKRW.symbol()).to.equal("MockKRW");
      expect(await mockKRW.decimals()).to.equal(18);
      expect(await mockKRW.balanceOf(admin.address)).to.equal(initialSupply);
    });

    it("should allow minter to mint new tokens", async function () {
      const mintAmount = ethers.parseEther("5000");
      await expect(mockKRW.connect(admin).mint(user.address, mintAmount))
        .to.emit(mockKRW, "TokenMinted")
        .withArgs(user.address, mintAmount);

      expect(await mockKRW.balanceOf(user.address)).to.equal(mintAmount);
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

    it("should allow manager to withdraw ERC20 tokens", async function () {
      const depositAmount = ethers.parseEther("5000");
      await mockKRW.connect(admin).transfer(await treasury.getAddress(), depositAmount);

      await expect(treasury.connect(manager).withdraw(await mockKRW.getAddress(), user.address, depositAmount))
        .to.emit(treasury, "Withdrawn")
        .withArgs(await mockKRW.getAddress(), user.address, depositAmount);

      expect(await mockKRW.balanceOf(user.address)).to.equal(depositAmount);
    });

    it("should reject withdrawals from non-managers", async function () {
      const MANAGER_ROLE = await treasury.MANAGER_ROLE();
      await expect(treasury.connect(stranger).withdraw(ethers.ZeroAddress, user.address, ethers.parseEther("1")))
        .to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, MANAGER_ROLE);
    });
  });

  describe("KorriSettlement", function () {
    let settlementAmount = ethers.parseEther("200");

    beforeEach(async function () {
      // Transfer MockKRW to user to execute settlements
      await mockKRW.connect(admin).transfer(user.address, ethers.parseEther("10000"));
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
