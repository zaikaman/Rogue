/**
 * Aerodrome DEX Integration for Base Mainnet
 * Direct swap execution without GUI - uses router contract
 */

import { ethers } from 'ethers';
import { getProvider } from '../utils/rpc';
import { logger } from '../utils/logger';

// Aerodrome Router on Base Mainnet
const AERODROME_ROUTER = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';

// Aerodrome Router ABI (minimal for swaps)
const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, tuple(address from, address to, bool stable)[] routes, address to, uint256 deadline) external returns (uint256[] amounts)',
  'function getAmountsOut(uint256 amountIn, tuple(address from, address to, bool stable)[] routes) external view returns (uint256[] amounts)',
];

interface Route {
  from: string;
  to: string;
  stable: boolean;
}

/**
 * Get swap quote from Aerodrome
 */
export async function getAerodromeQuote(
  fromToken: string,
  toToken: string,
  amountIn: string,
  stable: boolean = false
): Promise<{ amountOut: string; priceImpact: number }> {
  try {
    const provider = getProvider();
    const router = new ethers.Contract(AERODROME_ROUTER, ROUTER_ABI, provider);

    const route: Route = {
      from: fromToken,
      to: toToken,
      stable
    };

    const amounts = await router.getAmountsOut(amountIn, [route]);
    const amountOut = amounts[1].toString();

    // Calculate price impact (simplified)
    const priceImpact = 0.3; // Aerodrome typically has very low slippage

    logger.info('Aerodrome quote', {
      fromToken,
      toToken,
      amountIn,
      amountOut,
      priceImpact
    });

    return { amountOut, priceImpact };
  } catch (error: any) {
    logger.error('Failed to get Aerodrome quote', { error: error.message });
    throw error;
  }
}

/**
 * Build Aerodrome swap transaction
 */
export async function buildAerodromeSwap(
  fromToken: string,
  toToken: string,
  amountIn: string,
  amountOutMin: string,
  recipient: string,
  stable: boolean = false
): Promise<ethers.ContractTransaction> {
  try {
    const route: Route = {
      from: fromToken,
      to: toToken,
      stable
    };

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

    logger.info('Building Aerodrome swap', {
      fromToken,
      toToken,
      amountIn,
      amountOutMin,
      recipient,
      stable
    });

    return {
      to: AERODROME_ROUTER,
      data: new ethers.Interface(ROUTER_ABI).encodeFunctionData(
        'swapExactTokensForTokens',
        [amountIn, amountOutMin, [route], recipient, deadline]
      ),
      value: '0',
    } as any;
  } catch (error: any) {
    logger.error('Failed to build Aerodrome swap', { error: error.message });
    throw error;
  }
}

/**
 * Execute swap on Aerodrome (called by executor wallet)
 */
export async function executeAerodromeSwap(
  signer: ethers.Signer,
  fromToken: string,
  toToken: string,
  amountIn: string,
  slippageBps: number = 50 // 0.5% default slippage
): Promise<string> {
  try {
    // Get quote
    const { amountOut } = await getAerodromeQuote(fromToken, toToken, amountIn);
    
    // Calculate minimum output with slippage
    const amountOutMin = (BigInt(amountOut) * BigInt(10000 - slippageBps) / BigInt(10000)).toString();

    // Build transaction
    const router = new ethers.Contract(AERODROME_ROUTER, ROUTER_ABI, signer);
    const route: Route = { from: fromToken, to: toToken, stable: false };
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const recipient = await signer.getAddress();

    logger.info('Executing Aerodrome swap', {
      fromToken,
      toToken,
      amountIn,
      amountOutMin,
      slippageBps
    });

    // Execute swap
    const tx = await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      [route],
      recipient,
      deadline
    );

    const receipt = await tx.wait();
    
    logger.info('Aerodrome swap successful', {
      txHash: receipt.hash,
      fromToken,
      toToken
    });

    return receipt.hash;
  } catch (error: any) {
    logger.error('Aerodrome swap failed', { error: error.message });
    throw error;
  }
}

export default {
  getAerodromeQuote,
  buildAerodromeSwap,
  executeAerodromeSwap,
  AERODROME_ROUTER
};
