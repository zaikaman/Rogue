import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { compoundPositionWorkflow } from '../workflows/yield-optimization';
import { getSupabaseClient } from '../services/supabase';
import { getChainlinkPrice } from '../services/chainlink-oracle';
import logger from '../utils/logger';

/**
 * Autonomous Compound Cron Job
 * 
 * Automatically compounds accrued yield for active positions when:
 * 1. Minimum yield threshold is met ($10 equivalent)
 * 2. Compounding is profitable after gas costs
 * 3. Position hasn't been compounded recently (24h cooldown)
 * 
 * Runs every 12 hours by default (configurable via COMPOUND_CRON_SCHEDULE env var)
 */

const COMPOUND_SCHEDULE = process.env.COMPOUND_CRON_SCHEDULE || '0 */12 * * *'; // Every 12 hours
const MIN_COMPOUND_VALUE_USD = parseFloat(process.env.MIN_COMPOUND_VALUE || '10'); // $10 minimum
const COMPOUND_COOLDOWN_HOURS = parseFloat(process.env.COMPOUND_COOLDOWN || '24'); // 24h cooldown
const MAX_GAS_COST_USD = parseFloat(process.env.MAX_GAS_COST || '5'); // Don't compound if gas > $5

/**
 * Calculate estimated yield for a position
 */
async function estimatePositionYield(position: any): Promise<number> {
  try {
    const strategy = position.strategies;
    if (!strategy) return 0;

    // Calculate days since last compound (or deposit)
    const lastCompoundAt = position.last_compound_at || position.created_at;
    const daysSince = (Date.now() - new Date(lastCompoundAt).getTime()) / (1000 * 60 * 60 * 24);

    // Estimate accrued yield: principal * (APY/365) * days
    const principal = parseFloat(position.total_value);
    const apy = parseFloat(strategy.target_apy) / 100;
    const estimatedYield = principal * (apy / 365) * daysSince;

    return estimatedYield;
  } catch (error: any) {
    logger.error('Failed to estimate yield', { error: error.message, positionId: position.id });
    return 0;
  }
}

/**
 * Check if compounding is profitable after gas costs
 */
async function isCompoundProfitable(yieldValueUSD: number): Promise<boolean> {
  try {
    // Get current MATIC price
    const maticPriceData = await getChainlinkPrice('MATIC', 'moderate');
    if (!maticPriceData) {
      logger.warn('Could not get MATIC price, skipping profitability check');
      return false;
    }
    
    const maticPrice = parseFloat(maticPriceData.price);
    
    // Estimate gas cost (compound tx ~200k gas, high gas price ~100 gwei on Polygon)
    const gasUnits = 200000;
    const gasPriceGwei = 100; // Conservative estimate
    const gasInMatic = (gasUnits * gasPriceGwei) / 1e9;
    const gasInUSD = gasInMatic * maticPrice;

    logger.debug('Gas cost estimate', {
      maticPrice,
      gasInMatic: gasInMatic.toFixed(4),
      gasInUSD: gasInUSD.toFixed(2),
      yieldValueUSD
    });

    // Profitable if yield > (gas cost + minimum threshold)
    return gasInUSD < MAX_GAS_COST_USD && yieldValueUSD > gasInUSD + MIN_COMPOUND_VALUE_USD;
  } catch (error: any) {
    logger.error('Failed to check profitability', { error: error.message });
    return false; // Conservative - don't compound if can't verify profitability
  }
}

/**
 * Compound yield for eligible positions
 */
async function compoundEligiblePositions() {
  const startTime = Date.now();
  logger.info('🔄 Starting autonomous compound job...');

  try {
    const supabase = getSupabaseClient();
    
    // Fetch active positions
    const { data: positions, error } = await supabase
      .from('positions')
      .select(`
        *,
        strategies (
          id,
          name,
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
      logger.info('No active positions to compound');
      return;
    }

    logger.info(`Checking ${positions.length} positions for compounding eligibility`);

    let checkedCount = 0;
    let compoundedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each position
    for (const position of positions) {
      try {
        checkedCount++;

        // Check cooldown period
        const lastCompoundAt = position.last_compound_at || position.created_at;
        const hoursSince = (Date.now() - new Date(lastCompoundAt).getTime()) / (1000 * 60 * 60);
        
        if (hoursSince < COMPOUND_COOLDOWN_HOURS) {
          logger.debug(`Position ${position.id} still in cooldown`, {
            hoursSince: hoursSince.toFixed(1),
            cooldown: COMPOUND_COOLDOWN_HOURS
          });
          skippedCount++;
          continue;
        }

        // Estimate accrued yield
        const estimatedYield = await estimatePositionYield(position);
        
        if (estimatedYield < MIN_COMPOUND_VALUE_USD) {
          logger.debug(`Position ${position.id} yield too low`, {
            estimatedYield: estimatedYield.toFixed(2),
            minimum: MIN_COMPOUND_VALUE_USD
          });
          skippedCount++;
          continue;
        }

        // Check if profitable after gas
        const isProfitable = await isCompoundProfitable(estimatedYield);
        if (!isProfitable) {
          logger.debug(`Position ${position.id} not profitable to compound`, {
            estimatedYield: estimatedYield.toFixed(2)
          });
          skippedCount++;
          continue;
        }

        // Execute compound workflow
        logger.info(`💎 Compounding position ${position.id}`, {
          estimatedYield: `$${estimatedYield.toFixed(2)}`,
          positionValue: `$${position.total_value}`,
          hoursSinceLastCompound: hoursSince.toFixed(1)
        });

        const result: any = await compoundPositionWorkflow(position.id);

        if (result.success) {
          
          // Update last compound timestamp
          await supabase
            .from('positions')
            .update({
              last_compound_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', position.id);

          compoundedCount++;
          logger.info(`✅ Successfully compounded position ${position.id}`);
        } else {
          logger.warn(`Compound failed for position ${position.id}`, { error: result.error });
          errorCount++;
        }

        // Rate limiting - wait 3s between compounds
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error: any) {
        logger.error(`Error processing position ${position.id}`, { error: error.message });
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;
    logger.info('✅ Autonomous compound complete', {
      duration: `${(duration / 1000).toFixed(2)}s`,
      checked: checkedCount,
      compounded: compoundedCount,
      skipped: skippedCount,
      errors: errorCount
    });

    // Record job metrics
    const supabaseLog = getSupabaseClient();
    await supabaseLog.from('cron_logs').insert({
      job_name: 'autonomous-compound',
      status: errorCount === 0 ? 'success' : 'partial_failure',
      positions_checked: checkedCount,
      positions_compounded: compoundedCount,
      positions_skipped: skippedCount,
      errors: errorCount,
      duration_ms: duration,
      executed_at: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Autonomous compound job failed', { error: error.message });
    
    const supabaseErr = getSupabaseClient();
    await supabaseErr.from('cron_logs').insert({
      job_name: 'autonomous-compound',
      status: 'error',
      error_message: error.message,
      executed_at: new Date().toISOString()
    });
  }
}

/**
 * Initialize autonomous compound cron job
 */
export function initializeAutonomousCompound() {
  logger.info(`📅 Scheduling autonomous compound: ${COMPOUND_SCHEDULE}`);
  
  const task = cron.schedule(COMPOUND_SCHEDULE, async () => {
    await compoundEligiblePositions();
  }, {
    timezone: 'UTC'
  });

  // Run immediately on startup (optional)
  if (process.env.COMPOUND_ON_STARTUP === 'true') {
    logger.info('Running initial compound on startup...');
    compoundEligiblePositions();
  }

  return task;
}

// Allow manual execution for testing
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  compoundEligiblePositions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
