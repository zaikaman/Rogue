import { Router, Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../services/supabase';
import { ethers } from 'ethers';
import logger from '../utils/logger';

const router = Router();

// Token addresses for each chain
const TOKEN_ADDRESSES = {
  mumbai: {
    USDC: '0x0FA8781a83E46826621b3BC094Ea2A0212e71B23',
    DAI: '0xF14f9596430931E177469715c591513308244e8F',
    MATIC: '0x0000000000000000000000000000000000001010'
  },
  sepolia: {
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    DAI: '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6',
    ETH: ethers.ZeroAddress
  },
  base_sepolia: {
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    DAI: '0x5200000000000000000000000000000000000022',
    ETH: ethers.ZeroAddress
  }
};

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)'
];

/**
 * GET /portfolio/:walletAddress
 * Get comprehensive portfolio holdings across all chains
 */
router.get('/:walletAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { walletAddress } = req.params;

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        error: 'Invalid wallet address'
      });
    }

    logger.info('Fetching portfolio for wallet', { walletAddress });

    const supabase = getSupabaseClient();

    // Fetch database holdings
    const { data: dbHoldings, error } = await supabase
      .from('portfolio_holdings')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase());

    if (error) {
      logger.error('Failed to fetch portfolio holdings', { error, walletAddress });
      return res.status(500).json({
        error: 'Database error'
      });
    }

    // Fetch active positions
    const { data: positions, error: positionsError } = await supabase
      .from('positions')
      .select(`
        *,
        strategy:strategies(*)
      `)
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('status', 'active');

    if (positionsError) {
      logger.error('Failed to fetch positions', { error: positionsError, walletAddress });
    }

    // Fetch on-chain balances
    const onChainBalances = await fetchOnChainBalances(walletAddress);

    // Merge database holdings with on-chain data
    const holdings = mergeHoldings(dbHoldings || [], onChainBalances);

    // Calculate total portfolio value
    const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.value_usd || '0'), 0);

    // Calculate 24h change (simplified - would need historical data)
    const dailyChange = calculateDailyChange(holdings);

    // Group by chain
    const chainDistribution = groupByChain(holdings);

    res.json({
      success: true,
      data: {
        walletAddress,
        totalValue,
        dailyChange,
        holdings: holdings.map(h => ({
          id: h.id,
          tokenSymbol: h.token_symbol,
          chain: h.chain,
          balance: h.balance,
          valueUsd: h.value_usd,
          protocol: h.protocol,
          apy: h.apy,
          updatedAt: h.updated_at
        })),
        positions: (positions || []).map(p => ({
          id: p.id,
          chain: p.chain,
          protocol: p.strategy?.protocol,
          amount: p.amount,
          strategyType: p.strategy?.strategy_type,
          expectedApy: p.strategy?.expected_apy,
          currentValue: p.current_value,
          createdAt: p.created_at
        })),
        chainDistribution,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /portfolio/sync
 * Sync portfolio holdings from on-chain data
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        error: 'Invalid wallet address'
      });
    }

    logger.info('Syncing portfolio for wallet', { walletAddress });

    // Fetch on-chain balances
    const balances = await fetchOnChainBalances(walletAddress);

    // Update database
    const supabase = getSupabaseClient();

    for (const balance of balances) {
      const { error } = await supabase
        .from('portfolio_holdings')
        .upsert({
          wallet_address: walletAddress.toLowerCase(),
          token_symbol: balance.token_symbol,
          chain: balance.chain,
          balance: balance.balance,
          value_usd: balance.value_usd,
          protocol: balance.protocol || 'wallet',
          apy: balance.apy || '0',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'wallet_address,token_symbol,chain'
        });

      if (error) {
        logger.error('Failed to upsert portfolio holding', { error, balance });
      }
    }

    return res.json({
      success: true,
      message: 'Portfolio synced successfully',
      balancesUpdated: balances.length
    });
  } catch (error: any) {
    logger.error('Portfolio sync failed', { error: error.message });
    return res.status(500).json({
      error: 'Sync failed',
      message: error.message
    });
  }
});

/**
 * Fetch on-chain token balances for a wallet
 */
async function fetchOnChainBalances(walletAddress: string): Promise<any[]> {
  const balances: any[] = [];

  const chains = [
    { name: 'mumbai', rpcUrl: process.env.MUMBAI_RPC_URL || 'https://rpc-mumbai.maticvigil.com' },
    { name: 'sepolia', rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org' },
    { name: 'base_sepolia', rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org' }
  ];

  for (const chain of chains) {
    try {
      const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
      const tokens = TOKEN_ADDRESSES[chain.name as keyof typeof TOKEN_ADDRESSES];

      for (const [symbol, address] of Object.entries(tokens)) {
        try {
          let balance: bigint;

          if (address === ethers.ZeroAddress || address === '0x0000000000000000000000000000000000001010') {
            // Native token balance
            balance = await provider.getBalance(walletAddress);
          } else {
            // ERC20 token balance
            const contract = new ethers.Contract(address, ERC20_ABI, provider);
            balance = await contract.balanceOf(walletAddress);
          }

          if (balance > 0n) {
            const formattedBalance = ethers.formatUnits(balance, 18);
            
            balances.push({
              token_symbol: symbol,
              chain: chain.name,
              balance: formattedBalance,
              value_usd: '0', // Would need price oracle for real USD value
              protocol: 'wallet',
              apy: '0'
            });
          }
        } catch (error) {
          logger.error('Failed to fetch token balance', { chain: chain.name, symbol, error });
        }
      }
    } catch (error) {
      logger.error('Failed to connect to chain', { chain: chain.name, error });
    }
  }

  return balances;
}

/**
 * Merge database holdings with on-chain balances
 */
function mergeHoldings(dbHoldings: any[], onChainBalances: any[]): any[] {
  const merged = new Map();

  // Add database holdings
  for (const holding of dbHoldings) {
    const key = `${holding.chain}-${holding.token_symbol}-${holding.protocol}`;
    merged.set(key, holding);
  }

  // Update with on-chain balances
  for (const balance of onChainBalances) {
    const key = `${balance.chain}-${balance.token_symbol}-${balance.protocol}`;
    if (!merged.has(key)) {
      merged.set(key, balance);
    }
  }

  return Array.from(merged.values());
}

/**
 * Calculate 24h portfolio change
 */
function calculateDailyChange(_holdings: any[]): { amount: number; percentage: number } {
  // Simplified - in production would need historical price data
  return {
    amount: 0,
    percentage: 0
  };
}

/**
 * Group holdings by chain
 */
function groupByChain(holdings: any[]): any[] {
  const chainMap = new Map();

  for (const holding of holdings) {
    const chain = holding.chain;
    if (!chainMap.has(chain)) {
      chainMap.set(chain, {
        chain,
        value: 0,
        percentage: 0,
        tokens: []
      });
    }

    const chainData = chainMap.get(chain);
    chainData.value += parseFloat(holding.value_usd || '0');
    chainData.tokens.push(holding.token_symbol);
  }

  const totalValue = Array.from(chainMap.values()).reduce((sum, c) => sum + c.value, 0);

  return Array.from(chainMap.values()).map(c => ({
    ...c,
    percentage: totalValue > 0 ? (c.value / totalValue) * 100 : 0
  }));
}

export default router;
