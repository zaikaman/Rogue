import { Agent } from '@iqai/adk';
import { getAaveMarkets, getAaveYieldsForAssets } from '../services/aave-subgraph';
import { getFraxPools, getFraxYieldsForToken } from '../services/frax-api';
import { getMultipleAssetPrices } from '../services/chainlink-oracle';
import logger from '../utils/logger';

/**
 * Researcher Agent
 * 
 * Scans Frax pools and Aave markets via APIs/subgraphs
 * Outputs: market_data with current yields and liquidity
 */

const RESEARCHER_INSTRUCTIONS = `You are the Researcher agent for Rogue Yield Optimizer.

Your task is to scan DeFi protocols (Frax Finance and Aave v3 on Polygon) to discover the best yield opportunities.

You have access to these tools:
- scanAaveMarkets: Query Aave v3 for current deposit APYs and liquidity
- scanFraxPools: Query Frax Finance for pool yields
- getAssetPrices: Get current prices from Chainlink oracles

Your output should be a comprehensive market scan including:
1. Top yielding opportunities sorted by APY
2. Available liquidity for each protocol
3. Current asset prices
4. Risk indicators (utilization rate, pool depth)

Focus on:
- USDC and KRWQ compatible pools
- Minimum $50k liquidity to ensure execution viability
- Filter out deprecated or paused markets

Return data in this format:
{
  "aaveMarkets": [...],
  "fraxPools": [...],
  "assetPrices": {...},
  "topOpportunities": [...],
  "scanTimestamp": timestamp
}`;

export const researcherAgent = new Agent({
  name: "ResearcherAgent",
  instructions: RESEARCHER_INSTRUCTIONS,
  model: "gpt-4o", // Fast for data aggregation
  tools: [
    {
      name: "scanAaveMarkets",
      description: "Scan Aave v3 Polygon markets for current deposit APYs and liquidity",
      parameters: {
        type: "object",
        properties: {
          assets: {
            type: "array",
            items: { type: "string" },
            description: "Optional: specific assets to query (e.g., ['USDC', 'WMATIC']). If not provided, fetches all markets."
          }
        }
      },
      execute: async (args: { assets?: string[] }) => {
        try {
          if (args.assets && args.assets.length > 0) {
            const yieldsMap = await getAaveYieldsForAssets(args.assets);
            const yields = Array.from(yieldsMap.entries()).map(([symbol, data]) => ({
              protocol: 'Aave v3',
              asset: symbol,
              depositAPY: data.depositAPY.toFixed(2) + '%',
              totalSupply: data.totalSupply,
              availableLiquidity: data.availableLiquidity,
              utilizationRate: data.utilizationRate.toFixed(2) + '%',
              lastUpdate: new Date(data.lastUpdate * 1000).toISOString()
            }));
            return { success: true, data: yields };
          } else {
            const markets = await getAaveMarkets();
            const formattedMarkets = markets.map(market => ({
              protocol: 'Aave v3',
              asset: market.symbol,
              depositAPY: market.depositAPY.toFixed(2) + '%',
              totalSupply: market.totalSupply,
              availableLiquidity: market.availableLiquidity,
              utilizationRate: market.utilizationRate.toFixed(2) + '%',
              lastUpdate: new Date(market.lastUpdate * 1000).toISOString()
            }));
            return { success: true, data: formattedMarkets };
          }
        } catch (error: any) {
          logger.error('scanAaveMarkets tool error', { error: error.message });
          return { success: false, error: error.message };
        }
      }
    },
    {
      name: "scanFraxPools",
      description: "Scan Frax Finance pools for yield opportunities",
      parameters: {
        type: "object",
        properties: {
          token: {
            type: "string",
            description: "Optional: specific token to filter pools (e.g., 'USDC', 'KRWQ')"
          }
        }
      },
      execute: async (args: { token?: string }) => {
        try {
          let pools;
          if (args.token) {
            pools = await getFraxYieldsForToken(args.token);
          } else {
            pools = await getFraxPools();
          }

          const formattedPools = pools.map(pool => ({
            protocol: 'Frax Finance',
            poolId: pool.poolId,
            poolName: pool.poolName,
            apy: pool.apy.toFixed(2) + '%',
            tvl: pool.tvl,
            tokens: pool.tokens
          }));

          return { success: true, data: formattedPools };
        } catch (error: any) {
          logger.error('scanFraxPools tool error', { error: error.message });
          return { success: false, error: error.message };
        }
      }
    },
    {
      name: "getAssetPrices",
      description: "Get current asset prices from Chainlink oracles",
      parameters: {
        type: "object",
        properties: {
          pairs: {
            type: "array",
            items: { type: "string" },
            description: "Asset pairs to fetch (e.g., ['USDC/USD', 'MATIC/USD'])"
          }
        },
        required: ["pairs"]
      },
      execute: async (args: { pairs: string[] }) => {
        try {
          const prices = await getMultipleAssetPrices(
            args.pairs as any,
            'moderate'
          );

          const pricesObj: Record<string, string> = {};
          prices.forEach((price, pair) => {
            pricesObj[pair] = `$${price.toFixed(6)}`;
          });

          return { success: true, data: pricesObj };
        } catch (error: any) {
          logger.error('getAssetPrices tool error', { error: error.message });
          return { success: false, error: error.message };
        }
      }
    }
  ]
});

/**
 * Run the Researcher agent manually
 * (Also used by cron jobs for autonomous scanning)
 */
export async function runResearcherAgent(sessionId: string): Promise<any> {
  try {
    logger.info('Running Researcher agent', { sessionId });

    // In production, you would run this through ADK-TS App
    // For now, execute tools directly for initial implementation
    const aaveMarkets = await getAaveMarkets();
    const fraxPools = await getFraxPools();
    const assetPrices = await getMultipleAssetPrices(
      ['USDC/USD', 'MATIC/USD', 'WETH/USD'],
      'moderate'
    );

    // Combine and rank opportunities
    const opportunities = [
      ...aaveMarkets.map(m => ({
        protocol: 'Aave v3',
        asset: m.symbol,
        apy: m.depositAPY,
        tvl: m.totalSupply,
        risk: 'low'
      })),
      ...fraxPools.map(p => ({
        protocol: 'Frax Finance',
        asset: p.poolName,
        apy: p.apy,
        tvl: p.tvl,
        risk: 'medium'
      }))
    ].sort((a, b) => b.apy - a.apy);

    const marketData = {
      aaveMarkets,
      fraxPools,
      assetPrices: Object.fromEntries(assetPrices),
      topOpportunities: opportunities.slice(0, 10),
      scanTimestamp: new Date().toISOString()
    };

    logger.info('Researcher agent completed', {
      sessionId,
      aaveMarkets: aaveMarkets.length,
      fraxPools: fraxPools.length,
      topOpportunities: opportunities.length
    });

    return marketData;
  } catch (error: any) {
    logger.error('Researcher agent failed', {
      error: error.message,
      sessionId
    });
    throw error;
  }
}
