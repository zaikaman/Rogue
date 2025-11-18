# Quick Deployment Guide

## Prerequisites

1. **Set up `.env` file** in `contracts/` directory:
```env
PRIVATE_KEY=0xYourPrivateKeyHere
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY
POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY
ETHERSCAN_API_KEY=your_etherscan_api_key
BASESCAN_API_KEY=your_basescan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

2. **Get testnet funds:**
   - Polygon Amoy: https://faucet.polygon.technology/
   - Sepolia: https://sepoliafaucet.com/
   - Base Sepolia: https://www.coinbase.com/faucets/base-sepolia-faucet

## Deploy Commands

```powershell
# Navigate to contracts directory
cd contracts

# Install dependencies (first time only)
npm install

# Compile contracts
npx hardhat compile

# Deploy to Sepolia
npx hardhat run scripts/deploy.ts --network sepolia

# Deploy to Base Sepolia
npx hardhat run scripts/deploy.ts --network baseSepolia

# Deploy to Polygon Amoy
npx hardhat run scripts/deploy.ts --network polygon
```

## After Deployment

1. **Copy contract addresses** to `backend/.env`:
```env
STAKING_PROXY_ADDRESS=0x...
YIELD_HARVESTER_ADDRESS=0x...
```

2. **Save deployment JSON** to `contracts/deployments/{network}.json`

3. **Verify contracts** on block explorer:
```powershell
# Sepolia
npx hardhat verify --network sepolia 0xYieldHarvesterAddress "0xDeployerAddress"

# Base Sepolia
npx hardhat verify --network baseSepolia 0xYieldHarvesterAddress "0xDeployerAddress"

# Polygon Amoy
npx hardhat verify --network polygon 0xYieldHarvesterAddress "0xDeployerAddress"
```

## Network-Specific Information

### Sepolia (ChainID: 11155111)
- Min Balance: 0.05 ETH
- Protocols: Aave v3, Compound v3
- Block Explorer: https://sepolia.etherscan.io/

### Base Sepolia (ChainID: 84532)
- Min Balance: 0.01 ETH
- Protocols: Aave v3
- Block Explorer: https://sepolia.basescan.org/

### Polygon Amoy (ChainID: 80002)
- Min Balance: 0.1 POL
- Protocols: Aave v3
- Block Explorer: https://amoy.polygonscan.com/

## Troubleshooting

**"Network sepolia doesn't exist"**
- ✅ Fixed! The `hardhat.config.ts` now includes all networks.

**"Insufficient balance"**
- Get testnet funds from faucets listed above.

**"PRIVATE_KEY not configured"**
- Create `.env` file from `.env.example` and add your private key.

**"Contract verification failed"**
- Ensure you have the correct API key in `.env`.
- Wait a few minutes after deployment before verifying.

## Get Testnet Tokens

Visit the Aave Faucet to get testnet USDC, DAI, and other tokens:
https://app.aave.com/faucet/

## Full Documentation

See `DEPLOYMENT.md` for complete deployment guide.
