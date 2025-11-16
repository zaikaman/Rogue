import { Router, Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /strategies
 * Get all available strategies (Analyzer output)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { riskTier, minApy } = req.query;

    const supabase = getSupabaseClient();

    let query = supabase
      .from('strategies')
      .select('*')
      .eq('is_active', true)
      .order('expected_apy', { ascending: false });

    // Filter by risk tier if provided
    if (riskTier && ['low', 'medium', 'high'].includes(riskTier as string)) {
      query = query.eq('risk_tier', riskTier);
    }

    // Filter by minimum APY if provided
    if (minApy && !isNaN(Number(minApy))) {
      query = query.gte('expected_apy', Number(minApy));
    }

    const { data: strategies, error } = await query;

    if (error) {
      logger.error('Failed to fetch strategies', { error });
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch strategies'
      });
    }

    res.json({
      success: true,
      data: strategies.map(strategy => ({
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
        riskTier: strategy.risk_tier,
        expectedApy: strategy.expected_apy,
        protocolAllocations: strategy.protocol_allocations,
        leverageRatio: strategy.leverage_ratio,
        minAmount: strategy.min_amount,
        maxAmount: strategy.max_amount,
        isActive: strategy.is_active,
        createdAt: strategy.created_at,
        updatedAt: strategy.updated_at
      }))
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /strategies/:id
 * Get single strategy by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const supabase = getSupabaseClient();

    const { data: strategy, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !strategy) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Strategy not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
        riskTier: strategy.risk_tier,
        expectedApy: strategy.expected_apy,
        protocolAllocations: strategy.protocol_allocations,
        leverageRatio: strategy.leverage_ratio,
        minAmount: strategy.min_amount,
        maxAmount: strategy.max_amount,
        isActive: strategy.is_active,
        metadata: strategy.metadata,
        createdAt: strategy.created_at,
        updatedAt: strategy.updated_at
      }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /strategies/recommend/:walletAddress
 * Get recommended strategy for a wallet based on their positions and preferences
 */
router.get('/recommend/:walletAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress } = req.params;
    const { amount, token, riskProfile } = req.query;

    // Validate required parameters
    if (!amount || !token || !riskProfile) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'amount, token, and riskProfile are required'
      });
    }

    if (!['USDC', 'KRWQ'].includes(token as string)) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Token must be USDC or KRWQ'
      });
    }

    if (!['low', 'medium', 'high'].includes(riskProfile as string)) {
      return res.status(400).json({
        error: 'Invalid risk profile',
        message: 'Risk profile must be low, medium, or high'
      });
    }

    const supabase = getSupabaseClient();

    // Get strategies matching risk profile
    const { data: strategies, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('risk_tier', riskProfile)
      .eq('is_active', true)
      .gte('max_amount', amount)
      .lte('min_amount', amount)
      .order('expected_apy', { ascending: false })
      .limit(3);

    if (error) {
      logger.error('Failed to fetch recommended strategies', { error, walletAddress });
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch recommendations'
      });
    }

    logger.info('Strategy recommendations generated', {
      walletAddress,
      amount,
      token,
      riskProfile,
      strategiesFound: strategies?.length || 0
    });

    res.json({
      success: true,
      data: {
        recommendations: strategies?.map(strategy => ({
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          riskTier: strategy.risk_tier,
          expectedApy: strategy.expected_apy,
          protocolAllocations: strategy.protocol_allocations,
          leverageRatio: strategy.leverage_ratio,
          estimatedYield: (Number(amount) * strategy.expected_apy / 100).toFixed(2)
        })) || [],
        requestParams: {
          walletAddress,
          amount,
          token,
          riskProfile
        }
      }
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
