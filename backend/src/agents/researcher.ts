import { AgentBuilder, createTool } from '@iqai/adk';
import * as z from 'zod';
import dedent from 'dedent';
import { getAaveMarkets } from '../services/aave-subgraph';
import { getFraxPools } from '../services/frax-api';
import { getMultipleAssetPrices } from '../services/chainlink-oracle';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

/**
 * Tool: Scan Aave markets
 */
const scanAaveTool = createTool({
  name: 'scan_aave_markets',
  description: 'Scan Aave v3 markets on Polygon for yield opportunities',
  fn: async (_, context) => {
    const markets = await getAaveMarkets();
    context.state.set('aave_markets', markets);
    return {
      protocol: 'Aave v3',
      marketsFound: markets.length,
      markets: markets.map((market: any) => ({
        token: market.symbol,
        depositAPY: market.depositAPY,
        tvl: market.totalSupply
      }))
    };
  }
});

/**
 * Tool: Scan Frax pools
 */
const scanFraxTool = createTool({
  name: 'scan_frax_pools',
  description: 'Scan Frax Finance pools for yield opportunities',
  fn: async (_, context) => {
    const pools = await getFraxPools();
    context.state.set('frax_pools', pools);
    return {
      protocol: 'Frax Finance',
      poolsFound: pools.length,
      pools: pools.map((pool: any) => ({
        name: pool.poolName,
        apy: pool.apy,
        tvl: pool.tvl
      }))
    };
  }
});

/**
 * Tool: Get asset prices
 */
const getAssetPricesTool = createTool({
  name: 'get_asset_prices',
  description: 'Get current prices for multiple assets from Chainlink oracles',
  schema: z.object({
    pairs: z.array(z.string()).describe('Price pairs like USDC/USD, MATIC/USD')
  }) as any,
  fn: async ({ pairs }) => {
    const prices = await getMultipleAssetPrices(pairs, 'moderate');
    return {
      prices: Object.fromEntries(prices),
      timestamp: new Date().toISOString()
    };
  }
});

/**
 * Tool: Store research results
 */
const storeResearchTool = createTool({
  name: 'store_research_results',
  description: 'Store research findings in database and agent state',
  schema: z.object({
    sessionId: z.string(),
    topOpportunities: z.array(z.object({
      protocol: z.string(),
      asset: z.string(),
      apy: z.number(),
      tvl: z.number(),
      risk: z.string()
    })),
    totalScanned: z.number()
  }) as any,
  fn: async (params: any, context: any) => {
    const { sessionId, topOpportunities, totalScanned } = params;
    // Log to database
    const supabase = getSupabaseClient();
    await supabase.from('agent_logs').insert({
      agent_name: 'Researcher',
      action: 'market_scan',
      status: 'success',
      metadata: {
        sessionId,
        opportunitiesFound: totalScanned,
        topAPY: topOpportunities[0]?.apy || 0,
        protocols: ['Aave v3', 'Frax Finance']
      },
      created_at: new Date().toISOString()
    });

    // Store in agent state for workflow
    context.state.set('market_data', {
      topOpportunities,
      totalScanned,
      timestamp: new Date().toISOString()
    });

    return { 
      stored: true, 
      opportunitiesStored: topOpportunities.length,
      message: `Stored ${topOpportunities.length} opportunities in database`
    };
  }
});

/**
 * Create the Researcher Agent using ADK
 */
export async function createResearcherAgent() {
  const { runner } = await AgentBuilder.create('researcher_agent')
    .withModel(process.env.OPENAI_MODEL || 'gpt-4o-mini')
    .withDescription('Scans DeFi protocols for yield opportunities on Polygon')
    .withInstruction(dedent`
      You are the Researcher Agent for Rogue, a DeFi yield optimizer on Polygon.

      Your mission: Scan Aave v3 and Frax Finance to find the best yield opportunities.

      Process:
      1. Use scan_aave_markets to get all Aave v3 lending markets
      2. Use scan_frax_pools to get all Frax Finance liquidity pools
      3. Use get_asset_prices to fetch current prices for ['USDC/USD', 'MATIC/USD', 'WETH/USD']
      4. Analyze all opportunities and identify the top 10 by APY
      5. Use store_research_results to save your findings with sessionId

      Analysis criteria:
      - Prioritize sustainable yields (avoid ponzi-like >100% APYs)
      - Consider protocol TVL and security
      - Account for gas costs on Polygon
      - Flag high-risk opportunities

      Return a summary with:
      - Total markets/pools scanned
      - Top 10 opportunities ranked by APY
      - Current asset prices
      - Risk assessment for each opportunity (low/medium/high)
    `)
    .withTools(scanAaveTool, scanFraxTool, getAssetPricesTool, storeResearchTool)
    .build();

  return runner;
}

/**
 * Run the Researcher agent
 */
export async function runResearcherAgent(sessionId: string): Promise<any> {
  try {
    logger.info('🤖 Running Researcher agent', { sessionId });

    const agent = await createResearcherAgent();

    // Run the ADK agent
    const response = await agent.ask(
      `Scan all DeFi markets for yield opportunities. Session: ${sessionId}`
    );

    logger.info('✅ Researcher agent completed', {
      sessionId,
      response: typeof response === 'string' ? response : JSON.stringify(response)
    });

    // Also fetch raw data for immediate use (agent runs async)
    const [aaveMarkets, fraxPools, assetPrices] = await Promise.all([
      getAaveMarkets(),
      getFraxPools(),
      getMultipleAssetPrices(['USDC/USD', 'MATIC/USD', 'WETH/USD'], 'moderate')
    ]);

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
      scanTimestamp: new Date().toISOString(),
      agentResponse: response
    };

    return marketData;
  } catch (error: any) {
    logger.error('Researcher agent failed', {
      error: error.message,
      sessionId
    });

    const supabase = getSupabaseClient();
    await supabase.from('agent_logs').insert({
      agent_name: 'Researcher',
      action: 'market_scan',
      status: 'failed',
      notes: error.message,
      metadata: { sessionId },
      created_at: new Date().toISOString()
    });

    throw error;
  }
}

