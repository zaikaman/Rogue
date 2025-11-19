import { Router, Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

const router = Router();

// Define Base Mainnet yield opportunities (would be fetched from protocols in production)
const YIELD_OPPORTUNITIES = [
  {
    id: 'aave-base-usdc',
    protocol: 'Aave V3',
    chain: 'base',
    token: 'USDC',
    apy: 5.8,
    tvl: 145000000,
    risk: 'low',
    minDeposit: '10',
    features: ['Auto-compound', 'Flash Loans', 'Isolated Lending', 'Low Gas']
  },
  {
    id: 'aave-base-eth',
    protocol: 'Aave V3',
    chain: 'base',
    token: 'ETH',
    apy: 3.2,
    tvl: 289000000,
    risk: 'low',
    minDeposit: '0.01',
    features: ['Native ETH Yield', 'Liquid', 'Low Gas', 'Collateral Efficiency']
  },
  {
    id: 'aave-base-cbeth',
    protocol: 'Aave V3',
    chain: 'base',
    token: 'cbETH',
    apy: 4.1,
    tvl: 78000000,
    risk: 'low',
    minDeposit: '0.01',
    features: ['Staking Yield', 'Coinbase Backed', 'Liquid', 'Auto-compound']
  },
  {
    id: 'uniswap-base-eth-usdc',
    protocol: 'Uniswap V3',
    chain: 'base',
    token: 'ETH-USDC LP',
    apy: 8.5,
    tvl: 92000000,
    risk: 'medium',
    minDeposit: '100',
    features: ['Trading Fees', 'Concentrated Liquidity', 'High Volume', 'Low Gas']
  },
  {
    id: 'aerodrome-base-usdc-dai',
    protocol: 'Aerodrome',
    chain: 'base',
    token: 'USDC-DAI LP',
    apy: 12.3,
    tvl: 45000000,
    risk: 'low',
    minDeposit: '50',
    features: ['Stable Pairs', 'Low IL', 'AERO Rewards', 've(3,3) Model']
  },
  {
    id: 'moonwell-base-usdc',
    protocol: 'Moonwell',
    chain: 'base',
    token: 'USDC',
    apy: 6.2,
    tvl: 38000000,
    risk: 'medium',
    minDeposit: '25',
    features: ['Base Native', 'Governance', 'WELL Rewards', 'Community Owned']
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
        chains: ['base'],
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

        // Estimate gas cost (simplified - Base has very low gas)
        const gasCost = 0.25; // USD - Base is much cheaper than L1

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
