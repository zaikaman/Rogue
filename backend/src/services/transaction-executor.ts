/**
 * Transaction Executor Service
 * Handles real blockchain transactions for all operations
 */

import { ethers } from 'ethers';
import { getSupabaseClient } from './supabase';
import { logger } from '../utils/logger';
import { depositToProtocol, compoundYield, claimRewards } from '../contracts/yield-harvester';
import { stakeTokens, unstakeTokens } from '../contracts/staking-proxy';
import { executeAerodromeSwap } from './aerodrome-swap';
import { buildBridgeTransaction } from './layerzero-bridge';

/**
 * Get executor wallet for Base Mainnet
 */
function getExecutorWallet(): ethers.Wallet {
  const privateKey = process.env.EXECUTOR_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('EXECUTOR_PRIVATE_KEY not configured');
  }
  
  // Get Base Mainnet RPC URL
  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Record transaction in database
 */
async function recordTransaction(data: {
  positionId?: string;
  walletAddress: string;
  txHash: string;
  type: 'stake' | 'unstake' | 'compound' | 'claim' | 'rebalance' | 'swap' | 'bridge';
  status: 'pending' | 'confirmed' | 'failed';
  chain?: string;
  fromToken?: string;
  toToken?: string;
  amount?: string;
  gasCost?: string;
  notes?: string;
  metadata?: any;
}) {
  const supabase = getSupabaseClient();
  
  await supabase.from('transaction_records').insert({
    position_id: data.positionId,
    wallet_address: data.walletAddress,
    tx_hash: data.txHash,
    type: data.type,
    status: data.status,
    chain: data.chain,
    from_token: data.fromToken,
    to_token: data.toToken,
    amount: data.amount,
    gas_cost: data.gasCost,
    notes: data.notes,
    metadata: data.metadata,
    created_at: new Date().toISOString(),
    confirmed_at: data.status === 'confirmed' ? new Date().toISOString() : null
  });
}

/**
 * Execute deposit to DeFi protocol
 */
export async function executeDeposit(params: {
  positionId: string;
  protocol: string;
  chain: 'base';
  token: string;
  amount: string;
  recipient: string;
}): Promise<{ txHash: string; gasUsed: string }> {
  try {
    logger.info('Executing deposit', params);
    
    const wallet = getExecutorWallet();
    const txHash = await depositToProtocol(
      wallet,
      params.positionId,
      params.protocol,
      params.token,
      params.amount,
      params.recipient // Pass user address for fee deduction
    );
    
    // Wait for confirmation and get gas used
    if (!wallet.provider) throw new Error('Provider not available');
    const receipt = await wallet.provider.getTransactionReceipt(txHash);
    if (!receipt) throw new Error('Transaction receipt not found');
    const gasUsed = receipt.gasUsed ? ethers.formatUnits(receipt.gasUsed, 'gwei') : '0';
    
    await recordTransaction({
      positionId: params.positionId,
      walletAddress: params.recipient,
      txHash,
      type: 'stake',
      status: 'confirmed',
      chain: params.chain,
      fromToken: params.token,
      amount: params.amount,
      gasCost: gasUsed,
      notes: `Deposited ${ethers.formatUnits(params.amount, 6)} ${params.token} to ${params.protocol}`,
      metadata: { protocol: params.protocol, chain: params.chain }
    });
    
    return { txHash, gasUsed };
  } catch (error: any) {
    logger.error('Deposit failed', { error: error.message, params });
    throw error;
  }
}

/**
 * Execute token swap (uses Aerodrome on Base Mainnet)
 */
export async function executeSwap(params: {
  positionId: string;
  chain: 'base';
  fromToken: string;
  toToken: string;
  amount: string;
  recipient: string;
}): Promise<{ txHash: string; gasUsed: string }> {
  try {
    logger.info('Executing swap on Base Mainnet via Aerodrome', params);
    
    // Use Aerodrome for Base Mainnet swaps (already integrated in YieldHarvester)
    const wallet = getExecutorWallet();
    
    // First approve Aerodrome router to spend tokens
    const tokenContract = new ethers.Contract(
      params.fromToken,
      ['function approve(address spender, uint256 amount) returns (bool)'],
      wallet
    );
    
    const approveTx = await tokenContract.approve(
      '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', // Aerodrome Router
      params.amount
    );
    await approveTx.wait();
    logger.info('Token approved for Aerodrome swap');
    
    // Execute swap via Aerodrome
    const txHash = await executeAerodromeSwap(
      wallet,
      params.fromToken,
      params.toToken,
      params.amount,
      50 // 0.5% slippage tolerance
    );
    
    if (!wallet.provider) throw new Error('Provider not available');
    const receipt = await wallet.provider.getTransactionReceipt(txHash);
    if (!receipt) throw new Error('Transaction receipt not found');
    const gasUsed = receipt.gasUsed ? ethers.formatUnits(receipt.gasUsed, 'gwei') : '0';
    
    await recordTransaction({
      positionId: params.positionId,
      walletAddress: params.recipient,
      txHash,
      type: 'swap',
      status: 'confirmed',
      chain: params.chain,
      fromToken: params.fromToken,
      toToken: params.toToken,
      amount: params.amount,
      gasCost: gasUsed,
      notes: `Swapped ${ethers.formatUnits(params.amount, 6)} ${params.fromToken} to ${params.toToken}`,
      metadata: { fromToken: params.fromToken, toToken: params.toToken }
    });
    
    return { txHash, gasUsed };
  } catch (error: any) {
    logger.error('Swap failed', { error: error.message, params });
    throw error;
  }
}

/**
 * Execute cross-chain bridge via LayerZero
 */
export async function executeBridge(params: {
  positionId: string;
  sourceChain: 'base';
  destChain: 'base';
  token: string;
  amount: string;
  recipient: string;
}): Promise<{ txHash: string; gasUsed: string }> {
  try {
    logger.info('Executing bridge', params);
    
    const bridgeTx = await buildBridgeTransaction(
      params.sourceChain,
      params.destChain,
      params.token,
      params.amount,
      params.recipient
    );
    
    const wallet = getExecutorWallet();
    const tx = await wallet.sendTransaction({
      to: bridgeTx.to,
      data: bridgeTx.data,
      value: bridgeTx.value,
      gasLimit: bridgeTx.gas
    });
    
    const receipt = await tx.wait();
    if (!receipt) throw new Error('Transaction receipt not found');
    const txHash = receipt.hash;
    const gasUsed = receipt.gasUsed ? ethers.formatUnits(receipt.gasUsed, 'gwei') : '0';
    
    // Record in bridge_transactions table
    const supabase = getSupabaseClient();
    await supabase.from('bridge_transactions').insert({
      wallet_address: params.recipient,
      source_chain: params.sourceChain,
      dest_chain: params.destChain,
      token: params.token,
      amount: params.amount,
      source_tx_hash: txHash,
      status: 'pending',
      fee: gasUsed,
      created_at: new Date().toISOString()
    });
    
    await recordTransaction({
      positionId: params.positionId,
      walletAddress: params.recipient,
      txHash,
      type: 'bridge',
      status: 'confirmed',
      chain: params.sourceChain,
      fromToken: params.token,
      amount: params.amount,
      gasCost: gasUsed,
      notes: `Bridged ${ethers.formatUnits(params.amount, 6)} ${params.token} from ${params.sourceChain} to ${params.destChain}`,
      metadata: { sourceChain: params.sourceChain, destChain: params.destChain }
    });
    
    return { txHash, gasUsed };
  } catch (error: any) {
    logger.error('Bridge failed', { error: error.message, params });
    throw error;
  }
}

/**
 * Execute compound (reinvest yields)
 */
export async function executeCompound(params: {
  positionId: string;
  protocol: string;
  chain: 'base';
  yieldAmount: string;
  recipient: string;
}): Promise<{ txHash: string; gasUsed: string }> {
  try {
    logger.info('Executing compound', params);
    
    const wallet = getExecutorWallet();
    const txHash = await compoundYield(
      wallet,
      params.positionId,
      params.protocol,
      params.yieldAmount,
      params.recipient // Pass user address for fee deduction
    );
    
    if (!wallet.provider) throw new Error('Provider not available');
    const receipt = await wallet.provider.getTransactionReceipt(txHash);
    if (!receipt) throw new Error('Transaction receipt not found');
    const gasUsed = receipt.gasUsed ? ethers.formatUnits(receipt.gasUsed, 'gwei') : '0';
    
    await recordTransaction({
      positionId: params.positionId,
      walletAddress: params.recipient,
      txHash,
      type: 'compound',
      status: 'confirmed',
      chain: params.chain,
      amount: params.yieldAmount,
      gasCost: gasUsed,
      notes: `Compounded ${ethers.formatUnits(params.yieldAmount, 6)} yield from ${params.protocol}`,
      metadata: { protocol: params.protocol }
    });
    
    return { txHash, gasUsed };
  } catch (error: any) {
    logger.error('Compound failed', { error: error.message, params });
    throw error;
  }
}

/**
 * Execute staking
 */
export async function executeStake(params: {
  token: string;
  amount: string;
  riskProfile: 'low' | 'medium' | 'high';
  chain: 'base';
  walletAddress: string;
}): Promise<{ positionId: string; txHash: string; gasUsed: string }> {
  try {
    logger.info('Executing stake', params);
    
    const wallet = getExecutorWallet();
    const { positionId, txHash } = await stakeTokens(
      wallet,
      params.token,
      params.amount,
      params.riskProfile
    );
    
    if (!wallet.provider) throw new Error('Provider not available');
    const receipt = await wallet.provider.getTransactionReceipt(txHash);
    if (!receipt) throw new Error('Transaction receipt not found');
    const gasUsed = receipt.gasUsed ? ethers.formatUnits(receipt.gasUsed, 'gwei') : '0';
    
    await recordTransaction({
      positionId,
      walletAddress: params.walletAddress,
      txHash,
      type: 'stake',
      status: 'confirmed',
      chain: params.chain,
      fromToken: params.token,
      amount: params.amount,
      gasCost: gasUsed,
      notes: `Staked ${ethers.formatUnits(params.amount, 6)} ${params.token}`,
      metadata: { riskProfile: params.riskProfile }
    });
    
    return { positionId, txHash, gasUsed };
  } catch (error: any) {
    logger.error('Stake failed', { error: error.message, params });
    throw error;
  }
}

/**
 * Execute unstaking
 */
export async function executeUnstake(params: {
  positionId: string;
  chain: 'base';
  walletAddress: string;
}): Promise<{ amount: string; txHash: string; gasUsed: string }> {
  try {
    logger.info('Executing unstake', params);
    
    const wallet = getExecutorWallet();
    const { amount, txHash } = await unstakeTokens(wallet, params.positionId);
    
    if (!wallet.provider) throw new Error('Provider not available');
    const receipt = await wallet.provider.getTransactionReceipt(txHash);
    if (!receipt) throw new Error('Transaction receipt not found');
    const gasUsed = receipt.gasUsed ? ethers.formatUnits(receipt.gasUsed, 'gwei') : '0';
    
    await recordTransaction({
      positionId: params.positionId,
      walletAddress: params.walletAddress,
      txHash,
      type: 'unstake',
      status: 'confirmed',
      chain: params.chain,
      amount,
      gasCost: gasUsed,
      notes: `Unstaked ${amount} tokens`,
      metadata: {}
    });
    
    return { amount, txHash, gasUsed };
  } catch (error: any) {
    logger.error('Unstake failed', { error: error.message, params });
    throw error;
  }
}

/**
 * Execute reward claim
 */
export async function executeClaim(params: {
  positionId: string;
  chain: 'base';
  walletAddress: string;
  amount: string;
}): Promise<{ txHash: string; gasUsed: string }> {
  try {
    logger.info('Executing claim', params);
    
    const wallet = getExecutorWallet();
    const txHash = await claimRewards(
      wallet,
      params.positionId,
      params.walletAddress,
      params.amount
    );
    
    if (!wallet.provider) throw new Error('Provider not available');
    const receipt = await wallet.provider.getTransactionReceipt(txHash);
    if (!receipt) throw new Error('Transaction receipt not found');
    const gasUsed = receipt.gasUsed ? ethers.formatUnits(receipt.gasUsed, 'gwei') : '0';
    
    await recordTransaction({
      positionId: params.positionId,
      walletAddress: params.walletAddress,
      txHash,
      type: 'claim',
      status: 'confirmed',
      chain: params.chain,
      amount: params.amount,
      gasCost: gasUsed,
      notes: `Claimed ${params.amount} ATP rewards`,
      metadata: {}
    });
    
    return { txHash, gasUsed };
  } catch (error: any) {
    logger.error('Claim failed', { error: error.message, params });
    throw error;
  }
}

/**
 * Add liquidity to LP pool
 */
export async function executeAddLiquidity(params: {
  positionId: string;
  protocol: string;
  chain: 'mumbai' | 'sepolia' | 'base_sepolia';
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  recipient: string;
}): Promise<{ txHash: string; gasUsed: string }> {
  try {
    logger.info('Executing add liquidity', params);
    
    // TODO: Implement actual Uniswap V3 LP addition
    // For now, return error as this requires specific pool setup
    throw new Error('Add liquidity not yet implemented - requires Uniswap V3 position manager');
  } catch (error: any) {
    logger.error('Add liquidity failed', { error: error.message, params });
    throw error;
  }
}
