import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { config, validateConfig } from './utils/constants.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { initializeADK } from './app.js';

dotenv.config();

const app = express();
const PORT = config.PORT;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
  });
});

// API routes will be added in Phase 3
// app.use('/api/positions', positionsRouter);
// app.use('/api/strategies', strategiesRouter);
// app.use('/api/transactions', transactionsRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize server
async function startServer() {
  try {
    // Validate environment configuration
    validateConfig();
    logger.info('Environment configuration validated');

    // Initialize ADK-TS framework
    initializeADK();

    // Start listening
    app.listen(PORT, () => {
      logger.info(`🚀 Rogue backend server running on port ${PORT}`);
      logger.info(`Environment: ${config.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

startServer();

export default app;
