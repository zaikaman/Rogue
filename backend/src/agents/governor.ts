import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

/**
 * Governor Agent
 * 
 * Manages ATP token reward distribution pro-rata
 * Validates execution plans and manages risk limits
 * 
 * NOTE: ADK Agent integration pending - currently using direct function calls
 */

/**
 * Validate execution plan
 */
function validatePlan(strategy: any, _executionPlan: any): any {
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
