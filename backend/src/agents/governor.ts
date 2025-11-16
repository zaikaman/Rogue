import { AgentBuilder, createTool } from '@iqai/adk';
import * as z from 'zod';
import dedent from 'dedent';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

/**
 * Tool: Validate execution plan
 */
const validatePlanTool = createTool({
  name: 'validate_plan',
  description: 'Validate execution plan for safety and compliance',
  schema: z.object({
    strategy: z.any(),
    executionPlan: z.any()
  }) as any,
  fn: async (params: any) => {
    const { strategy } = params;
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let approved = true;

    if (strategy.leverageRatio > 5) {
      warnings.push('Leverage ratio exceeds maximum (5x)');
      approved = false;
    } else if (strategy.leverageRatio > 3) {
      warnings.push('High leverage ratio detected');
      recommendations.push('Consider reducing leverage to 2-3x for safety');
    }

    if (strategy.expectedAPY < 3) {
      warnings.push('Expected APY below minimum threshold (3%)');
      recommendations.push('Strategy may not be profitable after fees');
    }

    const riskScore = calculateRiskScore(strategy);
    if (riskScore > 8) {
      warnings.push('Very high risk score detected');
      if (strategy.riskTier !== 'high') {
        approved = false;
        recommendations.push('High risk score only allowed for aggressive risk profile');
      }
    }

    return {
      approved,
      riskScore,
      warnings,
      recommendations,
      message: approved ? `Plan approved with ${warnings.length} warnings` : 'Plan rejected'
    };
  }
});

/**
 * Tool: Calculate ATP rewards
 */
const calculateRewardsTool = createTool({
  name: 'calculate_atp_rewards',
  description: 'Calculate ATP token rewards based on position metrics',
  schema: z.object({
    tvl: z.number(),
    riskTier: z.enum(['low', 'medium', 'high']),
    compoundCount: z.number()
  }) as any,
  fn: async (params: any) => {
    const { tvl, riskTier, compoundCount } = params;
    const baseRates = {
      low: 1.0,
      medium: 1.5,
      high: 2.0
    };

    const baseRate = baseRates[riskTier as keyof typeof baseRates];
    const dailyReward = (tvl / 1000) * baseRate;
    const compoundBonus = compoundCount * 0.1;
    const totalRewards = dailyReward + compoundBonus;

    return {
      dailyReward: dailyReward.toFixed(2),
      compoundBonus: compoundBonus.toFixed(2),
      totalRewards: totalRewards.toFixed(2),
      currency: 'ATP',
      message: `Calculated ${totalRewards.toFixed(2)} ATP tokens`
    };
  }
});

/**
 * Create the Governor Agent using ADK
 */
export async function createGovernorAgent() {
  const { runner } = await AgentBuilder.create('governor_agent')
    .withModel(process.env.OPENAI_MODEL || 'gpt-4o-mini')
    .withDescription('Validates strategies and manages ATP rewards')
    .withInstruction(dedent`
      You are the Governor Agent for Rogue, managing governance and rewards.

      Your responsibilities:
      1. Validate execution plans for safety and compliance
      2. Calculate ATP token rewards for positions

      Validation criteria:
      - Leverage ratio must not exceed 5x
      - Expected APY should be >= 3%
      - Risk score must match user risk profile

      ATP Rewards:
      - Base rate varies by risk tier (low: 1.0, medium: 1.5, high: 2.0)
      - Daily reward = (TVL / 1000) * base_rate
      - Compound bonus = 0.1 ATP per compound

      Approve plans that meet safety criteria, reject those that don't.
    `)
    .withTools(validatePlanTool, calculateRewardsTool)
    .build();

  return runner;
}

/**
 * Calculate risk score (1-10)
 */
function calculateRiskScore(strategy: any): number {
  let score = 0;

  const tierScores = { low: 2, medium: 5, high: 8 };
  score += tierScores[strategy.riskTier as keyof typeof tierScores] || 5;

  if (strategy.leverageRatio > 1) {
    score += Math.min(strategy.leverageRatio - 1, 2);
  }

  return Math.min(Math.round(score), 10);
}

/**
 * Validate execution plan
 */
export function validatePlan(strategy: any, _executionPlan: any): any {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let approved = true;

  if (strategy.leverageRatio > 5) {
    warnings.push('Leverage ratio exceeds maximum (5x)');
    approved = false;
  } else if (strategy.leverageRatio > 3) {
    warnings.push('High leverage ratio detected');
    recommendations.push('Consider reducing leverage to 2-3x for safety');
  }

  if (strategy.expectedAPY < 3) {
    warnings.push('Expected APY below minimum threshold (3%)');
    recommendations.push('Strategy may not be profitable after fees');
  }

  const riskScore = calculateRiskScore(strategy);
  if (riskScore > 8) {
    warnings.push('Very high risk score detected');
    if (strategy.riskTier !== 'high') {
      approved = false;
      recommendations.push('High risk score only allowed for aggressive risk profile');
    }
  }

  return {
    approved,
    riskScore,
    warnings,
    recommendations
  };
}

/**
 * Calculate ATP rewards
 */
export function calculateRewards(
  tvl: number,
  riskTier: 'low' | 'medium' | 'high',
  compoundCount: number
): any {
  const baseRates = {
    low: 1.0,
    medium: 1.5,
    high: 2.0
  };

  const baseRate = baseRates[riskTier];
  const dailyReward = (tvl / 1000) * baseRate;
  const compoundBonus = compoundCount * 0.1;
  const totalRewards = dailyReward + compoundBonus;

  return {
    dailyReward: dailyReward.toFixed(2),
    compoundBonus: compoundBonus.toFixed(2),
    totalRewards: totalRewards.toFixed(2),
    currency: 'ATP'
  };
}

/**
 * Run the Governor agent for validation
 */
export async function runGovernorAgent(
  positionId: string,
  strategy: any,
  executionPlan: any
): Promise<any> {
  try {
    logger.info('Running Governor agent', { positionId });

    const validation = validatePlan(strategy, executionPlan);

    const supabase = getSupabaseClient();
    const { data: position } = await supabase
      .from('positions')
      .select('amount, risk_profile')
      .eq('id', positionId)
      .single();

    let rewards = { dailyReward: '0', compoundBonus: '0', totalRewards: '0', currency: 'ATP' };
    if (position) {
      rewards = calculateRewards(
        parseFloat(position.amount),
        position.risk_profile,
        0
      );
    }

    await supabase
      .from('agent_logs')
      .insert({
        agent_name: 'Governor',
        action: 'validate_execution',
        status: validation.approved ? 'approved' : 'rejected',
        position_id: positionId,
        metadata: {
          ...validation,
          rewards
        },
        created_at: new Date().toISOString()
      });

    logger.info('Governor agent completed', {
      positionId,
      approved: validation.approved,
      riskScore: validation.riskScore
    });

    return {
      ...validation,
      atpRewards: rewards
    };
  } catch (error: any) {
    logger.error('Governor agent failed', {
      error: error.message,
      positionId
    });
    throw error;
  }
}
