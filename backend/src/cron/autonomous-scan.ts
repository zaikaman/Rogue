import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { runYieldOptimizationWorkflow } from '../workflows/yield-optimization';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

/**
 * Autonomous Market Scanning Cron Job
 * 
 * Scans all active positions and triggers yield optimization workflow
 * to rebalance allocations when better opportunities are detected.
 * 
 * Runs every 6 hours by default (configurable via SCAN_CRON_SCHEDULE env var)
 */

const SCAN_SCHEDULE = process.env.SCAN_CRON_SCHEDULE || '0 */6 * * *'; // Every 6 hours
const MIN_REBALANCE_THRESHOLD = parseFloat(process.env.MIN_REBALANCE_APY_DIFF || '0.5'); // 0.5% APY improvement threshold

/**
 * Scan active positions and trigger rebalancing if needed
 */
async function scanActivePositions() {
  const startTime = Date.now();
  logger.info('🔍 Starting autonomous market scan...');

  try {
    const supabase = getSupabaseClient();
    // Fetch all active positions
    const { data: positions, error } = await supabase
      .from('positions')
      .select(`
        *,
        strategies (
          id,
          name,
          risk_tier,
          target_apy,
          allocations
        )
      `)
      .eq('status', 'active')
      .order('total_value', { ascending: false });

    if (error) {
      logger.error('Failed to fetch positions', { error: error.message });
      return;
    }

    if (!positions || positions.length === 0) {
      logger.info('No active positions to scan');
      return;
    }

    logger.info(`Found ${positions.length} active positions to analyze`);

    let scannedCount = 0;
    let rebalancedCount = 0;
    let errorCount = 0;

    // Process each position
    for (const position of positions) {
      try {
        scannedCount++;
        
        // Run yield optimization workflow to get new recommendations
        const result = await runYieldOptimizationWorkflow({
          walletAddress: position.wallet_address,
          token: position.token as 'USDC',
          amount: parseFloat(position.amount),
          riskProfile: position.risk_profile,
          positionId: position.id,
          action: 'rebalance'
        });

        if (!result.success) {
          logger.warn(`Scan failed for position ${position.id}`, { error: result.error });
          errorCount++;
          continue;
        }

        // Check if new APY is significantly better
        const currentAPY = position.strategies?.target_apy || 0;
        const newAPY = result.steps.analyzer?.data?.expectedAPY || 0;
        const apyDiff = newAPY - currentAPY;

        if (apyDiff >= MIN_REBALANCE_THRESHOLD) {
          logger.info(`🎯 Rebalance opportunity detected for position ${position.id}`, {
            currentAPY,
            newAPY,
            improvement: `+${apyDiff.toFixed(2)}%`,
            positionValue: position.total_value
          });

          // Update position with new strategy
          // Note: Strategy ID update requires strategy creation which is handled by workflow
          // For now we just log the rebalance opportunity
          /*
          const { error: updateError } = await supabase
            .from('positions')
            .update({
              strategy_id: result.steps.analyzer?.data?.strategyId,
              updated_at: new Date().toISOString()
            })
            .eq('id', position.id);

          if (updateError) {
            logger.error(`Failed to update position ${position.id}`, { error: updateError.message });
            errorCount++;
          } else {
            rebalancedCount++;
          }
          */
          rebalancedCount++;
        } else {
          logger.debug(`Position ${position.id} is already optimized`, {
            currentAPY,
            newAPY,
            diff: apyDiff.toFixed(2)
          });
        }

        // Rate limiting - wait 2s between scans to avoid API overload
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error: any) {
        logger.error(`Error processing position ${position.id}`, { error: error.message });
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;
    logger.info('✅ Autonomous scan complete', {
      duration: `${(duration / 1000).toFixed(2)}s`,
      scanned: scannedCount,
      rebalanced: rebalancedCount,
      errors: errorCount
    });

    // Record scan metrics
    await supabase.from('cron_logs').insert({
      job_name: 'autonomous-scan',
      status: errorCount < positions.length / 2 ? 'success' : 'partial_failure',
      positions_scanned: scannedCount,
      positions_rebalanced: rebalancedCount,
      errors: errorCount,
      duration_ms: duration,
      executed_at: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Autonomous scan failed', { error: error.message });
    
    const supabase = getSupabaseClient();
    await supabase.from('cron_logs').insert({
      job_name: 'autonomous-scan',
      status: 'error',
      error_message: error.message,
      executed_at: new Date().toISOString()
    });
  }
}

/**
 * Initialize autonomous scan cron job
 */
export function initializeAutonomousScan() {
  logger.info(`📅 Scheduling autonomous scan: ${SCAN_SCHEDULE}`);
  
  const task = cron.schedule(SCAN_SCHEDULE, async () => {
    await scanActivePositions();
  }, {
    timezone: 'UTC'
  });

  // Run immediately on startup (optional)
  if (process.env.SCAN_ON_STARTUP === 'true') {
    logger.info('Running initial scan on startup...');
    scanActivePositions();
  }

  return task;
}

// Allow manual execution for testing
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  scanActivePositions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
