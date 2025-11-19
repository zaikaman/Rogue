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
  
  // Base Mainnet RPC
  BASE_RPC_URL: process.env.BASE_RPC_URL || '',
  
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
  AAVE_SUBGRAPH_URL: process.env.AAVE_SUBGRAPH_URL || 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-base',
};

/**
 * Base Mainnet Token Addresses (ChainID: 8453)
 */
export const TOKEN_ADDRESSES = {
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base Mainnet USDC
  WETH: '0x4200000000000000000000000000000000000006', // Base Mainnet WETH
  CBETH: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', // Base Mainnet cbETH
};

/**
 * Chainlink Oracle Addresses (Base Mainnet - ChainID: 8453)
 */
export const CHAINLINK_ORACLES = {
  ETH_USD: process.env.CHAINLINK_ETH_USD || '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
  USDC_USD: process.env.CHAINLINK_USDC_USD || '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B',
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
    'BASE_RPC_URL',
    'OPENAI_API_KEY',
  ];
  
  const missing = required.filter(key => !config[key as keyof typeof config]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default config;
