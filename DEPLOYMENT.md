# Rogue Yield Agent - Production Deployment Guide

## Overview
This guide covers deploying Rogue's multichain yield farming platform to testnet environments (Polygon Amoy, Sepolia, Base Sepolia).

## Prerequisites

### Required Accounts
- **Alchemy** - RPC node provider (free tier sufficient for testnet)
- **1inch API** - DEX aggregation (optional for testnets, get key from https://portal.1inch.dev)
- **Supabase** - PostgreSQL database with Row Level Security
- **Private Key** - Wallet with testnet funds on all chains

### Testnet Faucets
- Polygon Amoy: https://faucet.polygon.technology/
- Sepolia (Ethereum): https://sepoliafaucet.com/
- Base Sepolia: https://www.coinbase.com/faucets/base-sepolia-faucet
- Aave Faucet (for testnet tokens): https://app.aave.com/faucet/

### Testnet Token Addresses

**Polygon Amoy (ChainID: 80002)**
- USDC: `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`
- DAI: `0x001B3B4d0F3714Ca98ba10F6042DaEbF0B1B7b6F`
- WMATIC: `0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9`
- Aave v3 Pool: `0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951`

**Sepolia (ChainID: 11155111)**
- USDC: `0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8`
- DAI: `0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357`
- WETH: `0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c`
- Aave v3 Pool: `0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951`
- Compound v3 USDC: `0xAec1F48e02Cfb822Be958B68C7957156EB3F0b6e`

**Base Sepolia (ChainID: 84532)**
- USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- DAI: `0x7268Fdf2Eb25F8A1Fb8365B69d65A6c8423ff333`
- WETH: `0x4200000000000000000000000000000000000006`
- Aave v3 Pool: `0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b`

---

## Step 1: Environment Configuration

Create `.env` files in both `backend/` and `frontend/` directories.

### Backend `.env`

```env
# Server
NODE_ENV=development
PORT=3001

# Frontend
FRONTEND_URL=http://localhost:5173

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Blockchain RPC URLs (Alchemy recommended)
POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Executor Wallet (KEEP PRIVATE - testnet only)
EXECUTOR_PRIVATE_KEY=0x<your-private-key-here>

# Smart Contracts (deploy first, then add addresses)
YIELD_HARVESTER_ADDRESS=0x...
STAKING_PROXY_ADDRESS=0x...
ATP_TOKEN_ADDRESS=0x...

# 1inch API (optional for testnets)
ONEINCH_API_KEY=your-1inch-api-key

# OpenAI API (for AI agents)
OPENAI_API_KEY=sk-...
```

### Frontend `.env`

```env
VITE_API_URL=http://localhost:3001
VITE_CHAIN_ID=80002
VITE_NETWORK_NAME=Polygon Amoy Testnet
```

---

## Step 2: Database Setup

### 2.1 Create Supabase Project
1. Go to https://supabase.com
2. Create new project
3. Copy URL and API keys to backend `.env`

### 2.2 Run Database Migration
```powershell
# Navigate to backend
cd backend

# Copy schema to Supabase SQL Editor and execute
# File: backend/src/db/schema.sql
```

**Key Tables Created:**
- `strategies` - Yield farming strategies across protocols
- `positions` - User positions with multichain support
- `transaction_records` - On-chain transaction history
- `portfolio_holdings` - Cross-chain asset balances
- `bridge_transactions` - LayerZero bridge operations
- `fee_distributions` - ATP token reward distributions

### 2.3 Configure Row Level Security (RLS)
The schema includes RLS policies that:
- Allow users to read their own data
- Restrict writes to authenticated service role
- Enable public read of strategies

---

## Step 3: Smart Contract Deployment

### 3.1 Deploy Contracts

The deployment script is now **network-aware** and will automatically use the correct addresses for each testnet.

```powershell
# Navigate to contracts directory
cd contracts

# Install dependencies
npm install

# Deploy to Polygon Amoy testnet
npx hardhat run scripts/deploy.ts --network polygon

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.ts --network sepolia

# Deploy to Base Sepolia
npx hardhat run scripts/deploy.ts --network baseSepolia
```

**Network Configuration:**
- **Polygon Amoy**: USDC, DAI, WMATIC, Aave v3
- **Sepolia**: USDC, DAI, WETH, Aave v3, Compound v3
- **Base Sepolia**: USDC, DAI, WETH, Aave v3

### 3.2 Update Contract Addresses
After deployment, the script will output the addresses. Copy them to `backend/.env`:

```env
YIELD_HARVESTER_ADDRESS=0x... # YieldHarvester contract
STAKING_PROXY_ADDRESS=0x...   # StakingProxy contract
ATP_TOKEN_ADDRESS=0x...        # ATPToken contract (if deployed)
```

**Save Deployment Info:**
The script also outputs JSON. Save it to `contracts/deployments/{network}.json` for future reference.

### 3.3 Verify Contracts on Block Explorers

```powershell
# Verify on Polygon Amoy (PolygonScan)
npx hardhat verify --network polygon 0xYourYieldHarvesterAddress "0xDeployerAddress"
npx hardhat verify --network polygon 0xYourStakingProxyAddress "0xUSDCAddress" "0xYieldHarvesterAddress"

# Verify on Sepolia (Etherscan)
npx hardhat verify --network sepolia 0xYourYieldHarvesterAddress "0xDeployerAddress"
npx hardhat verify --network sepolia 0xYourStakingProxyAddress "0xUSDCAddress" "0xYieldHarvesterAddress"

# Verify on Base Sepolia (BaseScan)
npx hardhat verify --network baseSepolia 0xYourYieldHarvesterAddress "0xDeployerAddress"
npx hardhat verify --network baseSepolia 0xYourStakingProxyAddress "0xUSDCAddress" "0xYieldHarvesterAddress"
```

**Block Explorers:**
- Polygon Amoy: https://amoy.polygonscan.com/
- Sepolia: https://sepolia.etherscan.io/
- Base Sepolia: https://sepolia.basescan.org/

---

## Step 4: Backend Deployment

### 4.1 Install Dependencies
```powershell
cd backend
npm install
```

### 4.2 Build TypeScript
```powershell
npm run build
```

### 4.3 Start Server (Development)
```powershell
npm run dev
```

### 4.4 Start Server (Production)
```powershell
npm start
```

**Verify Backend:**
- Health check: http://localhost:3001/api/health
- Should return `{"status": "healthy", "timestamp": "..."}`

---

## Step 5: Frontend Deployment

### 5.1 Install Dependencies
```powershell
cd frontend
npm install
```

### 5.2 Start Development Server
```powershell
npm run dev
```

**Access Frontend:**
- URL: http://localhost:5173
- Connect wallet (MetaMask recommended)
- Switch to Polygon Amoy testnet

---

## Step 6: Initialize Strategies

Run the strategy seeding script to populate available yield opportunities:

```powershell
cd backend
node -e "
const { seedStrategies } = require('./dist/db/seed-strategies');
seedStrategies();
"
```

This creates strategies for:
- Aave V3 (Polygon Amoy, Sepolia, Base Sepolia)
- Compound V3 (Sepolia)
- Lido Staking (Sepolia)
- Uniswap V3 LP (Polygon Amoy, Sepolia)
- Curve Finance (Base Sepolia)

---

## Step 7: Fund Executor Wallet

The executor wallet needs testnet funds to execute transactions on behalf of users:

```powershell
# Polygon Amoy (MATIC)
# Send ~10 MATIC to executor address

# Sepolia (ETH)
# Send ~1 ETH to executor address

# Base Sepolia (ETH)
# Send ~0.5 ETH to executor address
```

**Get executor address:**
```javascript
import { ethers } from 'ethers';
const wallet = new ethers.Wallet(process.env.EXECUTOR_PRIVATE_KEY);
console.log(wallet.address);
```

---

## API Endpoints

### Core Features

**Swap** (1inch DEX aggregation)
- `GET /api/swap/quote` - Get swap quote
- `POST /api/swap/execute` - Execute swap
- `GET /api/swap/history/:address` - Swap history

**Bridge** (LayerZero cross-chain)
- `GET /api/bridge/quote` - Get bridge quote
- `POST /api/bridge/execute` - Execute bridge
- `GET /api/bridge/status/:txHash` - Check status
- `GET /api/bridge/history/:address` - Bridge history

**Portfolio** (Multi-chain holdings)
- `GET /api/portfolio/:address` - Get portfolio
- `POST /api/portfolio/sync` - Sync balances

**Multichain** (Yield opportunities)
- `GET /api/multichain/opportunities` - List opportunities
- `GET /api/multichain/optimal-chain` - Find best chain
- `GET /api/multichain/stats` - Platform statistics

**Legacy** (Existing features)
- `GET /api/positions` - User positions
- `GET /api/strategies` - Available strategies
- `POST /api/workflows/execute` - Run AI workflow

---

## Testing

### Test Swap Functionality
```bash
curl -X GET "http://localhost:3001/api/swap/quote?chain=amoy&fromToken=USDC&toToken=DAI&amount=1000000"
```

### Test Portfolio
```bash
curl -X GET "http://localhost:3001/api/portfolio/0xYourWalletAddress"
```

### Test Multichain Opportunities
```bash
curl -X GET "http://localhost:3001/api/multichain/opportunities?minApy=5&sortBy=apy"
```

---

## Production Checklist

### Security
- [ ] Use secure private keys (never commit to git)
- [ ] Enable Supabase RLS policies
- [ ] Set up API rate limiting
- [ ] Configure CORS properly
- [ ] Use environment-specific URLs

### Monitoring
- [ ] Set up error logging (Sentry, LogRocket)
- [ ] Monitor RPC usage (Alchemy dashboard)
- [ ] Track transaction success rates
- [ ] Monitor gas costs

### Smart Contracts
- [ ] Audit contracts before mainnet
- [ ] Test all contract functions
- [ ] Verify contracts on block explorers
- [ ] Set up multi-sig for contract ownership

### Database
- [ ] Regular backups configured
- [ ] Indexes optimized for queries
- [ ] Connection pooling configured
- [ ] Monitor query performance

---

## Troubleshooting

### Common Issues

**"EXECUTOR_PRIVATE_KEY not configured"**
- Add private key to `backend/.env`
- Ensure it starts with `0x`

**"Insufficient funds for gas"**
- Fund executor wallet from faucets
- Check balance: `wallet.getBalance()`

**"Contract not deployed"**
- Run deployment script
- Update addresses in `.env`

**"Supabase connection failed"**
- Check URL and keys in `.env`
- Verify project is active in Supabase dashboard

**"RPC request failed"**
- Check Alchemy API key is valid
- Verify network is accessible
- Try alternative RPC endpoint

---

## Mainnet Migration (Future)

When ready for mainnet:

1. **Audit Smart Contracts** - Security audit by Certik/OpenZeppelin
2. **Update RPC URLs** - Use mainnet endpoints
3. **Fund Contracts** - Deposit real assets
4. **Enable Real 1inch API** - Production API key required
5. **Update Frontend** - Change chain IDs to mainnet
6. **Test Thoroughly** - Small transactions first
7. **Monitor Closely** - Watch all transactions initially

---

## Support & Resources

- **1inch Docs**: https://docs.1inch.io/
- **LayerZero Docs**: https://layerzero.gitbook.io/
- **Lido Docs**: https://docs.lido.fi/
- **Aave Docs**: https://docs.aave.com/
- **Ethers.js**: https://docs.ethers.org/

---

## Contact

For issues or questions:
- GitHub Issues: https://github.com/zaikaman/Rogue/issues
- Discord: [Your Discord Server]
- Twitter: [@YourTwitter]

---

**Last Updated**: November 2025  
**Version**: 1.0.0  
**Network**: Polygon Amoy/Sepolia/Base Sepolia Testnets
