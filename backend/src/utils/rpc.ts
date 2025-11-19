import { JsonRpcProvider } from 'ethers';
import { config } from './constants.js';
import { logger } from './logger.js';

let provider: JsonRpcProvider | null = null;

/**
 * Get or create RPC provider for Base Mainnet
 */
export function getProvider(): JsonRpcProvider {
  if (provider) {
    return provider;
  }

  const rpcUrl = config.BASE_RPC_URL;
  
  if (!rpcUrl) {
    throw new Error('BASE_RPC_URL not configured');
  }

  provider = new JsonRpcProvider(rpcUrl, {
    chainId: 8453,
    name: 'base',
  });

  logger.info('Base Mainnet RPC provider initialized');
  return provider;
}

/**
 * Get current block number
 */
export async function getCurrentBlock(): Promise<number> {
  const provider = getProvider();
  return await provider.getBlockNumber();
}

/**
 * Get gas price in wei
 */
export async function getGasPrice(): Promise<bigint> {
  const provider = getProvider();
  const feeData = await provider.getFeeData();
  return feeData.gasPrice || 0n;
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(txHash: string, confirmations = 1) {
  const provider = getProvider();
  const receipt = await provider.waitForTransaction(txHash, confirmations);
  
  if (!receipt) {
    throw new Error(`Transaction ${txHash} not found`);
  }
  
  if (receipt.status === 0) {
    throw new Error(`Transaction ${txHash} failed`);
  }
  
  return receipt;
}

export const rpc = {
  getProvider,
  getCurrentBlock,
  getGasPrice,
  waitForTransaction,
};

export default rpc;
