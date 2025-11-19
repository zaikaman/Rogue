import axios from 'axios';
import logger from '../utils/logger';

/**
 * Aave v3 Base Mainnet Subgraph client
 * Official subgraph for querying Aave yield rates, markets, and liquidity
 */

const AAVE_V3_BASE_SUBGRAPH = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-base';

// Rate conversion constants
const RAY = 10 ** 27;
const SECONDS_PER_YEAR = 31536000;

interface AaveReserve {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  liquidityRate: string;
  variableBorrowRate: string;
  availableLiquidity: string;
  totalATokenSupply: string;
  lastUpdateTimestamp: number;
}

interface AaveYieldData {
  asset: string;
  symbol: string;
  depositAPY: number;
  variableBorrowAPY: number;
  totalSupply: string;
  availableLiquidity: string;
  utilizationRate: number;
  lastUpdate: number;
}

/**
 * Convert RAY APR to APY percentage
 * Formula: APY = (1 + apr/SECONDS_PER_YEAR)^SECONDS_PER_YEAR - 1
 */
function rayAprToApy(liquidityRate: string): number {
  const apr = parseFloat(liquidityRate) / RAY;
  const apy = (Math.pow(1 + apr / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1) * 100;
  return apy;
}

/**
 * Query Aave subgraph
 */
async function queryAaveSubgraph(query: string, variables?: Record<string, any>): Promise<any> {
  try {
    const response = await axios.post(
      AAVE_V3_BASE_SUBGRAPH,
      {
        query,
        variables
      },
      {
        headers: {
          'Content-Type': 'application/json',
          // Add API key if using The Graph Studio
          ...(process.env.GRAPH_API_KEY && {
            'Authorization': `Bearer ${process.env.GRAPH_API_KEY}`
          })
        },
        timeout: 10000
      }
    );

    if (response.data.errors) {
      logger.error('Aave subgraph query errors', { errors: response.data.errors });
      throw new Error(`Subgraph query failed: ${response.data.errors[0].message}`);
    }

    return response.data.data;
  } catch (error: any) {
    logger.error('Failed to query Aave subgraph', {
      error: error.message,
      query
    });
    throw error;
  }
}

/**
 * Get current deposit APY for specific asset (e.g., USDC)
 */
export async function getAaveDepositAPY(symbol: string): Promise<number | null> {
  const query = `
    query GetAssetAPY($symbol: String!) {
      reserves(where: { symbol: $symbol }) {
        id
        symbol
        name
        liquidityRate
        variableBorrowRate
        availableLiquidity
        totalATokenSupply
        lastUpdateTimestamp
      }
    }
  `;

  try {
    const data = await queryAaveSubgraph(query, { symbol });
    
    if (!data || !data.reserves || data.reserves.length === 0) {
      logger.warn('Aave reserve not found', { symbol });
      return null;
    }

    const reserve: AaveReserve = data.reserves[0];
    const depositAPY = rayAprToApy(reserve.liquidityRate);

    logger.info('Fetched Aave deposit APY', { symbol, depositAPY: depositAPY.toFixed(2) });
    return depositAPY;
  } catch (error: any) {
    logger.error('Failed to fetch Aave deposit APY', { error: error.message, symbol });
    return null;
  }
}

/**
 * Get all available Aave markets with yield data
 */
export async function getAaveMarkets(): Promise<AaveYieldData[]> {
  const query = `
    query GetAllMarkets {
      reserves(
        orderBy: totalATokenSupply
        orderDirection: desc
        first: 20
      ) {
        id
        symbol
        name
        decimals
        liquidityRate
        variableBorrowRate
        availableLiquidity
        totalATokenSupply
        lastUpdateTimestamp
      }
    }
  `;

  try {
    const data = await queryAaveSubgraph(query);
    
    if (!data || !data.reserves) {
      logger.warn('No Aave markets found');
      return [];
    }

    const markets: AaveYieldData[] = data.reserves.map((reserve: AaveReserve) => {
      const totalSupply = parseFloat(reserve.totalATokenSupply);
      const available = parseFloat(reserve.availableLiquidity);
      const utilizationRate = totalSupply > 0 ? ((totalSupply - available) / totalSupply) * 100 : 0;

      return {
        asset: reserve.id,
        symbol: reserve.symbol,
        depositAPY: rayAprToApy(reserve.liquidityRate),
        variableBorrowAPY: rayAprToApy(reserve.variableBorrowRate),
        totalSupply: reserve.totalATokenSupply,
        availableLiquidity: reserve.availableLiquidity,
        utilizationRate,
        lastUpdate: reserve.lastUpdateTimestamp
      };
    });

    logger.info('Fetched Aave markets', { count: markets.length });
    return markets;
  } catch (error: any) {
    logger.error('Failed to fetch Aave markets', { error: error.message });
    return [];
  }
}

/**
 * Get yield data for multiple assets at once
 */
export async function getAaveYieldsForAssets(symbols: string[]): Promise<Map<string, AaveYieldData>> {
  const query = `
    query GetMultipleAssets($symbols: [String!]!) {
      reserves(where: { symbol_in: $symbols }) {
        id
        symbol
        name
        decimals
        liquidityRate
        variableBorrowRate
        availableLiquidity
        totalATokenSupply
        lastUpdateTimestamp
      }
    }
  `;

  try {
    const data = await queryAaveSubgraph(query, { symbols });
    
    if (!data || !data.reserves) {
      logger.warn('No Aave reserves found for symbols', { symbols });
      return new Map();
    }

    const yieldsMap = new Map<string, AaveYieldData>();

    data.reserves.forEach((reserve: AaveReserve) => {
      const totalSupply = parseFloat(reserve.totalATokenSupply);
      const available = parseFloat(reserve.availableLiquidity);
      const utilizationRate = totalSupply > 0 ? ((totalSupply - available) / totalSupply) * 100 : 0;

      yieldsMap.set(reserve.symbol, {
        asset: reserve.id,
        symbol: reserve.symbol,
        depositAPY: rayAprToApy(reserve.liquidityRate),
        variableBorrowAPY: rayAprToApy(reserve.variableBorrowRate),
        totalSupply: reserve.totalATokenSupply,
        availableLiquidity: reserve.availableLiquidity,
        utilizationRate,
        lastUpdate: reserve.lastUpdateTimestamp
      });
    });

    logger.info('Fetched Aave yields for assets', { symbols, count: yieldsMap.size });
    return yieldsMap;
  } catch (error: any) {
    logger.error('Failed to fetch Aave yields for assets', { error: error.message, symbols });
    return new Map();
  }
}

/**
 * Get historical yield rates over time (for charts)
 */
export async function getAaveHistoricalRates(
  symbol: string,
  startTime: number,
  endTime: number
): Promise<Array<{ timestamp: number; depositAPY: number }>> {
  const query = `
    query GetHistoricalRates($symbol: String!, $startTime: Int!, $endTime: Int!) {
      reserveParamsHistoryItems(
        where: {
          reserve_: { symbol: $symbol }
          timestamp_gte: $startTime
          timestamp_lte: $endTime
        }
        orderBy: timestamp
        orderDirection: asc
        first: 1000
      ) {
        timestamp
        liquidityRate
      }
    }
  `;

  try {
    const data = await queryAaveSubgraph(query, { symbol, startTime, endTime });
    
    if (!data || !data.reserveParamsHistoryItems) {
      logger.warn('No historical data found for Aave reserve', { symbol, startTime, endTime });
      return [];
    }

    const historicalRates = data.reserveParamsHistoryItems.map((item: any) => ({
      timestamp: item.timestamp,
      depositAPY: rayAprToApy(item.liquidityRate)
    }));

    logger.info('Fetched Aave historical rates', {
      symbol,
      dataPoints: historicalRates.length,
      startTime,
      endTime
    });

    return historicalRates;
  } catch (error: any) {
    logger.error('Failed to fetch Aave historical rates', { error: error.message, symbol });
    return [];
  }
}

/**
 * Health check for Aave subgraph
 */
export async function checkAaveSubgraphHealth(): Promise<boolean> {
  try {
    const query = `
      query HealthCheck {
        reserves(first: 1) {
          id
          symbol
        }
      }
    `;
    
    const data = await queryAaveSubgraph(query);
    return !!data && !!data.reserves;
  } catch (error: any) {
    logger.error('Aave subgraph health check failed', { error: error.message });
    return false;
  }
}
