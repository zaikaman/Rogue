import { initializeAutonomousScan } from './autonomous-scan';
import { initializeAutonomousCompound } from './autonomous-compound';
import logger from '../utils/logger';

/**
 * Central cron job manager
 * 
 * Initializes and manages all autonomous background jobs:
 * - Market scanning & rebalancing
 * - Yield compounding
 */

export function initializeCronJobs() {
  logger.info('⏰ Initializing autonomous cron jobs...');

  const jobs = [];

  // Initialize market scanning job
  if (process.env.ENABLE_AUTONOMOUS_SCAN !== 'false') {
    const scanJob = initializeAutonomousScan();
    jobs.push({ name: 'autonomous-scan', task: scanJob });
    logger.info('✅ Autonomous scan job initialized');
  } else {
    logger.info('⏭️ Autonomous scan job disabled');
  }

  // Initialize compounding job
  if (process.env.ENABLE_AUTONOMOUS_COMPOUND !== 'false') {
    const compoundJob = initializeAutonomousCompound();
    jobs.push({ name: 'autonomous-compound', task: compoundJob });
    logger.info('✅ Autonomous compound job initialized');
  } else {
    logger.info('⏭️ Autonomous compound job disabled');
  }

  logger.info(`🎯 ${jobs.length} cron jobs active`);

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
