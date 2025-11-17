/**
 * Tokenomics Service
 * Manages $RGE token fees, rewards, and pro-rata distributions
 */

import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { getSupabaseClient } from './supabase';

interface FeeStructure {
  managementFee: number; // % of yields (1-2%)
  performanceFee: number; // % of trade profits (10-20%)
  holderDistribution: number; // % to $RGE holders (20% of fees)
  treasuryRetention: number; // % to treasury (80% of fees)
}

const DEFAULT_FEES: FeeStructure = {
  managementFee: 0.02, // 2% of yields
  performanceFee: 0.15, // 15% of profits
  holderDistribution: 0.20, // 20% to holders
  treasuryRetention: 0.80 // 80% to treasury
};

/**
 * Calculate fees on yield
 */
export function calculateYieldFees(
  yieldAmount: string,
  fees: FeeStructure = DEFAULT_FEES
): {
  totalFee: string;
  managementFee: string;
  userReceives: string;
  toHolders: string;
  toTreasury: string;
} {
  const yield_bn = BigInt(yieldAmount);
  
  // Management fee: 2% of yields
  const managementFee = (yield_bn * BigInt(Math.floor(fees.managementFee * 1e6))) / BigInt(1e6);
  
  // Split fee: 20% to holders, 80% to treasury
  const toHolders = (managementFee * BigInt(Math.floor(fees.holderDistribution * 1e6))) / BigInt(1e6);
  const toTreasury = managementFee - toHolders;
  
  const userReceives = yield_bn - managementFee;

  return {
    totalFee: managementFee.toString(),
    managementFee: managementFee.toString(),
    userReceives: userReceives.toString(),
    toHolders: toHolders.toString(),
    toTreasury: toTreasury.toString()
  };
}

/**
 * Calculate fees on trade profits
 */
export function calculateTradeFees(
  profitAmount: string,
  fees: FeeStructure = DEFAULT_FEES
): {
  totalFee: string;
  performanceFee: string;
  userReceives: string;
  toHolders: string;
  toTreasury: string;
} {
  const profit_bn = BigInt(profitAmount);
  
  // Performance fee: 15% of profits
  const performanceFee = (profit_bn * BigInt(Math.floor(fees.performanceFee * 1e6))) / BigInt(1e6);
  
  // Split fee
  const toHolders = (performanceFee * BigInt(Math.floor(fees.holderDistribution * 1e6))) / BigInt(1e6);
  const toTreasury = performanceFee - toHolders;
  
  const userReceives = profit_bn - performanceFee;

  return {
    totalFee: performanceFee.toString(),
    performanceFee: performanceFee.toString(),
    userReceives: userReceives.toString(),
    toHolders: toHolders.toString(),
    toTreasury: toTreasury.toString()
  };
}

/**
 * Calculate pro-rata rewards for $RGE holder
 */
export async function calculateProRataRewards(
  holderAddress: string,
  totalFeePool: string
): Promise<{
  holderBalance: string;
  totalSupply: string;
  sharePercentage: number;
  rewardAmount: string;
}> {
  try {
    // In production, fetch from $RGE token contract
    // For now, simulate
    const holderBalance = ethers.parseUnits('1000', 18).toString(); // 1000 $RGE
    const totalSupply = ethers.parseUnits('1000000', 18).toString(); // 1M total supply

    const holderBN = BigInt(holderBalance);
    const totalBN = BigInt(totalSupply);
    const poolBN = BigInt(totalFeePool);

    const sharePercentage = Number(holderBN * BigInt(10000) / totalBN) / 100; // 0.1%
    const rewardAmount = (poolBN * holderBN) / totalBN;

    return {
      holderBalance,
      totalSupply,
      sharePercentage,
      rewardAmount: rewardAmount.toString()
    };

  } catch (error: any) {
    logger.error('Failed to calculate pro-rata rewards', {
      error: error.message,
      holderAddress
    });
    throw error;
  }
}

/**
 * Distribute rewards to $RGE holders
 */
export async function distributeRewards(
  feePool: string,
  holders: string[]
): Promise<{
  totalDistributed: string;
  distributions: Array<{
    holder: string;
    amount: string;
    sharePercentage: number;
  }>;
}> {
  try {
    logger.info('Distributing rewards to $RGE holders', {
      feePool,
      holdersCount: holders.length
    });

    const distributions = await Promise.all(
      holders.map(async (holder) => {
        const reward = await calculateProRataRewards(holder, feePool);
        return {
          holder,
          amount: reward.rewardAmount,
          sharePercentage: reward.sharePercentage
        };
      })
    );

    const totalDistributed = distributions
      .reduce((sum, d) => sum + BigInt(d.amount), BigInt(0))
      .toString();

    // Log to database
    const supabase = getSupabaseClient();
    await supabase.from('reward_distributions').insert(
      distributions.map(d => ({
        holder_address: d.holder,
        amount: d.amount,
        share_percentage: d.sharePercentage,
        distributed_at: new Date().toISOString()
      }))
    );

    return {
      totalDistributed,
      distributions
    };

  } catch (error: any) {
    logger.error('Failed to distribute rewards', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Record fee collection
 */
export async function recordFeeCollection(
  positionId: string,
  feeType: 'management' | 'performance',
  amount: string,
  toHolders: string,
  toTreasury: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    await supabase.from('fee_collections').insert({
      position_id: positionId,
      fee_type: feeType,
      total_amount: amount,
      to_holders: toHolders,
      to_treasury: toTreasury,
      collected_at: new Date().toISOString()
    });

    logger.info('Fee collection recorded', {
      positionId,
      feeType,
      amount
    });

  } catch (error: any) {
    logger.error('Failed to record fee collection', {
      error: error.message,
      positionId
    });
  }
}

/**
 * Get user's share of platform fees
 */
export async function getUserFeeShare(
  userAddress: string,
  period: 'day' | 'week' | 'month' = 'month'
): Promise<{
  totalEarned: string;
  breakdownByType: {
    management: string;
    performance: string;
  };
  rgeBalance: string;
  sharePercentage: number;
}> {
  try {
    const supabase = getSupabaseClient();

    // Calculate time range
    const now = new Date();
    const startDate = new Date(now);
    if (period === 'day') startDate.setDate(now.getDate() - 1);
    else if (period === 'week') startDate.setDate(now.getDate() - 7);
    else startDate.setMonth(now.getMonth() - 1);

    // Fetch distributions
    const { data: distributions } = await supabase
      .from('reward_distributions')
      .select('*')
      .eq('holder_address', userAddress.toLowerCase())
      .gte('distributed_at', startDate.toISOString());

    const totalEarned = (distributions || [])
      .reduce((sum, d) => sum + BigInt(d.amount), BigInt(0))
      .toString();

    // Get $RGE balance
    const balance = ethers.parseUnits('1000', 18).toString(); // Simulated

    return {
      totalEarned,
      breakdownByType: {
        management: totalEarned, // Simplified
        performance: '0'
      },
      rgeBalance: balance,
      sharePercentage: 0.1 // Simulated 0.1%
    };

  } catch (error: any) {
    logger.error('Failed to get user fee share', {
      error: error.message,
      userAddress
    });
    throw error;
  }
}

/**
 * Calculate estimated annual rewards for $RGE holder
 */
export function estimateAnnualRewards(
  rgeBalance: string,
  totalSupply: string,
  estimatedAnnualFees: string
): {
  sharePercentage: number;
  estimatedRewards: string;
  apy: number;
} {
  const balanceBN = BigInt(rgeBalance);
  const supplyBN = BigInt(totalSupply);
  const feesBN = BigInt(estimatedAnnualFees);

  const sharePercentage = Number(balanceBN * BigInt(10000) / supplyBN) / 100;
  
  // 20% of fees go to holders
  const holderPool = (feesBN * BigInt(20)) / BigInt(100);
  const estimatedRewards = (holderPool * balanceBN) / supplyBN;

  // APY based on current $RGE value (assume $1 per token for simplicity)
  const investmentValue = balanceBN / BigInt(1e18);
  const rewardValue = estimatedRewards / BigInt(1e18);
  const apy = Number(rewardValue * BigInt(100) / investmentValue);

  return {
    sharePercentage,
    estimatedRewards: estimatedRewards.toString(),
    apy: Number(apy.toFixed(2))
  };
}
