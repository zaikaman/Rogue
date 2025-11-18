/**
 * Researcher Agent
 * Scans DeFi protocols (Aave, Frax) for yield opportunities
 */

import logger from '../utils/logger';
import { getAaveDepositAPY } from '../services/aave-subgraph';
import { getFraxYieldsForToken } from '../services/frax-api';

export interface YieldOpportunity {
  protocol: string;
  token: string;
  apy: number;
  tvl: number;
  riskScore: number;
}

/**
 * Run researcher agent to find yield opportunities
 */
export async function runResearcherAgent(token: 'USDC'): Promise<YieldOpportunity[]> {
  logger.info('🔍 Researcher Agent: Scanning yield opportunities', { token });

  try {
    const opportunities: YieldOpportunity[] = [];

    // Fetch Aave yields
    try {
      const aaveAPY = await getAaveDepositAPY(token);
      if (aaveAPY !== null) {
        opportunities.push({
          protocol: 'Aave',
          token,
          apy: aaveAPY,
          tvl: 1000000, // Placeholder TVL
          riskScore: 0.2, // Aave is low risk
        });
      }
    } catch (error) {
      logger.error('Failed to fetch Aave yields', { error });
    }

    // Fetch Frax yields
    try {
      const fraxYields = await getFraxYieldsForToken(token);
      if (fraxYields && fraxYields.length > 0) {
        const bestFrax = fraxYields[0];
        opportunities.push({
          protocol: 'Frax',
          token,
          apy: bestFrax.apy,
          tvl: parseFloat(bestFrax.tvl) || 0,
          riskScore: 0.3, // Frax slightly higher risk
        });
      }
    } catch (error) {
      logger.error('Failed to fetch Frax yields', { error });
    }

    logger.info('✅ Researcher Agent: Found opportunities', {
      count: opportunities.length,
      opportunities,
    });

    return opportunities;
  } catch (error) {
    logger.error('Researcher Agent failed', { error });
    return [];
  }
}
