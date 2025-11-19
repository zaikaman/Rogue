/**
 * Enhanced Researcher Agent
 * Scans Base Mainnet DeFi opportunities: yields, LPs, swaps
 */

import { AgentBuilder, createTool } from '@iqai/adk';
import * as z from 'zod';
import dedent from 'dedent';
import { getAaveMarkets } from '../services/aave-subgraph';
import { getSwapQuote } from '../services/1inch-api';
import { getMultipleAssetPrices } from '../services/chainlink-oracle';
import { getSupabaseClient } from '../services/supabase';
import { logger } from '../utils/logger';

type Chain = 'base';

/**
 * Tool: Scan yields across chains
 */
const scanYieldsTool = createTool({
  name: 'scan_base_yields',
  description: 'Scan lending/staking yields on Base Mainnet (Aave V3, Aerodrome, Moonwell)',
  schema: z.object({
    chains: z.array(z.literal('base'))
  }) as any,
  fn: async ({ chains }: { chains: Chain[] }, context: any) => {
    const results: any = {};
    
    for (const chain of chains) {
      if (chain === 'base') {
        // Aave V3 on Base Mainnet
        const aave = await getAaveMarkets();
        results[chain] = {
          aave: aave.map((m: any) => ({
            asset: m.symbol,
            apy: m.depositAPY,
            tvl: m.totalSupply,
            protocol: 'Aave v3',
            chain: 'base'
          })),
          // TODO: Add Aerodrome and Moonwell when APIs are available
          placeholder: [{
            asset: 'USDC',
            apy: 6.2,
            tvl: '38000000',
            protocol: 'Moonwell',
            chain: 'base'
          }]
        };
      }
    }

    context.state.set('yield_opportunities', results);
    return results;
  }
});

/**
 * Tool: Scan LP opportunities
 */
const scanLPsTool = createTool({
  name: 'scan_lp_pools',
  description: 'Scan Uniswap V3 / Aerodrome LP pools on Base for fee opportunities',
  schema: z.object({
    chain: z.literal('base'),
    minTVL: z.number().optional()
  }) as any,
  fn: async ({ chain }: any) => {
    // TODO: Implement Base-specific LP scanning
    // For now return static data from multichain API
    return {
      chain,
      pools: [
        {
          pair: 'ETH/USDC',
          apr: 8.5,
          tvl: '92000000',
          fee: '0.05%',
          protocol: 'Uniswap V3'
        },
        {
          pair: 'USDC/DAI',
          apr: 12.3,
          tvl: '45000000',
          fee: '0.01%',
          protocol: 'Aerodrome'
        }
      ]
    };
  }
});

/**
 * Tool: Evaluate swap opportunities
 */
const evaluateSwapsTool = createTool({
  name: 'evaluate_swaps',
  description: 'Check swap rates for potential rebalancing on Base',
  schema: z.object({
    chain: z.literal('base'),
    from: z.string(),
    to: z.string(),
    amount: z.string()
  }) as any,
  fn: async ({ chain, from, to, amount }: any) => {
    const quote = await getSwapQuote(chain, from, to, amount);
    
    return {
      from,
      to,
      inputAmount: quote.fromAmount,
      outputAmount: quote.toAmount,
      priceImpact: quote.priceImpact,
      estimatedGas: quote.estimatedGas
    };
  }
});

/**
 * Tool: Store comprehensive research
 */
const storeEnhancedResearchTool = createTool({
  name: 'store_enhanced_research',
  description: 'Store all research findings including yields, LPs, swaps, bridges',
  schema: z.object({
    sessionId: z.string(),
    findings: z.object({
      yields: z.any(),
      lps: z.any(),
      swaps: z.any(),
      bridges: z.any()
    })
  }) as any,
  fn: async ({ sessionId, findings }: any, context: any) => {
    const supabase = getSupabaseClient();
    
    await supabase.from('agent_logs').insert({
      agent_name: 'researcher',
      action: 'comprehensive_scan',
      success: true,
      metadata: {
        sessionId,
        ...findings
      },
      created_at: new Date().toISOString()
    });

    context.state.set('research_complete', true);
    context.state.set('all_opportunities', findings);

    return {
      stored: true,
      totalOpportunities: Object.keys(findings).length
    };
  }
});

/**
 * Create Enhanced Researcher Agent
 */
export async function createEnhancedResearcherAgent() {
  const { runner } = await AgentBuilder.create('enhanced_researcher')
    .withModel(process.env.OPENAI_MODEL || 'gpt-4o-mini')
    .withDescription('Base Mainnet DeFi opportunity scanner for Rogue')
    .withInstruction(dedent`
      You are the Enhanced Researcher Agent for Rogue, an autonomous portfolio manager on Base Mainnet.

      Your mission: Scan ALL opportunities on Base: yields, LPs, staking.

      Base Mainnet Protocols:
      - Aave V3: Lending and borrowing (USDC, ETH, cbETH)
      - Aerodrome: DEX and liquidity pools
      - Moonwell: Lending protocol
      - Uniswap V3: DEX and LP pools

      Process:
      1. Use scan_base_yields to find lending/staking yields on Base
      2. Use scan_lp_pools to identify high-APR liquidity pools
      3. Use evaluate_swaps to check swap rates for key pairs (USDC/ETH, etc)
      4. Use store_enhanced_research to save all findings

      Ranking Criteria:
      - Filter yields >4% (low risk), >8% (medium), >12% (high)
      - Base has very low gas costs (~$0.01-0.05 per tx)
      - Assess IL risk for LPs (>20% annual fee revenue acceptable)

      Output: Top 10 opportunities ranked by risk-adjusted return, with:
      - Protocol, asset, APY/APR
      - TVL and risk tier (low/medium/high)
      - Gas estimates and action type (yield/LP/stake)
    `)
    .withTools(
      scanYieldsTool,
      scanLPsTool,
      evaluateSwapsTool,
      storeEnhancedResearchTool
    )
    .build();

  return runner;
}

/**
 * Run Enhanced Researcher Agent
 */
export async function runEnhancedResearcher(
  sessionId: string,
  chains: Chain[] = ['base']
): Promise<{
  yields: any;
  lps: any;
  swaps: any;
  topOpportunities: any[];
  timestamp: string;
}> {
  try {
    logger.info('🔍 Running Enhanced Researcher', { sessionId, chains });

    const agent = await createEnhancedResearcherAgent();

    const response = await agent.ask(
      `Scan all DeFi opportunities on chains: ${chains.join(', ')}. Session: ${sessionId}`
    );

    logger.info('✅ Enhanced Researcher completed', { response });

    // Fetch data in parallel for immediate use
    const [aaveMarkets, prices] = await Promise.all([
      getAaveMarkets(),
      getMultipleAssetPrices(['USDC/USD', 'ETH/USD'], 'moderate')
    ]);

    // Consolidate all opportunities (Base Mainnet only)
    const allOpportunities = [
      ...aaveMarkets.map((m: any) => ({
        protocol: 'Aave v3',
        chain: 'base',
        type: 'yield',
        asset: m.symbol,
        apy: m.depositAPY,
        tvl: m.totalSupply,
        risk: 'low'
      })),
      // Add static opportunities from multichain API
      {
        protocol: 'Uniswap V3',
        chain: 'base',
        type: 'lp',
        asset: 'ETH/USDC',
        apy: 8.5,
        tvl: '92000000',
        risk: 'medium'
      },
      {
        protocol: 'Aerodrome',
        chain: 'base',
        type: 'lp',
        asset: 'USDC/DAI',
        apy: 12.3,
        tvl: '45000000',
        risk: 'low'
      },
      {
        protocol: 'Moonwell',
        chain: 'base',
        type: 'yield',
        asset: 'USDC',
        apy: 6.2,
        tvl: '38000000',
        risk: 'medium'
      }
    ];

    const topOpportunities = allOpportunities
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 10);

    return {
      yields: { aaveMarkets },
      lps: { base: [] }, // TODO: Implement Base LP scanning
      swaps: { prices: Object.fromEntries(prices) },
      topOpportunities,
      timestamp: new Date().toISOString()
    };

  } catch (error: any) {
    logger.error('Enhanced Researcher failed', {
      error: error.message,
      sessionId
    });
    throw error;
  }
}
