import { Router, Response } from 'express';
import { getSupabaseClient } from '../services/supabase';
import { getProvider } from '../utils/rpc';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /health
 * Health check endpoint for monitoring
 */
router.get('/', async (_req, res: Response) => {
  const startTime = Date.now();
  const health: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      api: { status: 'up', latency: 0 },
      database: { status: 'unknown', latency: 0 },
      blockchain: { status: 'unknown', latency: 0 }
    }
  };

  try {
    // Check database connectivity
    const dbStart = Date.now();
    const supabase = getSupabaseClient();
    const { error: dbError } = await supabase
      .from('positions')
      .select('id')
      .limit(1);

    health.services.database.latency = Date.now() - dbStart;

    if (dbError) {
      health.services.database.status = 'down';
      health.services.database.error = dbError.message;
      health.status = 'degraded';
    } else {
      health.services.database.status = 'up';
    }

    // Check blockchain RPC connectivity
    const rpcStart = Date.now();
    try {
      const provider = getProvider();
      const blockNumber = await provider.getBlockNumber();
      health.services.blockchain.latency = Date.now() - rpcStart;
      health.services.blockchain.status = 'up';
      health.services.blockchain.blockNumber = blockNumber;
    } catch (rpcError: any) {
      health.services.blockchain.latency = Date.now() - rpcStart;
      health.services.blockchain.status = 'down';
      health.services.blockchain.error = rpcError.message;
      health.status = 'degraded';
    }

    // Calculate overall API latency
    health.services.api.latency = Date.now() - startTime;

    // Log health check results
    logger.info('Health check completed', {
      status: health.status,
      latency: health.services.api.latency,
      database: health.services.database.status,
      blockchain: health.services.blockchain.status
    });

    // Set appropriate HTTP status code
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error: any) {
    logger.error('Health check failed', { error: error.message });
    
    health.status = 'unhealthy';
    health.error = error.message;
    health.services.api.latency = Date.now() - startTime;

    res.status(503).json(health);
  }
});

/**
 * GET /health/detailed
 * Detailed health check with additional metrics
 */
router.get('/detailed', async (_req, res: Response) => {
  const startTime = Date.now();
  const health: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      api: { status: 'up', latency: 0 },
      database: { status: 'unknown', latency: 0, stats: {} },
      blockchain: { status: 'unknown', latency: 0, stats: {} }
    }
  };

  try {
    // Database health with stats
    const dbStart = Date.now();
    const supabase = getSupabaseClient();
    
    const [positionsResult, strategiesResult, transactionsResult] = await Promise.all([
      supabase.from('positions').select('id', { count: 'exact', head: true }),
      supabase.from('strategies').select('id', { count: 'exact', head: true }),
      supabase.from('transaction_records').select('id', { count: 'exact', head: true })
    ]);

    health.services.database.latency = Date.now() - dbStart;
    health.services.database.status = 'up';
    health.services.database.stats = {
      totalPositions: positionsResult.count || 0,
      totalStrategies: strategiesResult.count || 0,
      totalTransactions: transactionsResult.count || 0
    };

    // Blockchain health with stats
    const rpcStart = Date.now();
    try {
      const provider = getProvider();
      const [blockNumber, network, gasPrice] = await Promise.all([
        provider.getBlockNumber(),
        provider.getNetwork(),
        provider.getFeeData()
      ]);

      health.services.blockchain.latency = Date.now() - rpcStart;
      health.services.blockchain.status = 'up';
      health.services.blockchain.stats = {
        blockNumber,
        chainId: Number(network.chainId),
        gasPrice: gasPrice.gasPrice?.toString() || 'N/A',
        maxFeePerGas: gasPrice.maxFeePerGas?.toString() || 'N/A'
      };
    } catch (rpcError: any) {
      health.services.blockchain.latency = Date.now() - rpcStart;
      health.services.blockchain.status = 'down';
      health.services.blockchain.error = rpcError.message;
      health.status = 'degraded';
    }

    // API latency
    health.services.api.latency = Date.now() - startTime;

    logger.info('Detailed health check completed', {
      status: health.status,
      services: Object.keys(health.services).reduce((acc: any, key) => {
        acc[key] = health.services[key].status;
        return acc;
      }, {})
    });

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error: any) {
    logger.error('Detailed health check failed', { error: error.message });
    
    health.status = 'unhealthy';
    health.error = error.message;
    health.services.api.latency = Date.now() - startTime;

    res.status(503).json(health);
  }
});

export default router;
