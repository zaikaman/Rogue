import { Router, Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

const router = Router();

// Define multichain yield opportunities (would be fetched from protocols in production)
const YIELD_OPPORTUNITIES = [
  {
    id: 'aave-mumbai-usdc',
    protocol: 'Aave V3',
    chain: 'mumbai',
    token: 'USDC',
    apy: 4.25,
    tvl: 1250000,
    risk: 'low',
    minDeposit: '100',
    features: ['Auto-compound', 'Flash Loans', 'Isolated Lending']
  },
  {
    id: 'compound-sepolia-eth',
    protocol: 'Compound V3',
    chain: 'sepolia',
    token: 'ETH',
    apy: 3.8,
    tvl: 2100000,
    risk: 'low',
    minDeposit: '0.1',
    features: ['Governance Rights', 'Collateral Efficiency']
  },
  {
    id: 'lido-sepolia-eth',
    protocol: 'Lido',
    chain: 'sepolia',
    token: 'ETH',
    apy: 5.2,
    tvl: 8500000,
    risk: 'low',
    minDeposit: '0.01',
    features: ['Liquid Staking', 'Daily Rewards', 'No Lock Period']
  },
  {
    id: 'aave-base-usdc',
    protocol: 'Aave V3',
    chain: 'base_sepolia',
    token: 'USDC',
    apy: 6.5,
    tvl: 450000,
    risk: 'medium',
    minDeposit: '50',
    features: ['High APY', 'L2 Speed', 'Low Gas']
  },
  {
    id: 'uniswap-mumbai-matic-usdc',
    protocol: 'Uniswap V3',
    chain: 'mumbai',
    token: 'MATIC-USDC LP',
    apy: 12.3,
    tvl: 680000,
    risk: 'medium',
    minDeposit: '200',
    features: ['Trading Fees', 'Concentrated Liquidity', 'IL Protection']
  },
  {
    id: 'curve-base-dai-usdc',
    protocol: 'Curve',
    chain: 'base_sepolia',
    token: 'DAI-USDC LP',
    apy: 8.7,
    tvl: 920000,
    risk: 'low',
    minDeposit: '500',
    features: ['Stable Pairs', 'Low IL', 'CRV Rewards']
  }
];

/**
 * GET /multichain/opportunities
 * Get all available yield opportunities across chains
 */
router.get('/opportunities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chain, minApy, maxRisk, sortBy } = req.query;

    logger.info('Fetching multichain opportunities', { chain, minApy, maxRisk, sortBy });

    let opportunities = [...YIELD_OPPORTUNITIES];

    // Apply filters
    if (chain) {
      opportunities = opportunities.filter(o => o.chain === chain);
    }

    if (minApy) {
      const minApyNum = parseFloat(minApy as string);
      opportunities = opportunities.filter(o => o.apy >= minApyNum);
    }

    if (maxRisk) {
      const riskLevel = maxRisk as string;
      const riskOrder = ['low', 'medium', 'high'];
      const maxRiskIndex = riskOrder.indexOf(riskLevel);
      opportunities = opportunities.filter(o => riskOrder.indexOf(o.risk) <= maxRiskIndex);
    }

    // Sort opportunities
    if (sortBy === 'apy') {
      opportunities.sort((a, b) => b.apy - a.apy);
    } else if (sortBy === 'tvl') {
      opportunities.sort((a, b) => b.tvl - a.tvl);
    } else if (sortBy === 'risk') {
      const riskOrder = ['low', 'medium', 'high'];
      opportunities.sort((a, b) => riskOrder.indexOf(a.risk) - riskOrder.indexOf(b.risk));
    }

    // Fetch user positions to show which are active
    const supabase = getSupabaseClient();
    const { walletAddress } = req.query;

    let userPositions: any[] = [];
    if (walletAddress) {
      const { data } = await supabase
        .from('positions')
        .select('*, strategy:strategies(*)')
        .eq('wallet_address', (walletAddress as string).toLowerCase())
        .eq('status', 'active');

      userPositions = data || [];
    }

    // Enhance opportunities with user position data
    const enhancedOpportunities = opportunities.map(opp => {
      const userPosition = userPositions.find(p =>
        p.strategy?.protocol?.toLowerCase().includes(opp.protocol.toLowerCase()) &&
        p.chain === opp.chain
      );

      return {
        ...opp,
        userPosition: userPosition ? {
          amount: userPosition.amount,
          currentValue: userPosition.current_value,
          createdAt: userPosition.created_at
        } : null
      };
    });

    res.json({
      success: true,
      data: {
        opportunities: enhancedOpportunities,
        totalCount: enhancedOpportunities.length,
        chains: ['mumbai', 'sepolia', 'base_sepolia'],
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /multichain/optimal-chain
 * Determine optimal chain for a deposit based on APY, gas, and bridge costs
 */
router.get('/optimal-chain', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentChain, token, amount } = req.query;

    if (!currentChain || !token || !amount) {
      return res.status(400).json({
        error: 'Missing required parameters: currentChain, token, amount'
      });
    }

    logger.info('Finding optimal chain', { currentChain, token, amount });

    // Get relevant opportunities for this token
    const relevantOpportunities = YIELD_OPPORTUNITIES.filter(o =>
      o.token === token || o.token.includes(token as string)
    );

    if (relevantOpportunities.length === 0) {
      return res.status(404).json({
        error: 'No opportunities found for this token'
      });
    }

    // Calculate net APY for each chain (APY - bridge cost - gas cost)
    const chainAnalysis = await Promise.all(
      relevantOpportunities.map(async (opp) => {
        let bridgeCost = 0;
        let bridgeTime = 0;

        // If not on same chain, calculate bridge cost
        if (opp.chain !== currentChain) {
          try {
            // Calculate bridge cost estimate
            const bridgeFeePercent = 0.5; // 0.5% estimated bridge cost
            const amountNum = parseFloat(amount as string);
            
            bridgeCost = (amountNum * bridgeFeePercent) / 100;
            bridgeTime = 300; // 5 minutes estimated
          } catch (error) {
            logger.error('Failed to calculate bridge cost', { error });
          }
        }

        // Estimate gas cost (simplified)
        const gasCost = opp.chain === 'base_sepolia' ? 0.5 : 2; // USD

        // Calculate net APY over 1 year
        const grossYield = (parseFloat(amount as string) * opp.apy) / 100;
        const totalCosts = bridgeCost + gasCost;
        const netYield = grossYield - totalCosts;
        const netApy = (netYield / parseFloat(amount as string)) * 100;

        return {
          chain: opp.chain,
          protocol: opp.protocol,
          grossApy: opp.apy,
          netApy,
          bridgeCost,
          bridgeTime,
          gasCost,
          tvl: opp.tvl,
          risk: opp.risk,
          totalCosts
        };
      })
    );

    // Sort by net APY
    chainAnalysis.sort((a, b) => b.netApy - a.netApy);

    const optimal = chainAnalysis[0];

    res.json({
      success: true,
      data: {
        optimalChain: optimal.chain,
        recommendation: optimal,
        allChains: chainAnalysis,
        needsBridge: optimal.chain !== currentChain,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /multichain/stats
 * Get aggregated statistics across all chains
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();

    // Fetch total value locked per chain
    const { data: positions } = await supabase
      .from('positions')
      .select('chain, amount, current_value')
      .eq('status', 'active');

    const chainStats = new Map();
    
    for (const position of positions || []) {
      if (!chainStats.has(position.chain)) {
        chainStats.set(position.chain, {
          chain: position.chain,
          totalValueLocked: 0,
          activePositions: 0
        });
      }

      const stats = chainStats.get(position.chain);
      stats.totalValueLocked += parseFloat(position.current_value || position.amount);
      stats.activePositions += 1;
    }

    // Calculate average APY per chain
    const chainApyMap = new Map();
    for (const opp of YIELD_OPPORTUNITIES) {
      if (!chainApyMap.has(opp.chain)) {
        chainApyMap.set(opp.chain, []);
      }
      chainApyMap.get(opp.chain).push(opp.apy);
    }

    const result = Array.from(chainStats.values()).map(stat => ({
      ...stat,
      averageApy: chainApyMap.has(stat.chain)
        ? chainApyMap.get(stat.chain).reduce((a: number, b: number) => a + b, 0) / chainApyMap.get(stat.chain).length
        : 0
    }));

    res.json({
      success: true,
      data: {
        chains: result,
        totalProtocols: new Set(YIELD_OPPORTUNITIES.map(o => o.protocol)).size,
        totalOpportunities: YIELD_OPPORTUNITIES.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Failed to fetch multichain stats', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch stats',
      message: error.message
    });
  }
});

export default router;
