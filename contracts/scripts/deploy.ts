import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying Rogue Yield Optimizer contracts to Polygon Amoy Testnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "POL\n");

  // Check minimum balance for deployment
  const minBalance = ethers.parseEther("0.1");
  if (balance < minBalance) {
    throw new Error(
      `Insufficient balance. Need at least 0.1 POL, have ${ethers.formatEther(balance)} POL`
    );
  }

  // Polygon Amoy Testnet token addresses
  const USDC_ADDRESS = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"; // USDC on Polygon Amoy

  console.log("📝 Token Configuration:");
  console.log("  USDC:", USDC_ADDRESS, "\n");

  // Deploy YieldHarvester first with a placeholder address
  console.log("📝 Deploying YieldHarvester...");
  const YieldHarvester = await ethers.getContractFactory("YieldHarvester");
  // Use deployer address as temporary stakingProxy address
  const yieldHarvester = await YieldHarvester.deploy(deployer.address);
  await yieldHarvester.waitForDeployment();
  const yieldHarvesterAddress = await yieldHarvester.getAddress();
  console.log("✅ YieldHarvester deployed to:", yieldHarvesterAddress, "\n");

  // Deploy StakingProxy with the actual YieldHarvester address
  console.log("📝 Deploying StakingProxy...");
  const StakingProxy = await ethers.getContractFactory("StakingProxy");
  
  const stakingProxy = await StakingProxy.deploy(
    USDC_ADDRESS,
    yieldHarvesterAddress
  );
  await stakingProxy.waitForDeployment();
  const stakingProxyAddress = await stakingProxy.getAddress();
  console.log("✅ StakingProxy deployed to:", stakingProxyAddress, "\n");

  // Update YieldHarvester with correct StakingProxy address
  console.log("📝 Updating YieldHarvester with StakingProxy address...");
  const updateTx = await yieldHarvester.updateStakingProxy(stakingProxyAddress);
  await updateTx.wait();
  console.log("✅ YieldHarvester updated\n");

  // Add protocol integrations to YieldHarvester
  console.log("📝 Adding protocol integrations...");
  
  // Aave v3 Pool on Polygon Amoy Testnet
  // Note: This address may need verification for Amoy testnet
  const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"; // TODO: Verify Aave v3 address on Amoy
  await yieldHarvester.addProtocol("Aave", AAVE_POOL);
  console.log("✅ Added Aave protocol integration");

  // Frax (placeholder - update with actual address)
  const FRAX_PROTOCOL = "0x0000000000000000000000000000000000000001";
  await yieldHarvester.addProtocol("Frax", FRAX_PROTOCOL);
  console.log("✅ Added Frax protocol integration\n");

  // Summary
  console.log("═══════════════════════════════════════════════");
  console.log("🎉 Deployment Complete!\n");
  console.log("Contract Addresses:");
  console.log("  StakingProxy:", stakingProxyAddress);
  console.log("  YieldHarvester:", yieldHarvesterAddress);
  console.log("\nConfiguration:");
  console.log("  USDC:", USDC_ADDRESS);
  console.log("  Deployer:", deployer.address);
  console.log("\nProtocols:");
  console.log("  Aave v3:", AAVE_POOL);
  console.log("  Frax:", FRAX_PROTOCOL);
  console.log("═══════════════════════════════════════════════\n");

  // Save deployment info
  const deploymentInfo = {
    network: "polygon-amoy-testnet",
    chainId: 80002,
    stakingProxy: stakingProxyAddress,
    yieldHarvester: yieldHarvesterAddress,
    usdc: USDC_ADDRESS,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  console.log("📄 Save this deployment info to backend/src/utils/constants.ts\n");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
