import axios from 'axios';
import logger from '../utils/logger';

/**
 * Frax Finance API client for yield data
 * 
 * Note: Frax doesn't have a public REST API for all pools.
 * This implementation uses on-chain data queries via The Graph subgraph.
 * For production, consider direct contract calls or Frax's official SDK.
 */

const FRAX_SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/frax-finance/frax-polygon';

interface FraxPool {
  id: string;
  name: string;
  totalLiquidity: string;
  apy: number;
  token0: {
    symbol: string;
    address: string;
  };
  token1: {
    symbol: string;
    address: string;
  };
}

interface FraxYieldData {
  poolId: string;
  poolName: string;
  apy: number;
  tvl: string;
  tokens: string[];
}

/**
 * Query Frax pools via The Graph subgraph
 */
async function queryFraxSubgraph(query: string, variables?: Record<string, any>): Promise<any> {
  try {
    const response = await axios.post(
      FRAX_SUBGRAPH_URL,
      {
        query,
        variables
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (response.data.errors) {
      logger.error('Frax subgraph query errors', { errors: response.data.errors });
      throw new Error(`Subgraph query failed: ${response.data.errors[0].message}`);
    }

    return response.data.data;
  } catch (error: any) {
    logger.error('Failed to query Frax subgraph', {
      error: error.message,
      query
    });
    throw error;
  }
}

/**
 * Get all active Frax pools with yield data
 */
export async function getFraxPools(): Promise<FraxYieldData[]> {
  const query = `
    query GetFraxPools {
      pools(
        first: 10
        orderBy: totalLiquidity
        orderDirection: desc
        where: { totalLiquidity_gt: "100000" }
      ) {
        id
        name
        totalLiquidity
        token0 {
          symbol
          address
        }
        token1 {
          symbol
          address
        }
      }
    }
  `;

  try {
    const data = await queryFraxSubgraph(query);
    
    if (!data || !data.pools) {
      logger.warn('No Frax pools found');
      return [];
    }

    // Transform and calculate APY (simplified - in production use real yield calculations)
    const pools: FraxYieldData[] = data.pools.map((pool: FraxPool) => ({
      poolId: pool.id,
      poolName: pool.name || `${pool.token0.symbol}/${pool.token1.symbol}`,
      apy: calculateFraxPoolAPY(pool), // Placeholder calculation
      tvl: pool.totalLiquidity,
      tokens: [pool.token0.symbol, pool.token1.symbol]
    }));

    logger.info('Fetched Frax pools', { count: pools.length });
    return pools;
  } catch (error: any) {
    logger.error('Failed to fetch Frax pools', { error: error.message });
    return [];
  }
}

/**
 * Get yield data for specific Frax pool
 */
export async function getFraxPoolYield(poolId: string): Promise<FraxYieldData | null> {
  const query = `
    query GetFraxPool($poolId: String!) {
      pool(id: $poolId) {
        id
        name
        totalLiquidity
        token0 {
          symbol
          address
        }
        token1 {
          symbol
          address
        }
      }
    }
  `;

  try {
    const data = await queryFraxSubgraph(query, { poolId });
    
    if (!data || !data.pool) {
      logger.warn('Frax pool not found', { poolId });
      return null;
    }

    const pool = data.pool;
    return {
      poolId: pool.id,
      poolName: pool.name || `${pool.token0.symbol}/${pool.token1.symbol}`,
      apy: calculateFraxPoolAPY(pool),
      tvl: pool.totalLiquidity,
      tokens: [pool.token0.symbol, pool.token1.symbol]
    };
  } catch (error: any) {
    logger.error('Failed to fetch Frax pool yield', { error: error.message, poolId });
    return null;
  }
}

/**
 * Get Frax yields for specific token (e.g., USDC, KRWQ)
 */
export async function getFraxYieldsForToken(tokenSymbol: string): Promise<FraxYieldData[]> {
  const query = `
    query GetTokenPools($token: String!) {
      pools(
        first: 5
        orderBy: totalLiquidity
        orderDirection: desc
        where: {
          or: [
            { token0_: { symbol: $token } }
            { token1_: { symbol: $token } }
          ]
          totalLiquidity_gt: "50000"
        }
      ) {
        id
        name
        totalLiquidity
        token0 {
          symbol
          address
        }
        token1 {
          symbol
          address
        }
      }
    }
  `;

  try {
    const data = await queryFraxSubgraph(query, { token: tokenSymbol });
    
    if (!data || !data.pools) {
      logger.warn('No Frax pools found for token', { tokenSymbol });
      return [];
    }

    const pools: FraxYieldData[] = data.pools.map((pool: FraxPool) => ({
      poolId: pool.id,
      poolName: pool.name || `${pool.token0.symbol}/${pool.token1.symbol}`,
      apy: calculateFraxPoolAPY(pool),
      tvl: pool.totalLiquidity,
      tokens: [pool.token0.symbol, pool.token1.symbol]
    }));

    logger.info('Fetched Frax yields for token', { tokenSymbol, count: pools.length });
    return pools;
  } catch (error: any) {
    logger.error('Failed to fetch Frax yields for token', { error: error.message, tokenSymbol });
    return [];
  }
}

/**
 * Calculate APY for Frax pool (placeholder implementation)
 * 
 * In production, this should use:
 * - Historical swap fees
 * - FXS rewards
 * - veFXS boost multipliers
 * - Current utilization rate
 */
function calculateFraxPoolAPY(pool: FraxPool): number {
  // Placeholder: base rate + liquidity-based boost
  const tvl = parseFloat(pool.totalLiquidity);
  
  // Higher TVL = higher APY (simplified logic)
  let baseAPY = 5.0; // 5% base
  
  if (tvl > 1000000) {
    baseAPY = 8.0;
  } else if (tvl > 500000) {
    baseAPY = 6.5;
  }
  
  // Add random variance to simulate real market conditions
  const variance = (Math.random() - 0.5) * 2; // ±1%
  
  return Math.max(0, baseAPY + variance);
}

/**
 * Health check for Frax API
 */
export async function checkFraxAPIHealth(): Promise<boolean> {
  try {
    const query = `
      query HealthCheck {
        pools(first: 1) {
          id
        }
      }
    `;
    
    const data = await queryFraxSubgraph(query);
    return !!data && !!data.pools;
  } catch (error: any) {
    logger.error('Frax API health check failed', { error: error.message });
    return false;
  }
}
