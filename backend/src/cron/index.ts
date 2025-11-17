import { initializeAutonomousScan } from './autonomous-scan';
import { initializeAutonomousCompound } from './autonomous-compound';
import { initializeCronJobs as initializeEnhancedCronJobs } from './autonomous-jobs';
import logger from '../utils/logger';

/**
 * Central cron job manager
 * 
 * Initializes and manages all autonomous background jobs:
 * - Enhanced multi-agent market scanning
 * - Hourly yield optimization
 * - Quarterly rebalancing
 * - Volatility monitoring
 * - Auto-compounding
 */

export function initializeCronJobs() {
  logger.info('⏰ Initializing autonomous cron jobs...');

  // Initialize enhanced cron jobs (new system)
  if (process.env.ENABLE_ENHANCED_JOBS !== 'false') {
    try {
      initializeEnhancedCronJobs();
      logger.info('✅ Enhanced autonomous jobs initialized');
    } catch (error: any) {
      logger.error('Failed to initialize enhanced jobs', { error: error.message });
    }
  }

  // Keep legacy jobs if needed for compatibility
  const jobs = [];

  if (process.env.ENABLE_LEGACY_SCAN === 'true') {
    const scanJob = initializeAutonomousScan();
    jobs.push({ name: 'autonomous-scan', task: scanJob });
    logger.info('✅ Legacy autonomous scan job initialized');
  }

  if (process.env.ENABLE_LEGACY_COMPOUND === 'true') {
    const compoundJob = initializeAutonomousCompound();
    jobs.push({ name: 'autonomous-compound', task: compoundJob });
    logger.info('✅ Legacy autonomous compound job initialized');
  }

  logger.info(`🎯 Enhanced cron system active with ${jobs.length} legacy jobs`);

  return jobs;
}

/**
 * Stop all cron jobs (for graceful shutdown)
 */
export function stopCronJobs(jobs: any[]) {
  logger.info('🛑 Stopping cron jobs...');
  
  jobs.forEach(({ name, task }) => {
    task.stop();
    logger.info(`Stopped ${name}`);
  });
  
  logger.info('All cron jobs stopped');
}
