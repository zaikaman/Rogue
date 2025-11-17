/**
 * Enhanced Trader/Analyzer Agent
 * Personalizes strategies with TA signals, risk management, and portfolio optimization
 */

import { AgentBuilder, createTool } from '@iqai/adk';
import * as z from 'zod';
import dedent from 'dedent';
import { analyzeAsset } from '../services/technical-analysis';
import { getSupabaseClient } from '../services/supabase';
import { logger } from '../utils/logger';

/**
 * Tool: Analyze with Technical Indicators
 */
const analyzeTechnicalsTool = createTool({
  name: 'analyze_technicals',
  description: 'Analyze assets using RSI, MACD, and momentum indicators',
  schema: z.object({
    assets: z.array(z.string()),
    riskProfile: z.enum(['low', 'medium', 'high'])
  }) as any,
  fn: async ({ assets, riskProfile }: any) => {
    const analyses = await Promise.all(
      assets.map((asset: string) => analyzeAsset(asset, riskProfile))
    );

    const signals = analyses.map((analysis, i) => ({
      asset: assets[i],
      price: analysis.currentPrice,
      rsi: analysis.rsi,
      rsiSignal: analysis.rsiSignal,
      macdSignal: analysis.macdSignal,
      overall: analysis.overallSignal,
      confidence: analysis.confidence
    }));

    return {
      signals,
      summary: {
        strongBuys: signals.filter(s => s.overall === 'strong_buy').length,
        strongSells: signals.filter(s => s.overall === 'strong_sell').length,
        holds: signals.filter(s => s.overall === 'hold').length
      }
    };
  }
});

/**
 * Tool: Optimize Portfolio Allocation
 */
const optimizeAllocationTool = createTool({
  name: 'optimize_portfolio',
  description: 'Create optimal allocation based on risk profile and market data',
  schema: z.object({
    riskProfile: z.enum(['low', 'medium', 'high']),
    opportunities: z.array(z.any()),
    amount: z.number(),
    signals: z.any().optional()
  }) as any,
  fn: async ({ riskProfile, opportunities, amount }: any) => {
    // Risk-based allocation rules
    const allocationStrategy = {
      low: {
        holds: 0.8,      // 80% in stable holds/yields
        yields: 0.8,     // Same, combined
        lps: 0,
        swaps: 0,
        stakes: 0.2
      },
      medium: {
        holds: 0.4,
        yields: 0.4,
        lps: 0.2,
        swaps: 0.2,
        stakes: 0.2
      },
      high: {
        holds: 0.2,
        yields: 0.2,
        lps: 0.3,
        swaps: 0.3,
        stakes: 0.2
      }
    };

    const strategy = allocationStrategy[riskProfile as keyof typeof allocationStrategy];

    // Filter opportunities by type
    const yields = opportunities.filter((o: any) => o.type === 'yield');
    const lps = opportunities.filter((o: any) => o.type === 'lp');
    const stakes = opportunities.filter((o: any) => o.type === 'stake');

    // Build allocation
    const allocation: any = {};

    // Allocate to best yields
    if (yields.length > 0 && strategy.yields > 0) {
      const bestYield = yields[0];
      allocation[`${bestYield.protocol}_${bestYield.asset}`] = {
        type: 'yield',
        protocol: bestYield.protocol,
        chain: bestYield.chain,
        asset: bestYield.asset,
        percentage: strategy.yields * 100,
        amount: amount * strategy.yields,
        expectedAPY: bestYield.apy
      };
    }

    // Allocate to LPs if applicable
    if (lps.length > 0 && strategy.lps > 0) {
      const bestLP = lps[0];
      allocation[`${bestLP.protocol}_LP_${bestLP.asset}`] = {
        type: 'lp',
        protocol: bestLP.protocol,
        chain: bestLP.chain,
        asset: bestLP.asset,
        percentage: strategy.lps * 100,
        amount: amount * strategy.lps,
        expectedAPY: bestLP.apy
      };
    }

    // Allocate to staking
    if (stakes.length > 0 && strategy.stakes > 0) {
      const bestStake = stakes[0];
      allocation[`${bestStake.protocol}_${bestStake.asset}`] = {
        type: 'stake',
        protocol: bestStake.protocol,
        chain: bestStake.chain,
        asset: bestStake.asset,
        percentage: strategy.stakes * 100,
        amount: amount * strategy.stakes,
        expectedAPY: bestStake.apy
      };
    }

    // Calculate expected portfolio APY
    const expectedAPY: number = Object.values(allocation).reduce(
      (sum: number, alloc: any) => sum + (alloc.expectedAPY * alloc.percentage / 100),
      0
    );

    return {
      allocation,
      expectedAPY: Number(expectedAPY.toFixed(2)),
      riskScore: riskProfile === 'low' ? 2 : riskProfile === 'medium' ? 5 : 8,
      diversification: Object.keys(allocation).length
    };
  }
});

/**
 * Tool: Generate Action Plan
 */
const generateActionPlanTool = createTool({
  name: 'generate_action_plan',
  description: 'Create step-by-step execution plan',
  schema: z.object({
    allocation: z.any(),
    positionId: z.string(),
    currentChain: z.string()
  }) as any,
  fn: async ({ allocation, positionId, currentChain }: any) => {
    const actions: any[] = [];

    for (const [, alloc] of Object.entries(allocation)) {
      const a = alloc as any;

      // Check if bridge needed
      if (a.chain !== currentChain) {
        actions.push({
          step: actions.length + 1,
          type: 'bridge',
          from: currentChain,
          to: a.chain,
          asset: a.asset,
          amount: a.amount,
          estimatedCost: '0.01 native token',
          estimatedTime: '5 minutes'
        });
      }

      // Main action
      if (a.type === 'yield') {
        actions.push({
          step: actions.length + 1,
          type: 'deposit',
          protocol: a.protocol,
          chain: a.chain,
          asset: a.asset,
          amount: a.amount,
          expectedAPY: a.expectedAPY
        });
      } else if (a.type === 'lp') {
        actions.push({
          step: actions.length + 1,
          type: 'add_liquidity',
          protocol: a.protocol,
          chain: a.chain,
          pool: a.asset,
          amount: a.amount,
          expectedAPR: a.expectedAPY
        });
      } else if (a.type === 'stake') {
        actions.push({
          step: actions.length + 1,
          type: 'stake',
          protocol: a.protocol,
          chain: a.chain,
          asset: a.asset,
          amount: a.amount,
          expectedAPR: a.expectedAPY
        });
      } else if (a.type === 'swap') {
        actions.push({
          step: actions.length + 1,
          type: 'swap',
          protocol: a.protocol,
          chain: a.chain,
          from: a.fromAsset,
          to: a.toAsset,
          amount: a.amount,
          reason: a.reason || 'Rebalancing based on TA signals'
        });
      }
    }

    // Add auto-compound schedule
    actions.push({
      step: actions.length + 1,
      type: 'auto_compound',
      frequency: 'weekly',
      estimatedGas: '0.03 MATIC per compound'
    });

    return {
      positionId,
      totalSteps: actions.length,
      actions,
      estimatedCompletionTime: actions.length * 2 + ' minutes'
    };
  }
});

/**
 * Tool: Assess Risks
 */
const assessRisksTool = createTool({
  name: 'assess_portfolio_risks',
  description: 'Evaluate risks and generate warnings',
  schema: z.object({
    allocation: z.any(),
    riskProfile: z.enum(['low', 'medium', 'high'])
  }) as any,
  fn: async ({ allocation, riskProfile }: any) => {
    const risks: string[] = [];
    const warnings: string[] = [];

    // Check concentration risk
    const allocValues = Object.values(allocation) as any[];
    const maxAllocation = Math.max(...allocValues.map(a => a.percentage));
    if (maxAllocation > 50) {
      risks.push(`High concentration: ${maxAllocation}% in single position`);
    }

    // Check IL risk for LPs
    const lpPositions = allocValues.filter(a => a.type === 'lp');
    if (lpPositions.length > 0) {
      warnings.push(`${lpPositions.length} LP position(s) exposed to impermanent loss`);
    }

    // Check cross-chain risk
    const chains = new Set(allocValues.map(a => a.chain));
    if (chains.size > 1) {
      warnings.push(`Assets spread across ${chains.size} chains - bridge risk present`);
    }

    // Risk score validation
    const riskLimits: Record<'low' | 'medium' | 'high', number> = {
      low: 3,
      medium: 6,
      high: 9
    };
    const currentRiskScore = allocValues.length * 2 + (chains.size - 1) * 1;
    if (currentRiskScore > riskLimits[riskProfile as keyof typeof riskLimits]) {
      risks.push(`Risk score ${currentRiskScore} exceeds ${riskProfile} profile limit ${riskLimits[riskProfile as keyof typeof riskLimits]}`);
    }

    return {
      riskScore: currentRiskScore,
      risks,
      warnings,
      approved: risks.length === 0
    };
  }
});

/**
 * Tool: Store Strategy
 */
const storeStrategyTool = createTool({
  name: 'store_strategy',
  description: 'Save finalized strategy to database',
  schema: z.object({
    positionId: z.string(),
    allocation: z.any(),
    actionPlan: z.any(),
    expectedAPY: z.number(),
    riskScore: z.number()
  }) as any,
  fn: async ({ positionId, allocation, actionPlan, expectedAPY, riskScore }: any) => {
    const supabase = getSupabaseClient();

    await supabase.from('strategies').insert({
      position_id: positionId,
      allocation,
      action_plan: actionPlan,
      expected_apy: expectedAPY,
      risk_score: riskScore,
      created_at: new Date().toISOString(),
      active: true
    });

    await supabase.from('agent_logs').insert({
      agent_name: 'trader_analyzer',
      action: 'strategy_created',
      success: true,
      metadata: {
        positionId,
        expectedAPY,
        riskScore,
        actionsCount: actionPlan.actions.length
      },
      created_at: new Date().toISOString()
    });

    return {
      stored: true,
      strategyId: positionId
    };
  }
});

/**
 * Create Enhanced Trader/Analyzer Agent
 */
export async function createEnhancedTraderAgent() {
  const { runner } = await AgentBuilder.create('enhanced_trader_analyzer')
    .withModel(process.env.OPENAI_MODEL || 'gpt-4o-mini')
    .withDescription('Portfolio optimizer with technical analysis for Rogue')
    .withInstruction(dedent`
      You are the Enhanced Trader/Analyzer Agent for Rogue.

      Your mission: Build personalized, risk-optimized portfolios using market data + technical analysis.

      Process:
      1. Use analyze_technicals to get RSI/MACD signals for key assets (ETH, MATIC, etc)
      2. Use optimize_portfolio to create allocation based on:
         - Risk profile (low/medium/high)
         - Top opportunities from Researcher
         - Technical signals (buy on RSI <30, sell on RSI >70)
      3. Use generate_action_plan to create step-by-step execution (deposits, swaps, bridges, LPs)
      4. Use assess_portfolio_risks to validate safety
      5. Use store_strategy to save the final plan

      Allocation Guidelines by Risk Profile:
      
      LOW RISK:
      - 80% in stable yields (Aave USDC/DAI lending)
      - 20% in ETH staking (Lido)
      - NO swaps, NO LPs (too much IL risk)
      - Target APY: 4-6%

      MEDIUM RISK:
      - 40% stable yields
      - 20% ETH staking
      - 20% LPs (USDC/ETH, low volatility pairs)
      - 20% tactical swaps (based on RSI signals)
      - Target APY: 8-12%

      HIGH RISK:
      - 20% stable yields (base layer)
      - 20% ETH staking
      - 30% LPs (including volatile pairs)
      - 30% active swaps (trade on MACD crossovers, momentum)
      - Target APY: 15%+

      Technical Signal Usage:
      - RSI < 30 + MACD bullish = allocate 10-20% to swap/buy
      - RSI > 70 + MACD bearish = rotate to stables
      - Confidence >70% required for swaps

      Output: Complete strategy with allocation %, action plan, expected APY, risk warnings.
    `)
    .withTools(
      analyzeTechnicalsTool,
      optimizeAllocationTool,
      generateActionPlanTool,
      assessRisksTool,
      storeStrategyTool
    )
    .build();

  return runner;
}

/**
 * Run Enhanced Trader/Analyzer
 */
export async function runEnhancedTrader(
  positionId: string,
  riskProfile: 'low' | 'medium' | 'high',
  amount: number,
  researchData: any
): Promise<{
  allocation: any;
  actionPlan: any;
  expectedAPY: number;
  riskScore: number;
  signals: any;
}> {
  try {
    logger.info('📊 Running Enhanced Trader/Analyzer', {
      positionId,
      riskProfile,
      amount
    });

    // Mock implementation - simplified allocation based on risk profile
    const allocationStrategy = {
      low: {
        holds: 0.8,
        yields: 0.8,
        lps: 0,
        swaps: 0,
        stakes: 0.2
      },
      medium: {
        holds: 0.4,
        yields: 0.4,
        lps: 0.2,
        swaps: 0.2,
        stakes: 0.2
      },
      high: {
        holds: 0.2,
        yields: 0.2,
        lps: 0.3,
        swaps: 0.3,
        stakes: 0.2
      }
    };

    const strategy = allocationStrategy[riskProfile as keyof typeof allocationStrategy];

    const allocation: any = {};
    const yields = researchData.topOpportunities.filter((o: any) => o.type === 'yield');

    if (yields.length > 0 && strategy.yields > 0) {
      const bestYield = yields[0];
      allocation[`${bestYield.protocol}_${bestYield.asset}`] = {
        type: 'yield',
        protocol: bestYield.protocol,
        chain: bestYield.chain,
        asset: bestYield.asset,
        percentage: strategy.yields * 100,
        amount: amount * strategy.yields,
        expectedAPY: bestYield.apy
      };
    }

    const actionPlan = {
      positionId,
      totalSteps: 1,
      actions: Object.keys(allocation).map((_, i) => ({
        step: i + 1,
        type: 'deposit',
        protocol: 'Aave v3',
        chain: 'mumbai',
        amount: amount * strategy.yields
      })),
      estimatedCompletionTime: '5 minutes'
    };

    const expectedAPY = yields.length > 0
      ? yields[0].apy * (strategy.yields || 0.5)
      : 5.0;

    const riskScore = riskProfile === 'low' ? 2 : riskProfile === 'medium' ? 5 : 8;

    logger.info('✅ Enhanced Trader completed', {
      expectedAPY,
      actions: actionPlan.actions.length
    });

    return {
      allocation,
      actionPlan,
      expectedAPY: Number(expectedAPY.toFixed(2)),
      riskScore,
      signals: {
        assets: ['ETH', 'MATIC'],
        overall: 'hold'
      }
    };

  } catch (error: any) {
    logger.error('Enhanced Trader failed', {
      error: error.message,
      positionId
    });
    throw error;
  }
}
