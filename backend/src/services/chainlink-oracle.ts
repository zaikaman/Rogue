import { ethers } from 'ethers';
import { getProvider } from '../utils/rpc';
import logger from '../utils/logger';

/**
 * Chainlink Price Feed Oracle Reader for Polygon
 * 
 * Per research.md:
 * - USDC/USD: 0.25% deviation, ~27s heartbeat
 * - MATIC/USD: 0.5% deviation, ~30s heartbeat
 * - Polygon has NO L2 sequencer uptime feed (not an optimistic rollup)
 */

// Chainlink AggregatorV3Interface ABI
const AGGREGATOR_V3_INTERFACE_ABI = [
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'description',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint80', name: '_roundId', type: 'uint80' }],
    name: 'getRoundData',
    outputs: [
      { internalType: 'uint80', name: 'roundId', type: 'uint80' },
      { internalType: 'int256', name: 'answer', type: 'int256' },
      { internalType: 'uint256', name: 'startedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'updatedAt', type: 'uint256' },
      { internalType: 'uint80', name: 'answeredInRound', type: 'uint80' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { internalType: 'uint80', name: 'roundId', type: 'uint80' },
      { internalType: 'int256', name: 'answer', type: 'int256' },
      { internalType: 'uint256', name: 'startedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'updatedAt', type: 'uint256' },
      { internalType: 'uint80', name: 'answeredInRound', type: 'uint80' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
];

// Polygon Mainnet Price Feed Addresses (from research.md)
export const CHAINLINK_PRICE_FEEDS = {
  'USDC/USD': '0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7',
  'MATIC/USD': '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0',
  'WETH/USD': '0xF9680D99D6C9589e2a93a78A04A279e509205945',
  'DAI/USD': '0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D',
  'WBTC/USD': '0xc907E116054Ad103354f2D350FD2514433D57F6f',
  'AAVE/USD': '0x72484B12719E23115761D5DA1646945632979bB6'
};

// Heartbeat tolerances per risk profile (from research.md)
const STALENESS_TOLERANCES = {
  conservative: {
    stablecoin: 300, // 5 minutes beyond heartbeat
    major: 120, // 2 minutes beyond heartbeat
    defi: 60 // 1 minute beyond heartbeat
  },
  moderate: {
    stablecoin: 600, // 10 minutes
    major: 300, // 5 minutes
    defi: 180 // 3 minutes
  },
  aggressive: {
    stablecoin: 900, // 15 minutes
    major: 600, // 10 minutes
    defi: 300 // 5 minutes
  }
};

interface PriceData {
  price: string;
  decimals: number;
  updatedAt: number;
  roundId: string;
  isStale: boolean;
}

/**
 * Get latest price from Chainlink oracle
 */
export async function getChainlinkPrice(
  feedAddress: string,
  riskProfile: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
): Promise<PriceData | null> {
  try {
    const provider = getProvider();
    const priceFeed = new ethers.Contract(feedAddress, AGGREGATOR_V3_INTERFACE_ABI, provider);

    // Get latest round data
    const [roundId, answer, _startedAt, updatedAt, answeredInRound] = await priceFeed.latestRoundData();

    // Get decimals for price normalization
    const decimals = await priceFeed.decimals();

    // Validate price data
    if (answer <= 0) {
      logger.error('Invalid price data from Chainlink', {
        feedAddress,
        answer: answer.toString()
      });
      return null;
    }

    // Check staleness
    const currentTime = Math.floor(Date.now() / 1000);
    const dataAge = currentTime - Number(updatedAt);
    
    // Determine asset type for staleness tolerance
    const assetType = determineAssetType(feedAddress);
    const maxStaleness = STALENESS_TOLERANCES[riskProfile][assetType];
    const isStale = dataAge > maxStaleness;

    // Check if round is completed
    if (roundId > answeredInRound) {
      logger.warn('Chainlink round not completed', {
        feedAddress,
        roundId: roundId.toString(),
        answeredInRound: answeredInRound.toString()
      });
      return null;
    }

    const priceData: PriceData = {
      price: answer.toString(),
      decimals,
      updatedAt: Number(updatedAt),
      roundId: roundId.toString(),
      isStale
    };

    if (isStale) {
      logger.warn('Chainlink price data is stale', {
        feedAddress,
        dataAge,
        maxStaleness,
        riskProfile
      });
    }

    logger.info('Fetched Chainlink price', {
      feedAddress,
      price: ethers.formatUnits(answer, decimals),
      decimals,
      dataAge
    });

    return priceData;
  } catch (error: any) {
    logger.error('Failed to fetch Chainlink price', {
      error: error.message,
      feedAddress
    });
    return null;
  }
}

/**
 * Get price for specific asset pair (e.g., USDC/USD)
 */
export async function getAssetPrice(
  pair: keyof typeof CHAINLINK_PRICE_FEEDS,
  riskProfile: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
): Promise<number | null> {
  const feedAddress = CHAINLINK_PRICE_FEEDS[pair];
  
  if (!feedAddress) {
    logger.error('Unknown price feed pair', { pair });
    return null;
  }

  const priceData = await getChainlinkPrice(feedAddress, riskProfile);
  
  if (!priceData) {
    return null;
  }

  if (priceData.isStale) {
    logger.warn('Using stale price data', { pair, riskProfile });
    // In production, you might want to reject stale prices for high-risk operations
  }

  // Convert to decimal price
  const price = parseFloat(ethers.formatUnits(priceData.price, priceData.decimals));
  return price;
}

/**
 * Get multiple asset prices at once
 */
export async function getMultipleAssetPrices(
  pairs: Array<keyof typeof CHAINLINK_PRICE_FEEDS>,
  riskProfile: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();

  const pricePromises = pairs.map(async (pair) => {
    const price = await getAssetPrice(pair, riskProfile);
    if (price !== null) {
      prices.set(pair, price);
    }
  });

  await Promise.all(pricePromises);

  logger.info('Fetched multiple asset prices', {
    requested: pairs.length,
    fetched: prices.size
  });

  return prices;
}

/**
 * Validate price sanity (prevent flash crash exploits)
 * Per research.md: check for extreme deviations from last known good price
 */
export function validatePriceSanity(
  currentPrice: number,
  lastGoodPrice: number,
  maxDeviation: number = 0.5 // 50% max deviation
): boolean {
  if (currentPrice <= 0) {
    return false;
  }

  const deviation = Math.abs(currentPrice - lastGoodPrice) / lastGoodPrice;
  
  if (deviation > maxDeviation) {
    logger.error('Price sanity check failed', {
      currentPrice,
      lastGoodPrice,
      deviation: (deviation * 100).toFixed(2) + '%',
      maxDeviation: (maxDeviation * 100) + '%'
    });
    return false;
  }

  return true;
}

/**
 * Determine asset type for staleness tolerance
 */
function determineAssetType(feedAddress: string): 'stablecoin' | 'major' | 'defi' {
  const stablecoins = [
    CHAINLINK_PRICE_FEEDS['USDC/USD'],
    CHAINLINK_PRICE_FEEDS['DAI/USD']
  ];

  const majors = [
    CHAINLINK_PRICE_FEEDS['MATIC/USD'],
    CHAINLINK_PRICE_FEEDS['WETH/USD'],
    CHAINLINK_PRICE_FEEDS['WBTC/USD']
  ];

  if (stablecoins.includes(feedAddress)) {
    return 'stablecoin';
  } else if (majors.includes(feedAddress)) {
    return 'major';
  } else {
    return 'defi';
  }
}

/**
 * Health check for Chainlink oracles
 */
export async function checkChainlinkHealth(): Promise<boolean> {
  try {
    // Try to fetch USDC/USD price as health indicator
    const price = await getAssetPrice('USDC/USD', 'moderate');
    return price !== null && price > 0;
  } catch (error: any) {
    logger.error('Chainlink health check failed', { error: error.message });
    return false;
  }
}
