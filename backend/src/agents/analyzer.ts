import { Agent } from '@iqai/adk';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

/**
 * Analyzer Agent
 * 
 * Personalizes strategies based on user risk profile and market data
 * Outputs: position_plan with recommended allocations and expected APY
 */

const ANALYZER_INSTRUCTIONS = `You are the Analyzer agent for Rogue Yield Optimizer.

Your task is to analyze market data from the Researcher and create personalized yield strategies based on user risk profiles.

Risk Profile Definitions:
- LOW: Conservative (max 5% leverage, stable pools only, minimize IL risk)
- MEDIUM: Balanced (up to 2x leverage, mix of stable + yield farms, moderate IL tolerance)
- HIGH: Aggressive (up to 5x leverage, max yield focus, accept higher IL risk)

Given:
1. Market data (yields, liquidity, prices)
2. User risk profile (low/medium/high)
3. Stake amount and token (USDC or KRWQ)

You must output a strategy recommendation including:
- Protocol allocations (% to Aave, % to Frax, etc.)
- Estimated APY (realistic, accounting for fees and slippage)
- Leverage ratio (if applicable)
- Risk score (1-10)
- Expected actions (deposit, compound frequency, hedge if needed)

Safety constraints:
- NEVER recommend leverage >5x even for high risk
- ALWAYS ensure minimum $10k liquidity in target pools
- REJECT strategies with <3% expected APY after fees
- FLAG high utilization rate protocols (>90%)

Return structured data in this format:
{
  "strategyName": "Conservative Aave USDC",
  "riskTier": "low",
  "expectedAPY": 5.2,
  "protocolAllocations": { "Aave": 100, "Frax": 0 },
  "leverageRatio": 1.0,
  "riskScore": 3,
  "actions": [...],
  "warnings": [...]
}`;

export const analyzerAgent = new Agent({
  name: "AnalyzerAgent",
  instructions: ANALYZER_INSTRUCTIONS,
  model: "o1-preview", // Best reasoning for risk calculations
  tools: [
    {
      name: "calculateStrategy",
      description: "Calculate personalized strategy based on risk profile and market data",
      parameters: {
        type: "object",
        properties: {
          riskProfile: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "User's risk tolerance level"
          },
          amount: {
            type: "number",
            description: "Stake amount in USD equivalent"
          },
          token: {
            type: "string",
            enum: ["USDC", "KRWQ"],
            description: "Token being staked"
          },
          marketData: {
            type: "object",
            description: "Market data from Researcher agent"
          }
        },
        required: ["riskProfile", "amount", "token", "marketData"]
      },
      execute: async (args: {
        riskProfile: 'low' | 'medium' | 'high';
        amount: number;
        token: 'USDC' | 'KRWQ';
        marketData: any;
      }) => {
        try {
          // Analyze market data and create strategy
          const strategy = await createStrategy(
            args.riskProfile,
            args.amount,
            args.token,
            args.marketData
          );

          return { success: true, data: strategy };
        } catch (error: any) {
          logger.error('calculateStrategy tool error', { error: error.message });
          return { success: false, error: error.message };
        }
      }
    },
    {
      name: "saveStrategy",
      description: "Save strategy to database for execution",
      parameters: {
        type: "object",
        properties: {
          positionId: {
            type: "string",
            description: "Position ID to associate strategy with"
          },
          strategy: {
            type: "object",
            description: "Strategy data to save"
          }
        },
        required: ["positionId", "strategy"]
      },
      execute: async (args: { positionId: string; strategy: any }) => {
        try {
          const supabase = getSupabaseClient();

          // Insert or update strategy
          const { data, error } = await supabase
            .from('strategies')
            .upsert({
              name: args.strategy.strategyName,
              description: `Auto-generated strategy for ${args.strategy.riskTier} risk profile`,
              risk_tier: args.strategy.riskTier,
              expected_apy: args.strategy.expectedAPY,
              protocol_allocations: args.strategy.protocolAllocations,
              leverage_ratio: args.strategy.leverageRatio || 1.0,
              min_amount: 100,
              max_amount: 1000000,
              is_active: true,
              metadata: {
                riskScore: args.strategy.riskScore,
                actions: args.strategy.actions,
                warnings: args.strategy.warnings
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            throw new Error(`Failed to save strategy: ${error.message}`);
          }

          // Link strategy to position
          await supabase
            .from('positions')
            .update({ strategy_id: data.id })
            .eq('id', args.positionId);

          return { success: true, data: { strategyId: data.id } };
        } catch (error: any) {
          logger.error('saveStrategy tool error', { error: error.message });
          return { success: false, error: error.message };
        }
      }
    }
  ]
});

/**
 * Create strategy based on risk profile and market data
 */
async function createStrategy(
  riskProfile: 'low' | 'medium' | 'high',
  amount: number,
  token: 'USDC' | 'KRWQ',
  marketData: any
): Promise<any> {
  // Strategy logic based on risk profile
  const strategies = {
    low: {
      strategyName: 'Conservative Aave Deposit',
      riskTier: 'low',
      expectedAPY: 4.5,
      protocolAllocations: { 'Aave v3': 100, 'Frax Finance': 0 },
      leverageRatio: 1.0,
      riskScore: 2,
      actions: [
        { type: 'deposit', protocol: 'Aave v3', percentage: 100 },
        { type: 'compound', frequency: 'weekly' }
      ],
      warnings: []
    },
    medium: {
      strategyName: 'Balanced Aave + Frax',
      riskTier: 'medium',
      expectedAPY: 7.2,
      protocolAllocations: { 'Aave v3': 60, 'Frax Finance': 40 },
      leverageRatio: 1.5,
      riskScore: 5,
      actions: [
        { type: 'deposit', protocol: 'Aave v3', percentage: 60 },
        { type: 'deposit', protocol: 'Frax Finance', percentage: 40 },
        { type: 'compound', frequency: 'bi-weekly' },
        { type: 'rebalance', frequency: 'monthly' }
      ],
      warnings: ['Moderate leverage applied (1.5x)']
    },
    high: {
      strategyName: 'Aggressive Leveraged Yield',
      riskTier: 'high',
      expectedAPY: 12.8,
      protocolAllocations: { 'Aave v3': 40, 'Frax Finance': 60 },
      leverageRatio: 3.0,
      riskScore: 8,
      actions: [
        { type: 'deposit', protocol: 'Aave v3', percentage: 40 },
        { type: 'deposit', protocol: 'Frax Finance', percentage: 60 },
        { type: 'leverage', ratio: 3.0 },
        { type: 'compound', frequency: 'daily' },
        { type: 'rebalance', frequency: 'weekly' },
        { type: 'hedge', trigger: 'volatility > 50%' }
      ],
      warnings: [
        'High leverage (3x) increases liquidation risk',
        'Requires active monitoring',
        'Gas costs may reduce net APY'
      ]
    }
  };

  const baseStrategy = strategies[riskProfile];

  // Adjust for token type
  if (token === 'KRWQ') {
    baseStrategy.warnings.push('KRWQ conversion fees may apply');
    baseStrategy.expectedAPY *= 0.98; // 2% fee adjustment
  }

  // Adjust for amount (larger amounts may have better rates)
  if (amount > 50000) {
    baseStrategy.expectedAPY *= 1.05; // 5% bonus for large amounts
  }

  logger.info('Created strategy', {
    riskProfile,
    amount,
    token,
    expectedAPY: baseStrategy.expectedAPY.toFixed(2)
  });

  return baseStrategy;
}

/**
 * Run the Analyzer agent manually
 */
export async function runAnalyzerAgent(
  positionId: string,
  riskProfile: 'low' | 'medium' | 'high',
  amount: number,
  token: 'USDC' | 'KRWQ',
  marketData: any
): Promise<any> {
  try {
    logger.info('Running Analyzer agent', { positionId, riskProfile, amount, token });

    // Create strategy
    const strategy = await createStrategy(riskProfile, amount, token, marketData);

    // Save to database
    const supabase = getSupabaseClient();
    
    const { data: savedStrategy, error } = await supabase
      .from('strategies')
      .upsert({
        name: strategy.strategyName,
        description: `Auto-generated strategy for ${strategy.riskTier} risk profile`,
        risk_tier: strategy.riskTier,
        expected_apy: strategy.expectedAPY,
        protocol_allocations: strategy.protocolAllocations,
        leverage_ratio: strategy.leverageRatio,
        min_amount: 100,
        max_amount: 1000000,
        is_active: true,
        metadata: {
          riskScore: strategy.riskScore,
          actions: strategy.actions,
          warnings: strategy.warnings
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save strategy: ${error.message}`);
    }

    // Link to position
    await supabase
      .from('positions')
      .update({ strategy_id: savedStrategy.id })
      .eq('id', positionId);

    logger.info('Analyzer agent completed', {
      positionId,
      strategyId: savedStrategy.id,
      expectedAPY: strategy.expectedAPY
    });

    return {
      ...strategy,
      strategyId: savedStrategy.id
    };
  } catch (error: any) {
    logger.error('Analyzer agent failed', {
      error: error.message,
      positionId
    });
    throw error;
  }
}

/**
 * Recalculate strategy when user adjusts allocations
 */
export async function recalculateStrategy(
  positionId: string,
  newAllocations: Record<string, number>,
  riskProfile: 'low' | 'medium' | 'high'
): Promise<any> {
  try {
    logger.info('Recalculating strategy with new allocations', {
      positionId,
      newAllocations,
      riskProfile
    });

    const supabase = getSupabaseClient();

    // Validate allocations total 100%
    const total = Object.values(newAllocations).reduce((sum, val) => sum + val, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error(`Allocations must sum to 100%, got ${total}%`);
    }

    // Fetch market data for validation
    // TODO: Call Researcher to get latest APYs for each protocol
    const estimatedAPY = calculateWeightedAPY(newAllocations, {
      'Aave V3': 6.5,
      'Frax Finance': 8.2,
      'Curve': 12.3
    });

    // Create new strategy with user-defined allocations
    const { data: newStrategy, error } = await supabase
      .from('strategies')
      .insert({
        position_id: positionId,
        risk_profile: riskProfile,
        allocation: newAllocations,
        expected_apy: estimatedAPY,
        rationale: `User-adjusted allocation: ${JSON.stringify(newAllocations)}`,
        active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save strategy: ${error.message}`);
    }

    // Deactivate old strategies
    await supabase
      .from('strategies')
      .update({ active: false })
      .eq('position_id', positionId)
      .neq('id', newStrategy.id);

    logger.info('Strategy recalculated', {
      positionId,
      strategyId: newStrategy.id,
      estimatedAPY
    });

    return {
      strategyId: newStrategy.id,
      allocations: newAllocations,
      expectedAPY: estimatedAPY,
      riskProfile
    };
  } catch (error: any) {
    logger.error('Failed to recalculate strategy', {
      error: error.message,
      positionId
    });
    throw error;
  }
}

/**
 * Calculate weighted average APY from allocations
 */
function calculateWeightedAPY(
  allocations: Record<string, number>,
  protocolAPYs: Record<string, number>
): number {
  let weightedSum = 0;
  
  for (const [protocol, percentage] of Object.entries(allocations)) {
    const apy = protocolAPYs[protocol] || 0;
    weightedSum += (apy * percentage) / 100;
  }
  
  return Math.round(weightedSum * 100) / 100;
}
