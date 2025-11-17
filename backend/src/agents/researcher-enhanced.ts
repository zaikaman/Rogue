/**
 * Enhanced Researcher Agent
 * Scans multi-chain opportunities: yields, swaps, LPs, staking, bridges
 */

import { AgentBuilder, createTool } from '@iqai/adk';
import * as z from 'zod';
import dedent from 'dedent';
import { getAaveMarkets } from '../services/aave-subgraph';
import { getFraxPools } from '../services/frax-api';
import { getTopLPPools } from '../services/uniswap-lp';
import { getLidoAPR } from '../services/lido-staking';
import { getSwapQuote } from '../services/1inch-api';
import { getBridgeQuote } from '../services/layerzero-bridge';
import { getMultipleAssetPrices } from '../services/chainlink-oracle';
import { getSupabaseClient } from '../services/supabase';
import { logger } from '../utils/logger';

type Chain = 'mumbai' | 'sepolia' | 'base_sepolia';

/**
 * Tool: Scan yields across chains
 */
const scanYieldsTool = createTool({
  name: 'scan_multi_chain_yields',
  description: 'Scan lending/staking yields across Polygon Mumbai, Sepolia, and Base Sepolia',
  schema: z.object({
    chains: z.array(z.enum(['mumbai', 'sepolia', 'base_sepolia']))
  }) as any,
  fn: async ({ chains }: { chains: Chain[] }, context: any) => {
    const results: any = {};
    
    for (const chain of chains) {
      if (chain === 'mumbai') {
        // Aave + Frax on Polygon
        const [aave, frax] = await Promise.all([
          getAaveMarkets(),
          getFraxPools()
        ]);
        results[chain] = {
          aave: aave.map((m: any) => ({
            asset: m.symbol,
            apy: m.depositAPY,
            tvl: m.totalSupply,
            protocol: 'Aave v3'
          })),
          frax: frax.map((p: any) => ({
            asset: p.poolName,
            apy: p.apy,
            tvl: p.tvl,
            protocol: 'Frax'
          }))
        };
      } else if (chain === 'sepolia') {
        // Lido staking on Sepolia
        const lidoAPR = await getLidoAPR('sepolia');
        results[chain] = {
          lido: [{
            asset: 'ETH',
            apy: lidoAPR,
            tvl: '100000',
            protocol: 'Lido'
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
  description: 'Scan Uniswap V3 LP pools for fee opportunities',
  schema: z.object({
    chain: z.enum(['mumbai', 'sepolia']),
    minTVL: z.number().optional()
  }) as any,
  fn: async ({ chain }: any) => {
    const pools = await getTopLPPools(chain);
    
    return {
      chain,
      pools: pools.map(p => ({
        pair: `${p.token0}/${p.token1}`,
        apr: p.apr,
        tvl: p.tvl,
        fee: p.fee / 10000 + '%'
      }))
    };
  }
});

/**
 * Tool: Evaluate swap opportunities
 */
const evaluateSwapsTool = createTool({
  name: 'evaluate_swaps',
  description: 'Check swap rates for potential rebalancing',
  schema: z.object({
    chain: z.enum(['mumbai', 'sepolia', 'base_sepolia']),
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
 * Tool: Check bridge costs
 */
const checkBridgeCostsTool = createTool({
  name: 'check_bridge_costs',
  description: 'Evaluate costs of bridging assets between chains',
  schema: z.object({
    sourceChain: z.enum(['mumbai', 'sepolia', 'base_sepolia']),
    destChain: z.enum(['mumbai', 'sepolia', 'base_sepolia']),
    token: z.string(),
    amount: z.string()
  }) as any,
  fn: async ({ sourceChain, destChain, token, amount }: any) => {
    const quote = await getBridgeQuote(sourceChain, destChain, token, amount);
    
    return {
      sourceChain,
      destChain,
      bridgeFee: quote.estimatedFee,
      estimatedTime: quote.estimatedTime + ' seconds'
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
    .withDescription('Multi-chain DeFi opportunity scanner for Rogue')
    .withInstruction(dedent`
      You are the Enhanced Researcher Agent for Rogue, an autonomous multi-chain portfolio manager.

      Your mission: Scan ALL opportunities across chains: yields, LPs, swaps, bridges, staking.

      Chains to scan:
      - Polygon Mumbai: Aave, Frax, Uniswap V3 LPs
      - Ethereum Sepolia: Lido staking, Uniswap V3 LPs
      - Base Sepolia: Future expansion

      Process:
      1. Use scan_multi_chain_yields to find lending/staking yields on all chains
      2. Use scan_lp_pools to identify high-APR liquidity pools
      3. Use evaluate_swaps to check swap rates for key pairs (USDC/ETH, etc)
      4. Use check_bridge_costs to evaluate cross-chain opportunities
      5. Use store_enhanced_research to save all findings

      Ranking Criteria:
      - Filter yields >4% (low risk), >8% (medium), >12% (high)
      - Consider gas costs (prioritize Polygon for small amounts)
      - Flag bridge opportunities if APY gain >2% after fees
      - Assess IL risk for LPs (>20% annual fee revenue acceptable)

      Output: Top 10 opportunities ranked by risk-adjusted return, with:
      - Protocol, chain, asset, APY/APR
      - TVL and risk tier (low/medium/high)
      - Gas estimates and action type (hold/yield/swap/LP/stake/bridge)
    `)
    .withTools(
      scanYieldsTool,
      scanLPsTool,
      evaluateSwapsTool,
      checkBridgeCostsTool,
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
  chains: Chain[] = ['mumbai', 'sepolia']
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
    const [aaveMarkets, fraxPools, mumbaiLPs, sepoliaLPs, lidoAPR, prices] = await Promise.all([
      getAaveMarkets(),
      getFraxPools(),
      getTopLPPools('mumbai'),
      getTopLPPools('sepolia'),
      getLidoAPR('sepolia'),
      getMultipleAssetPrices(['USDC/USD', 'MATIC/USD', 'WETH/USD'], 'moderate')
    ]);

    // Consolidate all opportunities
    const allOpportunities = [
      ...aaveMarkets.map((m: any) => ({
        protocol: 'Aave v3',
        chain: 'mumbai',
        type: 'yield',
        asset: m.symbol,
        apy: m.depositAPY,
        tvl: m.totalSupply,
        risk: 'low'
      })),
      ...fraxPools.map((p: any) => ({
        protocol: 'Frax',
        chain: 'mumbai',
        type: 'yield',
        asset: p.poolName,
        apy: p.apy,
        tvl: p.tvl,
        risk: 'medium'
      })),
      ...mumbaiLPs.map(p => ({
        protocol: 'Uniswap V3',
        chain: 'mumbai',
        type: 'lp',
        asset: `${p.token0}/${p.token1}`,
        apy: p.apr,
        tvl: p.tvl,
        risk: 'medium'
      })),
      ...sepoliaLPs.map(p => ({
        protocol: 'Uniswap V3',
        chain: 'sepolia',
        type: 'lp',
        asset: `${p.token0}/${p.token1}`,
        apy: p.apr,
        tvl: p.tvl,
        risk: 'medium'
      })),
      {
        protocol: 'Lido',
        chain: 'sepolia',
        type: 'stake',
        asset: 'ETH',
        apy: lidoAPR,
        tvl: '1000000',
        risk: 'low'
      }
    ];

    const topOpportunities = allOpportunities
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 10);

    return {
      yields: { aaveMarkets, fraxPools, lidoAPR },
      lps: { mumbai: mumbaiLPs, sepolia: sepoliaLPs },
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
