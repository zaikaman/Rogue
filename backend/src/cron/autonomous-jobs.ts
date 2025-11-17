/**
 * Autonomous Cron Service
 * Hourly scans and executions for active positions
 */

import cron from 'node-cron';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../services/supabase';
import { runEnhancedResearcher } from '../agents/researcher-enhanced';
import { runEnhancedTrader } from '../agents/trader-enhanced';
import { shouldRebalance } from '../services/technical-analysis';
import { calculateYieldFees, recordFeeCollection } from '../services/tokenomics';

/**
 * Hourly market scan and opportunity detection
 */
export function scheduleHourlyScan() {
  // Run every hour at :00
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('🕐 Starting hourly market scan');

      const sessionId = `hourly-${Date.now()}`;
      const research = await runEnhancedResearcher(sessionId, ['mumbai', 'sepolia']);

      logger.info('✅ Hourly scan completed', {
        opportunities: research.topOpportunities.length,
        bestAPY: research.topOpportunities[0]?.apy
      });

      // Store scan results
      const supabase = getSupabaseClient();
      await supabase.from('market_scans').insert({
        scan_type: 'hourly',
        opportunities_found: research.topOpportunities.length,
        best_apy: research.topOpportunities[0]?.apy || 0,
        data: research,
        scanned_at: new Date().toISOString()
      });

    } catch (error: any) {
      logger.error('Hourly scan failed', { error: error.message });
    }
  });

  logger.info('📅 Hourly market scan scheduled');
}

/**
 * Auto-compound for active positions (daily at 2 AM)
 */
export function scheduleAutoCompound() {
  // Run daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('🔄 Starting auto-compound for all positions');

      const supabase = getSupabaseClient();

      // Fetch all active positions
      const { data: positions } = await supabase
        .from('positions')
        .select('*')
        .eq('status', 'active');

      if (!positions || positions.length === 0) {
        logger.info('No active positions to compound');
        return;
      }

      logger.info(`Processing ${positions.length} active positions`);

      for (const position of positions) {
        try {
          // Simulate yield accumulation (in production, fetch from contracts)
          const yieldAmount = calculateDailyYield(
            position.amount,
            5.0 // Assume 5% APY average
          );

          if (BigInt(yieldAmount) < BigInt(ethers.parseUnits('0.1', 6))) {
            logger.info('Yield too small to compound', {
              positionId: position.id,
              yield: yieldAmount
            });
            continue;
          }

          // Calculate fees
          const fees = calculateYieldFees(yieldAmount);

          // Record fee collection
          await recordFeeCollection(
            position.id,
            'management',
            fees.totalFee,
            fees.toHolders,
            fees.toTreasury
          );

          // Execute compound (simulated for testnet)
          logger.info('Compounding position', {
            positionId: position.id,
            yield: yieldAmount,
            userReceives: fees.userReceives,
            fee: fees.totalFee
          });

          // Update position amount
          const newAmount = BigInt(position.amount) + BigInt(fees.userReceives);
          await supabase
            .from('positions')
            .update({
              amount: newAmount.toString(),
              last_action_at: new Date().toISOString()
            })
            .eq('id', position.id);

          // Log transaction
          await supabase.from('transaction_records').insert({
            position_id: position.id,
            wallet_address: position.wallet_address,
            tx_hash: '0x' + Buffer.from(`compound-${position.id}-${Date.now()}`).toString('hex').slice(0, 64),
            type: 'compound',
            status: 'confirmed',
            amount: fees.userReceives,
            gas_cost: '0.03',
            notes: `Auto-compounded ${ethers.formatUnits(fees.userReceives, 6)} USDC`,
            created_at: new Date().toISOString(),
            confirmed_at: new Date().toISOString()
          });

        } catch (error: any) {
          logger.error('Failed to compound position', {
            positionId: position.id,
            error: error.message
          });
        }
      }

      logger.info('✅ Auto-compound completed');

    } catch (error: any) {
      logger.error('Auto-compound failed', { error: error.message });
    }
  });

  logger.info('📅 Daily auto-compound scheduled (2 AM)');
}

/**
 * Quarterly rebalancing check
 */
export function scheduleQuarterlyRebalance() {
  // Run on 1st of month at 3 AM (monthly, acting as quarterly for testing)
  cron.schedule('0 3 1 * *', async () => {
    try {
      logger.info('🔀 Starting quarterly rebalance check');

      const supabase = getSupabaseClient();

      // Fetch positions that need rebalancing
      const { data: positions } = await supabase
        .from('positions')
        .select('*, strategies(*)')
        .eq('status', 'active')
        .neq('risk_profile', 'low'); // Low risk doesn't rebalance

      if (!positions || positions.length === 0) {
        logger.info('No positions to rebalance');
        return;
      }

      for (const position of positions) {
        try {
          // Get latest market data
          const research = await runEnhancedResearcher(
            `rebalance-${position.id}`,
            ['mumbai', 'sepolia']
          );

          // Check if rebalance needed (simplified)
          const currentAllocation = position.strategies?.[0]?.allocation || {};
          
          // Simulate technical signals
          const signals = {
            ETH: { overallSignal: 'hold', confidence: 50 },
            MATIC: { overallSignal: 'buy', confidence: 75 }
          };

          const rebalanceCheck = shouldRebalance(
            currentAllocation,
            signals as any
          );

          if (rebalanceCheck.shouldRebalance) {
            logger.info('Rebalancing position', {
              positionId: position.id,
              reason: rebalanceCheck.reason
            });

            // Run trader to create new strategy
            const newStrategy = await runEnhancedTrader(
              position.id,
              position.risk_profile,
              Number(ethers.formatUnits(position.amount, 6)),
              research
            );

            logger.info('Rebalance strategy created', {
              positionId: position.id,
              newAPY: newStrategy.expectedAPY
            });

            // Log rebalance
            await supabase.from('transaction_records').insert({
              position_id: position.id,
              wallet_address: position.wallet_address,
              tx_hash: '0x' + Buffer.from(`rebalance-${position.id}-${Date.now()}`).toString('hex').slice(0, 64),
              type: 'rebalance',
              status: 'confirmed',
              notes: rebalanceCheck.reason,
              created_at: new Date().toISOString(),
              confirmed_at: new Date().toISOString()
            });
          } else {
            logger.info('No rebalance needed', {
              positionId: position.id,
              reason: rebalanceCheck.reason
            });
          }

        } catch (error: any) {
          logger.error('Failed to rebalance position', {
            positionId: position.id,
            error: error.message
          });
        }
      }

      logger.info('✅ Quarterly rebalance check completed');

    } catch (error: any) {
      logger.error('Quarterly rebalance failed', { error: error.message });
    }
  });

  logger.info('📅 Quarterly rebalance scheduled (1st of month, 3 AM)');
}

/**
 * Volatility monitoring and emergency hedging
 */
export function scheduleVolatilityMonitoring() {
  // Run every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      // Fetch price volatility
      const volatility = await calculateMarketVolatility();

      if (volatility > 20) {
        logger.warn('🚨 High volatility detected', { volatility });

        // Pause risky operations for high-risk positions
        const supabase = getSupabaseClient();
        const { data: highRiskPositions } = await supabase
          .from('positions')
          .select('*')
          .eq('status', 'active')
          .eq('risk_profile', 'high');

        if (highRiskPositions && highRiskPositions.length > 0) {
          logger.info('Implementing emergency hedge for high-risk positions', {
            count: highRiskPositions.length
          });

          // In production, execute protective swaps to stables
          // For now, just log
          await supabase.from('agent_logs').insert({
            agent_name: 'volatility_monitor',
            action: 'emergency_hedge',
            success: true,
            metadata: {
              volatility,
              positionsAffected: highRiskPositions.length
            },
            created_at: new Date().toISOString()
          });
        }
      }

    } catch (error: any) {
      logger.error('Volatility monitoring failed', { error: error.message });
    }
  });

  logger.info('📅 Volatility monitoring scheduled (every 30 minutes)');
}

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  logger.info('🚀 Initializing autonomous cron jobs');

  scheduleHourlyScan();
  scheduleAutoCompound();
  scheduleQuarterlyRebalance();
  scheduleVolatilityMonitoring();

  logger.info('✅ All cron jobs initialized');
}

/**
 * Helper: Calculate daily yield
 */
function calculateDailyYield(principalAmount: string, apyPercent: number): string {
  const principal = BigInt(principalAmount);
  const dailyRate = BigInt(Math.floor((apyPercent / 365) * 1e6)); // 6 decimals
  const yield_amount = (principal * dailyRate) / BigInt(1e6) / BigInt(100);
  return yield_amount.toString();
}

/**
 * Helper: Calculate market volatility
 */
async function calculateMarketVolatility(): Promise<number> {
  // Simplified: return random volatility for demo
  // In production, calculate from price history
  return Math.random() * 30; // 0-30% volatility
}

// Import ethers for formatUnits
import { ethers } from 'ethers';
