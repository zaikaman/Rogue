import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getSwapQuote, isSwapProfitable } from '../services/1inch-api';
import { executeSwap } from '../services/transaction-executor';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

const router = Router();

const swapQuoteSchema = z.object({
  chain: z.enum(['mumbai', 'sepolia', 'base_sepolia']),
  fromToken: z.string(),
  toToken: z.string(),
  amount: z.string()
});

const executeSwapSchema = z.object({
  chain: z.enum(['mumbai', 'sepolia', 'base_sepolia']),
  fromToken: z.string(),
  toToken: z.string(),
  amount: z.string(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  positionId: z.string().optional()
});

/**
 * GET /swap/quote
 * Get swap quote from 1inch aggregator
 */
router.get('/quote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chain, fromToken, toToken, amount } = swapQuoteSchema.parse(req.query);

    logger.info('Getting swap quote', { chain, fromToken, toToken, amount });

    const quote = await getSwapQuote(
      chain as 'mumbai' | 'sepolia' | 'base_sepolia',
      fromToken,
      toToken,
      amount
    );

    // Check if swap is profitable
    const gasPrice = BigInt(30000000000); // 30 gwei
    const profitable = isSwapProfitable(quote, gasPrice);

    res.json({
      success: true,
      data: {
        ...quote,
        profitable,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.issues
      });
    }
    return next(error);
  }
});

/**
 * POST /swap/execute
 * Execute token swap
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const validatedData = executeSwapSchema.parse(req.body);
    const { chain, fromToken, toToken, amount, walletAddress, positionId } = validatedData;

    logger.info('Executing swap', { chain, fromToken, toToken, amount, walletAddress });

    // Get quote first to validate
    const quote = await getSwapQuote(
      chain as 'mumbai' | 'sepolia' | 'base_sepolia',
      fromToken,
      toToken,
      amount
    );

    // Check profitability
    const gasPrice = BigInt(30000000000);
    if (!isSwapProfitable(quote, gasPrice)) {
      return res.status(400).json({
        error: 'Unprofitable swap',
        message: 'Swap would result in loss after gas costs'
      });
    }

    // Execute the swap
    const result = await executeSwap({
      positionId: positionId || '',
      chain: chain as 'mumbai' | 'sepolia' | 'base_sepolia',
      fromToken,
      toToken,
      amount,
      recipient: walletAddress
    });

    logger.info('Swap executed successfully', {
      txHash: result.txHash,
      gasUsed: result.gasUsed
    });

    return res.json({
      success: true,
      data: {
        txHash: result.txHash,
        gasUsed: result.gasUsed,
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: quote.toAmount,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.issues
      });
    }

    logger.error('Swap execution failed', { error: error.message });
    
    return res.status(500).json({
      error: 'Swap failed',
      message: error.message
    });
  }
});

/**
 * GET /swap/history/:walletAddress
 * Get swap transaction history for a wallet
 */
router.get('/history/:walletAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress } = req.params;

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        error: 'Invalid wallet address'
      });
    }

    const supabase = getSupabaseClient();

    const { data: swaps, error } = await supabase
      .from('transaction_records')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('type', 'swap')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('Failed to fetch swap history', { error, walletAddress });
      return res.status(500).json({
        error: 'Database error'
      });
    }

    res.json({
      success: true,
      data: swaps.map(swap => ({
        id: swap.id,
        txHash: swap.tx_hash,
        fromToken: swap.from_token,
        toToken: swap.to_token,
        amount: swap.amount,
        status: swap.status,
        gasCost: swap.gas_cost,
        chain: swap.chain,
        timestamp: swap.created_at
      }))
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
