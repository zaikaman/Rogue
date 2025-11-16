# Research: The Graph Subgraph for Aave v3 on Polygon

## Overview
The Graph provides official Aave v3 subgraphs that index protocol data, enabling efficient GraphQL queries for yield rates, markets, liquidity, and user positions. This research covers implementation details for Rogue's Researcher agent.

## 1. Official Aave v3 Polygon Subgraph

### Endpoint URL
```
https://gateway.thegraph.com/api/subgraphs/id/6yuf1C49aWEscgk5n9D1DekeG1BCk5Z9imJYJT3sVmAT
```

**Subgraph ID**: `6yuf1C49aWEscgk5n9D1DekeG1BCk5Z9imJYJT3sVmAT`

### Authentication
- Queries require an API key in the `Authorization` header
- Format: `Authorization: Bearer {api-key}`
- API keys can be generated at: https://thegraph.com/explorer/dashboard

### Alternative Access
- Queries can be made via The Graph Explorer: https://thegraph.com/explorer/subgraphs/6yuf1C49aWEscgk5n9D1DekeG1BCk5Z9imJYJT3sVmAT

## 2. GraphQL Schema for Yield Rates

### Core Entities

#### Reserve Entity
Primary entity for market data including rates and liquidity:
```graphql
type Reserve {
  id: ID!
  symbol: String!
  name: String!
  decimals: Int!
  underlyingAsset: Bytes!
  
  # Yield Rates (in RAY units: 10^27)
  liquidityRate: BigInt!           # Deposit APR
  variableBorrowRate: BigInt!      # Variable borrow APR
  stableBorrowRate: BigInt!        # Stable borrow APR
  
  # Liquidity Metrics
  totalLiquidity: BigInt!
  availableLiquidity: BigInt!
  totalCurrentVariableDebt: BigInt!
  totalScaledVariableDebt: BigInt!
  
  # Price Data
  priceInUsd: BigDecimal!
  assetPriceUSD: BigDecimal!
  
  # Configuration
  isActive: Boolean!
  isFrozen: Boolean!
  borrowingEnabled: Boolean!
  
  # Utilization
  utilizationRate: BigDecimal!
  
  # Reserve Factor
  reserveFactor: BigInt!
  
  # Last update
  lastUpdateTimestamp: Int!
}
```

#### ReserveParamsHistoryItem Entity
For historical yield data:
```graphql
type ReserveParamsHistoryItem {
  id: ID!
  reserve: Reserve!
  timestamp: Int!
  
  # Historical rates
  liquidityRate: BigInt!
  variableBorrowRate: BigInt!
  stableBorrowRate: BigInt!
  
  # Historical liquidity
  totalLiquidity: BigInt!
  availableLiquidity: BigInt!
  utilizationRate: BigDecimal!
  priceInUsd: BigDecimal!
}
```

#### UserReserve Entity
For user position tracking:
```graphql
type UserReserve {
  id: ID!
  user: User!
  reserve: Reserve!
  
  # Balances (continuously increasing due to interest)
  currentATokenBalance: BigInt!
  currentVariableDebt: BigInt!
  currentStableDebt: BigInt!
  
  # Scaled balances (normalized)
  scaledATokenBalance: BigInt!
  scaledVariableDebt: BigInt!
  
  # Interest rates
  liquidityRate: BigInt!
  variableBorrowRate: BigInt!
  stableBorrowRate: BigInt!
  
  # Timestamps
  lastUpdateTimestamp: Int!
}
```

### Rate Conversion Formula
**CRITICAL**: All rates are in RAY units (10^27) and represent APR, not APY.

Convert to APY percentage:
```javascript
// From RAY APR to APY percentage
const RAY = 10 ** 27;
const SECONDS_PER_YEAR = 31536000;

function rayAprToApy(liquidityRate) {
  const apr = liquidityRate / RAY;
  const apy = (Math.pow(1 + (apr / SECONDS_PER_YEAR), SECONDS_PER_YEAR) - 1) * 100;
  return apy;
}

// Example:
// liquidityRate = 32847953230937500000000000 (RAY)
// APY = ~3.34%
```

## 3. Query Patterns

### A. Fetch Current APY for USDC Deposits

```graphql
query GetUSDCDepositAPY {
  reserves(where: { symbol: "USDC" }) {
    id
    symbol
    name
    decimals
    liquidityRate
    variableBorrowRate
    stableBorrowRate
    availableLiquidity
    totalLiquidity
    utilizationRate
    priceInUsd
    lastUpdateTimestamp
  }
}
```

**Response Processing**:
```javascript
const reserve = data.reserves[0];
const depositAPY = rayAprToApy(reserve.liquidityRate);
const variableBorrowAPY = rayAprToApy(reserve.variableBorrowRate);
```

### B. List All Available Markets with Liquidity

```graphql
query GetAllMarkets {
  reserves(
    where: { isActive: true }
    orderBy: totalLiquidity
    orderDirection: desc
    first: 100
  ) {
    id
    symbol
    name
    decimals
    
    # Rates
    liquidityRate
    variableBorrowRate
    stableBorrowRate
    
    # Liquidity
    totalLiquidity
    availableLiquidity
    utilizationRate
    
    # Price
    priceInUsd
    
    # Config
    borrowingEnabled
    isFrozen
    
    # Supply/Borrow Caps
    supplyCap
    borrowCap
    
    lastUpdateTimestamp
  }
}
```

### C. Get Historical Yield Rates Over Time

```graphql
query GetHistoricalYieldRates($symbol: String!, $startTime: Int!, $endTime: Int!) {
  reserveParamsHistoryItems(
    where: {
      reserve_: { symbol: $symbol }
      timestamp_gte: $startTime
      timestamp_lte: $endTime
    }
    orderBy: timestamp
    orderDirection: asc
    first: 1000
  ) {
    id
    timestamp
    liquidityRate
    variableBorrowRate
    stableBorrowRate
    totalLiquidity
    availableLiquidity
    utilizationRate
    priceInUsd
  }
}
```

**Variables**:
```json
{
  "symbol": "USDC",
  "startTime": 1699920000,
  "endTime": 1700006400
}
```

### D. Track User Positions

```graphql
query GetUserPosition($userAddress: String!) {
  userReserves(
    where: { 
      user: $userAddress
      currentATokenBalance_gt: 0
    }
  ) {
    id
    reserve {
      symbol
      name
      decimals
      priceInUsd
      liquidityRate
    }
    currentATokenBalance
    currentVariableDebt
    currentStableDebt
    scaledATokenBalance
    liquidityRate
    lastUpdateTimestamp
  }
}
```

**Variables**:
```json
{
  "userAddress": "0x742d35cc6634c0532925a3b844bc454e4438f44e"
}
```

### E. User Transaction History

```graphql
query GetUserTransactions($userAddress: String!) {
  userTransactions(
    where: { user: $userAddress }
    orderBy: timestamp
    orderDirection: desc
    first: 100
  ) {
    id
    timestamp
    txHash
    action
    
    ... on Supply {
      amount
      reserve {
        symbol
        decimals
      }
      assetPriceUSD
    }
    
    ... on Borrow {
      amount
      borrowRateMode
      borrowRate
      reserve {
        symbol
        decimals
      }
      assetPriceUSD
    }
    
    ... on Repay {
      amount
      reserve {
        symbol
        decimals
      }
      assetPriceUSD
    }
  }
}
```

## 4. Historical Data Access

### Block-Based Queries
Query historical state at specific block:
```graphql
query GetHistoricalReserves($blockNumber: Int!) {
  reserves(
    block: { number: $blockNumber }
  ) {
    symbol
    liquidityRate
    variableBorrowRate
    totalLiquidity
  }
}
```

### Time-Series Analysis
For historical yield trends:
1. Query `reserveParamsHistoryItems` with time range
2. The subgraph creates entries on parameter changes
3. Use `timestamp` field to filter and sort
4. Maximum 1000 items per query (use pagination)

### Pagination for Large Datasets
```graphql
# First batch
query GetHistoricalData_Batch1 {
  reserveParamsHistoryItems(
    where: { reserve_: { symbol: "USDC" } }
    orderBy: timestamp
    orderDirection: asc
    first: 100
    skip: 0
  ) {
    timestamp
    liquidityRate
  }
}

# Second batch
query GetHistoricalData_Batch2 {
  reserveParamsHistoryItems(
    where: { reserve_: { symbol: "USDC" } }
    orderBy: timestamp
    orderDirection: asc
    first: 100
    skip: 100
  ) {
    timestamp
    liquidityRate
  }
}
```

**Limitation**: Maximum skip value is 5000. For larger datasets, use time-based filtering instead.

## 5. Real-Time Event Subscriptions

### Current State
The Graph **does not natively support GraphQL subscriptions** for real-time updates. The standard subgraph queries are read-only HTTP/POST requests.

### Alternative Approaches for Real-Time Data

#### A. Polling Strategy
```javascript
// Poll every 30 seconds for rate updates
setInterval(async () => {
  const data = await querySubgraph(`
    query GetLatestRates {
      reserves(where: { symbol_in: ["USDC", "WETH", "WMATIC"] }) {
        symbol
        liquidityRate
        lastUpdateTimestamp
      }
    }
  `);
  
  processRateUpdates(data);
}, 30000);
```

#### B. Event Monitoring via Blockchain
For truly real-time updates, monitor on-chain events:
- Listen to `ReserveDataUpdated` events from Aave Pool contract
- Fallback to subgraph for historical/aggregate data
- Hybrid approach: Events for real-time + Subgraph for queries

#### C. WebSocket Alternative
Some third-party services offer WebSocket endpoints for The Graph subgraphs, but official support is limited to HTTP queries.

## 6. Implementation Notes for Rogue Researcher

### Data Freshness
- Subgraph data is indexed continuously but has slight delay (typically 1-2 blocks)
- `lastUpdateTimestamp` indicates when reserve data was last updated
- For critical decisions, consider querying both subgraph + direct contract calls

### Rate Calculation Caveats
⚠️ **IMPORTANT**: Rates require real-time calculation
- `liquidityRate` is stored as snapshot at indexing time
- Interest accrues continuously between blocks
- For accurate user balances, apply rate compounding from `lastUpdateTimestamp`

### Recommended Query Strategy
1. **Market Discovery**: Query all active reserves once at startup
2. **Rate Monitoring**: Poll USDC/WETH/WMATIC reserves every 30-60 seconds
3. **Historical Analysis**: Use `reserveParamsHistoryItems` for trend analysis
4. **User Positions**: Query on-demand when analyzing specific wallets

### Performance Optimization
- Use field selection to minimize response size
- Implement caching for infrequently changing data (reserve configs)
- Batch related queries in single request
- Use `first` and `skip` for pagination
- Filter early in `where` clause to reduce processing

### Error Handling
```javascript
try {
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({ query, variables })
  });
  
  const result = await response.json();
  
  if (result.errors) {
    console.error('GraphQL Errors:', result.errors);
    // Fallback strategy
  }
  
  return result.data;
} catch (error) {
  console.error('Network Error:', error);
  // Retry logic
}
```

## 7. Comparison: Subgraph vs Direct Contract Calls

| Aspect | The Graph Subgraph | Direct Contract Calls |
|--------|-------------------|---------------------|
| **Speed** | Fast (indexed) | Slower (RPC calls) |
| **Historical Data** | Excellent | Limited |
| **Real-time** | ~1-2 block delay | Current block |
| **Aggregations** | Easy (GraphQL) | Complex |
| **Cost** | API limits | RPC rate limits + gas |
| **Reliability** | Dependent on indexers | Dependent on RPC node |

**Recommendation**: Use hybrid approach
- Subgraph for historical analysis and market discovery
- Direct calls for final execution verification

## 8. Example Implementation

```typescript
import { GraphQLClient } from 'graphql-request';

const AAVE_V3_POLYGON_SUBGRAPH = 'https://gateway.thegraph.com/api/subgraphs/id/6yuf1C49aWEscgk5n9D1DekeG1BCk5Z9imJYJT3sVmAT';

class AaveSubgraphClient {
  private client: GraphQLClient;
  
  constructor(apiKey: string) {
    this.client = new GraphQLClient(AAVE_V3_POLYGON_SUBGRAPH, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
  }
  
  async getCurrentYields(symbols: string[]) {
    const query = `
      query GetYields($symbols: [String!]!) {
        reserves(where: { symbol_in: $symbols, isActive: true }) {
          symbol
          liquidityRate
          variableBorrowRate
          availableLiquidity
          totalLiquidity
          utilizationRate
          priceInUsd
          lastUpdateTimestamp
        }
      }
    `;
    
    const data = await this.client.request(query, { symbols });
    
    return data.reserves.map(reserve => ({
      symbol: reserve.symbol,
      depositAPY: this.rayAprToApy(reserve.liquidityRate),
      borrowAPY: this.rayAprToApy(reserve.variableBorrowRate),
      liquidity: reserve.availableLiquidity,
      utilization: parseFloat(reserve.utilizationRate),
      priceUsd: parseFloat(reserve.priceInUsd),
      timestamp: reserve.lastUpdateTimestamp
    }));
  }
  
  private rayAprToApy(rate: string): number {
    const RAY = 1e27;
    const SECONDS_PER_YEAR = 31536000;
    const apr = parseFloat(rate) / RAY;
    return (Math.pow(1 + (apr / SECONDS_PER_YEAR), SECONDS_PER_YEAR) - 1) * 100;
  }
}

// Usage
const client = new AaveSubgraphClient(process.env.GRAPH_API_KEY);
const yields = await client.getCurrentYields(['USDC', 'WETH', 'WMATIC']);
console.log('Current USDC deposit APY:', yields[0].depositAPY.toFixed(2) + '%');
```

## 9. Key Takeaways

✅ **Strengths**
- Rich historical data via `reserveParamsHistoryItems`
- Complex filtering and aggregation with GraphQL
- User position tracking across all markets
- Transaction history with detailed event data
- Block-based time-travel queries

⚠️ **Limitations**
- No native WebSocket/subscription support (use polling)
- Rates in RAY units require conversion to APY
- Slight indexing delay (1-2 blocks)
- Pagination limited to 5000 skip maximum
- API key required for production use

🎯 **Best For**
- Historical yield analysis
- Market discovery and filtering
- Portfolio tracking
- Aggregate statistics
- Batch data retrieval

## 10. Additional Resources

- **Official Subgraph Explorer**: https://thegraph.com/explorer/subgraphs/6yuf1C49aWEscgk5n9D1DekeG1BCk5Z9imJYJT3sVmAT
- **Aave Subgraph Repository**: https://github.com/aave/protocol-subgraphs
- **The Graph Documentation**: https://thegraph.com/docs/en/
- **Aave Utilities Library**: For rate formatting and calculations
- **API Key Management**: https://thegraph.com/explorer/dashboard

---

**Research Completed**: November 16, 2025  
**Target Integration**: Rogue Researcher Agent  
**Network**: Polygon (Aave v3)  
**Status**: Production Ready
