import dotenv from 'dotenv';

dotenv.config();

/**
 * Environment configuration and constants
 */
export const config = {
  // Server
  PORT: process.env.PORT || '4000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
  // Alchemy RPC
  POLYGON_RPC_URL: process.env.POLYGON_RPC_URL || '',
  
  // OpenAI (REQUIRED for ADK-TS agents)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  
  // Cron Configuration
  AUTONOMOUS_SCAN_INTERVAL: process.env.AUTONOMOUS_SCAN_INTERVAL || '4h',
  AUTONOMOUS_COMPOUND_INTERVAL: process.env.AUTONOMOUS_COMPOUND_INTERVAL || '24h',
  
  // External APIs
  FRAX_API_URL: process.env.FRAX_API_URL || 'https://api.frax.finance',
  AAVE_SUBGRAPH_URL: process.env.AAVE_SUBGRAPH_URL || 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-polygon',
};

/**
 * Polygon Mainnet Token Addresses
 */
export const TOKEN_ADDRESSES = {
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  // KRWQ address to be added when available
  KRWQ: process.env.KRWQ_ADDRESS || '',
};

/**
 * Chainlink Oracle Addresses (Polygon Mainnet)
 */
export const CHAINLINK_ORACLES = {
  USDC_USD: process.env.CHAINLINK_USDC_USD || '0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7',
  MATIC_USD: process.env.CHAINLINK_MATIC_USD || '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0',
};

/**
 * Risk profile configurations
 */
export const RISK_PROFILES = {
  low: {
    maxLeverage: 1.0,
    preferredProtocols: ['aave', 'frax'],
    minLiquidity: 1000000, // $1M minimum liquidity
  },
  medium: {
    maxLeverage: 1.5,
    preferredProtocols: ['aave', 'frax', 'curve'],
    minLiquidity: 500000, // $500K minimum liquidity
  },
  high: {
    maxLeverage: 2.0,
    preferredProtocols: ['aave', 'frax', 'curve', 'convex'],
    minLiquidity: 100000, // $100K minimum liquidity
  },
};

/**
 * Validate required environment variables
 */
export function validateConfig() {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'POLYGON_RPC_URL',
    'OPENAI_API_KEY',
  ];
  
  const missing = required.filter(key => !config[key as keyof typeof config]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default config;
