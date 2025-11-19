import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';
import { unstakeTokens } from '../contracts/staking-proxy';
import { claimRewards as claimRewardsContract, withdrawFromProtocol } from '../contracts/yield-harvester';
import { ethers } from 'ethers';
import { getProvider } from '../utils/rpc';
import { calculateRewards } from '../agents/governor';
import { runYieldOptimizationWorkflow } from '../workflows/yield-optimization-enhanced';

const router = Router();

// Validation schemas
const createPositionSchema = z.object({
  wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  token: z.literal('USDC'),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount'),
  risk_profile: z.enum(['low', 'medium', 'high']),
  chain: z.literal('base').optional().default('base'),
  tx_hash: z.string().optional() // Optional: if frontend already executed the stake
});

const updateAllocationSchema = z.object({
  risk_profile: z.enum(['low', 'medium', 'high']).optional(),
  allocation: z.record(z.string(), z.number()).optional()
});

/**
 * POST /positions
 * Create new managed position
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = createPositionSchema.parse(req.body);
    const { wallet_address, token, amount, risk_profile, chain, tx_hash } = validatedData;

    const supabase = getSupabaseClient();

    // Create position in database with pending status
    const { data: position, error } = await supabase
      .from('positions')
      .insert({
        wallet_address: wallet_address.toLowerCase(),
        token,
        amount,
        risk_profile,
        status: 'active', // Frontend confirms before sending
        chain: 'base',
        allocation: {},
        strategy_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create position', { error, wallet_address });
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to create position'
      });
    }

    // Record the stake transaction if tx_hash provided
    if (tx_hash) {
      await supabase
        .from('transaction_records')
        .insert({
          wallet_address: wallet_address.toLowerCase(),
          position_id: position.id,
          tx_hash,
          type: 'stake',
          status: 'confirmed',
          chain: 'base',
          amount,
          notes: `Staked ${amount} ${token}`,
          created_at: new Date().toISOString(),
          confirmed_at: new Date().toISOString()
        });
    }

    logger.info('Position created', {
      positionId: position.id,
      wallet_address,
      token,
      amount,
      risk_profile
    });

    // Trigger yield optimization workflow asynchronously (don't block response)
    setImmediate(async () => {
      try {
        logger.info('🚀 Auto-triggering yield optimization workflow', {
          positionId: position.id,
          wallet_address,
          amount,
          risk_profile
        });

        const workflowResult = await runYieldOptimizationWorkflow({
          walletAddress: wallet_address,
          token: token as 'USDC',
          amount: parseFloat(amount),
          riskProfile: risk_profile,
          positionId: position.id,
          action: 'deposit' // Initial deposit action
        });

        if (workflowResult.success) {
          logger.info('✅ Workflow completed successfully', {
            positionId: position.id,
            steps: Object.keys(workflowResult.steps)
          });
        } else {
          logger.warn('⚠️ Workflow completed with errors', {
            positionId: position.id,
            error: workflowResult.error
          });
        }
      } catch (error: any) {
        logger.error('❌ Failed to execute workflow', {
          positionId: position.id,
          error: error.message,
          stack: error.stack
        });
      }
    });

    res.status(201).json(position);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.issues[0].message,
        details: error.issues
      });
    }
    return next(error);
  }
});

/**
 * GET /positions/:walletAddress
 * Get all positions for a wallet address
 */
router.get('/:walletAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress } = req.params;

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        error: 'Invalid address',
        message: 'Invalid Ethereum address format'
      });
    }

    const supabase = getSupabaseClient();

    const { data: positions, error } = await supabase
      .from('positions')
      .select(`
        *,
        strategies (
          id,
          name,
          description,
          risk_tier,
          expected_apy
        )
      `)
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch positions', { error, walletAddress });
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch positions'
      });
    }

    res.json(positions || []);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /positions/detail/:id
 * Get single position by ID
 */
router.get('/detail/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const supabase = getSupabaseClient();

    const { data: position, error } = await supabase
      .from('positions')
      .select(`
        *,
        strategies (
          id,
          name,
          description,
          risk_tier,
          expected_apy,
          protocol_allocations,
          leverage_ratio
        )
      `)
      .eq('id', id)
      .single();

    if (error || !position) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Position not found'
      });
    }

    res.json(position);
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /positions/:id/allocations
 * Update position allocations or risk profile
 */
router.patch('/:id/allocations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validatedData = updateAllocationSchema.parse(req.body);

    const supabase = getSupabaseClient();

    // Check if position exists
    const { data: existing, error: fetchError } = await supabase
      .from('positions')
      .select('id, wallet_address')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Position not found'
      });
    }

    // Update position
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (validatedData.risk_profile) {
      updateData.risk_profile = validatedData.risk_profile;
    }

    if (validatedData.allocation) {
      updateData.allocation = validatedData.allocation;
    }

    const { data: updated, error: updateError } = await supabase
      .from('positions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Failed to update position', { error: updateError, id });
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to update position'
      });
    }

    logger.info('Position updated', {
      positionId: id,
      updates: validatedData
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.issues[0].message,
        details: error.issues
      });
    }
    return next(error);
  }
});

/**
 * POST /positions/:id/unstake
 * Trigger unstake for a position
 */
router.post('/:id/unstake', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const supabase = getSupabaseClient();

    // Check if position exists and is active
    const { data: position, error: fetchError } = await supabase
      .from('positions')
      .select('id, wallet_address, status, amount, allocation')
      .eq('id', id)
      .single();

    if (fetchError || !position) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Position not found'
      });
    }

    if (position.status !== 'active') {
      return res.status(400).json({
        error: 'Invalid state',
        message: 'Position is not active'
      });
    }

    // Update position status to unstaking
    await supabase
      .from('positions')
      .update({
        status: 'unstaking',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    // Log pending transaction
    const { data: txData } = await supabase
      .from('transaction_records')
      .insert({
        wallet_address: position.wallet_address,
        position_id: id,
        tx_hash: `pending-unstake-${Date.now()}`,
        type: 'unstake',
        status: 'pending',
        notes: 'Withdrawing from protocols and unstaking position',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    try {
      // Get wallet signer (in production, use secure key management)
      const provider = getProvider();
      const wallet = new ethers.Wallet(process.env.EXECUTOR_PRIVATE_KEY || '', provider);

      // Withdraw from each protocol
      const allocation = position.allocation || {};
      for (const [protocol, percentage] of Object.entries(allocation)) {
        if (parseFloat(percentage as string) > 0) {
          const protocolAmount = (parseFloat(position.amount) * parseFloat(percentage as string)) / 100;
          await withdrawFromProtocol(wallet, id, protocol, protocolAmount.toString());
        }
      }

      // Unstake from StakingProxy
      const { amount, txHash } = await unstakeTokens(wallet, id);

      // Update transaction with success
      await supabase
        .from('transaction_records')
        .update({
          tx_hash: txHash,
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          notes: `Unstaked ${amount} tokens successfully`
        })
        .eq('id', txData?.id);

      // Update position status to closed
      await supabase
        .from('positions')
        .update({
          status: 'closed',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      logger.info('Unstake successful', {
        positionId: id,
        txHash,
        amount
      });

      res.json({
        success: true,
        message: `Position unstaked successfully. ${amount} tokens returned to wallet.`,
        data: {
          id,
          status: 'closed',
          txHash,
          amount
        }
      });
    } catch (error: any) {
      // Update transaction with failure
      await supabase
        .from('transaction_records')
        .update({
          status: 'failed',
          notes: `Unstake failed: ${error.message}`
        })
        .eq('id', txData?.id);

      // Revert position status
      await supabase
        .from('positions')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      logger.error('Unstake failed', { error: error.message, positionId: id });
      
      return res.status(500).json({
        error: 'Unstake failed',
        message: error.message
      });
    }
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /positions/:id/claim
 * Claim rewards for a position
 */
router.post('/:id/claim', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const supabase = getSupabaseClient();

    // Check if position exists
    const { data: position, error: fetchError } = await supabase
      .from('positions')
      .select('id, wallet_address, status, amount, created_at, risk_profile')
      .eq('id', id)
      .single();

    if (fetchError || !position) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Position not found'
      });
    }

    if (position.status !== 'active') {
      return res.status(400).json({
        error: 'Invalid state',
        message: 'Position must be active to claim rewards'
      });
    }

    // Calculate ATP rewards using Governor agent
    const daysActive = Math.floor(
      (Date.now() - new Date(position.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Get compound count from transaction history
    const { data: compoundTxs } = await supabase
      .from('transaction_records')
      .select('id')
      .eq('position_id', id)
      .eq('type', 'compound')
      .eq('status', 'confirmed');
    
    const compoundCount = compoundTxs?.length || 0;
    
    // Calculate rewards with Governor agent
    const rewardsCalc = calculateRewards(
      parseFloat(position.amount),
      position.risk_profile,
      compoundCount
    );
    
    // Daily rewards * days active for total claimable
    const rewardAmount = parseFloat(rewardsCalc.dailyReward) * daysActive + parseFloat(rewardsCalc.compoundBonus);

    if (rewardAmount < 1.0) {
      return res.status(400).json({
        error: 'Minimum claim not met',
        message: 'Minimum 1 ATP required to claim',
        claimable: rewardAmount.toFixed(4)
      });
    }

    // Log pending transaction
    const { data: txData } = await supabase
      .from('transaction_records')
      .insert({
        wallet_address: position.wallet_address,
        position_id: id,
        tx_hash: `pending-claim-${Date.now()}`,
        type: 'claim',
        status: 'pending',
        notes: `Claiming ${rewardAmount.toFixed(4)} ATP rewards`,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    try {
      // Get wallet signer
      const provider = getProvider();
      const wallet = new ethers.Wallet(process.env.EXECUTOR_PRIVATE_KEY || '', provider);

      // Claim rewards via smart contract
      const txHash = await claimRewardsContract(
        wallet,
        id,
        position.wallet_address,
        rewardAmount.toString()
      );

      // Update transaction with success
      await supabase
        .from('transaction_records')
        .update({
          tx_hash: txHash,
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          notes: `Claimed ${rewardAmount.toFixed(4)} ATP successfully`
        })
        .eq('id', txData?.id);

      logger.info('Claim successful', {
        positionId: id,
        txHash,
        rewardAmount
      });

      res.json({
        success: true,
        message: `Rewards claimed successfully. ${rewardAmount.toFixed(4)} ATP sent to wallet.`,
        data: {
          id,
          txHash,
          rewardAmount: rewardAmount.toFixed(4)
        }
      });
    } catch (error: any) {
      // Update transaction with failure
      await supabase
        .from('transaction_records')
        .update({
          status: 'failed',
          notes: `Claim failed: ${error.message}`
        })
        .eq('id', txData?.id);

      logger.error('Claim failed', { error: error.message, positionId: id });
      
      return res.status(500).json({
        error: 'Claim failed',
        message: error.message
      });
    }
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /positions/:id/allocations
 * Update position allocation strategy
 */
router.patch('/:id/allocations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { allocations } = req.body;

    // Validate allocations
    const total = Object.values(allocations).reduce((sum: number, val: any) => sum + parseFloat(val), 0);
    if (Math.abs(total - 100) > 0.01) {
      return res.status(400).json({
        error: 'Allocations must sum to 100%',
        total
      });
    }

    // Get current position
    const supabaseClient = getSupabaseClient();
    const { data: position, error: posError } = await supabaseClient
      .from('positions')
      .select('*')
      .eq('id', id)
      .single();

    if (posError || !position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    // Trigger re-analysis with new allocations
    logger.info('Rebalancing position', { positionId: id, allocations });

    // TODO: Trigger workflow with new allocations
    // For now, just log the transaction
    await supabaseClient.from('transaction_records').insert({
      wallet_address: position.wallet_address,
      position_id: id,
      tx_hash: `rebalance-${Date.now()}`,
      type: 'rebalance',
      status: 'pending',
      notes: `Allocation update: ${JSON.stringify(allocations)}`,
      created_at: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Rebalancing scheduled',
      allocations
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
