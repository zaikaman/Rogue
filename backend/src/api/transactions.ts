import { Router, Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /transactions/:walletAddress
 * Get transaction history for a wallet address
 */
router.get('/:walletAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress } = req.params;
    const { limit = '50', offset = '0', type, status } = req.query;

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        error: 'Invalid address',
        message: 'Invalid Ethereum address format'
      });
    }

    const supabase = getSupabaseClient();

    let query = supabase
      .from('transaction_records')
      .select('*', { count: 'exact' })
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    // Filter by transaction type if provided
    if (type && ['stake', 'unstake', 'compound', 'claim', 'rebalance'].includes(type as string)) {
      query = query.eq('type', type);
    }

    // Filter by status if provided
    if (status && ['pending', 'confirmed', 'failed'].includes(status as string)) {
      query = query.eq('status', status);
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch transactions', { error, walletAddress });
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch transaction history'
      });
    }

    res.json({
      success: true,
      data: {
        transactions: transactions?.map(tx => ({
          id: tx.id,
          positionId: tx.position_id,
          walletAddress: tx.wallet_address,
          txHash: tx.tx_hash,
          type: tx.type,
          status: tx.status,
          gasCost: tx.gas_cost,
          notes: tx.notes,
          createdAt: tx.created_at,
          confirmedAt: tx.confirmed_at
        })) || [],
        pagination: {
          total: count || 0,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: count ? (Number(offset) + Number(limit)) < count : false
        }
      }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /transactions/position/:positionId
 * Get transaction history for a specific position
 */
router.get('/position/:positionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { positionId } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const supabase = getSupabaseClient();

    const { data: transactions, error, count } = await supabase
      .from('transaction_records')
      .select('*', { count: 'exact' })
      .eq('position_id', positionId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      logger.error('Failed to fetch position transactions', { error, positionId });
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch transaction history'
      });
    }

    res.json({
      success: true,
      data: {
        transactions: transactions?.map(tx => ({
          id: tx.id,
          positionId: tx.position_id,
          txHash: tx.tx_hash,
          type: tx.tx_type,
          status: tx.status,
          amount: tx.amount,
          token: tx.token,
          gasCost: tx.gas_cost,
          notes: tx.notes,
          metadata: tx.metadata,
          createdAt: tx.created_at,
          confirmedAt: tx.confirmed_at
        })) || [],
        pagination: {
          total: count || 0,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: count ? (Number(offset) + Number(limit)) < count : false
        }
      }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /transactions
 * Record a new transaction (used by Executor agent)
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      positionId,
      txHash,
      type,
      gasCost,
      notes
    } = req.body;

    // Basic validation
    if (!positionId || !txHash || !type) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'positionId, txHash, and type are required'
      });
    }

    const supabase = getSupabaseClient();

    // Verify position exists
    const { data: position, error: posError } = await supabase
      .from('positions')
      .select('id, wallet_address')
      .eq('id', positionId)
      .single();

    if (posError || !position) {
      return res.status(404).json({
        error: 'Position not found',
        message: 'Invalid position ID'
      });
    }

    // Insert transaction record
    const { data: transaction, error } = await supabase
      .from('transaction_records')
      .insert({
        position_id: positionId,
        wallet_address: position.wallet_address,
        tx_hash: txHash,
        type: type,
        status: 'pending',
        gas_cost: gasCost || null,
        notes: notes || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create transaction record', { error, positionId, txHash });
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to create transaction record'
      });
    }

    logger.info('Transaction recorded', {
      transactionId: transaction.id,
      positionId,
      txHash,
      type
    });

    res.status(201).json({
      success: true,
      data: {
        id: transaction.id,
        positionId: transaction.position_id,
        walletAddress: transaction.wallet_address,
        txHash: transaction.tx_hash,
        type: transaction.type,
        status: transaction.status,
        createdAt: transaction.created_at
      }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /transactions/:txHash/status
 * Update transaction status (used by Executor agent when tx confirms/fails)
 */
router.patch('/:txHash/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { txHash } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'confirmed', 'failed'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Status must be pending, confirmed, or failed'
      });
    }

    const supabase = getSupabaseClient();

    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'confirmed' || status === 'failed') {
      updateData.confirmed_at = new Date().toISOString();
    }

    const { data: transaction, error } = await supabase
      .from('transaction_records')
      .update(updateData)
      .eq('tx_hash', txHash)
      .select()
      .single();

    if (error || !transaction) {
      logger.error('Failed to update transaction status', { error, txHash });
      return res.status(404).json({
        error: 'Not found',
        message: 'Transaction not found'
      });
    }

    logger.info('Transaction status updated', {
      transactionId: transaction.id,
      txHash,
      status
    });

    res.json({
      success: true,
      data: {
        id: transaction.id,
        txHash: transaction.tx_hash,
        status: transaction.status,
        confirmedAt: transaction.confirmed_at
      }
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
