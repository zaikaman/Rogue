import { ethers } from "hardhat";

async function main() {
  console.log("Deploying Rogue contracts to Polygon mainnet...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC");

  // Check minimum balance for deployment
  const minBalance = ethers.parseEther("0.1");
  if (balance < minBalance) {
    throw new Error(
      `Insufficient balance. Need at least 0.1 MATIC, have ${ethers.formatEther(balance)} MATIC`
    );
  }

  console.log("✅ Deployment script configured for Polygon mainnet");
  console.log("📋 Ready to deploy StakingProxy and YieldHarvester (Phase 3)");
  
  // Actual contract deployments will be added in Phase 3 - User Story 1
  // Example deployment flow:
  // const StakingProxy = await ethers.getContractFactory("StakingProxy");
  // const stakingProxy = await StakingProxy.deploy();
  // await stakingProxy.waitForDeployment();
  // console.log("StakingProxy deployed to:", await stakingProxy.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
