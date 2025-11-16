import { getAaveMarkets } from '../services/aave-subgraph';
import { getFraxPools } from '../services/frax-api';
import { getMultipleAssetPrices } from '../services/chainlink-oracle';
import logger from '../utils/logger';

/**
 * Researcher Agent
 * 
 * Scans Frax pools and Aave markets via APIs/subgraphs
 * Outputs: market_data with current yields and liquidity
 * 
 * NOTE: ADK Agent integration pending - currently using direct function calls
 */

/**
 * Run the Researcher agent manually
 */
export async function runResearcherAgent(sessionId: string): Promise<any> {
  try {
    logger.info('Running Researcher agent', { sessionId });

    const aaveMarkets = await getAaveMarkets();
    const fraxPools = await getFraxPools();
    const assetPrices = await getMultipleAssetPrices(
      ['USDC/USD', 'MATIC/USD', 'WETH/USD'],
      'moderate'
    );

    const opportunities = [
      ...aaveMarkets.map(m => ({
        protocol: 'Aave v3',
        asset: m.symbol,
        apy: m.depositAPY,
        tvl: m.totalSupply,
        risk: 'low'
      })),
      ...fraxPools.map(p => ({
        protocol: 'Frax Finance',
        asset: p.poolName,
        apy: p.apy,
        tvl: p.tvl,
        risk: 'medium'
      }))
    ].sort((a, b) => b.apy - a.apy);

    const marketData = {
      aaveMarkets,
      fraxPools,
      assetPrices: Object.fromEntries(assetPrices),
      topOpportunities: opportunities.slice(0, 10),
      scanTimestamp: new Date().toISOString()
    };

    logger.info('Researcher agent completed', {
      sessionId,
      aaveMarkets: aaveMarkets.length,
      fraxPools: fraxPools.length,
      topOpportunities: opportunities.length
    });

    return marketData;
  } catch (error: any) {
    logger.error('Researcher agent failed', {
      error: error.message,
      sessionId
    });
    throw error;
  }
}
