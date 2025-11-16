/**
 * ADK-TS Configuration Setup
 * 
 * This module ensures ADK-TS agents use the correct OpenAI configuration
 * including custom base URLs for OpenAI-compatible services.
 * 
 * IMPORTANT: This must be imported BEFORE any ADK agent imports
 */

import dotenv from 'dotenv';
import { config } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

// Load environment variables first
dotenv.config();

/**
 * Configure environment variables for ADK-TS
 * 
 * Since ADK-TS reads directly from process.env, we ensure all
 * required environment variables are properly set before ADK initialization
 */
export function configureADK() {
  // Ensure OPENAI_API_KEY is set
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is required for ADK-TS agents. Please set it in your .env file.'
    );
  }

  // Set OPENAI_BASE_URL if provided in config
  if (config.OPENAI_BASE_URL && config.OPENAI_BASE_URL !== 'https://api.openai.com/v1') {
    process.env.OPENAI_BASE_URL = config.OPENAI_BASE_URL;
    logger.info('ADK-TS configured with custom OpenAI base URL', {
      baseURL: config.OPENAI_BASE_URL,
    });
  }

  // Log configuration (without exposing the full API key)
  const maskedKey = process.env.OPENAI_API_KEY.slice(0, 7) + '...' + 
                    process.env.OPENAI_API_KEY.slice(-4);
  
  logger.info('ADK-TS OpenAI configuration loaded', {
    apiKey: maskedKey,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: config.OPENAI_MODEL,
  });
}

/**
 * Note on ADK-TS Custom Base URLs:
 * 
 * The published @iqai/adk package (v0.5.6) may not support OPENAI_BASE_URL
 * environment variable. If you need to use OpenAI-compatible services
 * (like Azure OpenAI, local LLMs, or other providers), you have these options:
 * 
 * 1. Check if the package supports it by testing with process.env.OPENAI_BASE_URL
 * 2. Use a proxy/reverse proxy to redirect OpenAI API calls
 * 3. Fork and modify the @iqai/adk package to add baseURL support
 * 4. Wait for the package to be updated with baseURL support
 * 5. Use the OpenAI client directly instead of ADK agents (fallback option)
 * 
 * Current implementation: We set process.env.OPENAI_BASE_URL and hope the
 * published package supports it. If not, consider the alternatives above.
 */

export default configureADK;
