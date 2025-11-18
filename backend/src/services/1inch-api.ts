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
    logger.info('Getting swap quote from 1inch', {
      chain,
      fromToken,
      toToken,
      amount
    });

    const apiKey = process.env.ONEINCH_API_KEY;
    
    // For testnets without 1inch support, simulate response
    if (!apiKey || chain === 'mumbai' || chain === 'base_sepolia') {
      logger.warn('Using simulated quote for testnet', { chain });
      
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
    }

    // Map chain to 1inch chainId (Sepolia = 11155111)
    const chainId = chain === 'sepolia' ? 11155111 : 1;
    
    const url = new URL(`https://api.1inch.dev/swap/v6.0/${chainId}/quote`);
    url.searchParams.append('src', fromToken);
    url.searchParams.append('dst', toToken);
    url.searchParams.append('amount', amount);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`1inch API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    const quote: SwapQuote = {
      fromToken: data.srcToken?.address || fromToken,
      toToken: data.dstToken?.address || toToken,
      fromAmount: data.srcAmount || amount,
      toAmount: data.dstAmount || '0',
      estimatedGas: data.estimatedGas || ethers.parseUnits('150000', 'wei').toString(),
      protocols: data.protocols?.map((p: any) => p.name) || [],
      priceImpact: parseFloat(data.priceImpact || '0')
    };

    return quote;
  } catch (error: any) {
    logger.error('Failed to get swap quote', {
      error: error.message,
      chain,
      fromToken,
      toToken
    });
    
    // Fallback to simulated quote on error
    logger.warn('Falling back to simulated quote');
    return {
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: calculateSimulatedOutput(amount),
      estimatedGas: ethers.parseUnits('150000', 'wei').toString(),
      protocols: ['Uniswap_V3'],
      priceImpact: calculatePriceImpact(amount)
    };
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

    const apiKey = process.env.ONEINCH_API_KEY;
    
    // For testnets without 1inch support, simulate transaction
    if (!apiKey || chain === 'mumbai' || chain === 'base_sepolia') {
      logger.warn('Using simulated transaction for testnet', { chain });
      
      const simulatedTx: SwapTransaction = {
        from: fromAddress,
        to: '0x1111111254EEB25477B68fb85Ed929f73A960582', // 1inch router
        data: '0x' + Buffer.from('simulated_swap_data').toString('hex'),
        value: fromToken === ethers.ZeroAddress ? amount : '0',
        gas: '200000',
        gasPrice: ethers.parseUnits('30', 'gwei').toString()
      };
      
      return simulatedTx;
    }

    // Map chain to 1inch chainId
    const chainId = chain === 'sepolia' ? 11155111 : 1;
    
    const url = new URL(`https://api.1inch.dev/swap/v6.0/${chainId}/swap`);
    url.searchParams.append('src', fromToken);
    url.searchParams.append('dst', toToken);
    url.searchParams.append('amount', amount);
    url.searchParams.append('from', fromAddress);
    url.searchParams.append('slippage', '1'); // 1% slippage

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`1inch API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    const tx: SwapTransaction = {
      from: fromAddress,
      to: data.tx?.to || '0x1111111254EEB25477B68fb85Ed929f73A960582',
      data: data.tx?.data || '0x',
      value: data.tx?.value || '0',
      gas: data.tx?.gas || '200000',
      gasPrice: data.tx?.gasPrice || ethers.parseUnits('30', 'gwei').toString()
    };

    return tx;
  } catch (error: any) {
    logger.error('Failed to build swap transaction', {
      error: error.message
    });
    
    // Fallback to simulated transaction on error
    logger.warn('Falling back to simulated transaction');
    return {
      from: fromAddress,
      to: '0x1111111254EEB25477B68fb85Ed929f73A960582',
      data: '0x' + Buffer.from('simulated_swap_data').toString('hex'),
      value: fromToken === ethers.ZeroAddress ? amount : '0',
      gas: '200000',
      gasPrice: ethers.parseUnits('30', 'gwei').toString()
    };
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
