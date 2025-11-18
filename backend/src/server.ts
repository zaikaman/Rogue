import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { config, validateConfig } from './utils/constants.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { configureADK } from './config/adk-setup.js';
import { initializeADK } from './app.js';
import { initializeCronJobs, stopCronJobs } from './cron/index.js';
import positionsRouter from './api/positions.js';
import strategiesRouter from './api/strategies.js';
import transactionsRouter from './api/transactions.js';
import healthRouter from './api/health.js';
import yieldHistoryRouter from './api/yield-history.js';
import workflowsRouter from './api/workflows.js';
import swapRouter from './api/swap.js';
import bridgeRouter from './api/bridge.js';
import portfolioRouter from './api/portfolio.js';
import multichainRouter from './api/multichain.js';

dotenv.config();

const app = express();
const PORT = config.PORT;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  next();
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Rogue Yield Agent API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      positions: '/api/positions',
      strategies: '/api/strategies',
      transactions: '/api/transactions'
    }
  });
});

// API routes
app.use('/api/positions', positionsRouter);
app.use('/api/positions', yieldHistoryRouter);
app.use('/api/strategies', strategiesRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/health', healthRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/swap', swapRouter);
app.use('/api/bridge', bridgeRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/multichain', multichainRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize server
async function startServer() {
  try {
    // Validate environment configuration
    validateConfig();
    logger.info('Environment configuration validated');

    // Configure ADK-TS with custom OpenAI settings
    configureADK();

    // Initialize ADK-TS framework
    initializeADK();

    // Initialize autonomous cron jobs
    const cronJobs = initializeCronJobs();

    // Start listening
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Rogue backend server running on port ${PORT}`);
      logger.info(`Environment: ${config.NODE_ENV}`);
    });

    // Graceful shutdown
    const shutdown = () => {
      logger.info('Shutting down gracefully...');
      stopCronJobs(cronJobs);
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

startServer();

export default app;
