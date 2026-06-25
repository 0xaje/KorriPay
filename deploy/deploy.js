import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Deploy MockKRWStable
  const initialSupply = ethers.parseEther("10000000"); // 10,000,000 MockKRW
  const MockKRWStable = await ethers.getContractFactory("MockKRWStable");
  const mockKRW = await MockKRWStable.deploy(deployer.address, initialSupply);
  await mockKRW.waitForDeployment();
  console.log("MockKRWStable deployed to:", await mockKRW.getAddress());

  // 2. Deploy KorriTreasury
  const KorriTreasury = await ethers.getContractFactory("KorriTreasury");
  const treasury = await KorriTreasury.deploy(deployer.address);
  await treasury.waitForDeployment();
  console.log("KorriTreasury deployed to:", await treasury.getAddress());

  // 3. Deploy KorriSettlement
  const KorriSettlement = await ethers.getContractFactory("KorriSettlement");
  const settlement = await KorriSettlement.deploy(deployer.address, await treasury.getAddress());
  await settlement.waitForDeployment();
  console.log("KorriSettlement deployed to:", await settlement.getAddress());

  // 4. Configure Roles
  // Grant SETTLEMENT_ROLE to the KorriSettlement contract so it can transfer assets from the treasury
  const SETTLEMENT_ROLE = await treasury.SETTLEMENT_ROLE();
  const tx = await treasury.grantRole(SETTLEMENT_ROLE, await settlement.getAddress());
  await tx.wait();
  console.log("Granted SETTLEMENT_ROLE to KorriSettlement on KorriTreasury");

  console.log("------------------------------------------------");
  console.log("Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
