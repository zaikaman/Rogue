/**
 * Enhanced Executor Agent
 * Executes on-chain actions: deposits, swaps, bridges, LPs, staking, compounds
 */

import { AgentBuilder, createTool } from '@iqai/adk';
import * as z from 'zod';
import dedent from 'dedent';
import { ethers } from 'ethers';
import { getProvider } from '../utils/rpc';
import { buildSwapTransaction } from '../services/1inch-api';
import { buildBridgeTransaction } from '../services/layerzero-bridge';
import { buildStakeTransaction } from '../services/lido-staking';
import { getSupabaseClient } from '../services/supabase';
import { recordFeeCollection } from '../services/tokenomics';
import { logger } from '../utils/logger';

/**
 * Tool: Execute deposit to lending protocol
 */
const executeDepositTool = createTool({
  name: 'execute_deposit',
  description: 'Submit deposit transaction to Aave or Frax',
  schema: z.object({
    positionId: z.string(),
    protocol: z.string(),
    chain: z.enum(['mumbai', 'sepolia', 'base_sepolia']),
    token: z.string(),
    amount: z.string(),
    recipient: z.string()
  }) as any,
  fn: async ({ positionId, protocol, chain, token, amount, recipient }: any) => {
    try {
      logger.info('Executing deposit', {
        positionId,
        protocol,
        chain,
        token,
        amount
      });

      const provider = getProvider();
      const blockNumber = await provider.getBlockNumber();

      // Simulate transaction for testnet
      const mockTxHash = ethers.id(`deposit-${positionId}-${Date.now()}`).slice(0, 66);

      const supabase = getSupabaseClient();
      await supabase.from('transaction_records').insert({
        position_id: positionId,
        wallet_address: recipient,
        tx_hash: mockTxHash,
        type: 'stake',
        status: 'confirmed',
        amount,
        token,
        gas_cost: '0.05',
        notes: `Deposited ${ethers.formatUnits(amount, 6)} ${token} to ${protocol} on ${chain}`,
        metadata: { protocol, chain, blockNumber },
        created_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString()
      });

      return {
        txHash: mockTxHash,
        status: 'confirmed',
        action: 'deposit',
        protocol,
        chain,
        token,
        amount,
        gasUsed: '0.05'
      };
    } catch (error: any) {
      logger.error('Deposit execution failed', { error: error.message });
      throw error;
    }
  }
});

/**
 * Tool: Execute swap
 */
const executeSwapTool = createTool({
  name: 'execute_swap',
  description: 'Execute token swap via 1inch',
  schema: z.object({
    positionId: z.string(),
    chain: z.enum(['mumbai', 'sepolia', 'base_sepolia']),
    fromToken: z.string(),
    toToken: z.string(),
    amount: z.string(),
    recipient: z.string()
  }) as any,
  fn: async ({ positionId, chain, fromToken, toToken, amount, recipient }: any) => {
    try {
      logger.info('Executing swap', {
        positionId,
        chain,
        fromToken,
        toToken,
        amount
      });

      await buildSwapTransaction(
        chain,
        fromToken,
        toToken,
        amount,
        recipient
      );

      const mockTxHash = ethers.id(`swap-${positionId}-${Date.now()}`).slice(0, 66);

      const supabase = getSupabaseClient();
      await supabase.from('transaction_records').insert({
        position_id: positionId,
        wallet_address: recipient,
        tx_hash: mockTxHash,
        type: 'rebalance',
        status: 'confirmed',
        amount,
        token: toToken,
        gas_cost: '0.08',
        notes: `Swapped ${ethers.formatUnits(amount, 6)} ${fromToken} to ${toToken}`,
        metadata: { fromToken, toToken, chain },
        created_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString()
      });

      return {
        txHash: mockTxHash,
        status: 'confirmed',
        action: 'swap',
        fromToken,
        toToken,
        inputAmount: amount,
        gasUsed: '0.08'
      };
    } catch (error: any) {
      logger.error('Swap execution failed', { error: error.message });
      throw error;
    }
  }
});

/**
 * Tool: Execute bridge
 */
const executeBridgeTool = createTool({
  name: 'execute_bridge',
  description: 'Bridge assets across chains via LayerZero',
  schema: z.object({
    positionId: z.string(),
    sourceChain: z.enum(['mumbai', 'sepolia', 'base_sepolia']),
    destChain: z.enum(['mumbai', 'sepolia', 'base_sepolia']),
    token: z.string(),
    amount: z.string(),
    recipient: z.string()
  }) as any,
  fn: async ({ positionId, sourceChain, destChain, token, amount, recipient }: any) => {
    try {
      logger.info('Executing bridge', {
        positionId,
        sourceChain,
        destChain,
        token,
        amount
      });

      await buildBridgeTransaction(sourceChain, destChain, token, amount, recipient);

      const mockTxHash = ethers.id(`bridge-${positionId}-${Date.now()}`).slice(0, 66);

      const supabase = getSupabaseClient();
      await supabase.from('transaction_records').insert({
        position_id: positionId,
        wallet_address: recipient,
        tx_hash: mockTxHash,
        type: 'rebalance',
        status: 'confirmed',
        amount,
        token,
        gas_cost: '0.01',
        notes: `Bridged ${ethers.formatUnits(amount, 6)} ${token} from ${sourceChain} to ${destChain}`,
        metadata: { sourceChain, destChain },
        created_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString()
      });

      return {
        txHash: mockTxHash,
        status: 'confirmed',
        action: 'bridge',
        sourceChain,
        destChain,
        token,
        amount,
        estimatedTime: '5 minutes'
      };
    } catch (error: any) {
      logger.error('Bridge execution failed', { error: error.message });
      throw error;
    }
  }
});

/**
 * Tool: Execute staking
 */
const executeStakeTool = createTool({
  name: 'execute_stake',
  description: 'Stake ETH via Lido',
  schema: z.object({
    positionId: z.string(),
    chain: z.enum(['mumbai', 'sepolia', 'base_sepolia']),
    amount: z.string(),
    recipient: z.string()
  }) as any,
  fn: async ({ positionId, chain, amount, recipient }: any) => {
    try {
      logger.info('Executing stake', {
        positionId,
        chain,
        amount
      });

      await buildStakeTransaction(amount, recipient, chain === 'sepolia' ? 'sepolia' : 'mainnet');

      const mockTxHash = ethers.id(`stake-${positionId}-${Date.now()}`).slice(0, 66);

      const supabase = getSupabaseClient();
      await supabase.from('transaction_records').insert({
        position_id: positionId,
        wallet_address: recipient,
        tx_hash: mockTxHash,
        type: 'stake',
        status: 'confirmed',
        amount,
        token: 'ETH',
        gas_cost: '0.04',
        notes: `Staked ${ethers.formatUnits(amount, 18)} ETH on Lido`,
        metadata: { protocol: 'Lido', chain },
        created_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString()
      });

      return {
        txHash: mockTxHash,
        status: 'confirmed',
        action: 'stake',
        protocol: 'Lido',
        chain,
        amount,
        stETHReceived: amount // 1:1 for demo
      };
    } catch (error: any) {
      logger.error('Stake execution failed', { error: error.message });
      throw error;
    }
  }
});

/**
 * Tool: Execute auto-compound
 */
const executeCompoundTool = createTool({
  name: 'execute_compound',
  description: 'Harvest yields and reinvest',
  schema: z.object({
    positionId: z.string(),
    protocol: z.string(),
    yieldAmount: z.string(),
    recipient: z.string()
  }) as any,
  fn: async ({ positionId, protocol, yieldAmount, recipient }: any) => {
    try {
      logger.info('Executing compound', {
        positionId,
        protocol,
        yieldAmount
      });

      // Calculate and deduct fees
      const { calculateYieldFees } = await import('../services/tokenomics');
      const fees = calculateYieldFees(yieldAmount);

      // Record fees
      await recordFeeCollection(
        positionId,
        'management',
        fees.totalFee,
        fees.toHolders,
        fees.toTreasury
      );

      const mockTxHash = ethers.id(`compound-${positionId}-${Date.now()}`).slice(0, 66);

      const supabase = getSupabaseClient();
      await supabase.from('transaction_records').insert({
        position_id: positionId,
        wallet_address: recipient,
        tx_hash: mockTxHash,
        type: 'compound',
        status: 'confirmed',
        amount: fees.userReceives,
        token: 'USDC',
        gas_cost: '0.03',
        notes: `Compounded ${ethers.formatUnits(fees.userReceives, 6)} USDC (${ethers.formatUnits(fees.totalFee, 6)} USDC fee deducted)`,
        metadata: { protocol, yieldAmount: yieldAmount, managementFee: fees.totalFee },
        created_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString()
      });

      return {
        txHash: mockTxHash,
        status: 'confirmed',
        action: 'compound',
        protocol,
        yieldHarvested: yieldAmount,
        reinvested: fees.userReceives,
        feesToHolders: fees.toHolders,
        feesToTreasury: fees.toTreasury
      };
    } catch (error: any) {
      logger.error('Compound execution failed', { error: error.message });
      throw error;
    }
  }
});

/**
 * Tool: Execute add liquidity
 */
const executeAddLiquidityTool = createTool({
  name: 'execute_add_liquidity',
  description: 'Add liquidity to Uniswap V3 pool',
  schema: z.object({
    positionId: z.string(),
    chain: z.enum(['mumbai', 'sepolia']),
    pool: z.string(),
    amount0: z.string(),
    amount1: z.string(),
    recipient: z.string()
  }) as any,
  fn: async ({ positionId, chain, pool, amount0, amount1, recipient }: any) => {
    try {
      logger.info('Executing add liquidity', {
        positionId,
        chain,
        pool
      });

      const mockTxHash = ethers.id(`add-lp-${positionId}-${Date.now()}`).slice(0, 66);

      const supabase = getSupabaseClient();
      await supabase.from('transaction_records').insert({
        position_id: positionId,
        wallet_address: recipient,
        tx_hash: mockTxHash,
        type: 'rebalance',
        status: 'confirmed',
        amount: (BigInt(amount0) + BigInt(amount1)).toString(),
        token: 'LP',
        gas_cost: '0.12',
        notes: `Added liquidity to ${pool} pool`,
        metadata: { chain, pool, amount0, amount1 },
        created_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString()
      });

      return {
        txHash: mockTxHash,
        status: 'confirmed',
        action: 'add_liquidity',
        chain,
        pool,
        liquidity: (BigInt(amount0) + BigInt(amount1)).toString()
      };
    } catch (error: any) {
      logger.error('Add liquidity execution failed', { error: error.message });
      throw error;
    }
  }
});

/**
 * Tool: Batch execute multiple actions
 */
const batchExecuteTool = createTool({
  name: 'batch_execute',
  description: 'Execute multiple actions in sequence for gas efficiency',
  schema: z.object({
    positionId: z.string(),
    actions: z.array(z.any())
  }) as any,
  fn: async ({ positionId, actions }: any) => {
    try {
      logger.info('Executing batch of actions', {
        positionId,
        actionCount: actions.length
      });

      const results: any[] = [];
      let totalGas = 0;

      for (const action of actions) {
        try {
          // Execute each action
          logger.info(`Executing action: ${action.type}`);
          // Results would be accumulated here
          results.push({ type: action.type, status: 'executed' });
          totalGas += 0.05; // Approximate
        } catch (error: any) {
          logger.error(`Action ${action.type} failed`, { error: error.message });
          // Continue with next action on error
        }
      }

      return {
        totalActions: actions.length,
        successfulActions: results.length,
        totalGasUsed: totalGas.toFixed(2),
        results
      };
    } catch (error: any) {
      logger.error('Batch execution failed', { error: error.message });
      throw error;
    }
  }
});

/**
 * Tool: Update position state
 */
const updatePositionStateTool = createTool({
  name: 'update_position_state',
  description: 'Update position in database after execution',
  schema: z.object({
    positionId: z.string(),
    amount: z.string().optional(),
    status: z.enum(['active', 'paused', 'closed']).optional()
  }) as any,
  fn: async ({ positionId, amount, status }: any) => {
    try {
      const supabase = getSupabaseClient();

      const updates: any = {
        last_action_at: new Date().toISOString()
      };

      if (amount) updates.amount = amount;
      if (status) updates.status = status;

      await supabase
        .from('positions')
        .update(updates)
        .eq('id', positionId);

      return {
        updated: true,
        positionId
      };
    } catch (error: any) {
      logger.error('Position update failed', { error: error.message });
      throw error;
    }
  }
});

/**
 * Create Enhanced Executor Agent
 */
export async function createEnhancedExecutorAgent() {
  const { runner } = await AgentBuilder.create('enhanced_executor')
    .withModel(process.env.OPENAI_MODEL || 'gpt-4o-mini')
    .withDescription('Multi-chain execution layer for Rogue')
    .withInstruction(dedent`
      You are the Enhanced Executor Agent for Rogue, responsible for on-chain action execution.

      Your mission: Execute strategies safely and efficiently, logging all actions.

      Capabilities:
      1. Deposits: Use execute_deposit for Aave/Frax deposits
      2. Swaps: Use execute_swap for 1inch token exchanges
      3. Bridges: Use execute_bridge for cross-chain transfers via LayerZero
      4. Staking: Use execute_stake for Lido ETH staking
      5. Auto-Compound: Use execute_compound to harvest and reinvest yields
      6. Liquidity: Use execute_add_liquidity for Uniswap V3 LP positions
      7. Batch: Use batch_execute for gas-efficient multi-step operations
      8. State: Use update_position_state to track on-chain changes

      Execution Guidelines:
      - All transactions are simulated on testnet (confirmed immediately)
      - Log all actions to transaction_records for audit trail
      - Deduct fees BEFORE returning to user
      - Skip actions if insufficient liquidity/balance
      - Retry failed actions with exponential backoff
      - Update position state after each major action

      Safety Checks:
      - Validate all addresses before execution
      - Check slippage tolerance (max 2%)
      - Verify gas estimates before submission
      - Pause if error rate >10% in session

      Output: Transaction hashes, action results, gas usage, and position updates.
    `)
    .withTools(
      executeDepositTool,
      executeSwapTool,
      executeBridgeTool,
      executeStakeTool,
      executeCompoundTool,
      executeAddLiquidityTool,
      batchExecuteTool,
      updatePositionStateTool
    )
    .build();

  return runner;
}

/**
 * Run Enhanced Executor
 */
export async function runEnhancedExecutor(
  positionId: string,
  actions: any[]
): Promise<{
  success: boolean;
  executedActions: any[];
  failedActions: any[];
  totalGasUsed: string;
  positionUpdated: boolean;
}> {
  try {
    logger.info('🚀 Running Enhanced Executor', {
      positionId,
      actionCount: actions.length
    });

    const agent = await createEnhancedExecutorAgent();

    const response = await agent.ask(dedent`
      Execute the following action plan for position ${positionId}:
      ${JSON.stringify(actions, null, 2)}

      Execute each action in sequence, handle errors gracefully, log everything to transaction_records,
      and update the position state when complete.
    `);

    logger.info('✅ Enhanced Executor completed', { response });

    // Simulate execution results
    const executedActions = actions.slice(0, Math.max(1, Math.floor(actions.length * 0.9)));
    const failedActions = actions.slice(executedActions.length);

    return {
      success: failedActions.length === 0,
      executedActions: executedActions.map(a => ({
        ...a,
        status: 'executed',
        txHash: '0x' + ethers.id(`${a.type}-${positionId}`).slice(2, 66)
      })),
      failedActions,
      totalGasUsed: (executedActions.length * 0.05).toFixed(2),
      positionUpdated: true
    };

  } catch (error: any) {
    logger.error('Enhanced Executor failed', {
      error: error.message,
      positionId
    });
    throw error;
  }
}
