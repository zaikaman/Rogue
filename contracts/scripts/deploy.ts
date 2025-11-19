import { ethers, network } from "hardhat";

// Network-specific configuration
interface NetworkConfig {
  name: string;
  chainId: number;
  nativeCurrency: string;
  minBalance: string;
  tokens: {
    USDC: string;
    DAI?: string;
    WETH?: string;
  };
  protocols: {
    aave?: string;
    moonwell?: string;
    morpho?: string;
    aerodrome?: string;
    compound?: string;
  };
}

const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  base: {
    name: "Base Mainnet",
    chainId: 8453,
    nativeCurrency: "ETH",
    minBalance: "0.01",
    tokens: {
      USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base Mainnet USDC
      DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",  // Base Mainnet DAI
      WETH: "0x4200000000000000000000000000000000000006", // Base Mainnet WETH
    },
    protocols: {
      aave: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",       // Aave v3 Pool
      moonwell: "0xfBb21d0380beE3312B33c4353c8936a0F13EF26C",   // Moonwell Comptroller
      morpho: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",     // Morpho Blue
      aerodrome: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", // Aerodrome Router
    },
  },
};

async function main() {
  // Get network configuration
  const networkName = network.name;
  const config = NETWORK_CONFIGS[networkName];

  if (!config) {
    throw new Error(
      `Network ${networkName} not supported. Supported networks: ${Object.keys(NETWORK_CONFIGS).join(", ")}`
    );
  }

  console.log(`🚀 Deploying Rogue Yield Optimizer contracts to ${config.name}...\n`);

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), config.nativeCurrency, "\n");

  // Use network-specific token addresses
  const USDC_ADDRESS = config.tokens.USDC;

  console.log("📝 Token Configuration:");
  console.log("  Network:", config.name);
  console.log("  Chain ID:", config.chainId);
  console.log("  USDC:", USDC_ADDRESS);
  if (config.tokens.DAI) console.log("  DAI:", config.tokens.DAI);
  if (config.tokens.WETH) console.log("  WETH:", config.tokens.WETH);
  console.log();

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

  // Add protocol integrations to YieldHarvester with proper nonce management
  console.log("📝 Adding protocol integrations...");
  
  try {
    // Add Aave V3
    if (config.protocols.aave) {
      const tx1 = await yieldHarvester.addProtocol("Aave", config.protocols.aave);
      await tx1.wait();
      console.log("✅ Added Aave V3:", config.protocols.aave);
    }

    // Add Moonwell
    if (config.protocols.moonwell) {
      const tx2 = await yieldHarvester.addProtocol("Moonwell", config.protocols.moonwell);
      await tx2.wait();
      console.log("✅ Added Moonwell:", config.protocols.moonwell);
    }

    // Add Morpho Blue
    if (config.protocols.morpho) {
      const tx3 = await yieldHarvester.addProtocol("Morpho", config.protocols.morpho);
      await tx3.wait();
      console.log("✅ Added Morpho Blue:", config.protocols.morpho);
    }

    // Add Aerodrome
    if (config.protocols.aerodrome) {
      const tx4 = await yieldHarvester.addProtocol("Aerodrome", config.protocols.aerodrome);
      await tx4.wait();
      console.log("✅ Added Aerodrome:", config.protocols.aerodrome);
    }

    // Add Compound v3 if available
    if (config.protocols.compound) {
      const tx5 = await yieldHarvester.addProtocol("Compound", config.protocols.compound);
      await tx5.wait();
      console.log("✅ Added Compound V3:", config.protocols.compound);
    }
  } catch (error: any) {
    console.log("⚠️  Protocol integration step failed (non-critical):", error.message);
    console.log("   You can add protocols manually later using the admin functions\n");
  }

  console.log();

  // Summary
  console.log("═══════════════════════════════════════════════");
  console.log("🎉 Deployment Complete!\n");
  console.log("Network:", config.name);
  console.log("Chain ID:", config.chainId);
  console.log("\nContract Addresses:");
  console.log("  StakingProxy:", stakingProxyAddress);
  console.log("  YieldHarvester:", yieldHarvesterAddress);
  console.log("\nToken Configuration:");
  console.log("  USDC:", USDC_ADDRESS);
  if (config.tokens.DAI) console.log("  DAI:", config.tokens.DAI);
  if (config.tokens.WETH) console.log("  WETH:", config.tokens.WETH);
  console.log("\nDeployer:", deployer.address);
  console.log("\nProtocol Integrations:");
  if (config.protocols.aave) console.log("  Aave v3:", config.protocols.aave);
  if (config.protocols.compound) console.log("  Compound v3:", config.protocols.compound);
  console.log("═══════════════════════════════════════════════\n");

  // Save deployment info
  const deploymentInfo = {
    network: config.name,
    networkKey: networkName,
    chainId: config.chainId,
    stakingProxy: stakingProxyAddress,
    yieldHarvester: yieldHarvesterAddress,
    tokens: {
      usdc: USDC_ADDRESS,
      dai: config.tokens.DAI,
      weth: config.tokens.WETH,
    },
    protocols: config.protocols,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  console.log("📄 Save this deployment info to your backend/.env:\n");
  console.log(`STAKING_PROXY_ADDRESS=${stakingProxyAddress}`);
  console.log(`YIELD_HARVESTER_ADDRESS=${yieldHarvesterAddress}`);
  console.log(`\n📄 Full deployment info (save to deployments/${networkName}.json):\n`);
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
