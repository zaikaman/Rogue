/**
 * Lido Liquid Staking Integration
 * Provides ETH staking with stETH liquid staking tokens
 */

import { ethers } from 'ethers';
import { logger } from '../utils/logger';

const LIDO_CONTRACTS = {
  sepolia: '0x3e3FE7dBc6B4C189E7128855dD526361c49b40Af', // Lido Sepolia testnet
  mainnet: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' // For reference
};

interface StakingInfo {
  totalStaked: string;
  currentAPR: number;
  stETHBalance: string;
  pendingRewards: string;
}

/**
 * Get current Lido staking APR
 */
export async function getLidoAPR(
  chain: 'sepolia' | 'mainnet' = 'sepolia'
): Promise<number> {
  try {
    logger.info('Fetching Lido APR', { chain });

    // For testnet, return simulated APR
    // In production, fetch from Lido API
    const simulatedAPR = 3.5 + Math.random() * 1.5; // 3.5-5% range

    return Number(simulatedAPR.toFixed(2));

    // Production implementation:
    // const response = await axios.get('https://stake.lido.fi/api/sma-steth-apr');
    // return response.data.apr;

  } catch (error: any) {
    logger.error('Failed to get Lido APR', { error: error.message });
    return 4.0; // Fallback APR
  }
}

/**
 * Get staking info for address
 */
export async function getStakingInfo(
  address: string,
  chain: 'sepolia' | 'mainnet' = 'sepolia'
): Promise<StakingInfo> {
  try {
    // Simulate staking info for testnet
    const info: StakingInfo = {
      totalStaked: ethers.parseEther('10').toString(),
      currentAPR: await getLidoAPR(chain),
      stETHBalance: ethers.parseEther('10.05').toString(),
      pendingRewards: ethers.parseEther('0.05').toString()
    };

    return info;

    // Production implementation with Lido contract
    // const lido = new ethers.Contract(lidoAddress, LIDO_ABI, provider);
    // const stETHBalance = await lido.balanceOf(address);
    // ...

  } catch (error: any) {
    logger.error('Failed to get staking info', {
      error: error.message,
      address
    });
    throw new Error(`Staking info failed: ${error.message}`);
  }
}

/**
 * Build stake transaction
 */
export async function buildStakeTransaction(
  amount: string,
  fromAddress: string,
  chain: 'sepolia' | 'mainnet' = 'sepolia'
): Promise<{
  to: string;
  data: string;
  value: string;
  gas: string;
}> {
  try {
    logger.info('Building Lido stake transaction', {
      amount,
      fromAddress,
      chain
    });

    const lidoAddress = LIDO_CONTRACTS[chain];

    // Simple submit() call - just send ETH to Lido
    const tx = {
      to: lidoAddress,
      data: '0xa1903eab', // submit() function selector
      value: amount,
      gas: '150000'
    };

    return tx;

  } catch (error: any) {
    logger.error('Failed to build stake transaction', {
      error: error.message
    });
    throw new Error(`Stake build failed: ${error.message}`);
  }
}

/**
 * Check if staking is profitable vs other yields
 */
export function isStakingProfitable(
  lidoAPR: number,
  alternativeAPY: number
): boolean {
  // Consider Lido if APR is within 1% of best alternative
  // Factor in liquidity of stETH
  const liquidityPremium = 0.5; // stETH is highly liquid
  const adjustedLidoAPR = lidoAPR + liquidityPremium;

  return adjustedLidoAPR >= alternativeAPY - 1;
}

/**
 * Estimate staking rewards
 */
export function estimateStakingRewards(
  stakedAmount: string,
  apr: number,
  days: number
): string {
  const amount = BigInt(stakedAmount);
  const dailyRate = BigInt(Math.floor((apr / 365) * 1e6)); // 6 decimals precision
  const rewards = (amount * dailyRate * BigInt(days)) / BigInt(1e6) / BigInt(100);
  
  return rewards.toString();
}
