# Contract Deployments

This directory stores deployment information for each network.

## Deployed Networks

After deploying to a network, the deployment script will output JSON that should be saved here:

- `polygon.json` - Polygon Amoy Testnet (ChainID: 80002)
- `sepolia.json` - Ethereum Sepolia Testnet (ChainID: 11155111)
- `baseSepolia.json` - Base Sepolia Testnet (ChainID: 84532)

## Deployment Info Format

```json
{
  "network": "Network Name",
  "networkKey": "hardhat_network_name",
  "chainId": 12345,
  "stakingProxy": "0x...",
  "yieldHarvester": "0x...",
  "tokens": {
    "usdc": "0x...",
    "dai": "0x...",
    "weth": "0x..."
  },
  "protocols": {
    "aave": "0x...",
    "compound": "0x..."
  },
  "deployer": "0x...",
  "timestamp": "2025-11-18T..."
}
```

## Usage

After deployment, update your backend `.env` file with the contract addresses:

```env
STAKING_PROXY_ADDRESS=0x...
YIELD_HARVESTER_ADDRESS=0x...
```
