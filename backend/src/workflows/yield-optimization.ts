import { runResearcherAgent } from '../agents/researcher';
import { runAnalyzerAgent } from '../agents/analyzer';
import { executeDeposit, executeCompound } from '../agents/executor';
import { runGovernorAgent } from '../agents/governor';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

/**
 * Log transaction to Supabase
 */
async function logTransaction(
  walletAddress: string,
  positionId: string,
  type: 'stake' | 'unstake' | 'compound' | 'rebalance' | 'deposit',
  status: 'pending' | 'confirmed' | 'failed',
  txHash?: string,
  gasCost?: string,
  notes?: string
) {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('transactions').insert({
      wallet_address: walletAddress,
      position_id: positionId,
      tx_hash: txHash || '',
      type,
      status,
      gas_cost: gasCost,
      notes,
      created_at: new Date().toISOString(),
      confirmed_at: status === 'confirmed' ? new Date().toISOString() : null
    });
    logger.info('Transaction logged', { type, status, positionId });
  } catch (error: any) {
    logger.error('Failed to log transaction', { error: error.message });
  }
}

/**
 * Rogue Yield Optimization Workflow
 * 
 * Sequential multi-agent workflow: Researcher → Analyzer → Executor → Governor
 * 
 * Per research.md:
 * - Uses shared state communication (session.state)
 * - Sequential execution matches linear pipeline
 * - Governor validates before execution
 */

interface WorkflowInput {
  positionId: string;
  walletAddress: string;
  token: 'USDC' | 'KRWQ';
  amount: number;
  riskProfile: 'low' | 'medium' | 'high';
  action: 'create' | 'compound' | 'unstake';
}

interface WorkflowOutput {
  success: boolean;
  positionId: string;
  steps: {
    researcher?: any;
    analyzer?: any;
    executor?: any;
    governor?: any;
  };
  finalStatus: string;
  error?: string;
}

/**
 * Execute the full Rogue yield optimization workflow
 */
export async function runYieldOptimizationWorkflow(
  input: WorkflowInput
): Promise<WorkflowOutput> {
  const sessionId = `workflow-${input.positionId}-${Date.now()}`;
  const steps: any = {};

  try {
    logger.info('Starting yield optimization workflow', {
      sessionId,
      positionId: input.positionId,
      action: input.action
    });

    // Log workflow start
    const supabase = getSupabaseClient();
    await supabase
      .from('agent_logs')
      .insert({
        agent_name: 'Workflow',
        action: 'workflow_start',
        status: 'running',
        position_id: input.positionId,
        wallet_address: input.walletAddress,
        metadata: { input },
        created_at: new Date().toISOString()
      });

    // STEP 1: Researcher Agent - Scan markets
    logger.info('[Workflow Step 1] Running Researcher agent', { sessionId });
    try {
      const marketData = await runResearcherAgent(sessionId);
      steps.researcher = {
        status: 'completed',
        data: marketData,
        timestamp: new Date().toISOString()
      };
      logger.info('[Workflow Step 1] Researcher completed', {
        opportunities: marketData.topOpportunities.length
      });
    } catch (error: any) {
      logger.error('[Workflow Step 1] Researcher failed', { error: error.message });
      throw new Error(`Researcher agent failed: ${error.message}`);
    }

    // STEP 2: Analyzer Agent - Create personalized strategy
    logger.info('[Workflow Step 2] Running Analyzer agent', { sessionId });
    try {
      const strategy = await runAnalyzerAgent(
        input.positionId,
        input.riskProfile,
        input.amount,
        input.token,
        steps.researcher.data
      );
      steps.analyzer = {
        status: 'completed',
        data: strategy,
        timestamp: new Date().toISOString()
      };
      logger.info('[Workflow Step 2] Analyzer completed', {
        strategyId: strategy.strategyId,
        expectedAPY: strategy.expectedAPY
      });
    } catch (error: any) {
      logger.error('[Workflow Step 2] Analyzer failed', { error: error.message });
      throw new Error(`Analyzer agent failed: ${error.message}`);
    }

    // STEP 3: Governor Agent - Validate execution plan
    logger.info('[Workflow Step 3] Running Governor agent', { sessionId });
    try {
      const validation = await runGovernorAgent(
        input.positionId,
        steps.analyzer.data,
        { action: input.action } // Execution plan
      );
      steps.governor = {
        status: 'completed',
        data: validation,
        timestamp: new Date().toISOString()
      };
      
      if (!validation.approved) {
        logger.warn('[Workflow Step 3] Governor rejected execution plan', {
          warnings: validation.warnings
        });
        throw new Error(`Execution plan rejected: ${validation.warnings.join(', ')}`);
      }
      
      logger.info('[Workflow Step 3] Governor approved', {
        riskScore: validation.riskScore
      });
    } catch (error: any) {
      logger.error('[Workflow Step 3] Governor failed', { error: error.message });
      throw new Error(`Governor agent failed: ${error.message}`);
    }

    // STEP 4: Executor Agent - Execute on-chain actions
    logger.info('[Workflow Step 4] Running Executor agent', { sessionId });
    try {
      // Log pending transaction
      await logTransaction(
        input.walletAddress,
        input.positionId,
        input.action === 'create' ? 'stake' : input.action,
        'pending',
        undefined,
        undefined,
        `${input.action} initiated by workflow`
      );

      let executionResult;
      
      if (input.action === 'create') {
        // Initial deposit
        const protocol = steps.analyzer.data.protocolAllocations['Aave v3'] > 50
          ? 'Aave v3'
          : 'Frax Finance';
        
        executionResult = await executeDeposit(
          input.positionId,
          protocol,
          input.token,
          input.amount.toString()
        );
      } else if (input.action === 'compound') {
        // Auto-compound
        const protocol = steps.analyzer.data.protocolAllocations['Aave v3'] > 50
          ? 'Aave v3'
          : 'Frax Finance';
        
        executionResult = await executeCompound(
          input.positionId,
          protocol
        );
      } else {
        throw new Error(`Unsupported action: ${input.action}`);
      }
      
      steps.executor = {
        status: 'completed',
        data: executionResult,
        timestamp: new Date().toISOString()
      };
      
      logger.info('[Workflow Step 4] Executor completed', {
        txHash: executionResult.txHash
      });

      // Log confirmed transaction
      await logTransaction(
        input.walletAddress,
        input.positionId,
        input.action === 'create' ? 'stake' : input.action,
        'confirmed',
        executionResult.txHash,
        executionResult.gasCost,
        `${input.action} completed successfully`
      );
    } catch (error: any) {
      logger.error('[Workflow Step 4] Executor failed', { error: error.message });
      
      // Log failed transaction
      await logTransaction(
        input.walletAddress,
        input.positionId,
        input.action === 'create' ? 'stake' : input.action,
        'failed',
        undefined,
        undefined,
        `Execution failed: ${error.message}`
      );
      
      throw new Error(`Executor agent failed: ${error.message}`);
    }

    // Update position status
    await supabase
      .from('positions')
      .update({
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', input.positionId);

    // Log workflow completion
    await supabase
      .from('agent_logs')
      .insert({
        agent_name: 'Workflow',
        action: 'workflow_complete',
        status: 'success',
        position_id: input.positionId,
        wallet_address: input.walletAddress,
        metadata: {
          steps: Object.keys(steps),
          txHash: steps.executor?.data?.txHash
        },
        created_at: new Date().toISOString()
      });

    logger.info('Workflow completed successfully', {
      sessionId,
      positionId: input.positionId,
      txHash: steps.executor?.data?.txHash
    });

    return {
      success: true,
      positionId: input.positionId,
      steps,
      finalStatus: 'active'
    };
  } catch (error: any) {
    logger.error('Workflow failed', {
      sessionId,
      positionId: input.positionId,
      error: error.message,
      completedSteps: Object.keys(steps)
    });

    // Log workflow failure
    const supabase = getSupabaseClient();
    await supabase
      .from('agent_logs')
      .insert({
        agent_name: 'Workflow',
        action: 'workflow_failed',
        status: 'failed',
        position_id: input.positionId,
        wallet_address: input.walletAddress,
        notes: error.message,
        metadata: { steps, error: error.message },
        created_at: new Date().toISOString()
      });

    // Update position to error state if exists
    if (input.positionId) {
      await supabase
        .from('positions')
        .update({
          status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('id', input.positionId);
    }

    return {
      success: false,
      positionId: input.positionId,
      steps,
      finalStatus: 'error',
      error: error.message
    };
  }
}

/**
 * Run workflow for new position creation
 */
export async function createPositionWorkflow(
  walletAddress: string,
  token: 'USDC' | 'KRWQ',
  amount: number,
  riskProfile: 'low' | 'medium' | 'high'
): Promise<WorkflowOutput> {
  // Create position record first
  const supabase = getSupabaseClient();
  const { data: position, error } = await supabase
    .from('positions')
    .insert({
      wallet_address: walletAddress.toLowerCase(),
      token,
      amount: amount.toString(),
      risk_profile: riskProfile,
      status: 'initializing',
      allocation: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error || !position) {
    throw new Error(`Failed to create position: ${error?.message || 'Unknown error'}`);
  }

  // Run workflow
  return await runYieldOptimizationWorkflow({
    positionId: position.id,
    walletAddress,
    token,
    amount,
    riskProfile,
    action: 'create'
  });
}

/**
 * Run workflow for auto-compound
 */
export async function compoundPositionWorkflow(
  positionId: string
): Promise<WorkflowOutput> {
  // Get position details
  const supabase = getSupabaseClient();
  const { data: position, error } = await supabase
    .from('positions')
    .select('*')
    .eq('id', positionId)
    .single();

  if (error || !position) {
    throw new Error(`Position not found: ${positionId}`);
  }

  // Run workflow
  return await runYieldOptimizationWorkflow({
    positionId,
    walletAddress: position.wallet_address,
    token: position.token,
    amount: parseFloat(position.amount),
    riskProfile: position.risk_profile,
    action: 'compound'
  });
}
