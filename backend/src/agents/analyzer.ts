import { AgentBuilder, createTool } from '@iqai/adk';
import * as z from 'zod';
import dedent from 'dedent';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

/**
 * Tool: Calculate optimal allocations
 */
const calculateAllocationsTool = createTool({
  name: 'calculate_optimal_allocations',
  description: 'Calculate optimal protocol allocations based on risk profile and market data',
  schema: z.object({
    riskProfile: z.enum(['low', 'medium', 'high']),
    marketData: z.object({
      topOpportunities: z.array(z.any())
    })
  }) as any,
  fn: async (params: any) => {
    const { riskProfile, marketData } = params;
    const allocationRules: Record<string, any> = {
      low: { aaveWeight: 100, fraxWeight: 0, leverageRatio: 1.0 },
      medium: { aaveWeight: 60, fraxWeight: 40, leverageRatio: 1.5 },
      high: { aaveWeight: 40, fraxWeight: 60, leverageRatio: 3.0 }
    };

    const rule = allocationRules[riskProfile];
    
    // Find best Aave and Frax opportunities from market data
    const aaveOpp = marketData.topOpportunities.find((o: any) => o.protocol === 'Aave v3');
    const fraxOpp = marketData.topOpportunities.find((o: any) => o.protocol === 'Frax Finance');

    return {
      protocolAllocations: {
        'Aave v3': rule.aaveWeight,
        'Frax Finance': rule.fraxWeight
      },
      leverageRatio: rule.leverageRatio,
      expectedAPY: (aaveOpp?.apy || 5) * (rule.aaveWeight / 100) + 
                   (fraxOpp?.apy || 8) * (rule.fraxWeight / 100),
      riskScore: riskProfile === 'low' ? 2 : riskProfile === 'medium' ? 5 : 8
    };
  }
});

/**
 * Tool: Generate action plan
 */
const generateActionPlanTool = createTool({
  name: 'generate_action_plan',
  description: 'Generate detailed action plan for strategy execution',
  schema: z.object({
    riskProfile: z.enum(['low', 'medium', 'high']),
    allocations: z.record(z.string(), z.number()),
    leverageRatio: z.number()
  }) as any,
  fn: async (params: any) => {
    const { riskProfile, allocations, leverageRatio } = params;
    const actions = [];

    // Add deposit actions
    for (const [protocol, percentage] of Object.entries(allocations)) {
      const pct = percentage as number;
      if (pct > 0) {
        actions.push({ type: 'deposit', protocol, percentage: pct });
      }
    }

    // Add leverage if applicable
    if (leverageRatio > 1) {
      actions.push({ type: 'leverage', ratio: leverageRatio });
    }

    // Add compound frequency
    const compoundFrequency = riskProfile === 'high' ? 'daily' : 
                             riskProfile === 'medium' ? 'bi-weekly' : 'weekly';
    actions.push({ type: 'compound', frequency: compoundFrequency });

    // Add rebalance if medium/high risk
    if (riskProfile !== 'low') {
      const rebalanceFrequency = riskProfile === 'high' ? 'weekly' : 'monthly';
      actions.push({ type: 'rebalance', frequency: rebalanceFrequency });
    }

    // Add hedge for high risk
    if (riskProfile === 'high') {
      actions.push({ type: 'hedge', trigger: 'volatility > 50%' });
    }

    return { actions };
  }
});

/**
 * Tool: Assess risks and warnings
 */
const assessRisksTool = createTool({
  name: 'assess_risks',
  description: 'Assess risks and generate warnings for the strategy',
  schema: z.object({
    riskProfile: z.enum(['low', 'medium', 'high']),
    leverageRatio: z.number(),
    token: z.enum(['USDC', 'KRWQ']),
    amount: z.number()
  }) as any,
  fn: async (params: any) => {
    const { riskProfile, leverageRatio, token, amount } = params;
    const warnings: string[] = [];

    // Leverage warnings
    if (leverageRatio > 2) {
      warnings.push(`High leverage (${leverageRatio}x) increases liquidation risk`);
    } else if (leverageRatio > 1) {
      warnings.push(`Moderate leverage applied (${leverageRatio}x)`);
    }

    // High risk warnings
    if (riskProfile === 'high') {
      warnings.push('Requires active monitoring');
      warnings.push('Gas costs may reduce net APY');
    }

    // Token-specific warnings
    if (token === 'KRWQ') {
      warnings.push('KRWQ conversion fees may apply');
    }

    // Small amount warning
    if (amount < 1000) {
      warnings.push('Small amounts may have higher gas cost ratio');
    }

    return { warnings, riskLevel: riskProfile };
  }
});

/**
 * Tool: Save strategy
 */
const saveStrategyTool = createTool({
  name: 'save_strategy_to_database',
  description: 'Save the generated strategy to database',
  schema: z.object({
    positionId: z.string(),
    strategyName: z.string(),
    riskTier: z.string(),
    expectedAPY: z.number(),
    protocolAllocations: z.record(z.string(), z.number()),
    leverageRatio: z.number(),
    riskScore: z.number(),
    actions: z.array(z.any()),
    warnings: z.array(z.string())
  }) as any,
  fn: async (params: any, context: any) => {
    const supabase = getSupabaseClient();
    
    const { data: savedStrategy, error } = await supabase
      .from('strategies')
      .upsert({
        name: params.strategyName,
        description: `Auto-generated strategy for ${params.riskTier} risk profile`,
        risk_tier: params.riskTier,
        expected_apy: params.expectedAPY,
        protocol_allocations: params.protocolAllocations,
        leverage_ratio: params.leverageRatio,
        min_amount: 100,
        max_amount: 1000000,
        is_active: true,
        metadata: {
          riskScore: params.riskScore,
          actions: params.actions,
          warnings: params.warnings
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
      .eq('id', params.positionId);

    // Store in agent state
    context.state.set('strategy', {
      strategyId: savedStrategy.id,
      ...params
    });

    return { 
      strategyId: savedStrategy.id,
      saved: true
    };
  }
});

/**
 * Create the Analyzer Agent using ADK
 */
export async function createAnalyzerAgent() {
  const { runner } = await AgentBuilder.create('analyzer_agent')
    .withModel(process.env.OPENAI_MODEL || 'gpt-4o-mini')
    .withDescription('Personalizes yield strategies based on risk profile and market conditions')
    .withInstruction(dedent`
      You are the Analyzer Agent for Rogue, a DeFi yield optimizer.

      Your mission: Create personalized yield strategies based on user risk profile and market data.

      Process:
      1. Use calculate_optimal_allocations with risk profile and market data to determine protocol split
      2. Use generate_action_plan to create detailed execution steps
      3. Use assess_risks to identify warnings and risk factors
      4. Use save_strategy_to_database to persist the complete strategy

      Strategy Guidelines:
      - Low Risk: 100% Aave, 1x leverage, weekly compounds, conservative APY
      - Medium Risk: 60/40 Aave/Frax split, 1.5x leverage, bi-weekly compounds
      - High Risk: 40/60 Aave/Frax split, 3x leverage, daily compounds, active hedging

      Always provide clear explanations for allocation decisions and risk assessments.
    `)
    .withTools(
      calculateAllocationsTool,
      generateActionPlanTool,
      assessRisksTool,
      saveStrategyTool
    )
    .build();

  return runner;
}

/**
 * Run the Analyzer agent
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

    const agent = await createAnalyzerAgent();

    // Run the ADK agent
    const response = await agent.ask(
      `Create a ${riskProfile} risk strategy for position ${positionId} with ${amount} ${token}. Market data: ${JSON.stringify(marketData.topOpportunities.slice(0, 3))}`
    );

    logger.info('Analyzer agent completed', {
      positionId,
      response: typeof response === 'string' ? response : JSON.stringify(response)
    });

    // Also generate strategy directly for immediate use
    const strategy = await createStrategyDirect(riskProfile, amount, token);
    
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

    await supabase
      .from('positions')
      .update({ strategy_id: savedStrategy.id })
      .eq('id', positionId);

    logger.info('Strategy saved', {
      positionId,
      strategyId: savedStrategy.id,
      expectedAPY: strategy.expectedAPY
    });

    return {
      ...strategy,
      strategyId: savedStrategy.id,
      agentResponse: response
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
 * Create strategy directly (fallback/immediate use)
 */
async function createStrategyDirect(
  riskProfile: 'low' | 'medium' | 'high',
  amount: number,
  token: 'USDC' | 'KRWQ'
): Promise<any> {
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
      warnings: [] as string[]
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

  if (token === 'KRWQ') {
    baseStrategy.warnings.push('KRWQ conversion fees may apply');
    baseStrategy.expectedAPY *= 0.98;
  }

  if (amount > 50000) {
    baseStrategy.expectedAPY *= 1.05;
  }

  return baseStrategy;
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

    const total = Object.values(newAllocations).reduce((sum, val) => sum + val, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error(`Allocations must sum to 100%, got ${total}%`);
    }

    const estimatedAPY = calculateWeightedAPY(newAllocations, {
      'Aave V3': 6.5,
      'Frax Finance': 8.2,
      'Curve': 12.3
    });

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

    await supabase
      .from('strategies')
      .update({ active: false })
      .eq('position_id', positionId)
      .neq('id', newStrategy.id);

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

