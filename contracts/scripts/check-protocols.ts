import { ethers } from 'hardhat';

async function main() {
  const YIELD_HARVESTER = '0xc597b6484931A42d95658f3aE032487a718a17B9';
  
  const yieldHarvester = await ethers.getContractAt('YieldHarvester', YIELD_HARVESTER);
  
  console.log('\n📋 Checking YieldHarvester protocols...\n');
  
  const protocolNames = ['aave', 'moonwell', 'morpho', 'aerodrome'];
  
  for (const name of protocolNames) {
    try {
      const address = await yieldHarvester.protocols(name);
      if (address === ethers.ZeroAddress) {
        console.log(`❌ ${name}: NOT CONFIGURED`);
      } else {
        console.log(`✅ ${name}: ${address}`);
      }
    } catch (error: any) {
      console.log(`⚠️  ${name}: ERROR - ${error.message}`);
    }
  }
  
  console.log('\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
