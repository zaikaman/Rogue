import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';
import { unstakeTokens } from '../contracts/staking-proxy';
import { claimRewards as claimRewardsContract, withdrawFromProtocol } from '../contracts/yield-harvester';
import { ethers } from 'ethers';
import { getProvider } from '../utils/rpc';
import { calculateRewards } from '../agents/governor';

const router = Router();

// Validation schemas
const createPositionSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  token: z.literal('USDC'),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount'),
  riskProfile: z.enum(['low', 'medium', 'high']),
  signature: z.string(),
  message: z.string()
});

const updateAllocationSchema = z.object({
  riskProfile: z.enum(['low', 'medium', 'high']).optional(),
  allocation: z.record(z.string(), z.number()).optional()
});

/**
 * POST /positions
 * Create new managed position
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = createPositionSchema.parse(req.body);
    const { walletAddress, token, amount, riskProfile, signature, message } = validatedData;

    // Verify wallet signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({
        error: 'Invalid signature',
        message: 'Wallet signature verification failed'
      });
    }

    const supabase = getSupabaseClient();

    // Create position in database
    const { data: position, error } = await supabase
      .from('positions')
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        token,
        amount,
        risk_profile: riskProfile,
        status: 'active',
        allocation: {}, // Empty allocation initially
        strategy_id: null, // Will be set by Analyzer agent
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create position', { error, walletAddress });
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to create position'
      });
    }

    logger.info('Position created', {
      positionId: position.id,
      walletAddress,
      token,
      amount,
      riskProfile
    });

    res.status(201).json({
      success: true,
      data: {
        id: position.id,
        walletAddress: position.wallet_address,
        token: position.token,
        amount: position.amount,
        riskProfile: position.risk_profile,
        status: position.status,
        createdAt: position.created_at
      }
    });
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

    res.json({
      success: true,
      data: positions.map(pos => ({
        id: pos.id,
        walletAddress: pos.wallet_address,
        token: pos.token,
        amount: pos.amount,
        riskProfile: pos.risk_profile,
        status: pos.status,
        allocation: pos.allocation,
        strategy: pos.strategies ? {
          id: pos.strategies.id,
          name: pos.strategies.name,
          description: pos.strategies.description,
          riskTier: pos.strategies.risk_tier,
          expectedApy: pos.strategies.expected_apy
        } : null,
        createdAt: pos.created_at,
        updatedAt: pos.updated_at
      }))
    });
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

    res.json({
      success: true,
      data: {
        id: position.id,
        walletAddress: position.wallet_address,
        token: position.token,
        amount: position.amount,
        riskProfile: position.risk_profile,
        status: position.status,
        allocation: position.allocation,
        strategy: position.strategies ? {
          id: position.strategies.id,
          name: position.strategies.name,
          description: position.strategies.description,
          riskTier: position.strategies.risk_tier,
          expectedApy: position.strategies.expected_apy,
          protocolAllocations: position.strategies.protocol_allocations,
          leverageRatio: position.strategies.leverage_ratio
        } : null,
        createdAt: position.created_at,
        updatedAt: position.updated_at
      }
    });
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

    if (validatedData.riskProfile) {
      updateData.risk_profile = validatedData.riskProfile;
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

    res.json({
      success: true,
      data: {
        id: updated.id,
        riskProfile: updated.risk_profile,
        allocation: updated.allocation,
        updatedAt: updated.updated_at
      }
    });
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
