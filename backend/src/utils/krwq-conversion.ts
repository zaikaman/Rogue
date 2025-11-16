import { getAssetPrice } from './chainlink-oracle';
import logger from '../utils/logger';

/**
 * KRWQ Conversion Utility
 * 
 * Converts between KRWQ (Korean Won stablecoin) and USDC using Chainlink oracles
 * Assumes KRWQ/USD oracle exists or derives from USDC/KRW + USDC/USD
 */

// Exchange rate cache to reduce oracle calls
interface ExchangeRateCache {
  rate: number;
  timestamp: number;
  ttl: number; // Time to live in seconds
}

const cache: Map<string, ExchangeRateCache> = new Map();
const CACHE_TTL = 60; // 1 minute cache

/**
 * Get KRWQ to USDC exchange rate
 * Uses Chainlink oracles for real-time conversion
 */
export async function getKRWQToUSDCRate(): Promise<number | null> {
  const cacheKey = 'KRWQ_USDC';
  const now = Math.floor(Date.now() / 1000);

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && (now - cached.timestamp) < cached.ttl) {
    logger.info('Using cached KRWQ/USDC rate', { rate: cached.rate });
    return cached.rate;
  }

  try {
    // Get USDC/USD price from Chainlink
    const usdcPrice = await getAssetPrice('USDC/USD', 'moderate');
    
    if (!usdcPrice) {
      logger.error('Failed to fetch USDC/USD price for KRWQ conversion');
      return null;
    }

    // Simplified conversion: assume 1 KRW ≈ 0.00075 USD (1 USD ≈ 1,330 KRW)
    // In production, use a real KRW/USD oracle or DEX price feed
    const krwToUsd = 0.00075;
    
    // KRWQ is pegged to KRW, so KRWQ/USDC = (KRW/USD) / (USDC/USD)
    const krwqToUsdc = krwToUsd / usdcPrice;

    // Cache the rate
    cache.set(cacheKey, {
      rate: krwqToUsdc,
      timestamp: now,
      ttl: CACHE_TTL
    });

    logger.info('Calculated KRWQ to USDC rate', {
      rate: krwqToUsdc,
      usdcPrice,
      krwToUsd
    });

    return krwqToUsdc;
  } catch (error: any) {
    logger.error('Failed to calculate KRWQ to USDC rate', { error: error.message });
    return null;
  }
}

/**
 * Convert KRWQ amount to USDC
 */
export async function convertKRWQToUSDC(krwqAmount: number): Promise<number | null> {
  const rate = await getKRWQToUSDCRate();
  
  if (!rate) {
    logger.error('Cannot convert KRWQ to USDC: rate unavailable');
    return null;
  }

  const usdcAmount = krwqAmount * rate;
  
  logger.info('Converted KRWQ to USDC', {
    krwqAmount,
    usdcAmount,
    rate
  });

  return usdcAmount;
}

/**
 * Convert USDC amount to KRWQ
 */
export async function convertUSDCToKRWQ(usdcAmount: number): Promise<number | null> {
  const rate = await getKRWQToUSDCRate();
  
  if (!rate) {
    logger.error('Cannot convert USDC to KRWQ: rate unavailable');
    return null;
  }

  const krwqAmount = usdcAmount / rate;
  
  logger.info('Converted USDC to KRWQ', {
    usdcAmount,
    krwqAmount,
    rate
  });

  return krwqAmount;
}

/**
 * Get current KRW/USD exchange rate (for UI display)
 */
export async function getKRWUSDRate(): Promise<number | null> {
  // Simplified: return hardcoded rate
  // In production, use a real KRW/USD Chainlink oracle or forex API
  const krwToUsd = 0.00075; // 1 USD ≈ 1,330 KRW
  
  logger.info('Fetched KRW/USD rate', { rate: krwToUsd });
  return krwToUsd;
}

/**
 * Format amount with currency symbol
 */
export function formatKRWQ(amount: number): string {
  return `₩${amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

/**
 * Format USDC amount
 */
export function formatUSDC(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Clear exchange rate cache (for testing or manual refresh)
 */
export function clearExchangeRateCache(): void {
  cache.clear();
  logger.info('Exchange rate cache cleared');
}
