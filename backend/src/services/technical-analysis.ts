/**
 * Technical Analysis Service
 * Provides RSI, MACD, and momentum signals for trading decisions
 */

import { logger } from '../utils/logger';

interface TechnicalSignals {
  rsi: number;
  rsiSignal: 'buy' | 'sell' | 'hold';
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  macdSignal: 'buy' | 'sell' | 'hold';
  momentum: number;
  overallSignal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) {
    throw new Error(`Need at least ${period + 1} prices for RSI`);
  }

  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  let avgGain = 0;
  let avgLoss = 0;

  // Initial averages
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // Smoothed RS
  for (let i = period; i < changes.length; i++) {
    if (changes[i] > 0) {
      avgGain = (avgGain * (period - 1) + changes[i]) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(changes[i])) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return Number(rsi.toFixed(2));
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26
): {
  macd: number;
  signal: number;
  histogram: number;
} {
  if (prices.length < slowPeriod) {
    throw new Error(`Need at least ${slowPeriod} prices for MACD`);
  }

  // Calculate EMAs
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  const macd = fastEMA - slowEMA;
  const signal = macd; // Simplified for demo
  const histogram = macd - signal;

  return {
    macd: Number(macd.toFixed(4)),
    signal: Number(signal.toFixed(4)),
    histogram: Number(histogram.toFixed(4))
  };
}

/**
 * Calculate EMA (Exponential Moving Average)
 */
function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;

  const multiplier = 2 / (period + 1);
  let ema = prices[0];

  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * Generate trading signals from technical indicators
 */
export function generateSignals(
  prices: number[],
  riskProfile: 'low' | 'medium' | 'high'
): TechnicalSignals {
  try {
    const rsi = calculateRSI(prices);
    const macd = calculateMACD(prices);

    // RSI signal
    let rsiSignal: 'buy' | 'sell' | 'hold' = 'hold';
    if (rsi < 30) rsiSignal = 'buy'; // Oversold
    else if (rsi > 70) rsiSignal = 'sell'; // Overbought

    // MACD signal
    let macdSignal: 'buy' | 'sell' | 'hold' = 'hold';
    if (macd.histogram > 0 && macd.macd > macd.signal) macdSignal = 'buy';
    else if (macd.histogram < 0 && macd.macd < macd.signal) macdSignal = 'sell';

    // Calculate momentum
    const momentum = calculateMomentum(prices, 10);

    // Overall signal based on risk profile
    const overallSignal = determineOverallSignal(
      rsiSignal,
      macdSignal,
      momentum,
      riskProfile
    );

    // Confidence based on indicator alignment
    const confidence = calculateConfidence(rsiSignal, macdSignal, momentum);

    return {
      rsi,
      rsiSignal,
      macd,
      macdSignal,
      momentum,
      overallSignal,
      confidence
    };

  } catch (error: any) {
    logger.error('Failed to generate signals', { error: error.message });
    return {
      rsi: 50,
      rsiSignal: 'hold',
      macd: { macd: 0, signal: 0, histogram: 0 },
      macdSignal: 'hold',
      momentum: 0,
      overallSignal: 'hold',
      confidence: 0
    };
  }
}

/**
 * Calculate momentum
 */
function calculateMomentum(prices: number[], period: number): number {
  if (prices.length < period) return 0;
  const current = prices[prices.length - 1];
  const past = prices[prices.length - period];
  return ((current - past) / past) * 100;
}

/**
 * Determine overall signal
 */
function determineOverallSignal(
  rsiSignal: string,
  macdSignal: string,
  momentum: number,
  riskProfile: 'low' | 'medium' | 'high'
): 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell' {
  // Conservative approach for low risk
  if (riskProfile === 'low') {
    if (rsiSignal === 'buy' && macdSignal === 'buy') return 'buy';
    if (rsiSignal === 'sell' || macdSignal === 'sell') return 'sell';
    return 'hold';
  }

  // Aggressive approach for high risk
  if (riskProfile === 'high') {
    if (rsiSignal === 'buy' && macdSignal === 'buy' && momentum > 5) return 'strong_buy';
    if (rsiSignal === 'buy' || macdSignal === 'buy') return 'buy';
    if (rsiSignal === 'sell' && macdSignal === 'sell' && momentum < -5) return 'strong_sell';
    if (rsiSignal === 'sell' || macdSignal === 'sell') return 'sell';
    return 'hold';
  }

  // Balanced approach for medium risk
  if (rsiSignal === 'buy' && macdSignal === 'buy') return 'strong_buy';
  if (rsiSignal === 'buy' || macdSignal === 'buy') return 'buy';
  if (rsiSignal === 'sell' && macdSignal === 'sell') return 'strong_sell';
  if (rsiSignal === 'sell' || macdSignal === 'sell') return 'sell';
  return 'hold';
}

/**
 * Calculate signal confidence
 */
function calculateConfidence(
  rsiSignal: string,
  macdSignal: string,
  momentum: number
): number {
  let score = 0;

  // Indicator alignment
  if (rsiSignal === macdSignal && rsiSignal !== 'hold') score += 50;
  else if (rsiSignal !== 'hold' || macdSignal !== 'hold') score += 25;

  // Momentum strength
  const momentumStrength = Math.min(Math.abs(momentum) / 10, 1);
  score += momentumStrength * 50;

  return Math.min(Math.round(score), 100);
}

/**
 * Fetch and analyze asset
 */
export async function analyzeAsset(
  asset: string,
  riskProfile: 'low' | 'medium' | 'high',
  historicalPrices?: number[]
): Promise<TechnicalSignals & { currentPrice: number }> {
  try {
    logger.info('Analyzing asset', { asset, riskProfile });

    // Simulate current price for testnet (Oracle fallback)
    const currentPrice = 2500 + Math.random() * 1000;

    // Use historical prices or simulate
    const priceHistory = historicalPrices || simulatePriceHistory(currentPrice, 50);

    const signals = generateSignals(priceHistory, riskProfile);

    return {
      ...signals,
      currentPrice
    };

  } catch (error: any) {
    logger.error('Failed to analyze asset', {
      error: error.message,
      asset
    });
    throw new Error(`Asset analysis failed: ${error.message}`);
  }
}

/**
 * Simulate price history for testing
 */
function simulatePriceHistory(currentPrice: number, periods: number): number[] {
  const prices: number[] = [];
  let price = currentPrice * 0.95; // Start 5% lower

  for (let i = 0; i < periods; i++) {
    const change = (Math.random() - 0.48) * 0.03; // Slight upward bias
    price *= (1 + change);
    prices.push(price);
  }

  // Ensure last price matches current
  prices[prices.length - 1] = currentPrice;

  return prices;
}

/**
 * Determine optimal rebalance timing
 */
export function shouldRebalance(
  currentAllocation: Record<string, number>,
  signals: Record<string, TechnicalSignals>
): {
  shouldRebalance: boolean;
  reason: string;
  suggestedAllocations?: Record<string, number>;
} {
  // Check if any asset has strong signals
  const strongSignals = Object.entries(signals).filter(([_, sig]) =>
    sig.overallSignal.includes('strong') && sig.confidence > 70
  );

  if (strongSignals.length === 0) {
    return { shouldRebalance: false, reason: 'No strong signals detected' };
  }

  return {
    shouldRebalance: true,
    reason: `Strong ${strongSignals[0][1].overallSignal} signal detected with ${strongSignals[0][1].confidence}% confidence`,
    suggestedAllocations: calculateSuggestedAllocations(signals, currentAllocation)
  };
}

/**
 * Calculate suggested allocations based on signals
 */
function calculateSuggestedAllocations(
  signals: Record<string, TechnicalSignals>,
  currentAllocation: Record<string, number>
): Record<string, number> {
  const suggested: Record<string, number> = { ...currentAllocation };

  // Adjust based on signals
  for (const [asset, signal] of Object.entries(signals)) {
    if (signal.overallSignal === 'strong_buy' && signal.confidence > 70) {
      suggested[asset] = Math.min((suggested[asset] || 0) + 10, 40);
    } else if (signal.overallSignal === 'strong_sell' && signal.confidence > 70) {
      suggested[asset] = Math.max((suggested[asset] || 0) - 10, 5);
    }
  }

  // Normalize to 100%
  const total = Object.values(suggested).reduce((sum, val) => sum + val, 0);
  for (const key in suggested) {
    suggested[key] = Math.round((suggested[key] / total) * 100);
  }

  return suggested;
}
