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
    compound?: string;
  };
}

const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  polygon: {
    name: "Polygon Amoy Testnet",
    chainId: 80002,
    nativeCurrency: "POL",
    minBalance: "0.1",
    tokens: {
      USDC: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // Polygon Amoy USDC
      DAI: "0x001B3B4d0F3714Ca98ba10F6042DaEbF0B1B7b6F",  // Polygon Amoy DAI
      WETH: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9", // Polygon Amoy WMATIC
    },
    protocols: {
      aave: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951", // Aave v3 Pool on Polygon Amoy
    },
  },
  sepolia: {
    name: "Ethereum Sepolia Testnet",
    chainId: 11155111,
    nativeCurrency: "ETH",
    minBalance: "0.05",
    tokens: {
      USDC: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8", // Sepolia USDC (Aave faucet)
      DAI: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357",  // Sepolia DAI (Aave faucet)
      WETH: "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c", // Sepolia WETH
    },
    protocols: {
      aave: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951", // Aave v3 Pool on Sepolia
      compound: "0xAec1F48e02Cfb822Be958B68C7957156EB3F0b6e", // Compound v3 USDC on Sepolia
    },
  },
  baseSepolia: {
    name: "Base Sepolia Testnet",
    chainId: 84532,
    nativeCurrency: "ETH",
    minBalance: "0.01",
    tokens: {
      USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
      DAI: "0x7268Fdf2Eb25F8A1Fb8365B69d65A6c8423ff333",  // Base Sepolia DAI (mock)
      WETH: "0x4200000000000000000000000000000000000006", // Base Sepolia WETH
    },
    protocols: {
      aave: "0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b", // Aave v3 Pool on Base Sepolia (check latest)
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

  // Check minimum balance for deployment
  const minBalance = ethers.parseEther(config.minBalance);
  if (balance < minBalance) {
    throw new Error(
      `Insufficient balance. Need at least ${config.minBalance} ${config.nativeCurrency}, have ${ethers.formatEther(balance)} ${config.nativeCurrency}`
    );
  }

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

  // Add protocol integrations to YieldHarvester
  console.log("📝 Adding protocol integrations...");
  
  // Add Aave v3 if available
  if (config.protocols.aave) {
    const tx1 = await yieldHarvester.addProtocol("Aave", config.protocols.aave);
    await tx1.wait();
    console.log("✅ Added Aave v3 protocol integration:", config.protocols.aave);
  }

  // Add Compound v3 if available (Sepolia only)
  if (config.protocols.compound) {
    const tx2 = await yieldHarvester.addProtocol("Compound", config.protocols.compound);
    await tx2.wait();
    console.log("✅ Added Compound v3 protocol integration:", config.protocols.compound);
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
