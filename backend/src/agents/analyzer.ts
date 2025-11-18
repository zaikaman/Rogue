/**
 * Analyzer Agent
 * Analyzes yield opportunities and selects best strategy based on risk profile
 */

import logger from '../utils/logger';
import { YieldOpportunity } from './researcher';

export interface StrategyRecommendation {
  protocol: string;
  token: string;
  expectedAPY: number;
  allocations: {
    protocol: string;
    percentage: number;
  }[];
  reasoning: string;
}

/**
 * Run analyzer agent to select best strategy
 */
export async function runAnalyzerAgent(
  opportunities: YieldOpportunity[],
  riskProfile: 'low' | 'medium' | 'high'
): Promise<StrategyRecommendation | null> {
  logger.info('📊 Analyzer Agent: Analyzing opportunities', {
    opportunitiesCount: opportunities.length,
    riskProfile,
  });

  if (opportunities.length === 0) {
    logger.warn('No opportunities to analyze');
    return null;
  }

  try {
    // Sort opportunities by APY
    const sortedByAPY = [...opportunities].sort((a, b) => b.apy - a.apy);

    // Risk-adjusted selection
    let selectedOpportunities: YieldOpportunity[];

    switch (riskProfile) {
      case 'low':
        // Low risk: Prefer Aave, lower APY but safer
        selectedOpportunities = sortedByAPY.filter((o) => o.riskScore <= 0.3);
        break;

      case 'medium':
        // Medium risk: Balance between APY and risk
        selectedOpportunities = sortedByAPY.slice(0, 2);
        break;

      case 'high':
        // High risk: Maximize APY
        selectedOpportunities = sortedByAPY;
        break;

      default:
        selectedOpportunities = sortedByAPY.slice(0, 1);
    }

    // Calculate allocations
    const totalWeight = selectedOpportunities.reduce(
      (sum, opp) => sum + (1 / opp.riskScore),
      0
    );

    const allocations = selectedOpportunities.map((opp) => ({
      protocol: opp.protocol,
      percentage: Math.round(((1 / opp.riskScore) / totalWeight) * 100),
    }));

    // Calculate weighted APY
    const expectedAPY = selectedOpportunities.reduce(
      (sum, opp, i) => sum + opp.apy * (allocations[i].percentage / 100),
      0
    );

    const recommendation: StrategyRecommendation = {
      protocol: selectedOpportunities[0].protocol,
      token: selectedOpportunities[0].token,
      expectedAPY,
      allocations,
      reasoning: `Selected ${selectedOpportunities.length} protocol(s) based on ${riskProfile} risk profile. Expected APY: ${expectedAPY.toFixed(2)}%`,
    };

    logger.info('✅ Analyzer Agent: Strategy selected', { recommendation });

    return recommendation;
  } catch (error) {
    logger.error('Analyzer Agent failed', { error });
    return null;
  }
}
