/**
 * 1inch Aggregator API Integration
 * Provides optimal swap routing for token exchanges
 */

import { logger } from '../utils/logger';
import { ethers } from 'ethers';

interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  estimatedGas: string;
  protocols: string[];
  priceImpact: number;
}

interface SwapTransaction {
  from: string;
  to: string;
  data: string;
  value: string;
  gas: string;
  gasPrice: string;
}

/**
 * Get swap quote from 1inch
 */
export async function getSwapQuote(
  chain: 'mumbai' | 'sepolia' | 'base_sepolia',
  fromToken: string,
  toToken: string,
  amount: string
): Promise<SwapQuote> {
  try {
    // For testnet, we'll simulate responses
    // In production, use actual 1inch API with API key
    logger.info('Getting swap quote from 1inch', {
      chain,
      fromToken,
      toToken,
      amount
    });

    // Simulated quote for testnet
    const simulatedQuote: SwapQuote = {
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: calculateSimulatedOutput(amount),
      estimatedGas: ethers.parseUnits('150000', 'wei').toString(),
      protocols: ['Uniswap_V3', 'SushiSwap'],
      priceImpact: calculatePriceImpact(amount)
    };

    return simulatedQuote;
  } catch (error: any) {
    logger.error('Failed to get swap quote', {
      error: error.message,
      chain,
      fromToken,
      toToken
    });
    throw new Error(`1inch quote failed: ${error.message}`);
  }
}

/**
 * Build swap transaction
 */
export async function buildSwapTransaction(
  chain: 'mumbai' | 'sepolia' | 'base_sepolia',
  fromToken: string,
  toToken: string,
  amount: string,
  fromAddress: string
): Promise<SwapTransaction> {
  try {
    logger.info('Building swap transaction', {
      chain,
      fromToken,
      toToken,
      amount,
      fromAddress
    });

    // Simulated transaction for testnet
    const simulatedTx: SwapTransaction = {
      from: fromAddress,
      to: '0x1111111254EEB25477B68fb85Ed929f73A960582', // 1inch router
      data: '0x' + Buffer.from('simulated_swap_data').toString('hex'),
      value: fromToken === ethers.ZeroAddress ? amount : '0',
      gas: '200000',
      gasPrice: ethers.parseUnits('30', 'gwei').toString()
    };

    return simulatedTx;
  } catch (error: any) {
    logger.error('Failed to build swap transaction', {
      error: error.message
    });
    throw new Error(`1inch swap build failed: ${error.message}`);
  }
}

/**
 * Check if swap is profitable after gas
 */
export function isSwapProfitable(
  quote: SwapQuote,
  gasPrice: bigint
): boolean {
  try {
    const gasCost = BigInt(quote.estimatedGas) * gasPrice;
    const gasCostUsd = Number(ethers.formatUnits(gasCost, 18)) * 1800; // Assume $1800 ETH

    // Simple profitability check
    const outputValue = Number(quote.toAmount);
    const inputValue = Number(quote.fromAmount);
    const profit = outputValue - inputValue - gasCostUsd;

    return profit > 5; // Minimum $5 profit threshold
  } catch (error: any) {
    logger.warn('Error checking swap profitability', { error: error.message });
    return false;
  }
}

/**
 * Helper: Calculate simulated output for testnet
 */
function calculateSimulatedOutput(
  amount: string
): string {
  // Simulate 0.3% DEX fee and some slippage
  const amountBN = BigInt(amount);
  const output = (amountBN * BigInt(997)) / BigInt(1000);
  return output.toString();
}

/**
 * Helper: Calculate price impact
 */
function calculatePriceImpact(amount: string): number {
  try {
    const amountNum = Number(ethers.formatUnits(amount, 6));
    if (amountNum < 1000) return 0.1;
    if (amountNum < 10000) return 0.5;
    return 1.5;
  } catch {
    return 0.5;
  }
}
