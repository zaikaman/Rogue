import { ethers } from 'ethers';
import { getProvider } from '../utils/rpc';
import logger from '../utils/logger';

/**
 * ATP Token Contract Wrapper
 * Autonomous Treasury Protocol (ATP) rewards token
 * 
 * In production, this would interact with a deployed ERC-20 ATP token contract.
 * For MVP, rewards are calculated off-chain and distributed via YieldHarvester.
 */

// ATP Token address (update after deployment)
const ATP_TOKEN_ADDRESS = process.env.ATP_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000';

// ERC-20 ABI for ATP token
const ATP_TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

/**
 * Get ATP token contract instance
 */
export function getATPTokenContract(signer?: ethers.Signer) {
  const provider = signer || getProvider();
  return new ethers.Contract(ATP_TOKEN_ADDRESS, ATP_TOKEN_ABI, provider);
}

/**
 * Get ATP token balance for an address
 */
export async function getATPBalance(address: string): Promise<string> {
  try {
    const contract = getATPTokenContract();
    const balance = await contract.balanceOf(address);
    return ethers.formatUnits(balance, 18); // ATP has 18 decimals
  } catch (error: any) {
    logger.error('Failed to get ATP balance', { error: error.message, address });
    return '0';
  }
}

/**
 * Get total ATP supply
 */
export async function getTotalATPSupply(): Promise<string> {
  try {
    const contract = getATPTokenContract();
    const supply = await contract.totalSupply();
    return ethers.formatUnits(supply, 18);
  } catch (error: any) {
    logger.error('Failed to get ATP total supply', { error: error.message });
    return '0';
  }
}

/**
 * Transfer ATP tokens (requires signer)
 */
export async function transferATP(
  signer: ethers.Signer,
  to: string,
  amount: string
): Promise<string> {
  try {
    const contract = getATPTokenContract(signer);
    const amountWei = ethers.parseUnits(amount, 18);

    logger.info('Transferring ATP tokens', { to, amount });

    const tx = await contract.transfer(to, amountWei);
    const receipt = await tx.wait();

    logger.info('ATP transfer successful', {
      to,
      amount,
      txHash: receipt.hash
    });

    return receipt.hash;
  } catch (error: any) {
    logger.error('ATP transfer failed', { error: error.message, to, amount });
    throw error;
  }
}

/**
 * Approve spender to use ATP tokens (for YieldHarvester)
 */
export async function approveATP(
  signer: ethers.Signer,
  spender: string,
  amount: string
): Promise<string> {
  try {
    const contract = getATPTokenContract(signer);
    const amountWei = ethers.parseUnits(amount, 18);

    logger.info('Approving ATP spending', { spender, amount });

    const tx = await contract.approve(spender, amountWei);
    const receipt = await tx.wait();

    logger.info('ATP approval successful', {
      spender,
      amount,
      txHash: receipt.hash
    });

    return receipt.hash;
  } catch (error: any) {
    logger.error('ATP approval failed', { error: error.message, spender, amount });
    throw error;
  }
}

/**
 * Get ATP token allowance
 */
export async function getATPAllowance(
  owner: string,
  spender: string
): Promise<string> {
  try {
    const contract = getATPTokenContract();
    const allowance = await contract.allowance(owner, spender);
    return ethers.formatUnits(allowance, 18);
  } catch (error: any) {
    logger.error('Failed to get ATP allowance', { error: error.message, owner, spender });
    return '0';
  }
}

/**
 * Mock ATP reward calculation for positions
 * In production, this would read from YieldHarvester contract
 */
export function calculateMockATPRewards(
  positionValue: number,
  riskTier: 'low' | 'medium' | 'high',
  daysActive: number
): number {
  // Base rate per $1000 TVL per day
  const baseRates = {
    low: 1.0,
    medium: 1.5,
    high: 2.0
  };

  const baseRate = baseRates[riskTier];
  const dailyReward = (positionValue / 1000) * baseRate;
  const totalReward = dailyReward * daysActive;

  return parseFloat(totalReward.toFixed(4));
}

export default {
  getATPTokenContract,
  getATPBalance,
  getTotalATPSupply,
  transferATP,
  approveATP,
  getATPAllowance,
  calculateMockATPRewards
};
