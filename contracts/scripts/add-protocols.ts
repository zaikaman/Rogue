import { ethers } from "hardhat";

/**
 * Add protocol integrations to deployed YieldHarvester
 * Run: npx hardhat run scripts/add-protocols.ts --network base
 */

async function main() {
  // Use the already deployed YieldHarvester
  const YIELD_HARVESTER_ADDRESS = "0xc597b6484931A42d95658f3aE032487a718a17B9";

  console.log("📝 Adding protocols to YieldHarvester:", YIELD_HARVESTER_ADDRESS);

  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address, "\n");

  // Get YieldHarvester contract
  const YieldHarvester = await ethers.getContractFactory("YieldHarvester");
  const yieldHarvester = YieldHarvester.attach(YIELD_HARVESTER_ADDRESS);

  // Protocol addresses on Base Mainnet (lowercase names match backend)
  const protocols = {
    aave: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",       // Aave V3 Pool
    moonwell: "0xfBb21d0380beE3312B33c4353c8936a0F13EF26C",   // Moonwell Comptroller
    morpho: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",     // Morpho Blue
    aerodrome: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", // Aerodrome Router
  };

  for (const [name, address] of Object.entries(protocols)) {
    try {
      console.log(`Adding ${name}...`);
      const tx = await yieldHarvester.addProtocol(name, address);
      await tx.wait();
      console.log(`✅ Added ${name}: ${address}\n`);
    } catch (error: any) {
      console.log(`⚠️ Failed to add ${name}:`, error.message, "\n");
    }
  }

  console.log("✅ Protocol integration complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
