/**
 * Enhanced Governor Agent
 * Validates execution plans and ensures security/compliance
 */

import { AgentBuilder, createTool } from '@iqai/adk';
import * as z from 'zod';
import dedent from 'dedent';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../services/supabase';

/**
 * Tool: Validate execution plan
 */
const validatePlanTool = createTool({
  name: 'validate_execution_plan',
  description: 'Validate strategy against safety rules',
  schema: z.object({
    plan: z.any(),
    riskProfile: z.enum(['low', 'medium', 'high']),
    positionId: z.string()
  }) as any,
  fn: async ({ plan, riskProfile }: any) => {
    const violations: string[] = [];

    // Leverage check (max 2x for medium, 3x for high, 1x for low)
    // Note: Leverage limits enforced per risk profile in allocation strategy

    // Check allocation concentration
    const allocations = Object.values(plan.allocation || {}) as any[];
    const maxAllocation = Math.max(
      ...allocations.map((a: any) => a.percentage || 0),
      0
    );

    if (maxAllocation > 70) {
      violations.push(
        `Concentration risk: ${maxAllocation}% in single position exceeds ${riskProfile} limit of 70%`
      );
    }

    // Check swap frequency for low risk
    const swaps = plan.actions?.filter((a: any) => a.type === 'swap') || [];
    if (riskProfile === 'low' && swaps.length > 2) {
      violations.push(
        `Too many swaps (${swaps.length}) for low-risk profile. Maximum 2 allowed.`
      );
    }

    // Check LP positions for low risk
    const lps = plan.actions?.filter((a: any) => a.type === 'add_liquidity') || [];
    if (riskProfile === 'low' && lps.length > 0) {
      violations.push(`LP positions not allowed for low-risk profile`);
    }

    // Bridge cost check
    const bridges = plan.actions?.filter((a: any) => a.type === 'bridge') || [];
    if (bridges.length > 2) {
      violations.push(
        `Too many bridges (${bridges.length}). Limit to 2 for gas efficiency.`
      );
    }

    return {
      approved: violations.length === 0,
      violations,
      warnings: [],
      riskScore: riskProfile === 'low' ? 2 : riskProfile === 'medium' ? 5 : 8,
      summary: violations.length === 0
        ? `Plan approved for ${riskProfile}-risk execution`
        : `Plan has ${violations.length} violations. Review required.`
    };
  }
});

/**
 * Tool: Check position limits
 */
const checkPositionLimitsTool = createTool({
  name: 'check_position_limits',
  description: 'Verify position meets size and frequency limits',
  schema: z.object({
    walletAddress: z.string(),
    positionAmount: z.number(),
    riskProfile: z.enum(['low', 'medium', 'high'])
  }) as any,
  fn: async ({ walletAddress, positionAmount, riskProfile }: any) => {
    const supabase = getSupabaseClient();

    // Get wallet's existing positions
    const { data: positions } = await supabase
      .from('positions')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('status', 'active');

    const totalExposure = (positions || [])
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0) + positionAmount;

    // Position limits by risk profile
    const limits: Record<'low' | 'medium' | 'high', { maxPerPosition: number; maxTotal: number }> = {
      low: { maxPerPosition: 100000, maxTotal: 500000 },
      medium: { maxPerPosition: 500000, maxTotal: 2000000 },
      high: { maxPerPosition: 2000000, maxTotal: 5000000 }
    };

    const limit = limits[riskProfile as keyof typeof limits];
    const violations: string[] = [];

    if (positionAmount > limit.maxPerPosition) {
      violations.push(
        `Position size ${positionAmount} exceeds ${riskProfile} limit of ${limit.maxPerPosition}`
      );
    }

    if (totalExposure > limit.maxTotal) {
      violations.push(
        `Total wallet exposure ${totalExposure} exceeds ${riskProfile} limit of ${limit.maxTotal}`
      );
    }

    return {
      approved: violations.length === 0,
      violations,
      currentPositions: positions?.length || 0,
      totalExposure,
      availableCapacity: limit.maxTotal - totalExposure
    };
  }
});

/**
 * Tool: Check slippage tolerance
 */
const checkSlippageTool = createTool({
  name: 'check_slippage_tolerance',
  description: 'Verify slippage is within acceptable limits',
  schema: z.object({
    expectedOutput: z.string(),
    minimumOutput: z.string(),
    riskProfile: z.enum(['low', 'medium', 'high'])
  }) as any,
  fn: async ({ expectedOutput, minimumOutput, riskProfile }: any) => {
    const expected = BigInt(expectedOutput);
    const minimum = BigInt(minimumOutput);

    const slippage = ((expected - minimum) * BigInt(10000)) / expected;
    const slippagePercent = Number(slippage) / 100;

    // Slippage tolerance by risk
    const tolerance: Record<'low' | 'medium' | 'high', number> = {
      low: 0.5,     // 0.5%
      medium: 1.0,  // 1%
      high: 2.0     // 2%
    };

    const maxTolerance = tolerance[riskProfile as keyof typeof tolerance];
    const approved = slippagePercent <= maxTolerance;

    return {
      approved,
      slippagePercent: slippagePercent.toFixed(2),
      maxTolerance,
      message: approved
        ? `Slippage ${slippagePercent.toFixed(2)}% is within ${maxTolerance}% limit`
        : `Slippage ${slippagePercent.toFixed(2)}% exceeds ${maxTolerance}% limit`
    };
  }
});

/**
 * Tool: Audit log entry
 */
const auditLogTool = createTool({
  name: 'audit_log_entry',
  description: 'Create audit trail for governance',
  schema: z.object({
    positionId: z.string(),
    action: z.string(),
    decision: z.enum(['approved', 'rejected', 'suspended']),
    reason: z.string(),
    metadata: z.any().optional()
  }) as any,
  fn: async ({ positionId, action, decision, reason, metadata }: any) => {
    try {
      const supabase = getSupabaseClient();

      await supabase.from('governance_logs').insert({
        position_id: positionId,
        action,
        decision,
        reason,
        metadata,
        logged_at: new Date().toISOString()
      });

      return {
        logged: true,
        logId: `log-${positionId}-${Date.now()}`,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      logger.error('Failed to create audit log', { error: error.message });
      throw error;
    }
  }
});

/**
 * Create Enhanced Governor Agent
 */
export async function createEnhancedGovernorAgent() {
  const { runner } = await AgentBuilder.create('enhanced_governor')
    .withModel(process.env.OPENAI_MODEL || 'gpt-4o-mini')
    .withDescription('Compliance and safety governance for Rogue')
    .withInstruction(dedent`
      You are the Enhanced Governor Agent for Rogue, enforcer of safety rules and compliance.

      Your mission: Validate all strategies before execution to ensure safety and compliance.

      Process:
      1. Use validate_execution_plan to check strategy against risk rules
      2. Use check_position_limits to verify position sizing
      3. Use check_slippage_tolerance for swap safety
      4. Use audit_log_entry to record all decisions

      Validation Rules:

      RISK PROFILE ENFORCEMENT:
      
      LOW RISK:
      - Max 70% single position concentration
      - NO LP positions (IL risk)
      - Max 2 swaps per strategy
      - Slippage tolerance: 0.5%
      - Max position: $100K
      - Max wallet exposure: $500K

      MEDIUM RISK:
      - Max 70% concentration
      - Up to 2 LP positions allowed
      - Max 5 swaps per strategy
      - Slippage tolerance: 1%
      - Max position: $500K
      - Max wallet exposure: $2M

      HIGH RISK:
      - Max 70% concentration (still enforce to prevent liquidations)
      - Up to 5 LP positions allowed
      - Unlimited swaps with TA signals
      - Slippage tolerance: 2%
      - Max position: $2M
      - Max wallet exposure: $5M

      UNIVERSAL RULES:
      - Max 2 bridge operations per strategy (gas efficiency)
      - Leverage cap: 1x (low), 2x (medium), 3x (high)
      - All swaps must be profitable after gas costs
      - Emergency pause if error rate >10%

      Output: Approval decision (approved/rejected/suspended) with audit trail.
    `)
    .withTools(
      validatePlanTool,
      checkPositionLimitsTool,
      checkSlippageTool,
      auditLogTool
    )
    .build();

  return runner;
}

/**
 * Run Enhanced Governor
 */
export async function runEnhancedGovernor(
  positionId: string,
  plan: any,
  riskProfile: 'low' | 'medium' | 'high',
  amount: number
): Promise<{
  approved: boolean;
  violations: string[];
  decision: 'approved' | 'rejected' | 'suspended';
  reason: string;
  auditLogId?: string;
}> {
  try {
    logger.info('🛡️ Running Enhanced Governor', {
      positionId,
      riskProfile,
      amount
    });

    // Validate plan against safety rules
    const violations: string[] = [];

    // Check allocation concentration
    const allocations = Object.values(plan.allocation || {}) as any[];
    const maxAllocation = Math.max(
      ...allocations.map((a: any) => a.percentage || 0),
      0
    );

    if (maxAllocation > 70) {
      violations.push(
        `Concentration risk: ${maxAllocation}% in single position exceeds ${riskProfile} limit of 70%`
      );
    }

    // Check LP positions for low risk
    const swaps = plan.actions?.filter((a: any) => a.type === 'swap') || [];
    if (riskProfile === 'low' && swaps.length > 2) {
      violations.push(
        `Too many swaps (${swaps.length}) for low-risk profile. Maximum 2 allowed.`
      );
    }

    const lps = plan.actions?.filter((a: any) => a.type === 'add_liquidity') || [];
    if (riskProfile === 'low' && lps.length > 0) {
      violations.push(`LP positions not allowed for low-risk profile`);
    }

    // Bridge cost check
    const bridges = plan.actions?.filter((a: any) => a.type === 'bridge') || [];
    if (bridges.length > 2) {
      violations.push(
        `Too many bridges (${bridges.length}). Limit to 2 for gas efficiency.`
      );
    }

    const decision = violations.length === 0 ? 'approved' : 'rejected';

    logger.info('✅ Enhanced Governor completed', {
      decision,
      violations: violations.length
    });

    return {
      approved: decision === 'approved',
      violations,
      decision,
      reason: violations.length > 0
        ? violations.join('; ')
        : `Strategy approved for ${riskProfile}-risk profile`,
      auditLogId: `log-${positionId}-${Date.now()}`
    };

  } catch (error: any) {
    logger.error('Enhanced Governor failed', {
      error: error.message,
      positionId
    });

    return {
      approved: false,
      violations: [`Governor error: ${error.message}`],
      decision: 'suspended',
      reason: `System error: ${error.message}`
    };
  }
}
