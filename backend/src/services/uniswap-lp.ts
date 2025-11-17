/**
 * Uniswap V3 Liquidity Provision
 * Manages LP positions for yield generation
 */

import { ethers } from 'ethers';
import { logger } from '../utils/logger';

const UNISWAP_CONTRACTS = {
  mumbai: {
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
  },
  sepolia: {
    factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
    positionManager: '0x1238536071E1c677A632429e3655c799b22cDA52'
  }
};

interface PoolInfo {
  address: string;
  token0: string;
  token1: string;
  fee: number;
  tvl: string;
  volume24h: string;
  apr: number;
}

/**
 * Get top LP pools by APR
 */
export async function getTopLPPools(
  chain: 'mumbai' | 'sepolia'
): Promise<PoolInfo[]> {
  try {
    logger.info('Fetching top LP pools', { chain });

    // Simulated pool data for testnet
    const pools: PoolInfo[] = [
      {
        address: '0x1234567890123456789012345678901234567890',
        token0: 'USDC',
        token1: 'WETH',
        fee: 3000, // 0.3%
        tvl: ethers.parseUnits('50000', 6).toString(),
        volume24h: ethers.parseUnits('10000', 6).toString(),
        apr: 12.5
      },
      {
        address: '0x2234567890123456789012345678901234567890',
        token0: 'USDC',
        token1: 'WMATIC',
        fee: 500, // 0.05%
        tvl: ethers.parseUnits('30000', 6).toString(),
        volume24h: ethers.parseUnits('8000', 6).toString(),
        apr: 15.2
      },
      {
        address: '0x3234567890123456789012345678901234567890',
        token0: 'WETH',
        token1: 'WMATIC',
        fee: 3000,
        tvl: ethers.parseUnits('40000', 6).toString(),
        volume24h: ethers.parseUnits('12000', 6).toString(),
        apr: 18.7
      }
    ];

    return pools.sort((a, b) => b.apr - a.apr).slice(0, 5);

  } catch (error: any) {
    logger.error('Failed to get LP pools', {
      error: error.message,
      chain
    });
    throw new Error(`LP pool fetch failed: ${error.message}`);
  }
}

/**
 * Calculate optimal LP range (concentrated liquidity)
 */
export function calculateLPRange(
  currentPrice: number,
  volatility: number,
  riskProfile: 'low' | 'medium' | 'high'
): {
  lowerPrice: number;
  upperPrice: number;
  concentration: number;
} {
  // Adjust range based on risk profile
  const rangeMultipliers: Record<'low' | 'medium' | 'high', number> = {
    low: 0.5,    // Wide range, less IL risk
    medium: 0.3,
    high: 0.15   // Narrow range, higher fees but more IL risk
  };

  const multiplier = rangeMultipliers[riskProfile];
  const priceRange = currentPrice * volatility * multiplier;

  return {
    lowerPrice: currentPrice - priceRange,
    upperPrice: currentPrice + priceRange,
    concentration: 1 / multiplier // Higher concentration for narrow ranges
  };
}

/**
 * Estimate LP returns
 */
export function estimateLPReturns(
  position: {
    amount0: string;
    amount1: string;
    apr: number;
  },
  days: number
): {
  feeRewards: string;
  impermanentLoss: string;
  netReturn: string;
} {
  const amount0 = BigInt(position.amount0);
  const amount1 = BigInt(position.amount1);
  const totalValue = amount0 + amount1; // Simplified

  // Calculate fee rewards
  const dailyAPR = position.apr / 365;
  const feeRewards = (totalValue * BigInt(Math.floor(dailyAPR * 100 * days))) / BigInt(10000);

  // Estimate IL (simplified: assume 5% for volatile pairs)
  const estimatedIL = totalValue / BigInt(20); // 5% IL

  const netReturn = feeRewards - estimatedIL;

  return {
    feeRewards: feeRewards.toString(),
    impermanentLoss: estimatedIL.toString(),
    netReturn: netReturn.toString()
  };
}

/**
 * Build add liquidity transaction
 */
export async function buildAddLiquidityTransaction(
  chain: 'mumbai' | 'sepolia',
  pool: PoolInfo,
  amount0: string,
  amount1: string,
  fromAddress: string
): Promise<{
  to: string;
  data: string;
  value: string;
  gas: string;
}> {
  try {
    logger.info('Building add liquidity transaction', {
      chain,
      pool: pool.address,
      amount0,
      amount1
    });

    const positionManager = UNISWAP_CONTRACTS[chain].positionManager;

    // Simulate transaction
    const tx = {
      to: positionManager,
      data: encodeAddLiquidityData(pool, amount0, amount1, fromAddress),
      value: '0',
      gas: '400000'
    };

    return tx;

  } catch (error: any) {
    logger.error('Failed to build add liquidity transaction', {
      error: error.message
    });
    throw new Error(`Add liquidity build failed: ${error.message}`);
  }
}

/**
 * Build collect fees transaction
 */
export async function buildCollectFeesTransaction(
  chain: 'mumbai' | 'sepolia',
  tokenId: string,
  recipient: string
): Promise<{
  to: string;
  data: string;
  value: string;
  gas: string;
}> {
  try {
    const positionManager = UNISWAP_CONTRACTS[chain].positionManager;

    const tx = {
      to: positionManager,
      data: encodeCollectFeesData(tokenId, recipient),
      value: '0',
      gas: '200000'
    };

    return tx;

  } catch (error: any) {
    logger.error('Failed to build collect fees transaction', {
      error: error.message
    });
    throw new Error(`Collect fees build failed: ${error.message}`);
  }
}

/**
 * Helper: Encode add liquidity data
 */
function encodeAddLiquidityData(
  pool: PoolInfo,
  amount0: string,
  amount1: string,
  recipient: string
): string {
  // Simplified encoding
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  return abiCoder.encode(
    ['address', 'address', 'uint24', 'uint256', 'uint256', 'address'],
    [pool.token0, pool.token1, pool.fee, amount0, amount1, recipient]
  );
}

/**
 * Helper: Encode collect fees data
 */
function encodeCollectFeesData(tokenId: string, recipient: string): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  return abiCoder.encode(
    ['uint256', 'address'],
    [tokenId, recipient]
  );
}
