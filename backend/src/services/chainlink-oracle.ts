import { ethers } from 'ethers';
import { getProvider } from '../utils/rpc';
import logger from '../utils/logger';

/**
 * Chainlink Price Feed Oracle Reader for Base Mainnet
 * 
 * Base Mainnet price feeds:
 * - ETH/USD and USDC/USD feeds available
 * - Base is an L2, but we'll use direct price feeds
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

// Base Mainnet Price Feed Addresses
export const CHAINLINK_PRICE_FEEDS = {
  'ETH/USD': '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
  'USDC/USD': '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B',
  'DAI/USD': '0x591e79239a7d679378eC8c847e5038150364C78F',
  'USDT/USD': '0xf19d560eB8d2ADf07BD6D13ed03e1D11215721F9',
  'AAVE/USD': '0x65B5d02E1Fff839b8B67Fa26F8540e5f11454316',
  'WBTC/USD': '0xCCADC697c55bbB68dc5bCdf8d3CBe83CdD4E071E'
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
