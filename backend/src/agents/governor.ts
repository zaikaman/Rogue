import { Agent } from '@iqai/adk';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

/**
 * Governor Agent
 * 
 * Manages ATP token reward distribution pro-rata
 * Validates execution plans and manages risk limits
 */

const GOVERNOR_INSTRUCTIONS = `You are the Governor agent for Rogue Yield Optimizer.

Your task is to validate execution plans, manage risk limits, and distribute ATP token rewards.

Responsibilities:
1. Validate execution plans from Analyzer
2. Check risk limits and safety constraints
3. Calculate ATP reward distribution pro-rata
4. Monitor system health and pause if necessary

Validation checks:
- Leverage ratio within limits (max 5x)
- Liquidity available in target protocols
- Gas costs reasonable vs yield
- Oracle prices fresh (<5 min)
- No conflicting positions

ATP Reward Rules:
- Distribute based on TVL contribution
- Higher risk profiles earn more rewards
- Compound actions earn bonus rewards
- Cap individual rewards at 10% of total pool

Return validation results:
{
  "approved": true/false,
  "riskScore": 1-10,
  "warnings": [...],
  "atpRewards": {...},
  "recommendations": [...]
}`;

export const governorAgent = new Agent({
  name: "GovernorAgent",
  instructions: GOVERNOR_INSTRUCTIONS,
  model: "claude-3.5-sonnet", // Strong validation logic
  tools: [
    {
      name: "validateExecutionPlan",
      description: "Validate execution plan against safety constraints",
      parameters: {
        type: "object",
        properties: {
          positionId: {
            type: "string",
            description: "Position ID"
          },
          strategy: {
            type: "object",
            description: "Strategy to validate"
          },
          executionPlan: {
            type: "object",
            description: "Planned execution actions"
          }
        },
        required: ["positionId", "strategy", "executionPlan"]
      },
      execute: async (args: {
        positionId: string;
        strategy: any;
        executionPlan: any;
      }) => {
        try {
          const validation = validatePlan(args.strategy, args.executionPlan);
          
          // Log validation result
          const supabase = getSupabaseClient();
          await supabase
            .from('agent_logs')
            .insert({
              agent_name: 'Governor',
              action: 'validate_execution_plan',
              status: validation.approved ? 'approved' : 'rejected',
              position_id: args.positionId,
              metadata: {
                riskScore: validation.riskScore,
                warnings: validation.warnings,
                recommendations: validation.recommendations
              },
              created_at: new Date().toISOString()
            });
          
          return { success: true, data: validation };
        } catch (error: any) {
          logger.error('validateExecutionPlan tool error', { error: error.message });
          return { success: false, error: error.message };
        }
      }
    },
    {
      name: "calculateATPRewards",
      description: "Calculate ATP token rewards for a position",
      parameters: {
        type: "object",
        properties: {
          positionId: {
            type: "string",
            description: "Position ID"
          },
          tvl: {
            type: "number",
            description: "Total value locked in position"
          },
          riskTier: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Risk tier of position"
          },
          compoundCount: {
            type: "number",
            description: "Number of compound actions performed"
          }
        },
        required: ["positionId", "tvl", "riskTier"]
      },
      execute: async (args: {
        positionId: string;
        tvl: number;
        riskTier: 'low' | 'medium' | 'high';
        compoundCount?: number;
      }) => {
        try {
          const rewards = calculateRewards(
            args.tvl,
            args.riskTier,
            args.compoundCount || 0
          );
          
          logger.info('Calculated ATP rewards', {
            positionId: args.positionId,
            rewards
          });
          
          return { success: true, data: rewards };
        } catch (error: any) {
          logger.error('calculateATPRewards tool error', { error: error.message });
          return { success: false, error: error.message };
        }
      }
    },
    {
      name: "pausePosition",
      description: "Emergency pause a position if risk limits exceeded",
      parameters: {
        type: "object",
        properties: {
          positionId: {
            type: "string",
            description: "Position ID to pause"
          },
          reason: {
            type: "string",
            description: "Reason for pause"
          }
        },
        required: ["positionId", "reason"]
      },
      execute: async (args: { positionId: string; reason: string }) => {
        try {
          const supabase = getSupabaseClient();
          
          // Update position status to paused
          await supabase
            .from('positions')
            .update({
              status: 'paused',
              updated_at: new Date().toISOString()
            })
            .eq('id', args.positionId);
          
          // Log pause action
          await supabase
            .from('agent_logs')
            .insert({
              agent_name: 'Governor',
              action: 'emergency_pause',
              status: 'executed',
              position_id: args.positionId,
              notes: args.reason,
              created_at: new Date().toISOString()
            });
          
          logger.warn('Position paused by Governor', {
            positionId: args.positionId,
            reason: args.reason
          });
          
          return { success: true, data: { status: 'paused' } };
        } catch (error: any) {
          logger.error('pausePosition tool error', { error: error.message });
          return { success: false, error: error.message };
        }
      }
    }
  ]
});

/**
 * Validate execution plan
 */
function validatePlan(strategy: any, executionPlan: any): any {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let approved = true;

  // Check leverage ratio
  if (strategy.leverageRatio > 5) {
    warnings.push('Leverage ratio exceeds maximum (5x)');
    approved = false;
  } else if (strategy.leverageRatio > 3) {
    warnings.push('High leverage ratio detected');
    recommendations.push('Consider reducing leverage to 2-3x for safety');
  }

  // Check expected APY
  if (strategy.expectedAPY < 3) {
    warnings.push('Expected APY below minimum threshold (3%)');
    recommendations.push('Strategy may not be profitable after fees');
  }

  // Check risk score
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

  // Base score from risk tier
  const tierScores = { low: 2, medium: 5, high: 8 };
  score += tierScores[strategy.riskTier as keyof typeof tierScores] || 5;

  // Adjust for leverage
  if (strategy.leverageRatio > 1) {
    score += Math.min(strategy.leverageRatio - 1, 2); // Max +2 for leverage
  }

  // Cap at 10
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
  // Base reward rate (ATP tokens per $1000 TVL per day)
  const baseRates = {
    low: 1.0,
    medium: 1.5,
    high: 2.0
  };

  const baseRate = baseRates[riskTier];
  const dailyReward = (tvl / 1000) * baseRate;

  // Compound bonus (0.1 ATP per compound action)
  const compoundBonus = compoundCount * 0.1;

  // Total rewards
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

    // Validate plan
    const validation = validatePlan(strategy, executionPlan);

    // Calculate rewards
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
        0 // compoundCount would come from tx history
      );
    }

    // Log validation
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
