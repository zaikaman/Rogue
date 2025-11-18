import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getBridgeQuote, checkBridgeStatus } from '../services/layerzero-bridge';
import { executeBridge } from '../services/transaction-executor';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

const router = Router();

const bridgeQuoteSchema = z.object({
  sourceChain: z.enum(['mumbai', 'sepolia', 'base_sepolia']),
  destChain: z.enum(['mumbai', 'sepolia', 'base_sepolia']),
  token: z.string(),
  amount: z.string()
});

const executeBridgeSchema = z.object({
  sourceChain: z.enum(['mumbai', 'sepolia', 'base_sepolia']),
  destChain: z.enum(['mumbai', 'sepolia', 'base_sepolia']),
  token: z.string(),
  amount: z.string(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  positionId: z.string().optional()
});

/**
 * GET /bridge/quote
 * Get bridge quote for cross-chain transfer
 */
router.get('/quote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceChain, destChain, token, amount } = bridgeQuoteSchema.parse(req.query);

    if (sourceChain === destChain) {
      return res.status(400).json({
        error: 'Invalid chains',
        message: 'Source and destination chains must be different'
      });
    }

    logger.info('Getting bridge quote', { sourceChain, destChain, token, amount });

    const quote = await getBridgeQuote(
      sourceChain as 'mumbai' | 'sepolia' | 'base_sepolia',
      destChain as 'mumbai' | 'sepolia' | 'base_sepolia',
      token,
      amount
    );

    res.json({
      success: true,
      data: {
        ...quote,
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
 * POST /bridge/execute
 * Execute cross-chain bridge transfer
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const validatedData = executeBridgeSchema.parse(req.body);
    const { sourceChain, destChain, token, amount, walletAddress, positionId } = validatedData;

    if (sourceChain === destChain) {
      return res.status(400).json({
        error: 'Invalid chains',
        message: 'Source and destination chains must be different'
      });
    }

    logger.info('Executing bridge', { sourceChain, destChain, token, amount, walletAddress });

    // Execute the bridge
    const result = await executeBridge({
      positionId: positionId || '',
      sourceChain: sourceChain as 'mumbai' | 'sepolia' | 'base_sepolia',
      destChain: destChain as 'mumbai' | 'sepolia' | 'base_sepolia',
      token,
      amount,
      recipient: walletAddress
    });

    logger.info('Bridge executed successfully', {
      txHash: result.txHash,
      gasUsed: result.gasUsed
    });

    return res.json({
      success: true,
      data: {
        txHash: result.txHash,
        gasUsed: result.gasUsed,
        sourceChain,
        destChain,
        token,
        amount,
        estimatedDeliveryTime: '5-10 minutes',
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

    logger.error('Bridge execution failed', { error: error.message });
    
    return res.status(500).json({
      error: 'Bridge failed',
      message: error.message
    });
  }
});

/**
 * GET /bridge/status/:txHash
 * Check bridge transaction status
 */
router.get('/status/:txHash', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { txHash } = req.params;
    const { sourceChain } = req.query;

    if (!sourceChain || !['mumbai', 'sepolia', 'base_sepolia'].includes(sourceChain as string)) {
      return res.status(400).json({
        error: 'Invalid or missing sourceChain parameter'
      });
    }

    const status = await checkBridgeStatus(
      txHash,
      sourceChain as 'mumbai' | 'sepolia' | 'base_sepolia'
    );

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /bridge/history/:walletAddress
 * Get bridge transaction history
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

    const { data: bridges, error } = await supabase
      .from('bridge_transactions')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('Failed to fetch bridge history', { error, walletAddress });
      return res.status(500).json({
        error: 'Database error'
      });
    }

    res.json({
      success: true,
      data: bridges.map(bridge => ({
        id: bridge.id,
        sourceTxHash: bridge.source_tx_hash,
        destTxHash: bridge.dest_tx_hash,
        sourceChain: bridge.source_chain,
        destChain: bridge.dest_chain,
        token: bridge.token,
        amount: bridge.amount,
        status: bridge.status,
        fee: bridge.fee,
        createdAt: bridge.created_at,
        deliveredAt: bridge.delivered_at
      }))
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
