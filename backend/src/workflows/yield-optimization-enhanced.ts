/**
 * Enhanced Multi-Agent Workflow Orchestrator
 * Chains: Researcher → Trader → Governor → Executor
 */

import { logger } from '../utils/logger';
import { getSupabaseClient } from '../services/supabase';
import { runEnhancedResearcher } from '../agents/researcher-enhanced';
import { runEnhancedTrader } from '../agents/trader-enhanced';
import { runEnhancedGovernor } from '../agents/governor-enhanced';
import { runEnhancedExecutor } from '../agents/executor-enhanced';

interface WorkflowInput {
  positionId: string;
  walletAddress: string;
  token: 'USDC';
  amount: number;
  riskProfile: 'low' | 'medium' | 'high';
  action: 'create' | 'compound' | 'rebalance' | 'unstake';
  chains?: ('base')[];
}

interface WorkflowOutput {
  success: boolean;
  positionId: string;
  steps: {
    researcher?: any;
    trader?: any;
    governor?: any;
    executor?: any;
  };
  finalStatus: string;
  error?: string;
  summary?: {
    expectedAPY: number;
    actionCount: number;
    gasEstimate: string;
    totalFeeDeducted: string;
  };
}

/**
 * Execute full multi-agent workflow
 */
export async function runYieldOptimizationWorkflow(
  input: WorkflowInput
): Promise<WorkflowOutput> {
  const sessionId = `workflow-${input.positionId}-${Date.now()}`;
  const steps: any = {};
  const chains = input.chains || ['base'];

  try {
    logger.info('🚀 Starting yield optimization workflow', {
      sessionId,
      positionId: input.positionId,
      action: input.action,
      amount: input.amount,
      riskProfile: input.riskProfile
    });

    const supabase = getSupabaseClient();

    // Log workflow start
    await supabase.from('agent_logs').insert({
      agent_name: 'workflow',
      action: 'workflow_start',
      success: true,
      metadata: { sessionId, input },
      created_at: new Date().toISOString()
    });

    // ============================================================
    // STEP 1: RESEARCHER - Market Scan
    // ============================================================
    logger.info('📊 [Step 1/4] Running Researcher Agent - Market Analysis');

    try {
      const researchData = await runEnhancedResearcher(sessionId, chains);

      steps.researcher = {
        status: 'completed',
        timestamp: new Date().toISOString(),
        findings: {
          opportunitiesScanned: researchData.topOpportunities.length,
          bestAPY: researchData.topOpportunities[0]?.apy,
          bestProtocol: researchData.topOpportunities[0]?.protocol,
          topOpportunities: researchData.topOpportunities
        }
      };

      logger.info('✅ Researcher completed', {
        opportunities: researchData.topOpportunities.length,
        bestAPY: researchData.topOpportunities[0]?.apy
      });

    } catch (error: any) {
      logger.error('❌ Researcher failed', { error: error.message });
      throw new Error(`Researcher agent failed: ${error.message}`);
    }

    // ============================================================
    // STEP 2: TRADER - Strategy Creation
    // ============================================================
    logger.info('💰 [Step 2/4] Running Trader/Analyzer Agent - Portfolio Optimization');

    try {
      const tradeData = await runEnhancedTrader(
        input.positionId,
        input.riskProfile,
        input.amount,
        steps.researcher.findings
      );

      steps.trader = {
        status: 'completed',
        timestamp: new Date().toISOString(),
        strategy: {
          expectedAPY: tradeData.expectedAPY,
          riskScore: tradeData.riskScore,
          allocation: tradeData.allocation,
          actionCount: tradeData.actionPlan?.actions?.length || 0,
          diversification: Object.keys(tradeData.allocation).length
        },
        actionPlan: tradeData.actionPlan,
        signals: tradeData.signals
      };

      logger.info('✅ Trader completed', {
        expectedAPY: tradeData.expectedAPY,
        actions: tradeData.actionPlan.actions.length
      });

    } catch (error: any) {
      logger.error('❌ Trader failed', { error: error.message });
      throw new Error(`Trader agent failed: ${error.message}`);
    }

    // ============================================================
    // STEP 3: GOVERNOR - Risk Validation
    // ============================================================
    logger.info('🛡️ [Step 3/4] Running Governor Agent - Risk Validation');

    try {
      const governanceData = await runEnhancedGovernor(
        input.positionId,
        steps.trader.actionPlan,
        input.riskProfile,
        input.amount
      );

      steps.governor = {
        status: 'completed',
        timestamp: new Date().toISOString(),
        decision: governanceData.decision,
        violations: governanceData.violations,
        reason: governanceData.reason,
        auditLogId: governanceData.auditLogId
      };

      if (!governanceData.approved) {
        logger.error('❌ Governor rejected strategy', {
          violations: governanceData.violations
        });
        throw new Error(`Strategy rejected by Governor: ${governanceData.reason}`);
      }

      logger.info('✅ Governor approved strategy', {
        decision: governanceData.decision
      });

    } catch (error: any) {
      logger.error('❌ Governor failed', { error: error.message });
      throw new Error(`Governor agent failed: ${error.message}`);
    }

    // ============================================================
    // STEP 4: EXECUTOR - On-Chain Execution
    // ============================================================
    logger.info('🚀 [Step 4/4] Running Executor Agent - On-Chain Execution');

    try {
      const executionData = await runEnhancedExecutor(
        input.positionId,
        steps.trader.actionPlan.actions
      );

      steps.executor = {
        status: 'completed',
        timestamp: new Date().toISOString(),
        execution: {
          success: executionData.success,
          executedActions: executionData.executedActions.length,
          failedActions: executionData.failedActions.length,
          totalGasUsed: executionData.totalGasUsed,
          positionUpdated: executionData.positionUpdated
        },
        transactionHashes: executionData.executedActions.map(a => a.txHash)
      };

      logger.info('✅ Executor completed', {
        executedActions: executionData.executedActions.length,
        failedActions: executionData.failedActions.length,
        gasUsed: executionData.totalGasUsed
      });

    } catch (error: any) {
      logger.error('❌ Executor failed', { error: error.message });
      throw new Error(`Executor agent failed: ${error.message}`);
    }

    // ============================================================
    // WORKFLOW COMPLETION
    // ============================================================
    logger.info('✅ Workflow completed successfully', {
      sessionId,
      positionId: input.positionId
    });

    // Calculate summary
    const totalGasUsed = parseFloat(steps.executor?.execution?.totalGasUsed || '0');
    const gasValue = totalGasUsed * 1800; // Assume $1800 ETH

    const summary = {
      expectedAPY: steps.trader.strategy.expectedAPY,
      actionCount: steps.trader.strategy.actionCount,
      gasEstimate: `${totalGasUsed} ETH (~$${gasValue.toFixed(2)})`,
      totalFeeDeducted: '0 USDC' // Will be calculated on compound
    };

    // Log workflow completion
    await supabase.from('agent_logs').insert({
      agent_name: 'workflow',
      action: 'workflow_complete',
      success: true,
      metadata: {
        sessionId,
        ...summary,
        steps: Object.keys(steps).length
      },
      created_at: new Date().toISOString()
    });

    return {
      success: true,
      positionId: input.positionId,
      steps,
      finalStatus: 'completed',
      summary
    };

  } catch (error: any) {
    logger.error('❌ Workflow failed', {
      sessionId,
      error: error.message,
      step: Object.keys(steps).length + 1
    });

    // Log workflow failure
    const supabase = getSupabaseClient();
    await supabase.from('agent_logs').insert({
      agent_name: 'workflow',
      action: 'workflow_failed',
      success: false,
      error_message: error.message,
      metadata: {
        sessionId,
        failedAt: Object.keys(steps).length,
        completedSteps: steps
      },
      created_at: new Date().toISOString()
    });

    return {
      success: false,
      positionId: input.positionId,
      steps,
      finalStatus: 'failed',
      error: error.message
    };
  }
}

/**
 * Execute compound workflow (harvest yields)
 */
export async function runCompoundWorkflow(
  positionId: string,
  walletAddress: string
): Promise<WorkflowOutput> {
  logger.info('🔄 Starting compound workflow', { positionId });

  return runYieldOptimizationWorkflow({
    positionId,
    walletAddress,
    token: 'USDC',
    amount: 0, // No new deposit
    riskProfile: 'medium', // Default
    action: 'compound',
    chains: ['base']
  });
}

/**
 * Execute rebalance workflow (adjust allocations)
 */
export async function runRebalanceWorkflow(
  positionId: string,
  walletAddress: string,
  riskProfile: 'low' | 'medium' | 'high'
): Promise<WorkflowOutput> {
  logger.info('🔀 Starting rebalance workflow', { positionId, riskProfile });

  return runYieldOptimizationWorkflow({
    positionId,
    walletAddress,
    token: 'USDC',
    amount: 0,
    riskProfile,
    action: 'rebalance',
    chains: ['base']
  });
}

/**
 * Get workflow status
 */
export async function getWorkflowStatus(
  sessionId: string
): Promise<{
  status: 'running' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  logs: any[];
}> {
  try {
    const supabase = getSupabaseClient();

    const { data: logs } = await supabase
      .from('agent_logs')
      .select('*')
      .match({ metadata: { sessionId } })
      .order('created_at', { ascending: true });

    if (!logs || logs.length === 0) {
      return {
        status: 'running',
        progress: 0,
        logs: []
      };
    }

    const failedLog = logs.find((l: any) => l.action === 'workflow_failed');
    const completedLog = logs.find((l: any) => l.action === 'workflow_complete');

    const status = failedLog ? 'failed' : completedLog ? 'completed' : 'running';
    const progress = (logs.length / 5) * 100; // 5 total steps

    return {
      status,
      progress: Math.min(progress, 100),
      logs
    };

  } catch (error: any) {
    logger.error('Failed to get workflow status', { error: error.message });
    throw error;
  }
}
