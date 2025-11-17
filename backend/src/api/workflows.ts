/**
 * Workflow API Routes
 * Endpoints for triggering and monitoring multi-agent workflows
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  runYieldOptimizationWorkflow,
  runCompoundWorkflow,
  runRebalanceWorkflow,
  getWorkflowStatus
} from '../workflows/yield-optimization-enhanced';

const router = Router();

/**
 * POST /api/workflows/optimize
 * Trigger full optimization workflow
 */
router.post('/optimize', async (req: Request, res: Response) => {
  try {
    const {
      positionId,
      walletAddress,
      token,
      amount,
      riskProfile,
      chains
    } = req.body;

    logger.info('Workflow request received', {
      positionId,
      action: 'optimize'
    });

    if (!positionId || !walletAddress || !amount || !riskProfile) {
      res.status(400).json({
        error: 'Missing required fields: positionId, walletAddress, amount, riskProfile'
      });
      return;
    }

    const workflow = await runYieldOptimizationWorkflow({
      positionId,
      walletAddress,
      token: token || 'USDC',
      amount,
      riskProfile,
      action: 'create',
      chains: chains || ['mumbai', 'sepolia']
    });

    res.json({
      success: workflow.success,
      positionId: workflow.positionId,
      status: workflow.finalStatus,
      summary: workflow.summary,
      error: workflow.error
    });

  } catch (error: any) {
    logger.error('Workflow error', { error: error.message });
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * POST /api/workflows/compound
 * Trigger auto-compound workflow
 */
router.post('/compound', async (req: Request, res: Response): Promise<void> => {
  try {
    const { positionId, walletAddress } = req.body;

    logger.info('Compound workflow requested', { positionId });

    if (!positionId || !walletAddress) {
      res.status(400).json({
        error: 'Missing required fields: positionId, walletAddress'
      });
      return;
    }

    const workflow = await runCompoundWorkflow(positionId, walletAddress);

    res.json({
      success: workflow.success,
      positionId: workflow.positionId,
      status: workflow.finalStatus,
      summary: workflow.summary,
      error: workflow.error
    });

  } catch (error: any) {
    logger.error('Compound workflow error', { error: error.message });
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * POST /api/workflows/rebalance
 * Trigger rebalance workflow
 */
router.post('/rebalance', async (req: Request, res: Response): Promise<void> => {
  try {
    const { positionId, walletAddress, riskProfile } = req.body;

    logger.info('Rebalance workflow requested', { positionId, riskProfile });

    if (!positionId || !walletAddress || !riskProfile) {
      res.status(400).json({
        error: 'Missing required fields: positionId, walletAddress, riskProfile'
      });
      return;
    }

    const workflow = await runRebalanceWorkflow(
      positionId,
      walletAddress,
      riskProfile
    );

    res.json({
      success: workflow.success,
      positionId: workflow.positionId,
      status: workflow.finalStatus,
      summary: workflow.summary,
      error: workflow.error
    });

  } catch (error: any) {
    logger.error('Rebalance workflow error', { error: error.message });
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/workflows/:sessionId/status
 * Check workflow status
 */
router.get('/:sessionId/status', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    logger.info('Checking workflow status', { sessionId });

    const status = await getWorkflowStatus(sessionId);

    res.json(status);

  } catch (error: any) {
    logger.error('Status check error', { error: error.message });
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/workflows/health
 * Check workflow system health
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    agents: {
      researcher: 'enhanced',
      trader: 'enhanced',
      governor: 'enhanced',
      executor: 'enhanced'
    },
    cronJobs: {
      hourlyMarketScan: 'active',
      dailyAutoCompound: 'active',
      quarterlyRebalance: 'active',
      volatilityMonitoring: 'active'
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
