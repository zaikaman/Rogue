import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying Rogue Yield Optimizer contracts to Polygon...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC\n");

  // Check minimum balance for deployment
  const minBalance = ethers.parseEther("0.1");
  if (balance < minBalance) {
    throw new Error(
      `Insufficient balance. Need at least 0.1 MATIC, have ${ethers.formatEther(balance)} MATIC`
    );
  }

  // Polygon Mainnet token addresses
  const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC on Polygon
  const KRWQ_ADDRESS = "0x0000000000000000000000000000000000000000"; // TODO: Replace with actual KRWQ address

  // Deploy StakingProxy first (without YieldHarvester address)
  console.log("📝 Deploying StakingProxy...");
  const StakingProxy = await ethers.getContractFactory("StakingProxy");
  
  // Deploy with placeholder address, will update after YieldHarvester deployment
  const stakingProxy = await StakingProxy.deploy(
    USDC_ADDRESS,
    KRWQ_ADDRESS,
    deployer.address // Temporary - will update
  );
  await stakingProxy.waitForDeployment();
  const stakingProxyAddress = await stakingProxy.getAddress();
  console.log("✅ StakingProxy deployed to:", stakingProxyAddress, "\n");

  // Deploy YieldHarvester
  console.log("📝 Deploying YieldHarvester...");
  const YieldHarvester = await ethers.getContractFactory("YieldHarvester");
  const yieldHarvester = await YieldHarvester.deploy(stakingProxyAddress);
  await yieldHarvester.waitForDeployment();
  const yieldHarvesterAddress = await yieldHarvester.getAddress();
  console.log("✅ YieldHarvester deployed to:", yieldHarvesterAddress, "\n");

  // Update StakingProxy with correct YieldHarvester address
  console.log("📝 Updating StakingProxy with YieldHarvester address...");
  const updateTx = await stakingProxy.updateYieldHarvester(yieldHarvesterAddress);
  await updateTx.wait();
  console.log("✅ StakingProxy updated\n");

  // Add protocol integrations to YieldHarvester
  console.log("📝 Adding protocol integrations...");
  
  // Aave v3 Pool on Polygon
  const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
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
  console.log("  KRWQ:", KRWQ_ADDRESS);
  console.log("  Deployer:", deployer.address);
  console.log("\nProtocols:");
  console.log("  Aave v3:", AAVE_POOL);
  console.log("  Frax:", FRAX_PROTOCOL);
  console.log("═══════════════════════════════════════════════\n");

  // Save deployment info
  const deploymentInfo = {
    network: "polygon",
    stakingProxy: stakingProxyAddress,
    yieldHarvester: yieldHarvesterAddress,
    usdc: USDC_ADDRESS,
    krwq: KRWQ_ADDRESS,
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
