import { getSupabaseClient } from './supabase';
import logger from '../utils/logger';

/**
 * Yield History Service
 * Tracks APY and position value over time for analysis and charting
 */

export interface YieldDataPoint {
  id: string;
  position_id: string;
  protocol: string;
  apy: number;
  value: number;
  timestamp: string;
}

/**
 * Record yield snapshot for a position
 */
export async function recordYieldSnapshot(
  positionId: string,
  protocol: string,
  apy: number,
  value: number
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    await supabase.from('yield_history').insert({
      position_id: positionId,
      protocol,
      apy,
      value,
      timestamp: new Date().toISOString()
    });

    logger.info('Yield snapshot recorded', { positionId, protocol, apy, value });
  } catch (error: any) {
    logger.error('Failed to record yield snapshot', {
      error: error.message,
      positionId
    });
  }
}

/**
 * Get yield history for a position
 */
export async function getYieldHistory(
  positionId: string,
  days: number = 30
): Promise<YieldDataPoint[]> {
  try {
    const supabase = getSupabaseClient();
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('yield_history')
      .select('*')
      .eq('position_id', positionId)
      .gte('timestamp', cutoffDate.toISOString())
      .order('timestamp', { ascending: true });

    if (error) {
      logger.error('Failed to fetch yield history', { error: error.message, positionId });
      return [];
    }

    return data || [];
  } catch (error: any) {
    logger.error('Failed to get yield history', { error: error.message, positionId });
    return [];
  }
}

/**
 * Get aggregated yield statistics
 */
export async function getYieldStatistics(positionId: string): Promise<{
  avgApy: number;
  maxApy: number;
  minApy: number;
  currentApy: number;
  totalGrowth: number;
} | null> {
  try {
    const history = await getYieldHistory(positionId);
    
    if (history.length === 0) {
      return null;
    }

    const apys = history.map(h => h.apy);
    const values = history.map(h => h.value);

    return {
      avgApy: apys.reduce((sum, apy) => sum + apy, 0) / apys.length,
      maxApy: Math.max(...apys),
      minApy: Math.min(...apys),
      currentApy: apys[apys.length - 1],
      totalGrowth: ((values[values.length - 1] / values[0]) - 1) * 100
    };
  } catch (error: any) {
    logger.error('Failed to calculate yield statistics', {
      error: error.message,
      positionId
    });
    return null;
  }
}

/**
 * Get protocol-level yield comparison
 */
export async function getProtocolYields(
  positionId: string
): Promise<Record<string, { avgApy: number; currentApy: number }>> {
  try {
    const history = await getYieldHistory(positionId);
    
    const protocolData: Record<string, number[]> = {};
    
    history.forEach(h => {
      if (!protocolData[h.protocol]) {
        protocolData[h.protocol] = [];
      }
      protocolData[h.protocol].push(h.apy);
    });

    const result: Record<string, { avgApy: number; currentApy: number }> = {};
    
    Object.entries(protocolData).forEach(([protocol, apys]) => {
      result[protocol] = {
        avgApy: apys.reduce((sum, apy) => sum + apy, 0) / apys.length,
        currentApy: apys[apys.length - 1]
      };
    });

    return result;
  } catch (error: any) {
    logger.error('Failed to get protocol yields', { error: error.message, positionId });
    return {};
  }
}
