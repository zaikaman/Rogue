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
  AAVE_SUBGRAPH_URL: process.env.AAVE_SUBGRAPH_URL || 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-polygon-amoy',
};

/**
 * Polygon Amoy Testnet Token Addresses (ChainID: 80002)
 * Get testnet tokens from https://faucets.chain.link/polygon-amoy
 */
export const TOKEN_ADDRESSES = {
  USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // Amoy testnet USDC
  WMATIC: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9', // Amoy testnet WMATIC
  // KRWQ address to be added when available
  KRWQ: process.env.KRWQ_ADDRESS || '',
};

/**
 * Chainlink Oracle Addresses (Polygon Amoy Testnet - ChainID: 80002)
 * Note: POL/USD is the primary feed on Amoy (MATIC rebranded to POL)
 */
export const CHAINLINK_ORACLES = {
  USDC_USD: process.env.CHAINLINK_USDC_USD || '0x001382149eBa3441043c1c66972b4772963f5D43',
  MATIC_USD: process.env.CHAINLINK_MATIC_USD || '0x001382149eBa3441043c1c66972b4772963f5D43',
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
