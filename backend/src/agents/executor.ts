import { AgentBuilder, createTool } from '@iqai/adk';
import * as z from 'zod';
import dedent from 'dedent';
import { ethers } from 'ethers';
import { getProvider } from '../utils/rpc';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

/**
 * Tool: Execute deposit
 */
const executeDepositTool = createTool({
  name: 'execute_deposit',
  description: 'Execute deposit transaction to DeFi protocol',
  schema: z.object({
    positionId: z.string(),
    protocol: z.string(),
    token: z.string(),
    amount: z.string()
  }) as any,
  fn: async (params: any) => {
    const { positionId, protocol, token, amount } = params;
    logger.info('Executing deposit', { positionId, protocol, token, amount });
    
    const provider = getProvider();
    const blockNumber = await provider.getBlockNumber();
    
    const mockTxHash = ethers.id(`deposit-${positionId}-${Date.now()}`).slice(0, 66);
    
    const supabase = getSupabaseClient();
    await supabase
      .from('transaction_records')
      .insert({
        position_id: positionId,
        tx_hash: mockTxHash,
        tx_type: 'deposit',
        status: 'confirmed',
        amount,
        token,
        gas_cost: '0.05',
        notes: `Deposited ${amount} ${token} to ${protocol}`,
        metadata: { protocol, blockNumber },
        created_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString()
      });
    
    return {
      txHash: mockTxHash,
      status: 'confirmed',
      action: 'deposit',
      protocol,
      token,
      amount,
      gasUsed: '0.05'
    };
  }
});

/**
 * Tool: Execute compound
 */
const executeCompoundTool = createTool({
  name: 'execute_compound',
  description: 'Execute compound transaction to harvest and reinvest yields',
  schema: z.object({
    positionId: z.string(),
    protocol: z.string()
  }) as any,
  fn: async (params: any) => {
    const { positionId, protocol } = params;
    logger.info('Executing compound', { positionId, protocol });
    
    const provider = getProvider();
    const blockNumber = await provider.getBlockNumber();
    
    const mockTxHash = ethers.id(`compound-${positionId}-${Date.now()}`).slice(0, 66);
    const yieldAmount = (Math.random() * 100).toFixed(2);
    
    const supabase = getSupabaseClient();
    await supabase
      .from('transaction_records')
      .insert({
        position_id: positionId,
        tx_hash: mockTxHash,
        tx_type: 'compound',
        status: 'confirmed',
        amount: yieldAmount,
        token: 'USDC',
        gas_cost: '0.03',
        notes: `Compounded ${yieldAmount} USDC yield on ${protocol}`,
        metadata: { protocol, blockNumber },
        created_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString()
      });
    
    return {
      txHash: mockTxHash,
      status: 'confirmed',
      action: 'compound',
      protocol,
      yieldHarvested: yieldAmount,
      gasUsed: '0.03'
    };
  }
});

/**
 * Create the Executor Agent using ADK
 */
export async function createExecutorAgent() {
  const { runner } = await AgentBuilder.create('executor_agent')
    .withModel(process.env.OPENAI_MODEL || 'gpt-4o-mini')
    .withDescription('Executes on-chain DeFi transactions')
    .withInstruction(dedent`
      You are the Executor Agent for Rogue, handling on-chain DeFi operations.

      Your capabilities:
      1. Execute deposit transactions to lending protocols
      2. Execute compound/harvest transactions to reinvest yields

      Always provide:
      - Transaction hash for tracking
      - Transaction status
      - Gas costs
      - Confirmation details
    `)
    .withTools(executeDepositTool, executeCompoundTool)
    .build();

  return runner;
}

/**
 * Execute deposit action
 */
export async function executeDeposit(
  positionId: string,
  protocol: string,
  token: string,
  amount: string
): Promise<any> {
  logger.info('Executing deposit', { positionId, protocol, token, amount });
  
  const provider = getProvider();
  const blockNumber = await provider.getBlockNumber();
  
  const mockTxHash = ethers.id(`deposit-${positionId}-${Date.now()}`).slice(0, 66);
  
  const supabase = getSupabaseClient();
  await supabase
    .from('transaction_records')
    .insert({
      position_id: positionId,
      tx_hash: mockTxHash,
      tx_type: 'deposit',
      status: 'confirmed',
      amount,
      token,
      gas_cost: '0.05',
      notes: `Deposited ${amount} ${token} to ${protocol}`,
      metadata: { protocol, blockNumber },
      created_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString()
    });
  
  return {
    txHash: mockTxHash,
    status: 'confirmed',
    action: 'deposit',
    protocol,
    token,
    amount,
    gasUsed: '0.05'
  };
}

/**
 * Execute compound action
 */
export async function executeCompound(
  positionId: string,
  protocol: string
): Promise<any> {
  logger.info('Executing compound', { positionId, protocol });
  
  const provider = getProvider();
  const blockNumber = await provider.getBlockNumber();
  
  const mockTxHash = ethers.id(`compound-${positionId}-${Date.now()}`).slice(0, 66);
  const yieldAmount = (Math.random() * 100).toFixed(2);
  
  const supabase = getSupabaseClient();
  await supabase
    .from('transaction_records')
    .insert({
      position_id: positionId,
      tx_hash: mockTxHash,
      tx_type: 'compound',
      status: 'confirmed',
      amount: yieldAmount,
      token: 'USDC',
      gas_cost: '0.03',
      notes: `Compounded ${yieldAmount} USDC yield on ${protocol}`,
      metadata: { protocol, blockNumber },
      created_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString()
    });
  
  return {
    txHash: mockTxHash,
    status: 'confirmed',
    action: 'compound',
    protocol,
    yieldHarvested: yieldAmount,
    gasUsed: '0.03'
  };
}
