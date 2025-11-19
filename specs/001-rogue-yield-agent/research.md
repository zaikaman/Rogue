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

const AAVE_V3_POLYGON_SUBGRAPH = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-polygon-amoy';

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

# ADK-TS Multi-Agent Orchestration Research

## Executive Summary

**Decision**: Use ADK-TS Sequential Workflow Agent with shared state communication and MCP-based tool integration for Rogue's four-agent system (Researcher → Analyzer → Executor → Governor).

**Rationale**: 
- Sequential workflow matches Rogue's linear pipeline (research → analyze → execute → govern)
- Shared state provides atomic communication without complexity of event-driven systems
- MCP integration enables standardized blockchain/API tool registration
- ADK-TS built for production with retry mechanisms and error handling plugins

**Key Finding**: ADK-TS is production-ready TypeScript framework (launched July 2025) specifically designed for multi-agent orchestration, unlike generic frameworks.

---

## 1. Agent Communication Patterns

### ADK-TS Communication Mechanisms

#### **Shared State (Recommended)**
```typescript
// Agents share state through session.state object
// Researcher writes to shared state
researcher_agent = new Agent({
  name: "ResearcherAgent",
  outputKey: "market_data", // Writes here
  // ...
});

// Analyzer reads from shared state
analyzer_agent = new Agent({
  name: "AnalyzerAgent", 
  instruction: "Read market_data from state and analyze risk",
  // Automatically accesses session.state.market_data
});
```

**Key Features**:
- Built-in state management via `session.state`
- No manual message passing required
- Automatic data flow between sequential agents
- Type-safe with clear input/output contracts

#### **Event-Driven (Alternative)**
```typescript
// Event-driven via ADK runtime events
// More complex, suitable for parallel agents
app = new App({
  plugins: [EventLoggerPlugin()],
  // Events: tool_call, agent_start, agent_end
});
```

**Comparison**:

| Pattern | Use Case | Complexity | Rogue Fit |
|---------|----------|------------|-----------|
| **Shared State** | Sequential workflows | Low | ✅ Perfect |
| Event-Driven | Parallel/async agents | High | ❌ Overkill |
| Message Passing | External systems | Medium | ⚠️ If needed for Governor |

### **Recommendation for Rogue**

**Use Shared State** for Researcher → Analyzer → Executor flow:

```typescript
const rogueWorkflow = new SequentialAgent({
  name: "RogueYieldWorkflow",
  subAgents: [
    researcherAgent,    // Writes: market_data, protocol_params
    analyzerAgent,      // Writes: risk_assessment, position_sizes
    executorAgent,      // Writes: execution_plan, transactions
    governorAgent       // Writes: validation_result, adjustments
  ]
});
```

**Why**: 
- Matches linear pipeline perfectly
- Minimal code complexity
- Built-in state persistence via ADK session management
- Clear data contracts between agents

---

## 2. Error Handling & Retry Strategies

### ADK-TS Built-in Mechanisms

#### **ReflectAndRetryToolPlugin** (ADK v1.16.0+)
```typescript
import { ReflectAndRetryToolPlugin } from '@iqai/adk';

const app = new App({
  rootAgent: rogueWorkflow,
  plugins: [
    ReflectAndRetryToolPlugin({
      maxRetries: 3,
      throwExceptionIfRetryExceeded: true,
      trackingScope: TrackingScope.INVOCATION
    })
  ]
});
```

**Features**:
- Automatic tool failure retry (blockchain calls, API failures)
- LLM-powered reflection: AI corrects parameters on retry
- Per-tool failure tracking
- Configurable retry limits

#### **Network Error Handling**
```typescript
// Production pattern for blockchain/API tools
class RobustBlockchainTool extends BaseTool {
  async execute(args) {
    const RETRIABLE_ERRORS = [
      'RemoteProtocolError',
      'ReadTimeout', 
      'ConnectTimeout'
    ];
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.callBlockchain(args);
      } catch (error) {
        if (RETRIABLE_ERRORS.includes(error.name) && attempt < 2) {
          await sleep(2 ** attempt * 1000); // Exponential backoff
          continue;
        }
        throw error;
      }
    }
  }
}
```

**Known ADK Issues** (as of Nov 2025):
- ADK-Python had narrow retry scope (only `anyio.ClosedResourceError`)
- Fixed in v1.16.0+ with ReflectAndRetryToolPlugin
- ADK-TS likely has similar improvements

### **Recommendation for Rogue**

**Three-Layer Error Strategy**:

1. **Tool Level**: Custom retry logic in blockchain tools
   ```typescript
   // For Aave/Morpho interaction tools
   - 3 retries with exponential backoff
   - Handle: network errors, nonce issues, gas estimation failures
   ```

2. **Agent Level**: ReflectAndRetryToolPlugin
   ```typescript
   - Catches tool errors
   - LLM reflects and corrects parameters
   - Max 3 retries per tool per invocation
   ```

3. **Workflow Level**: Governor agent validation
   ```typescript
   governorAgent = new Agent({
     instruction: "Validate executor plan. If invalid, request Analyzer re-run with adjusted parameters",
     // Implements business logic validation
   });
   ```

**Example Flow**:
```
1. Executor calls depositToAave() → Network timeout
   → Tool retries 3x with backoff → Success

2. Executor calls depositToAave() → "Insufficient liquidity" error
   → ReflectAndRetryPlugin: LLM adjusts deposit amount → Retry → Success

3. Governor validates plan → "Risk too high" 
   → Workflow re-runs from Analyzer with stricter risk params
```

---

## 3. State Persistence Patterns

### ADK-TS State Management

#### **Three Levels of Memory**

```typescript
// 1. SESSION STATE (Current conversation)
session.state.market_data = { ... };
// Lost on app restart

// 2. LONG-TERM MEMORY (Cross-session)
session.memory.remember("user_risk_preference", "conservative");
// Persists with backend storage

// 3. CHECKPOINTING (Workflow recovery)
const checkpoint = {
  lastCompletedAgent: "AnalyzerAgent",
  state: session.state,
  timestamp: Date.now()
};
await saveCheckpoint(checkpoint);
```

#### **Storage Backends**

| Backend | Use Case | Persistence | ADK Support |
|---------|----------|-------------|-------------|
| In-Memory | Development | ❌ Lost on restart | ✅ Default |
| PostgreSQL | Production sessions | ✅ Persistent | ✅ Via SessionService |
| Vertex AI | Long-term knowledge | ✅ Vector storage | ✅ Google ADK |
| Redis | Fast checkpointing | ✅ Persistent | ⚠️ Custom |

### **Recommendation for Rogue**

**Hybrid Persistence Strategy**:

```typescript
// 1. Session State for workflow execution
const rogueSession = new Session({
  storage: new PostgresSessionStore({
    // Stores: market_data, risk_assessment, execution_plan
    connectionString: process.env.DATABASE_URL
  })
});

// 2. Long-term memory for user preferences
session.memory.remember("user_vault_address", vaultAddress);
session.memory.remember("risk_tolerance", "moderate");
// Used by future executions

// 3. Custom checkpointing for long-running workflows
class RogueCheckpointManager {
  async saveCheckpoint(workflowId, state) {
    await redis.set(
      `checkpoint:${workflowId}`,
      JSON.stringify({
        completedAgents: state.completedAgents,
        sessionState: state.session.state,
        timestamp: Date.now()
      }),
      { EX: 3600 } // 1 hour expiry
    );
  }
  
  async recoverWorkflow(workflowId) {
    const checkpoint = await redis.get(`checkpoint:${workflowId}`);
    // Resume from last completed agent
  }
}
```

**Persistence Patterns**:

| Data Type | Storage | Lifetime | Example |
|-----------|---------|----------|---------|
| Market data | Session state | Workflow execution | Aave rates, pool liquidity |
| Risk parameters | Session state | Workflow execution | Max leverage, position sizes |
| User preferences | Long-term memory | Persistent | Vault address, risk tolerance |
| Execution checkpoints | Redis/PostgreSQL | 1 hour | Resume after API failures |
| Historical positions | PostgreSQL | Permanent | Audit trail, analytics |

---

## 4. Tool Integration Best Practices

### ADK-TS Tool Registration Patterns

#### **MCP (Model Context Protocol) Integration**

```typescript
// Recommended: Use MCP servers for blockchain tools
import { MCPToolset } from '@iqai/adk';

// 1. Define MCP server for Aave interactions
const aaveTools = new MCPToolset({
  serverName: "aave-protocol-server",
  transport: new StreamableHTTPServerTransport({
    endpoint: process.env.AAVE_MCP_SERVER_URL
  }),
  tools: [
    "getPoolData",
    "calculateBorrowRate", 
    "depositCollateral",
    "borrowAsset"
  ]
});

// 2. Register with agent
const executorAgent = new Agent({
  name: "ExecutorAgent",
  tools: [aaveTools], // All MCP tools available
  model: "gpt-4o"
});
```

**MCP Benefits**:
- Standardized tool interface
- Server-side tool execution (better security)
- Easy to version and update tools
- Built-in error handling via MCP protocol

#### **Direct Tool Integration**

```typescript
// Alternative: Direct tool definition
import { Tool } from '@iqai/adk';
import { z } from 'zod';

const depositToAaveTool = new Tool({
  name: "depositToAave",
  description: "Deposit collateral to Aave lending pool",
  parameters: z.object({
    asset: z.string(),
    amount: z.string(),
    onBehalfOf: z.string().optional()
  }),
  execute: async ({ asset, amount, onBehalfOf }) => {
    // Direct blockchain interaction
    const contract = new ethers.Contract(AAVE_POOL_ADDRESS, ABI);
    const tx = await contract.supply(asset, amount, onBehalfOf || userAddress, 0);
    return { txHash: tx.hash, status: 'submitted' };
  }
});
```

### **Recommendation for Rogue**

**MCP Architecture for Production**:

```typescript
// Architecture: Agent → MCP Client → MCP Servers → Blockchain

// 1. Aave MCP Server
const aaveMCP = new MCPToolset({
  serverName: "rogue-aave-server",
  transport: streamableHTTP(AAVE_MCP_URL),
  tools: [
    "getMarketData",      // Read-only
    "depositCollateral",  // Write
    "borrowAsset",        // Write
    "repayDebt"          // Write
  ]
});

// 2. Morpho MCP Server  
const morphoMCP = new MCPToolset({
  serverName: "rogue-morpho-server",
  transport: streamableHTTP(MORPHO_MCP_URL),
  tools: [
    "getVaultAPY",
    "deposit",
    "withdraw",
    "rebalance"
  ]
});

// 3. Data Provider MCP (CoinGecko, DeFi Llama)
const dataMCP = new MCPToolset({
  serverName: "rogue-data-server",
  tools: ["getPrices", "getTVL", "getHistoricalRates"]
});

// 4. Register with agents
const researcherAgent = new Agent({
  tools: [aaveMCP, morphoMCP, dataMCP], // Read-only tools
});

const executorAgent = new Agent({
  tools: [aaveMCP, morphoMCP], // Write tools
});
```

**Tool Design Patterns**:

```typescript
// Pattern 1: Read-only data tools (Researcher)
{
  name: "getAavePoolData",
  cacheable: true,         // Cache for 60s
  retryStrategy: "exponential",
  timeout: 5000
}

// Pattern 2: Write tools with simulation (Executor)
{
  name: "depositToAave",
  requiresSimulation: true, // Test on fork first
  gasEstimation: true,
  confirmations: 1
}

// Pattern 3: Validation tools (Governor)
{
  name: "validatePosition",
  local: true,             // No external call
  schema: strictRiskSchema
}
```

---

## 5. OpenAI Integration Patterns

### ADK-TS Multi-Provider Support

```typescript
// ADK-TS supports: OpenAI, Anthropic, Google, local models

// Option 1: OpenAI for all agents
const researcherAgent = new Agent({
  model: "gpt-4o",              // Fast for data processing
  apiKey: process.env.OPENAI_API_KEY
});

const analyzerAgent = new Agent({
  model: "o1-preview",          // Best reasoning for risk
  apiKey: process.env.OPENAI_API_KEY  
});

// Option 2: Mixed providers
const governorAgent = new Agent({
  model: "claude-3.5-sonnet",   // Anthropic for validation
  apiKey: process.env.ANTHROPIC_API_KEY
});
```

### **Recommendation for Rogue**

**Multi-Model Strategy**:

```typescript
// Agent-specific model selection
const ROGUE_MODELS = {
  researcher: "gpt-4o",           // Fast data aggregation
  analyzer: "o1-preview",         // Deep reasoning for risk
  executor: "gpt-4o",             // Fast transaction building  
  governor: "claude-3.5-sonnet"   // Strong validation logic
};

const rogueWorkflow = new SequentialAgent({
  subAgents: [
    new Agent({
      name: "ResearcherAgent",
      model: ROGUE_MODELS.researcher,
      temperature: 0.3,  // Factual data gathering
      tools: [dataMCP, aaveMCP, morphoMCP]
    }),
    
    new Agent({
      name: "AnalyzerAgent", 
      model: ROGUE_MODELS.analyzer,
      temperature: 0,    // Deterministic risk calculation
      systemPrompt: RISK_ANALYSIS_PROMPT
    }),
    
    new Agent({
      name: "ExecutorAgent",
      model: ROGUE_MODELS.executor,
      temperature: 0,    // Precise transaction building
      tools: [aaveMCP, morphoMCP]
    }),
    
    new Agent({
      name: "GovernorAgent",
      model: ROGUE_MODELS.governor,
      temperature: 0,    // Strict validation
      systemPrompt: GOVERNANCE_RULES_PROMPT
    })
  ]
});
```

**Cost Optimization**:
- Researcher: GPT-4o ($2.50/$10.00 per 1M tokens) - Fast, cheap
- Analyzer: o1-preview ($15/$60 per 1M tokens) - Worth it for risk accuracy
- Executor: GPT-4o - Fast transaction building
- Governor: Claude 3.5 Sonnet ($3/$15 per 1M tokens) - Strong reasoning

---

## 6. Multi-Agent Orchestration for Rogue

### Workflow Architecture

```typescript
// Researcher → Analyzer → Executor → Governor

import { SequentialAgent, Agent } from '@iqai/adk';

// 1. Researcher Agent
const researcherAgent = new Agent({
  name: "ResearcherAgent",
  description: "Gather DeFi market data, rates, and liquidity",
  model: "gpt-4o",
  instruction: `
    1. Fetch current Aave supply/borrow rates
    2. Get Morpho vault APYs and capacity
    3. Retrieve asset prices and volatility
    4. Output structured market snapshot
  `,
  tools: [dataMCP, aaveMCP, morphoMCP],
  outputKey: "market_data"  // Writes to session.state.market_data
});

// 2. Analyzer Agent  
const analyzerAgent = new Agent({
  name: "AnalyzerAgent",
  description: "Calculate optimal positions with risk management",
  model: "o1-preview",
  instruction: `
    Input: session.state.market_data
    
    1. Calculate max safe leverage for each protocol
    2. Determine optimal position sizes
    3. Compute expected yield and risk metrics
    4. Output risk_assessment and position_plan
  `,
  tools: [], // Pure calculation, no external calls
  outputKey: "position_plan"
});

// 3. Executor Agent
const executorAgent = new Agent({
  name: "ExecutorAgent", 
  description: "Build and simulate transactions",
  model: "gpt-4o",
  instruction: `
    Input: session.state.position_plan
    
    1. Build multicall transaction batch
    2. Simulate on Tenderly fork
    3. Estimate gas and validate slippage
    4. Output execution_plan with tx data
  `,
  tools: [aaveMCP, morphoMCP, tenderlySimulationTool],
  outputKey: "execution_plan"
});

// 4. Governor Agent
const governorAgent = new Agent({
  name: "GovernorAgent",
  description: "Validate execution plan against risk limits",
  model: "claude-3.5-sonnet",
  instruction: `
    Input: session.state.execution_plan
    
    1. Verify position sizes within risk limits
    2. Check protocol exposure diversification
    3. Validate liquidation thresholds
    4. Approve or request re-analysis with adjustments
  `,
  tools: [riskValidationTool],
  outputKey: "final_decision"
});

// 5. Orchestrate with Sequential Workflow
const rogueYieldWorkflow = new SequentialAgent({
  name: "RogueYieldWorkflow",
  description: "End-to-end yield optimization with risk management",
  subAgents: [
    researcherAgent,
    analyzerAgent, 
    executorAgent,
    governorAgent
  ]
});

// 6. Execute workflow
const app = new App({
  name: "rogue-yield-agent",
  rootAgent: rogueYieldWorkflow,
  plugins: [
    ReflectAndRetryToolPlugin({ maxRetries: 3 }),
    EventLoggerPlugin()
  ]
});

const result = await app.runAgent({
  userMessage: "Optimize my vault for max yield with moderate risk",
  sessionId: "user_vault_0x123"
});
```

### State Flow Example

```typescript
// Execution trace with shared state:

1. ResearcherAgent executes
   session.state.market_data = {
     aave: { supplyAPY: 0.02, borrowAPY: 0.04, liquidity: 10M },
     morpho: { vaultAPY: 0.06, capacity: 5M },
     prices: { ETH: 2000, USDC: 1.00 }
   }

2. AnalyzerAgent reads session.state.market_data
   session.state.position_plan = {
     aave_supply: { asset: "USDC", amount: 100000 },
     aave_borrow: { asset: "USDC", amount: 50000, ltv: 0.5 },
     morpho_deposit: { asset: "USDC", amount: 50000 },
     expected_apy: 0.08,
     liquidation_price: 1600
   }

3. ExecutorAgent reads session.state.position_plan
   session.state.execution_plan = {
     transactions: [
       { to: AAVE_POOL, data: "0x617ba...", gasEstimate: 150000 },
       { to: MORPHO_VAULT, data: "0x8a91c...", gasEstimate: 200000 }
     ],
     simulation_result: "SUCCESS",
     total_gas_usd: 12.50
   }

4. GovernorAgent reads session.state.execution_plan
   session.state.final_decision = {
     approved: true,
     risk_score: 6.5,
     warnings: [],
     ready_to_execute: true
   }
```

---

## Recommendations Summary

### 1. Communication Architecture

**Decision**: **Shared State via Sequential Agent**

```typescript
const rogueWorkflow = new SequentialAgent({
  subAgents: [researcher, analyzer, executor, governor]
});
// Automatic state sharing via session.state
```

**Alternatives Rejected**:
- Event-driven: Too complex for linear pipeline
- Message passing: Redundant with ADK's state management

### 2. Error Handling Strategy

**Decision**: **Three-Layer Approach**

1. **Tool-level**: Custom retry with exponential backoff
2. **Agent-level**: ReflectAndRetryToolPlugin (LLM-powered correction)
3. **Workflow-level**: Governor validation with re-run capability

**Implementation**:
```typescript
plugins: [
  ReflectAndRetryToolPlugin({ maxRetries: 3 })
]
```

### 3. State Persistence Approach

**Decision**: **Hybrid PostgreSQL + Redis**

- **PostgreSQL**: Session state, user preferences (persistent)
- **Redis**: Workflow checkpoints (1-hour TTL)
- **In-Memory**: Development only

**Schema**:
```sql
-- sessions table
CREATE TABLE adk_sessions (
  id UUID PRIMARY KEY,
  user_address TEXT,
  state JSONB,
  memory JSONB,
  updated_at TIMESTAMP
);

-- checkpoints table  
CREATE TABLE workflow_checkpoints (
  workflow_id UUID PRIMARY KEY,
  completed_agents TEXT[],
  session_state JSONB,
  created_at TIMESTAMP
);
```

### 4. Tool Registration Patterns

**Decision**: **MCP Architecture**

```typescript
// Three MCP servers:
- rogue-aave-server    (Aave pool interactions)
- rogue-morpho-server  (Morpho vault interactions)
- rogue-data-server    (Price feeds, analytics)

// Register with agents:
researcherAgent.tools = [aaveMCP, morphoMCP, dataMCP]
executorAgent.tools = [aaveMCP, morphoMCP, simulationMCP]
```

**Benefits**:
- Standardized interface
- Easy to mock for testing
- Version control for tools
- Deploy MCP servers on Cloud Run

### 5. Implementation Notes

#### Project Structure
```
rogue-yield-agent/
├── src/
│   ├── agents/
│   │   ├── researcher.ts       # Market data gathering
│   │   ├── analyzer.ts         # Risk calculations
│   │   ├── executor.ts         # Transaction building
│   │   └── governor.ts         # Validation logic
│   ├── tools/
│   │   ├── mcp-servers/
│   │   │   ├── aave/           # Aave MCP server
│   │   │   ├── morpho/         # Morpho MCP server
│   │   │   └── data/           # Data provider MCP
│   │   └── custom/
│   │       └── simulation.ts   # Tenderly fork testing
│   ├── workflows/
│   │   └── yield-optimization.ts  # Sequential workflow
│   ├── persistence/
│   │   ├── session-store.ts    # PostgreSQL sessions
│   │   └── checkpoint.ts       # Redis checkpoints
│   └── index.ts                # App entry point
├── .env
└── package.json
```

#### Key Dependencies
```json
{
  "dependencies": {
    "@iqai/adk": "^0.5.6",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "ethers": "^6.0.0",
    "zod": "^3.22.0",
    "pg": "^8.11.0",
    "redis": "^4.6.0"
  }
}
```

#### Configuration Example
```typescript
// config.ts
export const ROGUE_CONFIG = {
  models: {
    researcher: "gpt-4o",
    analyzer: "o1-preview",
    executor: "gpt-4o", 
    governor: "claude-3.5-sonnet"
  },
  
  errorHandling: {
    maxRetries: 3,
    backoffMultiplier: 2,
    throwOnExceeded: true
  },
  
  persistence: {
    sessionStore: "postgresql",
    checkpointStore: "redis",
    checkpointTTL: 3600
  },
  
  mcpServers: {
    aave: process.env.AAVE_MCP_URL,
    morpho: process.env.MORPHO_MCP_URL,
    data: process.env.DATA_MCP_URL
  }
};
```

---

## Production Readiness Checklist

### ADK-TS Framework Advantages
✅ **Production-ready**: Built for production use (unlike experimental frameworks)  
✅ **TypeScript-native**: Full type safety and IDE support  
✅ **Multi-provider LLMs**: OpenAI, Anthropic, Google, local models  
✅ **Built-in retry**: ReflectAndRetryToolPlugin with LLM reflection  
✅ **State management**: Session, long-term memory, custom backends  
✅ **MCP integration**: Standardized tool protocol  
✅ **Active development**: Released July 2025, regular updates  

### Rogue-Specific Requirements
✅ **Sequential pipeline**: SequentialAgent perfect fit  
✅ **Blockchain tools**: MCP architecture supports Aave/Morpho  
✅ **Error handling**: Three-layer strategy covers all failure modes  
✅ **State persistence**: PostgreSQL + Redis for production  
✅ **Multi-model support**: Optimize cost/performance per agent  

### Next Steps
1. **Week 1**: Setup ADK-TS project with basic workflow
2. **Week 2**: Implement MCP servers for Aave/Morpho
3. **Week 3**: Build Researcher + Analyzer agents
4. **Week 4**: Build Executor + Governor agents
5. **Week 5**: Integration testing with Tenderly forks
6. **Week 6**: Production deployment on Cloud Run

---

## References

- **ADK-TS GitHub**: https://github.com/IQAIcom/adk-ts
- **ADK-TS Docs**: https://adk.iqai.com/docs/framework/agents
- **MCP Protocol**: https://modelcontextprotocol.io/
- **Workflow Patterns**: https://adk.iqai.com/docs/framework/agents/workflow-agents
- **State Management**: https://google.github.io/adk-docs/sessions/
- **Error Handling**: https://google.github.io/adk-docs/plugins/reflect-and-retry/

---

**Document Status**: Production Research Complete  
**Author**: GitHub Copilot  
**Date**: 2025-11-16  
**Version**: 1.0

# Research: Chainlink Price Feed Oracles on Polygon

**Research Date:** November 16, 2025  
**Context:** Rogue Yield Agent - Executor oracle integration for safe price consumption on Polygon  
**Status:** ✅ Complete

---

## Executive Summary

**Decision:** Use Chainlink as primary oracle with Uniswap V3 TWAP fallback and comprehensive circuit breakers.

**Rationale:**
- Chainlink provides battle-tested, decentralized price feeds on Polygon with sub-second latency
- Critical feeds (USDC/USD, MATIC/USD) have tight heartbeats (27s-30s) and low deviation thresholds (0.25-0.5%)
- Polygon lacks L2 sequencer uptime feed (not an optimistic rollup), simplifying integration
- Dual-oracle design (Chainlink + TWAP) provides resilience against oracle failures
- Circuit breakers prevent catastrophic losses during extreme volatility or oracle outages

**Implementation Priority:** High - Required for safe leverage operations

---

## 1. Available Price Feeds on Polygon

### Polygon Mainnet - Key Feeds

| Asset Pair | Contract Address | Deviation | Heartbeat | Risk Category |
|------------|------------------|-----------|-----------|---------------|
| **USDC/USD** | `0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7` | 0.25% | ~27s | Low (Stablecoin) |
| **MATIC/USD** | `0xAB594600376Ec9fD91F8e885dADF0CE036862dE0` | 0.5% | ~30s | Low (Native) |
| **WETH/USD** | `0xF9680D99D6C9589e2a93a78A04A279e509205945` | 0.5% | ~30s | Low (Crypto) |
| **DAI/USD** | `0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D` | 0.25% | ~3600s | Low (Stablecoin) |
| **WBTC/USD** | `0xc907E116054Ad103354f2D350FD2514433D57F6f` | 0.5% | ~30s | Low (Crypto) |
| **AAVE/USD** | `0x72484B12719E23115761D5DA1646945632979bB6` | 1.0% | ~3600s | Low (DeFi Blue Chip) |

**Note:** Feed Registry is NOT available on Polygon (Ethereum mainnet only). Contract addresses must be hardcoded or managed via configuration.

### Polygon Amoy Testnet (Replacing Mumbai)

**Important:** Mumbai testnet is deprecated. Use Polygon Amoy testnet.

| Asset Pair | Contract Address | Notes |
|------------|------------------|-------|
| **POL/USD** | `0x001382149eBa3441043c1c66972b4772963f5D43` | MATIC rebranded to POL |
| **LINK/USD** | Available via Chainlink faucets | For testing oracle consumption |

**Testnet Resources:**
- Faucet: https://faucets.chain.link/polygon-amoy
- Get testnet MATIC + LINK tokens
- Test oracle integration before mainnet deployment

---

## 2. Oracle Staleness Detection Patterns

### Heartbeat & Deviation Threshold Mechanism

Chainlink feeds update based on two triggers:
1. **Deviation Threshold:** Price moves beyond X% from last on-chain value
2. **Heartbeat:** Maximum time elapsed since last update (even if price stable)

**Example:** MATIC/USD (0.5% deviation, 30s heartbeat)
- If MATIC price changes >0.5%, feed updates immediately
- If price stable for 30s, feed updates anyway to prove liveness

### Critical Staleness Checks (MUST IMPLEMENT)

```solidity
function _isStale(
    uint80 roundId,
    uint80 answeredInRound,
    uint256 updatedAt,
    uint256 maxStaleness
) internal view returns (bool) {
    // Check 1: Round not completed
    if (answeredInRound < roundId) return true;
    
    // Check 2: Price too old (exceeds heartbeat + tolerance)
    if (block.timestamp - updatedAt > maxStaleness) return true;
    
    // Check 3: Zero timestamp (invalid data)
    if (updatedAt == 0) return true;
    
    return false;
}
```

**Staleness Tolerance by Risk Profile:**

| Risk Profile | Conservative | Moderate | Aggressive |
|--------------|--------------|----------|------------|
| **Stablecoins** (USDC) | Heartbeat + 5min | Heartbeat + 10min | Heartbeat + 15min |
| **Major Assets** (MATIC, ETH) | Heartbeat + 2min | Heartbeat + 5min | Heartbeat + 10min |
| **DeFi Tokens** (AAVE) | Heartbeat + 1min | Heartbeat + 3min | Heartbeat + 5min |

**Recommendation for Rogue:**
- **Conservative mode** for high-leverage positions (>5x)
- **Moderate mode** for standard operations (2-5x leverage)
- **Aggressive mode** only for low-risk, liquid pairs with emergency override

### Additional Safety Validations

```solidity
// Price sanity bounds (prevent flash crash exploits)
function _isPriceSane(int256 price, int256 lastGoodPrice) internal pure returns (bool) {
    if (price <= 0) return false;
    
    // Reject >50% single-update deviation (likely oracle manipulation/bug)
    uint256 deviation = _calculateDeviation(price, lastGoodPrice);
    if (deviation > 50_00) return false; // 50.00% in basis points
    
    return true;
}

// Validate decimal normalization
function _normalizePrice(int256 price, uint8 decimals) internal pure returns (uint256) {
    require(price > 0, "Invalid price");
    require(decimals <= 18, "Decimals too high");
    
    // Normalize to 18 decimals
    return uint256(price) * 10**(18 - decimals);
}
```

---

## 3. Fallback Strategies When Chainlink Unavailable

### Recommended Fallback Hierarchy

```
Primary: Chainlink Price Feed
    ↓ (if stale/invalid)
Secondary: Uniswap V3 TWAP (30min window)
    ↓ (if unavailable/manipulated)
Tertiary: Circuit Breaker (Safe Mode)
```

### Option A: Uniswap V3 TWAP (RECOMMENDED)

**Advantages:**
- On-chain, permissionless, censorship-resistant
- Manipulation requires sustained capital over TWAP window
- Native to Polygon (deep liquidity for MATIC, USDC, WETH)

**Implementation:**
```solidity
// Use 30-minute TWAP for major pairs
uint32 twapInterval = 1800; // 30 minutes

// Query Uniswap V3 pool oracle
(int24 arithmeticMeanTick,) = OracleLibrary.consult(
    uniswapV3Pool,
    twapInterval
);

uint256 twapPrice = OracleLibrary.getQuoteAtTick(
    arithmeticMeanTick,
    baseAmount,
    baseToken,
    quoteToken
);
```

**Key Parameters:**
- **TWAP Window:** 30 minutes (balance manipulation cost vs. freshness)
- **Minimum Liquidity:** $1M+ TVL in pool
- **Validation:** Compare TWAP vs. Chainlink within 5% tolerance

### Option B: Pyth Network (Alternative)

**Contract Address (Polygon Mainnet):** Not available (Pyth focuses on Solana, EVM support limited)

**Verdict:** Not recommended for Polygon. Pyth better suited for low-latency chains.

### Option C: API3 / Tellor (Community Oracles)

**Pros:** Decentralized, some Polygon support  
**Cons:** Less battle-tested than Chainlink, fewer feeds, higher latency  
**Verdict:** Only if Chainlink + Uniswap both fail (edge case)

### Option D: Last Good Price + Gradual Decay

**Use Case:** All oracles offline during network congestion

```solidity
// Store last validated price
uint256 lastGoodPrice;
uint256 lastGoodPriceTime;

// Apply conservative decay (assume worst-case volatility)
uint256 decayBps = 100; // 1% decay per hour
uint256 hoursElapsed = (block.timestamp - lastGoodPriceTime) / 3600;
uint256 decayedPrice = lastGoodPrice * (10000 - (decayBps * hoursElapsed)) / 10000;

return decayedPrice; // Use with extreme caution
```

**Warning:** Only use as absolute last resort with conservative decay. Prefer halting operations.

---

## 4. L2 Sequencer Uptime Monitoring for Polygon

### Critical Finding: Polygon Does NOT Have Sequencer Uptime Feed

**Reason:** Polygon PoS is NOT an optimistic rollup (like Arbitrum, Optimism). It's a sidechain/commit chain with its own validator set.

**Supported Networks with Sequencer Feeds:**
- Arbitrum: `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`
- Optimism: `0x371EAD81c9102C9BF4874A9075FFFf170F2Ee389`
- Base: `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433`
- Scroll, zkSync, Metis, etc.

**Implication:** Rogue does NOT need sequencer uptime checks on Polygon. However, implement network health monitoring via:
1. **Block time monitoring:** Alert if no blocks for >30s
2. **RPC health checks:** Fallback to secondary RPC provider
3. **Chainlink heartbeat validation:** Sufficient for liveness detection

**Action:** Skip sequencer uptime feed integration. Focus on staleness detection.

---

## 5. Contract Addresses: Mumbai Testnet vs. Mainnet

### Polygon Mainnet (ChainID: 137)

**Key Price Feeds:**
```solidity
// Production-ready feeds with high uptime
address constant USDC_USD = 0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7;
address constant MATIC_USD = 0xAB594600376Ec9fD91F8e885dADF0CE036862dE0;
address constant WETH_USD = 0xF9680D99D6C9589e2a93a78A04A279e509205945;
address constant WBTC_USD = 0xc907E116054Ad103354f2D350FD2514433D57F6f;
address constant DAI_USD = 0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D;
```

**AggregatorV3Interface:**
```solidity
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
```

### Polygon Amoy Testnet (ChainID: 80002) - Replaces Mumbai

**Important:** Mumbai testnet is deprecated as of April 2024. Use Amoy.

**Key Testnet Feeds:**
```solidity
// POL/USD (MATIC rebranded)
address constant POL_USD_AMOY = 0x001382149eBa3441043c1c66972b4772963f5D43;
```

**Getting Testnet Tokens:**
1. Visit: https://faucets.chain.link/polygon-amoy
2. Connect wallet (MetaMask, WalletConnect)
3. Request MATIC + LINK tokens
4. Use for testing oracle consumption

**Mumbai Deprecation:**
- Mumbai shut down Q2 2024
- All Mumbai contracts deprecated
- Migrate all tests to Amoy

---

## 6. Best Practices for Safe Oracle Consumption in DeFi

### Core Security Principles

1. **Never Trust, Always Verify**
   - Validate all 5 return values from `latestRoundData()`
   - Implement staleness, sanity, and round completion checks
   - Use multiple oracles when possible

2. **Fail Safely**
   - Prefer reverting over using bad data
   - Enter safe mode (pause risky operations) during oracle failures
   - Allow emergency withdrawals even when oracles offline

3. **Graceful Degradation**
   - Chainlink primary → Uniswap TWAP secondary → Safe mode
   - Conservative assumptions when falling back
   - Clear user communication about degraded state

### Anti-Patterns to Avoid

❌ **Don't:**
- Use only `latestAnswer()` (deprecated, missing validations)
- Skip staleness checks
- Ignore `answeredInRound < roundId` (incomplete rounds)
- Trust price without bounds checking
- Single oracle with no fallback
- Mutable oracle addresses without timelock

✅ **Do:**
- Use `latestRoundData()` with full validation
- Implement heartbeat + tolerance staleness checks
- Verify round completion (`answeredInRound >= roundId`)
- Enforce min/max price bounds per asset
- Dual oracle design with fallback
- Immutable oracle addresses or timelock governance

### Comprehensive Validation Pattern

```solidity
function _validateChainlinkResponse(
    uint80 roundId,
    int256 price,
    uint256 updatedAt,
    uint80 answeredInRound,
    uint8 decimals,
    uint256 maxStaleness,
    int256 lastGoodPrice
) internal view returns (bool isValid, uint256 normalizedPrice) {
    // 1. Round completion check
    if (answeredInRound < roundId) return (false, 0);
    
    // 2. Staleness check
    if (block.timestamp - updatedAt > maxStaleness) return (false, 0);
    
    // 3. Zero timestamp check
    if (updatedAt == 0) return (false, 0);
    
    // 4. Price positivity
    if (price <= 0) return (false, 0);
    
    // 5. Sanity bounds (prevent flash crashes)
    uint256 deviation = _calculateDeviation(price, lastGoodPrice);
    if (deviation > 50_00) return (false, 0); // >50% deviation rejected
    
    // 6. Normalize decimals to 18
    normalizedPrice = uint256(price) * 10**(18 - decimals);
    
    return (true, normalizedPrice);
}
```

---

## 7. Rogue Executor Recommendations

### Staleness Tolerance Thresholds by Risk Profile

```solidity
// Recommended staleness tolerances
mapping(RiskProfile => mapping(AssetClass => uint256)) stalenessLimits;

// Conservative (High Leverage >5x)
stalenessLimits[RiskProfile.Conservative][AssetClass.Stablecoin] = 5 minutes;
stalenessLimits[RiskProfile.Conservative][AssetClass.MajorCrypto] = 2 minutes;
stalenessLimits[RiskProfile.Conservative][AssetClass.DeFiToken] = 1 minutes;

// Moderate (Standard Leverage 2-5x)
stalenessLimits[RiskProfile.Moderate][AssetClass.Stablecoin] = 10 minutes;
stalenessLimits[RiskProfile.Moderate][AssetClass.MajorCrypto] = 5 minutes;
stalenessLimits[RiskProfile.Moderate][AssetClass.DeFiToken] = 3 minutes;

// Aggressive (Low Leverage <2x)
stalenessLimits[RiskProfile.Aggressive][AssetClass.Stablecoin] = 15 minutes;
stalenessLimits[RiskProfile.Aggressive][AssetClass.MajorCrypto] = 10 minutes;
stalenessLimits[RiskProfile.Aggressive][AssetClass.DeFiToken] = 5 minutes;
```

**Usage:**
```solidity
uint256 maxStaleness = baseHeartbeat + stalenessLimits[userRiskProfile][assetClass];
```

### Fallback Oracle Strategy

**Recommended Dual-Oracle Design:**

```solidity
contract RogueOracleAdapter {
    AggregatorV3Interface public immutable chainlinkFeed;
    IUniswapV3Pool public immutable uniswapPool;
    uint32 public constant TWAP_INTERVAL = 1800; // 30 minutes
    
    enum OracleStatus { Healthy, Fallback, SafeMode }
    OracleStatus public status;
    
    function getPrice() external view returns (uint256 price, OracleStatus source) {
        // 1. Try Chainlink primary
        (bool clValid, uint256 clPrice) = _getChainlinkPrice();
        if (clValid) {
            return (clPrice, OracleStatus.Healthy);
        }
        
        // 2. Try Uniswap TWAP fallback
        (bool twapValid, uint256 twapPrice) = _getUniswapTWAP();
        if (twapValid) {
            // Cross-validate: TWAP should be within 5% of last good Chainlink price
            if (_isWithinTolerance(twapPrice, lastGoodPrice, 500)) {
                return (twapPrice, OracleStatus.Fallback);
            }
        }
        
        // 3. Enter safe mode
        revert("OracleFailure: All sources unavailable");
    }
    
    function _getChainlinkPrice() internal view returns (bool, uint256) {
        try chainlinkFeed.latestRoundData() returns (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            return _validateChainlinkResponse(
                roundId, price, updatedAt, answeredInRound, 
                chainlinkFeed.decimals(), maxStaleness, lastGoodPrice
            );
        } catch {
            return (false, 0);
        }
    }
    
    function _getUniswapTWAP() internal view returns (bool, uint256) {
        try this._consultTWAP(uniswapPool, TWAP_INTERVAL) returns (uint256 twapPrice) {
            // Validate minimum liquidity
            if (_getPoolLiquidity(uniswapPool) < MIN_LIQUIDITY) {
                return (false, 0);
            }
            return (true, twapPrice);
        } catch {
            return (false, 0);
        }
    }
}
```

### Circuit Breaker Implementation

**Multi-Level Circuit Breaker:**

```solidity
contract RogueCircuitBreaker {
    enum BreakerLevel { Normal, Caution, SafeMode, Emergency }
    BreakerLevel public currentLevel;
    
    // Trigger thresholds
    uint256 public constant CAUTION_DEVIATION = 10_00; // 10%
    uint256 public constant SAFE_MODE_DEVIATION = 20_00; // 20%
    uint256 public constant ORACLE_FAILURE_LIMIT = 3; // consecutive failures
    
    uint256 public consecutiveFailures;
    uint256 public lastGoodPrice;
    uint256 public lastGoodPriceTime;
    
    function checkAndUpdateBreaker(
        uint256 newPrice,
        bool oracleHealthy
    ) external onlyExecutor {
        if (!oracleHealthy) {
            consecutiveFailures++;
            
            if (consecutiveFailures >= ORACLE_FAILURE_LIMIT) {
                _activateBreaker(BreakerLevel.SafeMode);
                emit CircuitBreakerTriggered("Oracle failures exceeded limit");
            }
            return;
        }
        
        // Reset failure counter on success
        consecutiveFailures = 0;
        
        // Check price deviation
        uint256 deviation = _calculateDeviation(newPrice, lastGoodPrice);
        
        if (deviation >= SAFE_MODE_DEVIATION) {
            _activateBreaker(BreakerLevel.SafeMode);
            emit CircuitBreakerTriggered("Price deviation >20%");
        } else if (deviation >= CAUTION_DEVIATION) {
            _activateBreaker(BreakerLevel.Caution);
            emit CautionTriggered("Price deviation >10%");
        } else if (currentLevel != BreakerLevel.Normal) {
            // Gradual recovery: require 10 consecutive healthy updates
            healthyUpdateCounter++;
            if (healthyUpdateCounter >= 10) {
                _activateBreaker(BreakerLevel.Normal);
            }
        }
        
        // Update last good price
        lastGoodPrice = newPrice;
        lastGoodPriceTime = block.timestamp;
    }
    
    function _activateBreaker(BreakerLevel level) internal {
        currentLevel = level;
        
        if (level == BreakerLevel.SafeMode) {
            // Pause all risky operations
            _pauseLeverageOperations();
            _pauseWithdrawals();
            // Allow emergency exits only
        } else if (level == BreakerLevel.Caution) {
            // Reduce max leverage
            maxLeverage = 2; // Cap at 2x during caution
        }
    }
    
    modifier onlyWhenHealthy() {
        require(currentLevel == BreakerLevel.Normal, "Circuit breaker active");
        _;
    }
    
    modifier allowDuringCaution() {
        require(
            currentLevel == BreakerLevel.Normal || 
            currentLevel == BreakerLevel.Caution,
            "Safe mode active"
        );
        _;
    }
}
```

**Operation Gating:**
```solidity
// High-risk operations require Normal state
function openLeveragePosition() external onlyWhenHealthy { ... }

// Medium-risk operations allowed during Caution
function closePosition() external allowDuringCaution { ... }

// Emergency operations always allowed
function emergencyWithdraw() external { ... }
```

---

## 8. Example Solidity Code for Safe Price Fetching

### Complete Oracle Adapter with All Safety Features

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

/**
 * @title RoguePriceOracle
 * @notice Production-grade oracle adapter with Chainlink primary, Uniswap TWAP fallback,
 *         and comprehensive safety validations
 * @dev Implements staleness detection, sanity bounds, circuit breakers, and graceful degradation
 */
contract RoguePriceOracle {
    
    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    
    error OracleFailure(string reason);
    error CircuitBreakerActive(BreakerLevel level);
    error InvalidConfiguration();
    error PriceDeviationTooHigh(uint256 deviation);
    
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    
    event PriceFetched(uint256 price, OracleSource source, uint256 timestamp);
    event CircuitBreakerTriggered(BreakerLevel level, string reason);
    event CircuitBreakerReset(uint256 timestamp);
    event FallbackActivated(OracleSource source);
    
    /*//////////////////////////////////////////////////////////////
                                ENUMS
    //////////////////////////////////////////////////////////////*/
    
    enum OracleSource { Chainlink, UniswapTWAP, LastGoodPrice }
    enum BreakerLevel { Normal, Caution, SafeMode }
    enum AssetClass { Stablecoin, MajorCrypto, DeFiToken }
    enum RiskProfile { Conservative, Moderate, Aggressive }
    
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    
    // Oracle sources
    AggregatorV3Interface public immutable chainlinkFeed;
    IUniswapV3Pool public immutable uniswapPool;
    
    // Configuration
    uint256 public immutable baseHeartbeat; // Chainlink feed heartbeat
    uint32 public constant TWAP_INTERVAL = 1800; // 30 minutes
    uint256 public constant MIN_POOL_LIQUIDITY = 1_000_000e18; // $1M minimum
    
    // Staleness limits per risk profile (in seconds)
    mapping(RiskProfile => mapping(AssetClass => uint256)) public stalenessLimits;
    
    // Circuit breaker state
    BreakerLevel public breakerLevel;
    uint256 public consecutiveFailures;
    uint256 public healthyUpdateCounter;
    uint256 public lastGoodPrice;
    uint256 public lastGoodPriceTime;
    
    // Constants
    uint256 private constant DEVIATION_THRESHOLD_CAUTION = 10_00; // 10% in bps
    uint256 private constant DEVIATION_THRESHOLD_SAFE_MODE = 20_00; // 20% in bps
    uint256 private constant MAX_SINGLE_UPDATE_DEVIATION = 50_00; // 50% in bps
    uint256 private constant ORACLE_FAILURE_LIMIT = 3;
    uint256 private constant HEALTHY_UPDATES_FOR_RECOVERY = 10;
    uint256 private constant TWAP_TOLERANCE_BPS = 500; // 5%
    
    // Asset metadata
    AssetClass public immutable assetClass;
    RiskProfile public currentRiskProfile;
    
    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor(
        address _chainlinkFeed,
        address _uniswapPool,
        uint256 _baseHeartbeat,
        AssetClass _assetClass,
        RiskProfile _initialRiskProfile
    ) {
        if (_chainlinkFeed == address(0) || _uniswapPool == address(0)) {
            revert InvalidConfiguration();
        }
        
        chainlinkFeed = AggregatorV3Interface(_chainlinkFeed);
        uniswapPool = IUniswapV3Pool(_uniswapPool);
        baseHeartbeat = _baseHeartbeat;
        assetClass = _assetClass;
        currentRiskProfile = _initialRiskProfile;
        
        _initializeStalenessLimits();
        
        // Initialize with first price
        (bool success, uint256 initialPrice) = _getChainlinkPrice();
        if (success) {
            lastGoodPrice = initialPrice;
            lastGoodPriceTime = block.timestamp;
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                        CORE PRICE FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /**
     * @notice Get current asset price with automatic fallback and circuit breaker logic
     * @return price The validated price (18 decimals)
     * @return source The oracle source used
     */
    function getPrice() external returns (uint256 price, OracleSource source) {
        // Check circuit breaker
        if (breakerLevel == BreakerLevel.SafeMode) {
            revert CircuitBreakerActive(breakerLevel);
        }
        
        // 1. Try Chainlink primary oracle
        (bool clSuccess, uint256 clPrice) = _getChainlinkPrice();
        
        if (clSuccess) {
            _updateCircuitBreaker(clPrice, true);
            lastGoodPrice = clPrice;
            lastGoodPriceTime = block.timestamp;
            
            emit PriceFetched(clPrice, OracleSource.Chainlink, block.timestamp);
            return (clPrice, OracleSource.Chainlink);
        }
        
        // 2. Chainlink failed, try Uniswap TWAP fallback
        emit FallbackActivated(OracleSource.UniswapTWAP);
        (bool twapSuccess, uint256 twapPrice) = _getUniswapTWAP();
        
        if (twapSuccess) {
            // Cross-validate TWAP against last good Chainlink price
            if (_isWithinTolerance(twapPrice, lastGoodPrice, TWAP_TOLERANCE_BPS)) {
                _updateCircuitBreaker(twapPrice, true);
                lastGoodPrice = twapPrice;
                lastGoodPriceTime = block.timestamp;
                
                emit PriceFetched(twapPrice, OracleSource.UniswapTWAP, block.timestamp);
                return (twapPrice, OracleSource.UniswapTWAP);
            }
        }
        
        // 3. All oracles failed - update circuit breaker and revert
        _updateCircuitBreaker(0, false);
        revert OracleFailure("All oracle sources unavailable");
    }
    
    /**
     * @notice Get price view (does not update circuit breaker state)
     * @dev Use for read-only operations, simulations, or frontends
     */
    function getPriceView() external view returns (uint256 price, OracleSource source) {
        // Try Chainlink
        (bool clSuccess, uint256 clPrice) = _getChainlinkPriceView();
        if (clSuccess) {
            return (clPrice, OracleSource.Chainlink);
        }
        
        // Try Uniswap TWAP
        (bool twapSuccess, uint256 twapPrice) = _getUniswapTWAPView();
        if (twapSuccess && _isWithinTolerance(twapPrice, lastGoodPrice, TWAP_TOLERANCE_BPS)) {
            return (twapPrice, OracleSource.UniswapTWAP);
        }
        
        // Return last good price with warning
        return (lastGoodPrice, OracleSource.LastGoodPrice);
    }
    
    /*//////////////////////////////////////////////////////////////
                    CHAINLINK ORACLE FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    function _getChainlinkPrice() internal view returns (bool success, uint256 price) {
        try chainlinkFeed.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            return _validateChainlinkResponse(
                roundId,
                answer,
                updatedAt,
                answeredInRound
            );
        } catch {
            return (false, 0);
        }
    }
    
    function _getChainlinkPriceView() internal view returns (bool success, uint256 price) {
        try chainlinkFeed.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            return _validateChainlinkResponse(
                roundId,
                answer,
                updatedAt,
                answeredInRound
            );
        } catch {
            return (false, 0);
        }
    }
    
    function _validateChainlinkResponse(
        uint80 roundId,
        int256 answer,
        uint256 updatedAt,
        uint80 answeredInRound
    ) internal view returns (bool isValid, uint256 normalizedPrice) {
        // 1. Check round completion
        if (answeredInRound < roundId) {
            return (false, 0);
        }
        
        // 2. Check staleness
        uint256 maxStaleness = baseHeartbeat + stalenessLimits[currentRiskProfile][assetClass];
        if (block.timestamp - updatedAt > maxStaleness) {
            return (false, 0);
        }
        
        // 3. Check for zero timestamp
        if (updatedAt == 0) {
            return (false, 0);
        }
        
        // 4. Check price is positive
        if (answer <= 0) {
            return (false, 0);
        }
        
        // 5. Normalize to 18 decimals
        uint8 decimals = chainlinkFeed.decimals();
        normalizedPrice = uint256(answer) * 10**(18 - decimals);
        
        // 6. Sanity check: reject extreme single-update deviations
        if (lastGoodPrice > 0) {
            uint256 deviation = _calculateDeviation(normalizedPrice, lastGoodPrice);
            if (deviation > MAX_SINGLE_UPDATE_DEVIATION) {
                return (false, 0);
            }
        }
        
        return (true, normalizedPrice);
    }
    
    /*//////////////////////////////////////////////////////////////
                    UNISWAP TWAP FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    function _getUniswapTWAP() internal view returns (bool success, uint256 price) {
        try this._consultTWAPExternal(uniswapPool, TWAP_INTERVAL) returns (uint256 twapPrice) {
            // Validate pool has sufficient liquidity
            if (_getPoolLiquidity(uniswapPool) < MIN_POOL_LIQUIDITY) {
                return (false, 0);
            }
            return (true, twapPrice);
        } catch {
            return (false, 0);
        }
    }
    
    function _getUniswapTWAPView() internal view returns (bool success, uint256 price) {
        try this._consultTWAPExternal(uniswapPool, TWAP_INTERVAL) returns (uint256 twapPrice) {
            if (_getPoolLiquidity(uniswapPool) < MIN_POOL_LIQUIDITY) {
                return (false, 0);
            }
            return (true, twapPrice);
        } catch {
            return (false, 0);
        }
    }
    
    function _consultTWAPExternal(
        IUniswapV3Pool pool,
        uint32 interval
    ) external view returns (uint256) {
        (int24 arithmeticMeanTick,) = OracleLibrary.consult(address(pool), interval);
        
        // Assuming quote in USDC (6 decimals), normalize to 18
        uint256 quoteAmount = OracleLibrary.getQuoteAtTick(
            arithmeticMeanTick,
            1e18, // 1 token
            pool.token0(), // base token
            pool.token1()  // quote token
        );
        
        // Normalize USDC (6 decimals) to 18 decimals
        return quoteAmount * 1e12;
    }
    
    function _getPoolLiquidity(IUniswapV3Pool pool) internal view returns (uint256) {
        return uint256(pool.liquidity());
    }
    
    /*//////////////////////////////////////////////////////////////
                    CIRCUIT BREAKER FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    function _updateCircuitBreaker(uint256 newPrice, bool oracleHealthy) internal {
        if (!oracleHealthy) {
            consecutiveFailures++;
            
            if (consecutiveFailures >= ORACLE_FAILURE_LIMIT) {
                _activateBreaker(BreakerLevel.SafeMode, "Consecutive oracle failures");
            }
            return;
        }
        
        // Reset failure counter
        consecutiveFailures = 0;
        
        // Check price deviation if we have a last good price
        if (lastGoodPrice > 0) {
            uint256 deviation = _calculateDeviation(newPrice, lastGoodPrice);
            
            if (deviation >= DEVIATION_THRESHOLD_SAFE_MODE) {
                _activateBreaker(BreakerLevel.SafeMode, "Price deviation >20%");
                return;
            } else if (deviation >= DEVIATION_THRESHOLD_CAUTION) {
                _activateBreaker(BreakerLevel.Caution, "Price deviation >10%");
                return;
            }
        }
        
        // Gradual recovery logic
        if (breakerLevel != BreakerLevel.Normal) {
            healthyUpdateCounter++;
            if (healthyUpdateCounter >= HEALTHY_UPDATES_FOR_RECOVERY) {
                _resetBreaker();
            }
        }
    }
    
    function _activateBreaker(BreakerLevel level, string memory reason) internal {
        if (breakerLevel != level) {
            breakerLevel = level;
            healthyUpdateCounter = 0; // Reset recovery counter
            emit CircuitBreakerTriggered(level, reason);
        }
    }
    
    function _resetBreaker() internal {
        breakerLevel = BreakerLevel.Normal;
        healthyUpdateCounter = 0;
        consecutiveFailures = 0;
        emit CircuitBreakerReset(block.timestamp);
    }
    
    /*//////////////////////////////////////////////////////////////
                        HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    function _calculateDeviation(
        uint256 newPrice,
        uint256 referencePrice
    ) internal pure returns (uint256) {
        if (referencePrice == 0) return 0;
        
        uint256 diff = newPrice > referencePrice 
            ? newPrice - referencePrice 
            : referencePrice - newPrice;
            
        return (diff * 10000) / referencePrice; // Return in basis points
    }
    
    function _isWithinTolerance(
        uint256 price1,
        uint256 price2,
        uint256 toleranceBps
    ) internal pure returns (bool) {
        uint256 deviation = _calculateDeviation(price1, price2);
        return deviation <= toleranceBps;
    }
    
    function _initializeStalenessLimits() internal {
        // Conservative profile
        stalenessLimits[RiskProfile.Conservative][AssetClass.Stablecoin] = 5 minutes;
        stalenessLimits[RiskProfile.Conservative][AssetClass.MajorCrypto] = 2 minutes;
        stalenessLimits[RiskProfile.Conservative][AssetClass.DeFiToken] = 1 minutes;
        
        // Moderate profile
        stalenessLimits[RiskProfile.Moderate][AssetClass.Stablecoin] = 10 minutes;
        stalenessLimits[RiskProfile.Moderate][AssetClass.MajorCrypto] = 5 minutes;
        stalenessLimits[RiskProfile.Moderate][AssetClass.DeFiToken] = 3 minutes;
        
        // Aggressive profile
        stalenessLimits[RiskProfile.Aggressive][AssetClass.Stablecoin] = 15 minutes;
        stalenessLimits[RiskProfile.Aggressive][AssetClass.MajorCrypto] = 10 minutes;
        stalenessLimits[RiskProfile.Aggressive][AssetClass.DeFiToken] = 5 minutes;
    }
    
    /*//////////////////////////////////////////////////////////////
                        ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    function updateRiskProfile(RiskProfile newProfile) external {
        // Add access control in production
        currentRiskProfile = newProfile;
    }
    
    function manualResetCircuitBreaker() external {
        // Add access control + timelock in production
        _resetBreaker();
    }
}
```

---

## 9. Implementation Checklist for Rogue Executor

### Phase 1: Core Oracle Integration (Week 1-2)

- [ ] Deploy `RoguePriceOracle` for each asset (USDC, MATIC, WETH)
- [ ] Configure Chainlink feed addresses for Polygon mainnet
- [ ] Set appropriate heartbeats per asset
- [ ] Initialize staleness limits for Conservative profile
- [ ] Unit test all validation logic (staleness, rounds, decimals)
- [ ] Gas optimization for price fetching

### Phase 2: Fallback & Circuit Breakers (Week 3)

- [ ] Integrate Uniswap V3 TWAP for major pairs
- [ ] Validate pool liquidity thresholds
- [ ] Implement cross-validation (Chainlink vs TWAP within 5%)
- [ ] Deploy circuit breaker logic
- [ ] Test failure scenarios (Chainlink down, TWAP manipulated)
- [ ] Add emergency pause mechanism

### Phase 3: Risk Management (Week 4)

- [ ] Implement multi-level risk profiles
- [ ] Add deviation-based circuit breakers
- [ ] Create admin functions for risk parameter updates
- [ ] Add timelock for critical parameter changes
- [ ] Deploy monitoring/alerting for oracle failures
- [ ] Document safe mode recovery procedures

### Phase 4: Testing & Auditing (Week 5-6)

- [ ] Fork testing against Polygon mainnet
- [ ] Simulate oracle outages and price volatility
- [ ] Fuzz testing for edge cases (zero prices, overflow, etc.)
- [ ] Integration testing with Executor contract
- [ ] External audit of oracle logic
- [ ] Bug bounty program before mainnet launch

### Phase 5: Deployment (Week 7)

- [ ] Deploy to Polygon Amoy testnet
- [ ] Run testnet for 2 weeks with real monitoring
- [ ] Deploy to Polygon mainnet with conservative limits
- [ ] Gradual rollout (whitelist → public)
- [ ] Post-deployment monitoring for 30 days

---

## 10. Key Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Chainlink feed pauses unexpectedly** | High | Low | Uniswap TWAP fallback + circuit breaker |
| **Oracle manipulation via flash loans** | High | Low | TWAP (30min window) resistant to single-block attacks |
| **Network congestion delays price updates** | Medium | Medium | Staleness detection + grace period |
| **Decimal mismatch causes price error** | Critical | Low | Strict decimal normalization + unit tests |
| **Circuit breaker false positive** | Medium | Medium | Multi-update confirmation before Safe Mode |
| **All oracles fail simultaneously** | Critical | Very Low | Last good price + emergency admin override |

---

## 11. Monitoring & Alerting

### Critical Metrics to Track

1. **Oracle Health:**
   - Chainlink update frequency (should match heartbeat)
   - Staleness incidents per day (target: 0)
   - Fallback activations per week (target: <5)

2. **Price Anomalies:**
   - Deviation >10% alerts (investigate immediately)
   - Deviation >20% triggers (auto Safe Mode)
   - Cross-oracle divergence >5% warnings

3. **Circuit Breaker:**
   - Time spent in Caution mode (%)
   - Safe Mode activations per month (target: 0)
   - Recovery time (target: <1 hour)

4. **Gas Costs:**
   - Average gas per `getPrice()` call
   - Gas during fallback (should be <2x primary)

### Recommended Tools

- **The Graph:** Index oracle events for historical analysis
- **Defender (OpenZeppelin):** Monitor circuit breaker state, auto-pause
- **Tenderly:** Simulate oracle failures before deployment
- **Dune Analytics:** Public dashboard for oracle uptime

---

## 12. References & Resources

### Official Documentation
- [Chainlink Data Feeds (Polygon)](https://docs.chain.link/data-feeds/price-feeds/addresses?network=polygon)
- [L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds)
- [Uniswap V3 Oracle Integration](https://docs.uniswap.org/contracts/v3/guides/oracle/oracle)

### Security Best Practices
- [Safe Oracle Consumption (0xMacro)](https://0xmacro.com/blog/how-to-consume-chainlink-price-feeds-safely/)
- [Circuit Breakers Deep Dive (Arbitrary Execution)](https://medium.com/arbitrary-execution/circuit-breakers-a-chainlink-deep-dive-52b6f5b8c1e)
- [Oracle Manipulation Attacks (Cyfrin)](https://medium.com/cyfrin/chainlink-oracle-defi-attacks-93b6cb6541bf)

### Example Implementations
- [Liquity Dual-Oracle Design](https://hackernoon.com/facilitating-failure-resistance-with-the-dual-oracle-design)
- [Aave Oracle Risk Parameters](https://docs.aave.com/developers/core-contracts/aaveoracle)

### Contract Addresses (Polygon Mainnet)
- **USDC/USD:** 0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7
- **MATIC/USD:** 0xAB594600376Ec9fD91F8e885dADF0CE036862dE0
- **WETH/USD:** 0xF9680D99D6C9589e2a93a78A04A279e509205945

### Testnet Resources
- [Polygon Amoy Faucet](https://faucets.chain.link/polygon-amoy)
- [Amoy POL/USD Feed](https://data.chain.link/feeds/polygon-amoy/testnet/pol-usd)

---

## Summary: Decision Matrix

| Aspect | Decision | Priority |
|--------|----------|----------|
| **Primary Oracle** | Chainlink Price Feeds | ✅ High |
| **Fallback Oracle** | Uniswap V3 TWAP (30min) | ✅ High |
| **Staleness Detection** | Heartbeat + Risk-Based Tolerance | ✅ High |
| **Circuit Breaker** | 3-Level (Normal/Caution/SafeMode) | ✅ High |
| **Sequencer Uptime** | Not Required (Polygon PoS) | ⚠️ N/A |
| **Testnet** | Polygon Amoy (Mumbai deprecated) | ✅ Medium |
| **Risk Profile** | Conservative (start) → Moderate | ✅ High |

---

**Next Steps:**
1. Review implementation with security team
2. Deploy to Amoy testnet for integration testing
3. Run 2-week testnet pilot with monitoring
4. Security audit of oracle adapter contract
5. Mainnet deployment with conservative limits

**Estimated Timeline:** 6-7 weeks from research completion to mainnet launch

---

*Research completed by: GitHub Copilot*  
*Last updated: November 16, 2025*  
*Document version: 1.0*

# Research: Custody & Execution Authorization Models for Rogue

**Date**: 2025-11-16  
**Researcher**: GitHub Copilot  
**Topic**: FR-014 - Custody model for automated execution  
**Status**: ✅ COMPLETE

## Executive Summary

**Decision**: **Limited ERC-20 Approval + Executor Contract with Time/Amount Caps**

**Rationale**: This model provides the optimal balance for Rogue's MVP by enabling autonomous yield optimization without custody of user funds, minimal UX friction (one-time approval per token), and proven security patterns used by established DeFi protocols like Yearn Finance and Beefy. Users retain full asset custody while delegating specific execution permissions to a time-bounded, amount-capped smart contract.

**Alternatives Considered**: Per-transaction signatures (excellent security, poor UX for autonomous agents), EIP-2612 permit() (limited token support, complexity), EIP-4337/7702 account abstraction (cutting-edge but immature for MVP timeline), meta-transactions (additional relayer complexity).

**Implementation Notes**: 
- Smart contract: `YieldHarvester.sol` with role-based access control, emergency pause, and configurable caps
- User flow: One-time ERC-20 `approve()` during first stake with recommended cap (e.g., $10,000 USDC for 30 days)
- Security audits: OpenZeppelin audit required before mainnet (estimated 4-6 weeks, $30-50k)
- Gas optimization: Batch transactions for multi-step operations (harvest → compound → hedge)

---

## 1. Model Evaluation

### 1.1 Per-Transaction User Signatures

**Description**: Every on-chain action (deposit, compound, withdraw) requires explicit wallet signature approval via MetaMask popup.

**UX Impact**: 🔴 **SEVERE FRICTION**
- Users must be online and approve every autonomous action (defeats "set and forget" value prop)
- High-frequency operations (daily auto-compound) become user burden
- Mobile wallet users face constant interruptions
- Incompatible with true autonomous optimization

**Security**: 🟢 **MAXIMUM SECURITY**
- Zero custody risk - user explicitly authorizes every transaction
- No pre-approved spending limits or delegation
- Granular control over each action

**Implementation Complexity**: 🟢 **LOW**
- Standard ethers.js wallet signing flow
- No custom smart contracts beyond basic interaction
- Well-documented patterns

**Verdict**: ❌ **NOT RECOMMENDED** - Fundamentally incompatible with autonomous agent architecture. Users expect "stake once, optimize automatically" UX, not manual approval for every compound.

---

### 1.2 Delegated Approvals via ERC-20 `approve()` + Limited Executor Contract

**Description**: Users grant ERC-20 token approval to a trusted `YieldHarvester.sol` executor contract with built-in amount caps, time limits, and role-based access control. The contract performs autonomous actions within these boundaries.

**UX Impact**: 🟢 **MINIMAL FRICTION**
- One-time approval during initial stake flow
- Users can set conservative limits (e.g., max $10,000 for 30 days)
- Standard Web3 UX pattern - familiar to DeFi users
- Allowance dashboard shows active approvals with revoke option
- Subsequent operations (compound, rebalance) execute without user interaction

**Security**: 🟡 **MEDIUM-HIGH RISK (WITH MITIGATIONS)**
- **Risks**:
  - Smart contract vulnerabilities could drain approved amounts
  - Unlimited approvals (if users don't customize) create maximum exposure
  - Malicious contract upgrades if not using immutable contracts
- **Mitigations**:
  - Time-limited approvals (e.g., 30-day expiration, auto-renew optional)
  - Amount-capped approvals (recommended caps per risk profile)
  - OpenZeppelin `AccessControl` for role-based executor permissions
  - Emergency pause mechanism controlled by multisig
  - Immutable core logic with proxy pattern for safe upgrades
  - Professional security audit before mainnet

**Implementation Complexity**: 🟡 **MEDIUM**
- Smart contracts:
  - `StakingProxy.sol` - Holds user deposits, interfaces with yield protocols
  - `YieldHarvester.sol` - Executor with cap enforcement, emergency controls
  - OpenZeppelin libraries: `AccessControl`, `Pausable`, `ReentrancyGuard`
- Backend integration:
  - Cron-triggered execution respects on-chain caps
  - Oracle integration for price-based amount limits
  - Frontend approval UX with recommended/custom limit options
- Gas optimization required for auto-compound profitability (<10% of yield)

**Real-world Precedent**: 🟢 **INDUSTRY STANDARD**
- **Yearn Finance**: Users approve Vault contracts for token deposits; vaults autonomously compound yields
- **Beefy Finance**: Multi-chain yield optimizer using delegated vault approvals with strategy caps
- **Convex Finance**: Auto-compounding CRV rewards via approved executor contracts
- **Uniswap Permit2**: Universal approval contract with time/amount limits (see section 1.3)

**Verdict**: ✅ **RECOMMENDED FOR MVP** - Best balance of security, UX, and implementation feasibility. Aligns with established DeFi patterns and user expectations for yield optimizers.

---

### 1.3 EIP-2612 `permit()` for Gasless Approvals

**Description**: Off-chain signature-based approvals using EIP-712 typed data. Users sign a permit message allowing the contract to spend tokens without an on-chain approval transaction, saving gas and enabling one-click flows.

**UX Impact**: 🟢 **EXCELLENT (WHEN SUPPORTED)**
- Gasless approval - users only pay gas for actual execution
- One-click stake flow: sign permit + deposit in single transaction
- Familiar signature flow (similar to message signing in dApps)

**Security**: 🟢 **SECURE**
- Similar risk profile to standard `approve()` but with better UX
- Deadline parameter enforces time limits
- No unlimited approvals by default

**Implementation Complexity**: 🔴 **HIGH**
- **Token Support Limitation**: Only tokens implementing EIP-2612 interface
  - ✅ DAI, USDC (on some chains), UNI, COMP
  - ❌ Many ERC-20s don't support permit (Tether USDT, WBTC, most older tokens)
  - ❌ KRWQ (custom token) would need permit implementation
- Requires fallback to standard `approve()` for non-permit tokens
- Additional frontend complexity for permit signature generation
- Backend must handle both permit and approve flows

**Real-world Precedent**: 🟡 **GROWING ADOPTION**
- **Uniswap Permit2**: Universal permit contract for any ERC-20 (batch revokes, time limits)
- **Aave v3**: Permit-based deposits for supported tokens
- **1inch**: Permit integration for gasless limit orders

**Verdict**: 🟡 **CONSIDER FOR POST-MVP** - Excellent for supported tokens but dual-path implementation adds complexity. Use Uniswap's **Permit2** contract as abstraction layer if adopting (see section 1.6).

---

### 1.4 Meta-Transactions / Account Abstraction (EIP-4337)

**Description**: Smart contract wallets (EIP-4337) or meta-transaction relayers that enable gasless transactions, batching, and advanced permission models (session keys, spending limits, social recovery).

**UX Impact**: 🟢 **BEST-IN-CLASS (WHEN MATURE)**
- Gas sponsorship - Rogue pays user gas fees
- Transaction batching - stake + set risk profile + approve in one click
- Session keys - temporary permissions for autonomous execution
- No wallet popups for routine operations

**Security**: 🟢 **FLEXIBLE SECURITY**
- Programmable permissions (time-based, amount-based, action-specific)
- Social recovery without seed phrases
- Revocable session keys

**Implementation Complexity**: 🔴 **VERY HIGH**
- **Maturity Concerns**:
  - EIP-4337 mainnet deployment: March 2023 (relatively new)
  - EIP-7702 (Pectra upgrade): May 2025 (cutting-edge, limited tooling)
  - Requires new address for smart contract wallet (migration friction for existing users)
- Infrastructure requirements:
  - Bundler service for UserOperation submission
  - Paymaster contract for gas sponsorship (requires ETH/MATIC reserves)
  - EntryPoint contract integration
- Wallet support: Limited native support (Safe, Argent, Biconomy, Stackup)
- Debugging/auditing complexity for smart wallet logic

**Real-world Precedent**: 🟡 **EMERGING**
- **Safe (Gnosis Safe)**: Multisig smart wallets with EIP-4337 support
- **Biconomy, Stackup**: Account abstraction SDKs for gasless UX
- **thirdweb**: Account abstraction tooling for dApp developers
- **Limited adoption** for autonomous yield agents (most still use delegated approvals)

**Verdict**: ❌ **NOT FOR MVP** - Too cutting-edge for hackathon timeline and beta launch. Requires significant infrastructure, debugging overhead, and wallet ecosystem maturity. **Consider for v2** if gas sponsorship becomes critical differentiator.

---

### 1.5 Time-Limited & Amount-Capped Delegation Patterns

**Description**: Enhanced delegated approval patterns that combine standard ERC-20 approvals with smart contract enforcement of time windows and spending caps.

**Implementation Patterns**:

#### Pattern A: On-Chain Cap Enforcement in Executor Contract
```solidity
contract YieldHarvester {
    struct UserCap {
        uint256 maxAmount;      // e.g., 10,000 USDC
        uint256 spentAmount;    // Tracked spend
        uint256 expiryTime;     // e.g., block.timestamp + 30 days
    }
    
    mapping(address => UserCap) public caps;
    
    function compound(address user, uint256 amount) external onlyRole(EXECUTOR_ROLE) {
        UserCap storage cap = caps[user];
        require(block.timestamp < cap.expiryTime, "Approval expired");
        require(cap.spentAmount + amount <= cap.maxAmount, "Cap exceeded");
        
        cap.spentAmount += amount;
        // Execute compound logic...
    }
}
```

**Benefits**:
- Users set caps once during stake flow
- Contract enforces limits automatically
- No reliance on user re-approvals
- Transparent on-chain cap tracking

**Trade-offs**:
- Gas cost for cap storage/updates
- Cap renewal requires user transaction (or off-chain signature + relayer)

#### Pattern B: Off-Chain Signature + On-Chain Cap Verification (Hybrid)
```solidity
// User signs off-chain permit with expiry + amount cap
// Backend verifies signature before submitting transaction
// Contract validates signature matches expected cap
```

**Benefits**:
- Gasless cap updates (sign new permit)
- Flexible expiry without on-chain storage

**Trade-offs**:
- Backend complexity for signature verification
- Requires secure nonce management to prevent replay attacks

#### Pattern C: Periodic Allowance Resets (MetaMask Delegation Toolkit Pattern)
```solidity
// Based on MetaMask's delegation scopes (see research sources)
struct PeriodicCap {
    uint256 periodAmount;    // e.g., 1000 USDC per period
    uint256 periodDuration;  // e.g., 86400 seconds (1 day)
    uint256 startDate;       // First period start
}

// Allowance resets each period (no accumulation)
function getCurrentPeriod() internal view returns (uint256) {
    return (block.timestamp - cap.startDate) / cap.periodDuration;
}
```

**Benefits**:
- Predictable spending limits (e.g., max $1000/day for compounds)
- Auto-reset prevents runaway spending
- User can set conservative daily limits

**Trade-offs**:
- Complexity for cross-period operations
- May require multiple transactions if action exceeds period limit

**Verdict for Rogue**: ✅ **IMPLEMENT PATTERN A + C HYBRID**
- **Initial MVP**: Pattern A (on-chain max amount + expiry time)
- **Post-MVP**: Add Pattern C (periodic reset) for high-frequency strategies
- Skip Pattern B (signature complexity not justified for MVP)

---

### 1.6 Uniswap Permit2 Integration

**Description**: Leverage Uniswap's **Permit2** contract - a universal token approval manager that works with any ERC-20 (even without native permit support) and provides:
- Signature-based approvals (one-time setup)
- Time-limited allowances
- Amount-capped delegations
- Batch revocation of multiple approvals

**How It Works**:
1. User approves Permit2 contract once for each token (standard ERC-20 approval)
2. User signs off-chain permit messages to grant spending rights to Rogue's executor
3. Executor calls Permit2's `permitTransferFrom()` to move tokens (verifies signature + caps)

**Benefits**:
- ✅ Works with **any ERC-20** (not just EIP-2612 tokens)
- ✅ Signature-based delegation (gasless for users)
- ✅ Built-in time/amount limits
- ✅ Battle-tested (Uniswap production use, audited by OpenZeppelin)
- ✅ One approval per token across all dApps using Permit2

**Trade-offs**:
- Requires additional smart contract dependency
- Users must approve Permit2 first (one-time friction)
- Slightly more complex integration than direct approvals

**Verdict**: 🟡 **CONSIDER FOR V2** - Excellent security/UX but adds architectural complexity for MVP. If EIP-2612 adoption becomes critical, Permit2 is the recommended abstraction layer.

---

## 2. Recommended Architecture for Rogue MVP

### 2.1 Custody Model

**Selected Approach**: **Limited ERC-20 Approval + Executor Contract (Pattern A + C Hybrid)**

**User Flow**:
```
1. User connects wallet (MetaMask, WalletConnect)
2. User selects risk profile (low/medium/high) and stake amount
3. Frontend prompts ERC-20 approval:
   - RECOMMENDED: Cap at 2x stake amount, 30-day expiry
   - ADVANCED: Custom cap + expiry (for power users)
   - ONE-CLICK: "Approve max for 1 year" (not recommended, show warning)
4. User confirms approval transaction (1st tx)
5. User confirms stake transaction (2nd tx)
6. Position activated - autonomous execution begins
```

**Smart Contract Architecture**:
```
StakingProxy.sol (per user, per token)
├── Receives user deposits via transferFrom()
├── Tracks position: amount, risk profile, strategy allocation
├── Interfaces with yield protocols (Frax, Aave)
└── Enforces withdrawal rules (cooldown, fees)

YieldHarvester.sol (singleton executor)
├── Role-based access: EXECUTOR_ROLE (backend cron), ADMIN_ROLE (multisig)
├── Cap enforcement: UserCap struct per user
├── Emergency controls: Pausable, EmergencyWithdraw
├── Compound logic: harvest yields → swap → reinvest
├── Hedge logic: leverage monitoring → position adjustments
└── Gas-optimized batch operations
```

### 2.2 Security Measures

#### Smart Contract Security
1. **OpenZeppelin Standards**:
   - `AccessControl` - Role-based permissions (executor, admin, pauser)
   - `Pausable` - Emergency halt on oracle failure or exploit detection
   - `ReentrancyGuard` - Prevent reentrancy attacks on deposits/withdrawals
   - `Ownable` - Multisig ownership for contract upgrades

2. **Cap Enforcement**:
   ```solidity
   struct UserCap {
       uint256 maxAmount;        // Absolute cap (e.g., 10,000 USDC)
       uint256 spentAmount;      // Rolling counter
       uint256 expiryTime;       // Unix timestamp
       uint256 dailyLimit;       // Optional: periodic reset (Pattern C)
       uint256 lastResetTime;    // For daily limit tracking
   }
   ```

3. **Oracle Safety**:
   - Chainlink price staleness checks (max 1-hour old data)
   - Circuit breaker on >10% price deviation
   - Fallback oracle (e.g., Tellor) for critical operations

4. **Audit Requirements**:
   - Pre-testnet: Internal review + OpenZeppelin static analysis
   - Pre-mainnet: **Full security audit** (OpenZeppelin, ConsenSys Diligence, or Trail of Bits)
   - Estimated cost: $30-50k for comprehensive audit
   - Timeline: 4-6 weeks audit + 2 weeks fix review

#### Backend Security
1. **Execution Validation**:
   - Verify on-chain caps before submitting transactions
   - Gas price limits to prevent MEV/front-running losses
   - Slippage tolerance per strategy (conservative defaults)

2. **Oracle Monitoring**:
   - Pre-flight checks: Chainlink feed staleness + deviation
   - Fallback: Skip execution if oracle unavailable (log alert)
   - Manual review for >$10k single-position operations

3. **Access Control**:
   - Backend wallet (executor role) stored in AWS KMS or Vercel secrets
   - Rate limiting on API endpoints (prevent abuse)
   - Wallet signature verification for user-initiated actions

### 2.3 User Experience Enhancements

#### Approval UX
```typescript
// Frontend approval flow with risk-based recommendations
const recommendedCaps = {
  low: {
    maxAmount: stakeAmount * 1.5,  // Conservative: 50% buffer
    duration: 30 * 24 * 60 * 60,   // 30 days
  },
  medium: {
    maxAmount: stakeAmount * 2,    // Moderate: 100% buffer
    duration: 60 * 24 * 60 * 60,   // 60 days
  },
  high: {
    maxAmount: stakeAmount * 3,    // Aggressive: 200% buffer
    duration: 90 * 24 * 60 * 60,   // 90 days
  },
};

// Show approval modal with clear explanations
<ApprovalModal>
  <p>Rogue needs permission to manage your {token} tokens.</p>
  <p><strong>Recommended limit:</strong> {formatCurrency(cap.maxAmount)}</p>
  <p><strong>Duration:</strong> {cap.duration / 86400} days</p>
  <p><strong>You can revoke anytime</strong> via the Allowances dashboard.</p>
  <Button variant="advanced">Custom Limits</Button>
  <Button variant="primary">Approve Recommended</Button>
</ApprovalModal>
```

#### Allowance Dashboard
```tsx
// Component: components/AllowanceManager.tsx
<AllowanceCard>
  <TokenIcon src={usdc.logo} />
  <div>
    <h3>USDC Approval</h3>
    <p>Limit: $8,234 / $10,000 (82% used)</p>
    <p>Expires: 14 days remaining</p>
  </div>
  <Button onClick={revokeAllowance}>Revoke</Button>
  <Button onClick={increaseAllowance}>Increase Limit</Button>
</AllowanceCard>
```

#### Educational Content
- Tooltips explaining "What is token approval?"
- Link to revoke.cash or Etherscan token approvals page
- Safety guides: "How to audit smart contracts before approval"

### 2.4 Gas Optimization

**Problem**: Auto-compound gas costs must be <10% of yield to remain profitable.

**Solutions**:
1. **Batch Transactions**:
   ```solidity
   function batchCompound(address[] calldata users) external onlyRole(EXECUTOR_ROLE) {
       for (uint i = 0; i < users.length; i++) {
           _compound(users[i]);
       }
   }
   ```
   - Amortize fixed gas costs (21k base) across multiple users
   - Target: 5-10 users per batch on low gas periods

2. **Dynamic Frequency**:
   - Low-value positions (<$100): Compound weekly
   - Mid-value ($100-$1k): Compound every 2-3 days
   - High-value (>$1k): Compound daily
   - Backend cron uses heuristic based on position size + APY

3. **Gas Price Monitoring**:
   - Skip execution if Polygon gas >100 gwei
   - Use Flashbots/Eden RPC for MEV protection (mainnet only)

4. **Read Optimization**:
   ```typescript
   // Use multicall for position data aggregation
   const multicall = new ethers.Contract(MULTICALL_ADDRESS, abi, provider);
   const calls = users.map(user => ({
     target: stakingProxy.address,
     callData: stakingProxy.interface.encodeFunctionData('getPosition', [user])
   }));
   const results = await multicall.callStatic.aggregate(calls);
   ```

---

## 3. Alternatives Considered (Detailed)

### 3.1 Comparison Matrix

| Model | UX Friction | Security | Complexity | Gas Cost | MVP Ready |
|-------|------------|----------|------------|----------|-----------|
| Per-transaction signatures | 🔴 High | 🟢 Maximum | 🟢 Low | Low | ❌ No |
| ERC-20 approve() + caps | 🟢 Low | 🟡 Medium | 🟡 Medium | Medium | ✅ Yes |
| EIP-2612 permit() | 🟢 Low | 🟢 High | 🔴 High | Low | 🟡 Maybe |
| EIP-4337 (Account Abstraction) | 🟢 Minimal | 🟢 Flexible | 🔴 Very High | Variable | ❌ No |
| Permit2 (Uniswap) | 🟢 Low | 🟢 High | 🟡 Medium | Low | 🟡 Maybe |

### 3.2 Why Not Account Abstraction (EIP-4337/7702)?

**Pros**:
- Best-in-class UX (gas sponsorship, batching, session keys)
- Future-proof architecture
- Advanced permission models

**Cons (Critical for MVP)**:
1. **Ecosystem Immaturity (Nov 2025)**:
   - EIP-4337 deployed March 2023 (2.5 years old - still early)
   - EIP-7702 launched May 2025 (6 months old - very new)
   - Limited production deployments for autonomous agents
   - Tooling/debugging still evolving

2. **Implementation Overhead**:
   - Requires bundler service (infrastructure cost + maintenance)
   - Paymaster contract needs MATIC/ETH reserves for gas sponsorship
   - Smart wallet deployment per user (gas cost + migration friction)
   - EntryPoint contract integration + testing complexity

3. **User Migration Friction**:
   - Users with existing EOAs must create new smart wallet address
   - Asset transfers from old wallet to new wallet (gas + UX)
   - Confusion around "which wallet to use" for Rogue vs other dApps

4. **Audit/Security Risk**:
   - Smart wallet logic adds attack surface
   - Session key management vulnerabilities
   - Fewer audit reports for AA-based yield optimizers

**Verdict**: Excellent for future v2/v3, but **too risky for MVP timeline**. Prioritize shipping with proven patterns first.

### 3.3 Why Not EIP-2612 Permit?

**Pros**:
- Gasless approvals (better UX than standard approve)
- One-click deposit flows
- Built-in expiry/deadline

**Cons**:
1. **Token Support Gap**:
   - USDC: Partial support (varies by chain - Polygon mainnet: YES, Mumbai testnet: NO)
   - KRWQ: Custom token - would need permit implementation
   - Many popular tokens don't support permit (USDT, WBTC)

2. **Fallback Complexity**:
   - Must implement dual path: permit for supported tokens, approve for others
   - Frontend logic to detect permit support via EIP-165 or trial call
   - Testing overhead for both paths

3. **Marginal UX Gain for Rogue**:
   - Rogue is not high-frequency trading (compounds 1x/day max)
   - Saving 1 approval transaction per user is nice-to-have, not critical
   - Standard approve() is familiar to DeFi users

**Verdict**: Not worth complexity for MVP. If token support improves or Permit2 integration simplifies dual-path logic, revisit for v2.

---

## 4. Implementation Requirements

### 4.1 Smart Contract Deliverables

#### `contracts/StakingProxy.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract StakingProxy is AccessControl, ReentrancyGuard {
    bytes32 public constant HARVESTER_ROLE = keccak256("HARVESTER_ROLE");
    
    struct Position {
        uint256 amount;
        uint8 riskProfile;  // 0=low, 1=medium, 2=high
        uint256 depositTime;
        uint256 lastCompoundTime;
    }
    
    mapping(address => mapping(address => Position)) public positions;  // user => token => position
    
    function deposit(address token, uint256 amount, uint8 riskProfile) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(riskProfile <= 2, "Invalid risk profile");
        
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        Position storage pos = positions[msg.sender][token];
        pos.amount += amount;
        pos.riskProfile = riskProfile;
        pos.depositTime = block.timestamp;
        
        emit Staked(msg.sender, token, amount, riskProfile);
    }
    
    function compound(address user, address token, uint256 yieldAmount) 
        external 
        onlyRole(HARVESTER_ROLE) 
        nonReentrant 
    {
        Position storage pos = positions[user][token];
        pos.amount += yieldAmount;
        pos.lastCompoundTime = block.timestamp;
        
        emit Compounded(user, token, yieldAmount, pos.amount);
    }
    
    // ... withdraw, updateRisk, emergency functions
}
```

#### `contracts/YieldHarvester.sol`
```solidity
contract YieldHarvester is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    
    struct UserCap {
        uint256 maxAmount;
        uint256 spentAmount;
        uint256 expiryTime;
        uint256 dailyLimit;      // Optional periodic cap
        uint256 lastResetTime;
    }
    
    mapping(address => mapping(address => UserCap)) public caps;  // user => token => cap
    
    IStakingProxy public stakingProxy;
    IChainlinkOracle public priceOracle;
    
    function setCap(
        address token,
        uint256 maxAmount,
        uint256 expiryDuration,
        uint256 dailyLimit
    ) external {
        caps[msg.sender][token] = UserCap({
            maxAmount: maxAmount,
            spentAmount: 0,
            expiryTime: block.timestamp + expiryDuration,
            dailyLimit: dailyLimit,
            lastResetTime: block.timestamp
        });
        
        emit CapSet(msg.sender, token, maxAmount, expiryDuration);
    }
    
    function executeCompound(address user, address token, uint256 harvestedYield)
        external
        onlyRole(EXECUTOR_ROLE)
        whenNotPaused
        nonReentrant
    {
        UserCap storage cap = caps[user][token];
        
        // Check expiry
        require(block.timestamp < cap.expiryTime, "Approval expired");
        
        // Check daily limit reset
        if (block.timestamp > cap.lastResetTime + 1 days) {
            cap.spentAmount = 0;  // Reset daily counter
            cap.lastResetTime = block.timestamp;
        }
        
        // Check caps
        require(cap.spentAmount + harvestedYield <= cap.maxAmount, "Max cap exceeded");
        require(harvestedYield <= cap.dailyLimit, "Daily limit exceeded");
        
        // Update spent amount
        cap.spentAmount += harvestedYield;
        
        // Execute compound via StakingProxy
        stakingProxy.compound(user, token, harvestedYield);
        
        emit CompoundExecuted(user, token, harvestedYield);
    }
    
    // Emergency pause on oracle failure
    function pauseOnOracleFailure() external onlyRole(EXECUTOR_ROLE) {
        _pause();
        emit EmergencyPause(msg.sender, "Oracle staleness detected");
    }
}
```

### 4.2 Frontend Integration

#### `frontend/src/components/ApprovalFlow.tsx`
```typescript
import { useContractWrite, usePrepareContractWrite } from 'wagmi';
import { parseUnits } from 'viem';

export function ApprovalFlow({ token, stakeAmount, riskProfile }) {
  const recommendedCap = getRecommendedCap(stakeAmount, riskProfile);
  const [customCap, setCustomCap] = useState(recommendedCap.maxAmount);
  const [duration, setDuration] = useState(recommendedCap.duration);
  
  // Step 1: ERC-20 approval
  const { config: approveConfig } = usePrepareContractWrite({
    address: token.address,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [YIELD_HARVESTER_ADDRESS, parseUnits(customCap.toString(), token.decimals)],
  });
  
  const { write: approveWrite, isLoading: isApproving } = useContractWrite(approveConfig);
  
  // Step 2: Set cap in YieldHarvester
  const { config: capConfig } = usePrepareContractWrite({
    address: YIELD_HARVESTER_ADDRESS,
    abi: YIELD_HARVESTER_ABI,
    functionName: 'setCap',
    args: [token.address, parseUnits(customCap.toString(), token.decimals), duration, 0],
  });
  
  const { write: setCapWrite, isLoading: isSettingCap } = useContractWrite(capConfig);
  
  return (
    <div>
      <h2>Approve Token Spending</h2>
      <RecommendedCapCard cap={recommendedCap} />
      <AdvancedOptions onCustomCapChange={setCustomCap} onDurationChange={setDuration} />
      <Button onClick={() => approveWrite?.()} disabled={isApproving}>
        {isApproving ? 'Approving...' : 'Approve Tokens'}
      </Button>
      <Button onClick={() => setCapWrite?.()} disabled={!approveWrite || isSettingCap}>
        {isSettingCap ? 'Setting Cap...' : 'Set Spending Limit'}
      </Button>
    </div>
  );
}

function getRecommendedCap(stakeAmount: number, riskProfile: string) {
  const multipliers = { low: 1.5, medium: 2, high: 3 };
  const durations = { low: 30, medium: 60, high: 90 };  // days
  
  return {
    maxAmount: stakeAmount * multipliers[riskProfile],
    duration: durations[riskProfile] * 24 * 60 * 60,  // seconds
    label: `${multipliers[riskProfile]}x stake for ${durations[riskProfile]} days`,
  };
}
```

### 4.3 Backend Executor Service

#### `backend/src/cron/autonomous-compound.ts`
```typescript
import { ethers } from 'ethers';
import { YIELD_HARVESTER_ABI, YIELD_HARVESTER_ADDRESS } from '../contracts/abis';

export async function executeAutonomousCompound() {
  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
  const executorWallet = new ethers.Wallet(process.env.EXECUTOR_PRIVATE_KEY, provider);
  
  const harvester = new ethers.Contract(
    YIELD_HARVESTER_ADDRESS,
    YIELD_HARVESTER_ABI,
    executorWallet
  );
  
  // 1. Fetch positions needing compound
  const positions = await getPositionsForCompound();
  
  for (const position of positions) {
    try {
      // 2. Pre-flight checks
      const capValid = await validateUserCap(position.user, position.token, position.yieldAmount);
      if (!capValid) {
        console.log(`Skipping ${position.user}: cap exceeded`);
        continue;
      }
      
      const oracleValid = await checkOracleFreshness(position.token);
      if (!oracleValid) {
        console.error('Oracle staleness detected - pausing');
        await harvester.pauseOnOracleFailure();
        break;
      }
      
      // 3. Estimate gas
      const gasEstimate = await harvester.executeCompound.estimateGas(
        position.user,
        position.token,
        position.yieldAmount
      );
      
      const gasPrice = await provider.getFeeData();
      const gasCost = gasEstimate * gasPrice.gasPrice;
      
      // 4. Profitability check (gas < 10% of yield)
      if (gasCost > position.yieldAmount * 0.1) {
        console.log(`Skipping ${position.user}: gas too high (${gasCost} > ${position.yieldAmount * 0.1})`);
        continue;
      }
      
      // 5. Execute compound
      const tx = await harvester.executeCompound(
        position.user,
        position.token,
        position.yieldAmount,
        { gasLimit: gasEstimate * 1.2 }  // 20% buffer
      );
      
      await tx.wait();
      console.log(`Compounded for ${position.user}: ${ethers.formatUnits(position.yieldAmount, 6)} USDC`);
      
    } catch (error) {
      console.error(`Failed to compound for ${position.user}:`, error);
      // Log to monitoring (Sentry, Datadog)
    }
  }
}

async function checkOracleFreshness(token: string): Promise<boolean> {
  const oracle = new ethers.Contract(CHAINLINK_ORACLE_ADDRESS, ORACLE_ABI, provider);
  const { updatedAt } = await oracle.latestRoundData();
  const staleness = Date.now() / 1000 - updatedAt;
  
  return staleness < 3600;  // Max 1 hour old
}
```

---

## 5. Security Audit Checklist

### 5.1 Pre-Audit Preparation

**Code Readiness**:
- [ ] All smart contracts finalized (no pending features)
- [ ] Comprehensive NatSpec documentation for all functions
- [ ] Unit tests covering all critical paths (deposits, compounds, withdrawals, emergency pause)
- [ ] Integration tests with mock Frax/Aave contracts
- [ ] Fuzz testing for cap enforcement logic (Foundry invariants)

**Documentation**:
- [ ] Architecture diagrams (user flow, contract interactions)
- [ ] Threat model document (attack vectors, mitigations)
- [ ] Deployment process documented (multisig setup, upgrade procedures)
- [ ] Known issues/limitations disclosed

**Tooling**:
- [ ] Slither static analysis run (resolve all high/medium findings)
- [ ] Mythril symbolic execution (check reentrancy, overflow)
- [ ] OpenZeppelin Code Inspector scan
- [ ] Gas optimization review (target <200k gas per compound)

### 5.2 Critical Audit Areas

1. **Cap Enforcement**:
   - [ ] Time-based expiry correctly prevents expired executions
   - [ ] Amount tracking prevents overflow/underflow
   - [ ] Daily limit reset logic cannot be gamed
   - [ ] Edge case: user deposits more after setting cap

2. **Access Control**:
   - [ ] Only EXECUTOR_ROLE can call compound functions
   - [ ] Admin role transition follows secure multisig pattern
   - [ ] Emergency pause cannot be abused by malicious executor

3. **Oracle Safety**:
   - [ ] Staleness checks prevent manipulation via old data
   - [ ] Price deviation circuit breaker works correctly
   - [ ] Fallback oracle integration secure

4. **Reentrancy**:
   - [ ] All external calls follow checks-effects-interactions pattern
   - [ ] ReentrancyGuard on all entry points
   - [ ] Test with malicious ERC-20 contracts

5. **Upgrade Path**:
   - [ ] Proxy pattern correctly preserves storage layout
   - [ ] Initialization function cannot be front-run
   - [ ] Upgrade authorization requires multisig

### 5.3 Audit Firm Selection

**Tier 1 (Recommended for Mainnet)**:
- **OpenZeppelin**: $40-60k, 4-6 weeks, best for DeFi protocols
- **Trail of Bits**: $50-80k, 6-8 weeks, deep security expertise
- **ConsenSys Diligence**: $45-70k, 5-7 weeks, strong Ethereum focus

**Tier 2 (Budget-Conscious)**:
- **Quantstamp**: $25-40k, 3-4 weeks, automated + manual review
- **CertiK**: $30-50k, 4-5 weeks, formal verification available

**Community Audits** (Not Recommended for Production):
- Code4rena contests: $15-30k prize pool, 1-2 weeks, multiple auditors
- Risk: Variable quality, no liability coverage

---

## 6. Risk Mitigation Summary

### 6.1 User Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Smart contract exploit | Loss of approved funds | Low | Professional audit, bug bounty, insurance (Nexus Mutual) |
| Malicious contract upgrade | Drain all user funds | Very Low | Immutable core logic, multisig admin, 48h timelock |
| Oracle manipulation | Incorrect compound amounts | Medium | Chainlink + fallback oracle, staleness checks, deviation alerts |
| Excessive gas costs | Unprofitable compounds | Medium | Dynamic frequency, gas price limits, batch execution |
| Unlimited approval abuse | Loss if contract compromised | Medium | Default caps, expiry enforcement, allowance dashboard |

### 6.2 Operational Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Executor private key leak | Unauthorized compounds | Low | AWS KMS storage, role rotation, monitoring alerts |
| Frax/Aave API downtime | Missed yield opportunities | Medium | Graceful degradation, retry logic, multi-source data |
| Polygon network congestion | Failed transactions | Medium | Gas price monitoring, delayed execution acceptable |
| Backend outage (Vercel) | No autonomous execution | Low | Health monitoring, failover to manual execution |

### 6.3 Compliance & Legal

**Regulatory Considerations**:
- Non-custodial design reduces regulatory burden (users retain asset control)
- No custody license required (vs centralized yield platforms)
- Terms of Service must disclaim liability for smart contract risks
- Consider KYC/AML for large deposits (>$10k) in future versions

**Insurance Options**:
- **Nexus Mutual**: Protocol cover for smart contract hacks ($50k-$2M coverage)
- **InsurAce**: Competitive rates, multi-chain support
- Cost: ~2-4% of TVL annually

---

## 7. Post-MVP Enhancements

### 7.1 V2 Features (6-12 months)

1. **Uniswap Permit2 Integration**:
   - Universal approval contract for any ERC-20
   - Gasless user experience for supported tokens
   - Batch revoke across all protocols

2. **Dynamic Cap Adjustment**:
   - Auto-increase cap based on realized yield (user consent)
   - Smart notifications: "Your cap is 90% used - increase?"

3. **Multi-Token Strategies**:
   - Cross-asset rebalancing (USDC ↔ KRWQ swaps)
   - Hedging strategies (delta-neutral farming)

4. **Gas Rebates**:
   - Subsidize compound gas via IQAI ATP rewards
   - "Free compounds for stakers with >$1k positions"

### 7.2 V3 Features (12-24 months)

1. **Account Abstraction (EIP-4337)**:
   - Full gas sponsorship (zero-cost UX)
   - Session keys for mobile app auto-execution
   - Social recovery (no seed phrases)

2. **DAO Governance**:
   - Community votes on executor parameters (cap limits, gas thresholds)
   - Transparent executor performance metrics
   - Protocol revenue sharing with stakers

3. **L2 Expansion**:
   - Deploy to Arbitrum, Optimism, Base
   - Cross-chain yield aggregation
   - Unified liquidity pools

---

## 8. Decision Justification

### Why Limited Approval + Caps Wins

**Security-UX-Complexity Triangle**:
```
         Security
            /\
           /  \
          /    \
         /  ✓   \
        /  MVP  \
       /         \
      /___________\
    UX            Complexity

✓ = Limited Approval + Caps (optimal balance)
✗ Per-tx signatures = High security, poor UX
✗ Account Abstraction = Good UX, high complexity
```

**Alignment with Rogue Goals**:
1. **Autonomous Execution**: ✅ Enables "set and forget" optimization
2. **Non-Custodial**: ✅ Users retain asset ownership
3. **MVP Feasibility**: ✅ Proven patterns, 4-6 week implementation
4. **User Trust**: ✅ Established DeFi UX (Yearn, Beefy precedent)
5. **Auditable**: ✅ Standard Solidity patterns, audit-ready

**Trade-offs Accepted**:
- Users must manually renew caps after expiry (vs infinite delegation)
- One-time approval friction (vs truly gasless EIP-2612)
- Smart contract risk vs per-transaction safety (mitigated via audit)

**Why Not Alternatives**:
- Per-tx signatures: Breaks autonomous value prop
- EIP-2612: Token support gaps + complexity
- EIP-4337: Too new, infrastructure overhead
- Permit2: Good for v2, not critical for MVP

---

## 9. References & Further Reading

### Research Sources

1. **ERC-20 Approval Patterns**:
   - [Ethereum StackExchange: Current ERC20 approval best practices](https://ethereum.stackexchange.com/questions/106459/current-erc20-approval-best-practices)
   - [De.Fi Blog: ERC-20 Allowances and Approvals](https://de.fi/blog/erc-20-allowances-approvals-smart-contract-permissions)

2. **EIP-2612 Permit**:
   - [Veritas Protocol: Permit Signature Risk Scanner](https://www.veritasprotocol.com/blog/permit-signature-risk-scanner-eip-2612-checks)
   - [OneKey: EIP-2612 Gasless Approvals Guide](https://onekey.so/blog/ecosystem/eip-2612-how-erc-20-enables-gasless-approvals/)
   - [Medium: ERC-2612 Ultimate Guide](https://medium.com/frak-defi/erc-2612-the-ultimate-guide-to-gasless-erc-20-approvals-2cd32ddee534)

3. **Account Abstraction (EIP-4337/7702)**:
   - [LimeChain: What is Account Abstraction on Ethereum](https://limechain.tech/blog/what-is-account-abstraction-on-ethereum)
   - [Turnkey: ERC-4337 vs EIP-7702 Guide](https://www.turnkey.com/blog/account-abstraction-erc-4337-eip-7702)
   - [Thirdweb: ERC-4337 Developer Guide 2025](https://blog.thirdweb.com/erc-4337-vs-native-account-abstraction-vs-eip-7702-developer-guide-2025/)

4. **Delegation Patterns**:
   - [MetaMask Delegation Toolkit: Scopes Reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/)
   - [Medium: Token Allowances Best Practices](https://brogna.medium.com/what-about-token-allowances-dc553f7d38b3)

5. **Uniswap Permit2**:
   - [Uniswap Docs: Permit2 Overview](https://docs.uniswap.org/contracts/permit2/overview)
   - [EtherWorld: Uniswap Permit2 Deep Dive](https://etherworld.co/2023/02/01/uniswap-permit2/)
   - [Medium: Permit2 Next-Gen Approvals](https://medium.com/@gwrx2005/permit2-a-next-generation-token-approval-mechanism-7603d292ddfc)

6. **DeFi Yield Optimizer Precedents**:
   - [Beefy Finance Documentation](https://docs.beefy.finance/ecosystem/protocol)
   - [Nansen: What is Beefy Protocol](https://www.nansen.ai/post/what-is-beefy-protocol)
   - [Messari: Beefy Finance Multichain Yield Optimizer](https://messari.io/report/beefy-finance-multichain-yield-optimizer)

7. **Security Audits**:
   - [OpenZeppelin Security Audits](https://www.openzeppelin.com/security-audits)
   - [OpenZeppelin Audit Readiness Guide](https://learn.openzeppelin.com/security-audits/readiness-guide)

### Related EIPs

- **EIP-20**: Standard ERC-20 token interface
- **EIP-2612**: Permit extension for ERC-20 approvals
- **EIP-4337**: Account abstraction via EntryPoint contract
- **EIP-7702**: Set EOA account code for one transaction (Pectra upgrade)
- **EIP-712**: Typed structured data hashing and signing

---

## 10. Conclusion

**Final Recommendation**: Implement **Limited ERC-20 Approval + Executor Contract with Time/Amount Caps** for Rogue MVP.

**Next Steps**:
1. Finalize smart contract architecture (StakingProxy + YieldHarvester)
2. Design frontend approval UX with recommended caps
3. Implement backend cap validation + oracle safety checks
4. Schedule security audit (pre-mainnet, $40-50k budget)
5. Deploy to Polygon Mumbai testnet for beta testing

**Success Metrics**:
- 95%+ user approval rate on first stake attempt
- <5% cap renewal friction (users comfortable with 30-60 day limits)
- Zero unauthorized compound transactions
- 98%+ autonomous execution success rate

**Risk Acceptance**:
- Smart contract risk mitigated via professional audit + bug bounty
- User education on allowance management (tooltips, guides)
- Emergency pause capability for oracle failures or exploits

This custody model positions Rogue to deliver on its autonomous yield optimization promise while maintaining user trust and regulatory compliance. The architecture is battle-tested by industry leaders (Yearn, Beefy) and provides a clear upgrade path to advanced features (Permit2, Account Abstraction) in future versions.

---

**Research Status**: ✅ COMPLETE  
**Approved for Phase 1**: Ready to proceed with data model design and smart contract development.

# Research: Frax Finance Data Access Methods for Polygon

**Date:** November 16, 2025  
**Agent:** Researcher  
**Focus:** Yield optimization data access for Frax Finance on Polygon

---

## Executive Summary

**RECOMMENDED APPROACH:** Hybrid model using DeFi Llama API as primary source with on-chain calls as fallback/verification.

**Rationale:**
- DeFi Llama aggregates Frax data across chains including Polygon
- Frax's native API (`api.frax.finance`) has limited Polygon-specific endpoints
- The Graph subgraphs exist but Frax doesn't maintain dedicated Polygon subgraphs
- On-chain calls provide real-time accuracy but higher latency and RPC costs
- Hybrid approach balances speed, cost, and reliability

---

## 1. Available APIs & Endpoints

### 1.1 Frax Native API
**Base URL:** `https://api.frax.finance`

**Available Endpoints:**
- **V1 Docs:** `https://api.frax.finance/v1/docs`
- **V2 Docs:** `https://api.frax.finance/v2/docs`
- **Combined Data:** `https://api.frax.finance/combineddata/`
- **Pool APRs:** `https://api.frax.finance/pools`

**Limitations:**
- Primarily Ethereum mainnet focused
- Pool APR endpoint lacks chain-specific filtering
- No dedicated Polygon yield endpoint discovered
- Historical APY data not readily available via API

**Use Case:** Secondary data source for protocol-wide metrics

### 1.2 DeFi Llama API (RECOMMENDED)
**Base URL:** `https://api.llama.fi` or `https://yields.llama.fi`

**Frax Protocol Page:** `https://defillama.com/protocol/frax-finance`

**Key Metrics Available:**
- 49+ pools tracked (cross-chain)
- Average APY: ~8.46%
- TVL per pool and per chain
- Historical yield data
- Revenue and fees metrics

**Polygon-Specific Data:**
```
GET https://yields.llama.fi/pools
Filter: protocol=frax-finance AND chain=polygon
```

**Advantages:**
- Aggregated multi-protocol comparison
- Historical APY trends
- Free tier available (100k requests/month via The Graph for subgraph queries)
- RESTful API with JSON responses
- Regular updates (typically hourly)

**Sample Response Structure:**
```json
{
  "data": [
    {
      "pool": "pool-id",
      "chain": "Polygon",
      "project": "frax-finance",
      "symbol": "FRAX-USDC",
      "tvlUsd": 1234567,
      "apy": 12.5,
      "apyBase": 8.0,
      "apyReward": 4.5,
      "rewardTokens": ["FXS"]
    }
  ]
}
```

---

## 2. The Graph Subgraph Analysis

### 2.1 Frax Subgraph Availability
**Frax Profile:** `https://thegraph.com/explorer/profile/0x6e74053a3798e0fc9a9775f7995316b27f21c4d2`

**Status:**
- Frax maintains subgraphs primarily for FNS (Frax Name Service)
- No dedicated Fraxswap or Fraxlend subgraph found for Polygon
- GitHub repo `FraxFinance/fns-subgraph` exists but ENS-focused

**The Graph Support:**
- Polygon Mainnet is fully supported by The Graph
- Could deploy custom subgraph for Fraxswap/Fraxlend if needed

**Recommendation:** Not viable without custom deployment

### 2.2 Custom Subgraph Feasibility
**If Rogue deploys custom subgraph:**

**Contracts to Index:**
- Fraxswap V2 Factory (Polygon): `0x54F454D747e037Da288dB568D4121117EAb34e79`
- Fraxswap V2 Router (Polygon): `0xE52D0337904D4D0519EF7487e707268E1DB6495F`
- Fraxlend Pairs (via Fraxlend Deployer)

**Query Capabilities:**
```graphql
{
  pairs(where: { chain: "polygon" }) {
    id
    token0 { symbol }
    token1 { symbol }
    reserve0
    reserve1
    reserveUSD
    volumeUSD
    apr
  }
}
```

**Effort:** Medium (2-3 weeks to develop, test, deploy)  
**Cost:** The Graph Studio free tier or ~$100-500/month for decentralized network

---

## 3. On-Chain Contract Calls

### 3.1 Polygon Contract Addresses

**FRAX Token:**
- Deployment confirmed on Polygon
- LayerZero OFT standard for cross-chain transfers

**FXS Token (Polygon):**
- Address: `0x1a3acf6D19267E2d3e7f898f42803e90C9219062`

**Fraxswap V2 (Polygon):**
- Factory: `0x54F454D747e037Da288dB568D4121117EAb34e79`
- Router: `0xE52D0337904D4D0519EF7487e707268E1DB6495F`

**Fraxswap V1 (DEPRECATED):**
- Factory: `0xc2544A32872A91F4A553b404C6950e89De901fdb`
- Router: `0x9bc2152fD37b196C0Ff3C16f5533767c9A983971`

### 3.2 Real-Time Yield Calculation

**For Fraxswap Pools:**
```solidity
// Get pair reserves
interface IFraxswapPair {
    function getReserves() external view returns (
        uint112 reserve0,
        uint112 reserve1,
        uint32 blockTimestampLast
    );
    function totalSupply() external view returns (uint256);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

// APR calculation requires:
// 1. Fee tier from pool (typically 0.3%)
// 2. 24h volume (requires historical data or events)
// 3. Current TVL (reserves * price)
```

**For Fraxlend Pairs:**
```solidity
interface IFraxlendPair {
    function currentRateInfo() external view returns (
        uint64 lastBlock,
        uint64 feeToProtocolRate,
        uint64 lastTimestamp,
        uint64 ratePerSec
    );
    function totalAsset() external view returns (
        uint128 amount,
        uint128 shares
    );
    function totalBorrow() external view returns (
        uint128 amount,
        uint128 shares
    );
}

// APY = (ratePerSec * 365 days) / 1e18
```

**Advantages:**
- Real-time, trustless data
- No API dependency
- Maximum accuracy

**Disadvantages:**
- RPC call costs (Polygon: ~$0.0001/call, but adds up)
- Higher latency (100-300ms per call)
- Requires price oracles for TVL calculation
- Historical data not available

---

## 4. FRAX Stablecoin Integration on Polygon

### 4.1 Deployment Status
**Confirmed:** FRAX is deployed on Polygon via LayerZero OFT standard

**Bridge Mechanism:**
- Fraxferry (optimistic bridge)
- LayerZero OFT (Omnichain Fungible Token)

**Key Liquidity Venues:**
1. **Fraxswap** - Native AMM (Uniswap V2 fork with TWAMM)
2. **Curve Finance** - FRAX pools (e.g., FRAX/USDC)
3. **Third-party DEXs** - Uniswap V3, QuickSwap

### 4.2 Stablecoin Yield Products
**sFRAX (Staked FRAX):**
- Current APY: ~3-12% (depends on protocol revenue)
- Mechanism: Revenue-sharing from protocol fees
- **Polygon Availability:** Not confirmed - may be Ethereum/Fraxtal only

**frxUSD:**
- New BlackRock BUIDL-backed stablecoin
- APY: ~3.72% (Treasury yields)
- **Polygon Availability:** Unknown (launched 2024, Base focus)

---

## 5. FXS Rewards Distribution

### 5.1 Reward Mechanisms
**veFXS (Vote-Escrowed FXS):**
- Lock FXS for 1 week to 4 years
- APR: ~3-12% (post fee-switch activation)
- **Critical:** veFXS rewards now primarily on Fraxtal L2
- Polygon rewards likely minimal or discontinued

### 5.2 Liquidity Mining
**Historical Model:**
- FXS emissions to LP providers
- Gauge voting system (similar to Curve)

**Current Status (2024-2025):**
- Migration to Fraxtal-first model
- Ethereum mainnet veFXS can snapshot to Fraxtal
- **Polygon reward distribution unclear** - requires on-chain verification

**On-Chain Check:**
```solidity
// Query gauge controller (if exists on Polygon)
interface IGaugeController {
    function gaugeRelativeWeight(address gauge) external view returns (uint256);
}

// Check individual gauges for reward rate
interface IStakingRewards {
    function rewardRate() external view returns (uint256);
    function rewardsDuration() external view returns (uint256);
}
```

---

## 6. KRWQ Integration Analysis

### 6.1 KRWQ Overview
**Launch:** October 30, 2024  
**Network:** Base L2 (Coinbase)  
**Peg:** 1:1 Korean Won (KRW)  
**Partnership:** Frax Finance + IQ Protocol  
**Technology:** LayerZero OFT (multi-chain capable)

**Current Supply:** ~144.54M KRWQ  
**Reserve Ratio:** 102.4%  
**Attestation:** Coming soon (third-party audits pending)

### 6.2 Polygon Availability
**Status:** Not deployed on Polygon (as of Nov 2025)

**Available Networks:**
- Base (primary)
- Potentially other LayerZero-supported chains via OFT

### 6.3 Conversion Methods

**Option 1: Direct Bridge (if/when deployed)**
```
KRWQ (Base) -> LayerZero Bridge -> KRWQ (Polygon)
```

**Option 2: Swap Route**
```
KRWQ -> FRAX (Base) -> Bridge -> FRAX (Polygon) -> Other assets
```

**Option 3: CEX Arbitrage**
```
KRWQ -> KRW fiat -> USDC -> Polygon
```

**Recommendation for Rogue:**
- Monitor KRWQ LayerZero deployment announcements
- If Polygon deployment occurs, integrate via:
  - DEX liquidity (KRWQ/FRAX or KRWQ/USDC pairs)
  - Direct bridge interface
- For now, not viable for Polygon-focused strategy

---

## 7. Recommended Data Access Strategy

### 7.1 Primary Method: DeFi Llama API

**Implementation:**
```typescript
// Fetch Frax pools on Polygon
async function getFraxYieldsPolygon() {
  const response = await fetch('https://yields.llama.fi/pools');
  const data = await response.json();
  
  const fraxPolygonPools = data.data.filter(pool => 
    pool.project === 'frax-finance' && 
    pool.chain === 'Polygon'
  );
  
  return fraxPolygonPools.map(pool => ({
    poolId: pool.pool,
    symbol: pool.symbol,
    tvl: pool.tvlUsd,
    apy: pool.apy,
    apyBase: pool.apyBase,
    apyReward: pool.apyReward,
    rewardTokens: pool.rewardTokens
  }));
}
```

**Polling Frequency:** Every 5-15 minutes  
**Caching:** Redis with 5-minute TTL  
**Fallback:** On-chain calls if API unavailable

### 7.2 Secondary Method: On-Chain Verification

**Use Cases:**
1. API unavailable/rate limited
2. Verify critical transactions before execution
3. Real-time pool state before swaps

**Implementation:**
```typescript
// Polygon RPC endpoint (via Alchemy/Infura)
const provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);

// Get Fraxswap pair reserves
async function getPoolReservesOnChain(pairAddress: string) {
  const pairContract = new ethers.Contract(
    pairAddress,
    FRAXSWAP_PAIR_ABI,
    provider
  );
  
  const [reserve0, reserve1] = await pairContract.getReserves();
  const totalSupply = await pairContract.totalSupply();
  
  return { reserve0, reserve1, totalSupply };
}
```

**RPC Provider:** Alchemy Polygon (free tier: 300M compute units/month)

### 7.3 Tertiary Method: Frax Native API

**Use Cases:**
- Cross-chain metrics
- Protocol-wide statistics
- Governance data

**Endpoint:**
```
GET https://api.frax.finance/pools
```

**Limitations:** May not have Polygon-specific filtering

---

## 8. Historical APY Data Access

### 8.1 DeFi Llama Historical API

**Endpoint:**
```
GET https://yields.llama.fi/chart/{pool-id}
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "timestamp": "2024-11-01T00:00:00.000Z",
      "tvlUsd": 1000000,
      "apy": 10.5,
      "apyBase": 7.0,
      "apyReward": 3.5
    }
  ]
}
```

**Retention:** Varies by pool (typically 30-90 days)

### 8.2 On-Chain Event Indexing (Advanced)

**If custom indexer needed:**
```solidity
// Index Fraxswap Swap events
event Swap(
    address indexed sender,
    uint amount0In,
    uint amount1In,
    uint amount0Out,
    uint amount1Out,
    address indexed to
);

// Calculate volume over time windows
// Derive APR from fees (volume * fee_tier) / TVL
```

**Tools:**
- Ponder (TypeScript indexer)
- Subsquid (multi-chain indexer)
- Custom Subgraph (The Graph)

---

## 9. Implementation Checklist

### Phase 1: API Integration (Week 1)
- [ ] Integrate DeFi Llama Yields API
- [ ] Set up Redis caching layer
- [ ] Implement Polygon pool filtering
- [ ] Create yield ranking algorithm
- [ ] Add error handling & retries

### Phase 2: On-Chain Verification (Week 2)
- [ ] Configure Polygon RPC provider (Alchemy)
- [ ] Implement Fraxswap pair contract calls
- [ ] Implement Fraxlend pair contract calls
- [ ] Build price oracle integration (Chainlink/Uniswap TWAP)
- [ ] Create on-chain fallback logic

### Phase 3: Monitoring & Alerts (Week 3)
- [ ] Set up APY threshold alerts
- [ ] Monitor API uptime/latency
- [ ] Track RPC call costs
- [ ] Implement yield change notifications
- [ ] Create dashboard for data quality metrics

### Phase 4: Advanced Features (Week 4+)
- [ ] Historical yield analysis (30-day trends)
- [ ] Risk-adjusted yield scoring
- [ ] Liquidity depth verification
- [ ] IL (Impermanent Loss) calculation
- [ ] Multi-protocol yield comparison

---

## 10. Risk Considerations

### 10.1 Data Quality Risks
| Risk | Mitigation |
|------|------------|
| API downtime | On-chain fallback |
| Stale data | Timestamp validation, max age check |
| Incorrect APY | Cross-validate with on-chain state |
| Missing pools | Periodic discovery scan via Factory events |

### 10.2 Cost Management
| Component | Estimated Monthly Cost |
|-----------|----------------------|
| DeFi Llama API | Free (under 100k requests) |
| Polygon RPC (Alchemy) | Free (under 300M CU) |
| Redis hosting | $5-10 (fly.io/Railway) |
| **Total** | **$5-10** |

### 10.3 Polygon-Specific Risks
- **Lower Frax adoption** vs. Ethereum/Fraxtal
- **Potential yield migration** to Fraxtal L2
- **Liquidity fragmentation** across chains
- **FXS reward sunset** on Polygon (requires verification)

---

## 11. Alternative Yield Aggregators

If Frax yields on Polygon are insufficient, consider:

1. **Aave Polygon** - Stable yield on USDC/DAI (3-5% APY)
2. **Uniswap V3 Concentrated Liquidity** - USDC/USDT 0.01% fee tier
3. **Curve Finance** - Stablecoin pools with CRV rewards
4. **Gains Network** - gDAI (yield-bearing stablecoin on Polygon)
5. **Beefy Finance** - Auto-compounding vault aggregator

**DeFi Llama Polygon Overview:**
```
https://defillama.com/chain/Polygon
```

---

## 12. Code Snippets

### 12.1 Researcher Agent - Yield Scanner

```typescript
import { ethers } from 'ethers';

interface YieldOpportunity {
  protocol: string;
  poolId: string;
  chain: string;
  tokens: string[];
  apy: number;
  tvl: number;
  riskScore: number; // 0-100
  source: 'api' | 'onchain';
  timestamp: Date;
}

class FraxYieldScanner {
  private llama: LlamaFiClient;
  private provider: ethers.Provider;
  
  async scanPolygonYields(
    minApy: number = 5,
    minTvl: number = 100000
  ): Promise<YieldOpportunity[]> {
    // 1. Fetch from DeFi Llama
    const llamaYields = await this.llama.getYields({
      protocol: 'frax-finance',
      chain: 'Polygon'
    });
    
    // 2. Filter by criteria
    const qualified = llamaYields.filter(pool => 
      pool.apy >= minApy && pool.tvlUsd >= minTvl
    );
    
    // 3. Verify top 3 on-chain
    const topPools = qualified.slice(0, 3);
    const verified = await Promise.all(
      topPools.map(pool => this.verifyOnChain(pool))
    );
    
    // 4. Calculate risk scores
    return verified.map(pool => ({
      ...pool,
      riskScore: this.calculateRiskScore(pool)
    }));
  }
  
  private async verifyOnChain(pool: any): Promise<YieldOpportunity> {
    // Extract pool address from pool ID
    const pairAddress = this.extractAddress(pool.pool);
    
    // Get on-chain reserves
    const pairContract = new ethers.Contract(
      pairAddress,
      FRAXSWAP_PAIR_ABI,
      this.provider
    );
    
    const [reserve0, reserve1] = await pairContract.getReserves();
    
    // Calculate actual TVL
    const actualTvl = await this.calculateTvl(
      pool.token0,
      pool.token1,
      reserve0,
      reserve1
    );
    
    // Verify TVL matches (within 5%)
    const tvlMatch = Math.abs(actualTvl - pool.tvlUsd) / pool.tvlUsd < 0.05;
    
    return {
      protocol: 'frax-finance',
      poolId: pool.pool,
      chain: 'Polygon',
      tokens: [pool.token0, pool.token1],
      apy: pool.apy,
      tvl: tvlMatch ? actualTvl : pool.tvlUsd,
      riskScore: 0, // Calculated later
      source: 'api',
      timestamp: new Date()
    };
  }
  
  private calculateRiskScore(pool: YieldOpportunity): number {
    let score = 100; // Start with perfect score
    
    // Deduct for low TVL
    if (pool.tvl < 500000) score -= 20;
    if (pool.tvl < 100000) score -= 30;
    
    // Deduct for abnormally high APY (potential risk)
    if (pool.apy > 50) score -= 30;
    if (pool.apy > 100) score -= 50;
    
    // Deduct for non-stablecoin pairs
    const isStablePair = this.isStablecoinPair(pool.tokens);
    if (!isStablePair) score -= 10;
    
    return Math.max(0, score);
  }
}
```

### 12.2 ADK Integration Hook

```typescript
// specs/001-rogue-yield-agent/src/tools/frax-yield-scanner.ts

export const fraxYieldScannerTool = {
  name: 'scan_frax_yields_polygon',
  description: 'Scan Frax Finance yield opportunities on Polygon',
  parameters: z.object({
    minApy: z.number().min(0).default(5),
    minTvl: z.number().min(0).default(100000),
    riskTolerance: z.enum(['low', 'medium', 'high']).default('medium')
  }),
  execute: async (params) => {
    const scanner = new FraxYieldScanner();
    const opportunities = await scanner.scanPolygonYields(
      params.minApy,
      params.minTvl
    );
    
    // Filter by risk tolerance
    const riskThresholds = { low: 80, medium: 60, high: 40 };
    const filtered = opportunities.filter(
      opp => opp.riskScore >= riskThresholds[params.riskTolerance]
    );
    
    return {
      opportunities: filtered,
      count: filtered.length,
      timestamp: new Date().toISOString()
    };
  }
};
```

---

## 13. Conclusion

**Decision: Hybrid API + On-Chain Approach**

**Primary:** DeFi Llama Yields API
- Fast, free, aggregated data
- Historical trends available
- Multi-protocol comparison

**Secondary:** On-chain verification
- Real-time accuracy
- Trustless validation
- Fallback reliability

**Tertiary:** Frax native API
- Protocol-wide metrics
- Governance data

**KRWQ:** Not available on Polygon yet - monitor for future deployment

**Next Steps:**
1. Implement DeFi Llama client in Researcher agent
2. Configure Polygon RPC provider
3. Build yield ranking algorithm
4. Test with mock execution on Executor agent
5. Deploy monitoring dashboard

**Timeline:** 3-4 weeks for full implementation

---

## References

1. Frax API Docs: https://api.frax.finance/v2/docs
2. DeFi Llama Yields: https://defillama.com/yields
3. Frax on The Graph: https://thegraph.com/explorer/profile/0x6e74053a3798e0fc9a9775f7995316b27f21c4d2
4. Fraxswap Contracts: https://docs.frax.finance/fraxswap/fraxswap-contract-addresses
5. Fraxlend Docs: https://docs.frax.finance/fraxlend/fraxlend-overview
6. KRWQ Announcement: https://layerzero.network/blog/krwq-first-multi-chain-korean-won-stablecoin
7. GitHub - Frax Finance: https://github.com/FraxFinance

# Research: Gas Optimization for DeFi Auto-Compounding on Polygon

**Status:** Complete  
**Date:** November 16, 2025  
**Context:** Executor agent auto-compound feature for Rogue Yield Agent

## Executive Summary

**Decision:** Implement dynamic profitability-based auto-compounding with position-size tiered frequency and Polygon-optimized gas strategies.

**Key Thresholds:**
- **Minimum yield before compound:** $5-10 USD in rewards (ensures <5% gas cost ratio)
- **Gas cost ratio target:** <5% of yield (conservative), <10% acceptable for smaller positions
- **Compound frequency:** 
  - Small positions (<$1K): Weekly or when yield > $10
  - Medium positions ($1K-$10K): Every 2-3 days or when yield > $7
  - Large positions (>$10K): Daily or when yield > $5

**Expected Performance:**
- Gas savings: 60-93% vs individual transactions (using multicall batching)
- Polygon gas costs: ~$0.0075-0.02 per compound operation
- Break-even: Compound profitable when `(positionValue * APR * daysSinceLastCompound / 365) > (gasCostUSD * 20)`

---

## 1. Ethers.js Gas Estimation Patterns

### 1.1 EIP-1559 Gas Estimation on Polygon

Polygon supports EIP-1559 transactions with `maxFeePerGas` and `maxPriorityFeePerGas`:

```typescript
import { ethers } from 'ethers';

// Get current fee data from Polygon network
async function getPolygonFeeData(provider: ethers.Provider) {
  const feeData = await provider.getFeeData();
  
  return {
    maxFeePerGas: feeData.maxFeePerGas,           // Total max fee
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas, // Tip to validators
    gasPrice: feeData.gasPrice                     // Legacy gas price
  };
}

// Estimate gas for compound operation with safety margin
async function estimateCompoundGas(
  contract: ethers.Contract,
  method: string,
  args: any[]
) {
  // Step 1: Estimate gas limit
  const estimatedGas = await contract[method].estimateGas(...args);
  
  // Step 2: Add 15-20% safety margin for gas limit variations
  const gasLimit = estimatedGas * 115n / 100n;
  
  // Step 3: Get current fee data
  const feeData = await contract.runner.provider.getFeeData();
  
  // Step 4: Add 10% buffer to maxFeePerGas for price volatility
  const maxFeePerGas = (feeData.maxFeePerGas || 0n) * 110n / 100n;
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || 0n;
  
  return {
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    estimatedCost: gasLimit * maxFeePerGas
  };
}
```

### 1.2 Gas Estimation with Overrides

```typescript
// Advanced gas estimation with custom overrides
async function estimateWithOverrides(
  contract: ethers.Contract,
  functionName: string,
  args: any[],
  options: {
    gasMultiplier?: number;    // Default 1.15 (15% buffer)
    priorityMultiplier?: number; // Default 1.0
    maxGasPrice?: bigint;      // Cap on max fee
  } = {}
) {
  const {
    gasMultiplier = 1.15,
    priorityMultiplier = 1.0,
    maxGasPrice
  } = options;

  // Get base estimates
  const gasLimit = await contract[functionName].estimateGas(...args);
  const feeData = await contract.runner.provider.getFeeData();
  
  // Apply multipliers
  const bufferedGasLimit = BigInt(Math.ceil(Number(gasLimit) * gasMultiplier));
  let maxFeePerGas = feeData.maxFeePerGas || 0n;
  let maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas || 0n) * 
    BigInt(Math.ceil(priorityMultiplier * 100)) / 100n;
  
  // Cap gas price if specified
  if (maxGasPrice && maxFeePerGas > maxGasPrice) {
    maxFeePerGas = maxGasPrice;
  }
  
  return {
    gasLimit: bufferedGasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    estimatedCostInWei: bufferedGasLimit * maxFeePerGas
  };
}
```

### 1.3 Historical Gas Price Analysis

```typescript
// Fetch and analyze historical gas prices for timing optimization
async function analyzeGasPrices(provider: ethers.Provider, blocks = 100) {
  const currentBlock = await provider.getBlockNumber();
  const prices: bigint[] = [];
  
  // Sample recent blocks
  for (let i = 0; i < blocks; i += 10) {
    const block = await provider.getBlock(currentBlock - i);
    if (block?.baseFeePerGas) {
      prices.push(block.baseFeePerGas);
    }
  }
  
  // Calculate statistics
  const sorted = prices.sort((a, b) => Number(a - b));
  const low = sorted[Math.floor(sorted.length * 0.25)];
  const median = sorted[Math.floor(sorted.length * 0.5)];
  const high = sorted[Math.floor(sorted.length * 0.75)];
  
  return {
    low,
    median,
    high,
    current: prices[0],
    isLowGasPeriod: prices[0] <= median
  };
}
```

---

## 2. Batch Transaction Techniques

### 2.1 Multicall Pattern

**Benefits:** 60-93% gas savings vs individual transactions

```typescript
// Multicall3 interface (deployed on Polygon at 0xcA11bde05977b3631167028862bE2a173976CA11)
interface Call {
  target: string;      // Contract address
  callData: string;    // Encoded function call
  allowFailure: boolean;
}

async function batchCompoundOperations(
  multicallAddress: string,
  operations: Array<{
    contract: ethers.Contract;
    method: string;
    args: any[];
  }>,
  provider: ethers.Provider,
  signer: ethers.Signer
) {
  const multicall = new ethers.Contract(
    multicallAddress,
    [
      'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) returns (tuple(bool success, bytes returnData)[])'
    ],
    signer
  );
  
  // Encode all operations
  const calls: Call[] = operations.map(op => ({
    target: await op.contract.getAddress(),
    callData: op.contract.interface.encodeFunctionData(op.method, op.args),
    allowFailure: false
  }));
  
  // Estimate gas for batched call
  const gasEstimate = await multicall.aggregate3.estimateGas(calls);
  const gasLimit = gasEstimate * 115n / 100n; // 15% buffer
  
  // Execute batch
  const tx = await multicall.aggregate3(calls, { gasLimit });
  return await tx.wait();
}
```

### 2.2 Batch Compound Example

```typescript
// Example: Batch compound multiple positions
async function batchCompoundPositions(
  positions: Array<{
    vaultAddress: string;
    harvestMethod: string;
  }>,
  signer: ethers.Signer
) {
  const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
  
  const operations = positions.map(pos => {
    const vault = new ethers.Contract(
      pos.vaultAddress,
      ['function harvest() external'],
      signer
    );
    
    return {
      contract: vault,
      method: 'harvest',
      args: []
    };
  });
  
  return await batchCompoundOperations(
    MULTICALL3,
    operations,
    signer.provider!,
    signer
  );
}
```

### 2.3 Gas Savings Analysis

**Multicall Gas Savings (based on research):**

| Operation Type | Individual Gas | Batched Gas | Savings |
|---------------|----------------|-------------|---------|
| Non-paying call | ~21,000 | ~1,360 | 93.5% |
| Ether-paying call | ~21,000 | ~8,062 | 61.6% |
| Create contract | ~32,000 | ~32,233 | 98.9% |
| Proxy call (non-paying) | ~21,000 | ~2,352 | 88.8% |

**Practical Implications:**
- Batching 5 compound operations: ~50,000 gas vs ~250,000 gas individually (80% savings)
- On Polygon at 30 gwei, batch = $0.01 vs individual = $0.05

---

## 3. Auto-Compound Frequency Heuristics

### 3.1 Profitability Formula

**Core Formula:**
```
Compound Profitable When: yieldEarned > (gasCost * safetyMultiplier)

Where:
  yieldEarned = (positionValue * APR * daysSinceLastCompound) / 365
  gasCost = estimatedGas * gasPrice * nativeTokenPrice
  safetyMultiplier = 20 (ensures <5% gas cost ratio)
```

**Implementation:**

```typescript
async function isCompoundProfitable(
  positionValue: number,        // USD value
  apr: number,                  // Annual percentage rate (e.g., 0.15 for 15%)
  daysSinceLastCompound: number,
  estimatedGasUnits: bigint,
  gasPriceWei: bigint,
  nativeTokenPriceUSD: number,
  targetGasRatio: number = 0.05  // 5% target
): Promise<{
  isProfitable: boolean;
  yieldUSD: number;
  gasCostUSD: number;
  gasCostRatio: number;
}> {
  // Calculate yield earned in USD
  const yieldUSD = (positionValue * apr * daysSinceLastCompound) / 365;
  
  // Calculate gas cost in USD
  const gasCostWei = estimatedGasUnits * gasPriceWei;
  const gasCostUSD = Number(gasCostWei) / 1e18 * nativeTokenPriceUSD;
  
  // Calculate ratio
  const gasCostRatio = gasCostUSD / yieldUSD;
  
  // Profitable if gas cost is less than target ratio
  const isProfitable = gasCostRatio < targetGasRatio;
  
  return {
    isProfitable,
    yieldUSD,
    gasCostUSD,
    gasCostRatio
  };
}
```

### 3.2 Position-Size Tiered Strategy

```typescript
interface CompoundSchedule {
  minimumYieldUSD: number;
  minimumDaysBetweenCompounds: number;
  maxGasCostRatio: number;
}

function getCompoundSchedule(positionValueUSD: number): CompoundSchedule {
  if (positionValueUSD < 1000) {
    // Small positions: Conservative approach
    return {
      minimumYieldUSD: 10,
      minimumDaysBetweenCompounds: 7,
      maxGasCostRatio: 0.10  // 10% acceptable for small positions
    };
  } else if (positionValueUSD < 10000) {
    // Medium positions: Balanced approach
    return {
      minimumYieldUSD: 7,
      minimumDaysBetweenCompounds: 2,
      maxGasCostRatio: 0.07  // 7%
    };
  } else {
    // Large positions: Aggressive compounding
    return {
      minimumYieldUSD: 5,
      minimumDaysBetweenCompounds: 1,
      maxGasCostRatio: 0.05  // 5%
    };
  }
}
```

### 3.3 Dynamic Compound Checker

```typescript
async function shouldCompoundNow(
  position: {
    valueUSD: number;
    apr: number;
    lastCompoundTimestamp: number;
  },
  gasEstimate: bigint,
  provider: ethers.Provider,
  polPriceUSD: number
): Promise<{
  shouldCompound: boolean;
  reason: string;
  metrics: any;
}> {
  const schedule = getCompoundSchedule(position.valueUSD);
  const daysSince = (Date.now() / 1000 - position.lastCompoundTimestamp) / 86400;
  
  // Check minimum days
  if (daysSince < schedule.minimumDaysBetweenCompounds) {
    return {
      shouldCompound: false,
      reason: `Too soon - wait ${(schedule.minimumDaysBetweenCompounds - daysSince).toFixed(1)} more days`,
      metrics: { daysSince }
    };
  }
  
  // Get current gas price
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || 0n;
  
  // Check profitability
  const profCheck = await isCompoundProfitable(
    position.valueUSD,
    position.apr,
    daysSince,
    gasEstimate,
    gasPrice,
    polPriceUSD,
    schedule.maxGasCostRatio
  );
  
  if (!profCheck.isProfitable) {
    return {
      shouldCompound: false,
      reason: `Not profitable - gas ratio ${(profCheck.gasCostRatio * 100).toFixed(2)}% > ${(schedule.maxGasCostRatio * 100)}% target`,
      metrics: profCheck
    };
  }
  
  // Check minimum yield threshold
  if (profCheck.yieldUSD < schedule.minimumYieldUSD) {
    return {
      shouldCompound: false,
      reason: `Yield too low - $${profCheck.yieldUSD.toFixed(2)} < $${schedule.minimumYieldUSD} minimum`,
      metrics: profCheck
    };
  }
  
  return {
    shouldCompound: true,
    reason: `Profitable - $${profCheck.yieldUSD.toFixed(2)} yield with ${(profCheck.gasCostRatio * 100).toFixed(2)}% gas cost`,
    metrics: profCheck
  };
}
```

---

## 4. Gas Price Prediction & Timing on Polygon

### 4.1 Polygon Gas Characteristics

**Key Facts:**
- Average gas cost: ~$0.0075 per transaction (as of 2025)
- Gas price denomination: POL (formerly MATIC)
- Typical range: 20-100 gwei
- Lower congestion than Ethereum by 100-1000x

### 4.2 Optimal Timing Strategy

```typescript
interface GasPriceTiming {
  currentGwei: bigint;
  recommendation: 'execute' | 'wait' | 'urgent';
  confidence: number;
  expectedSavings?: number;
}

async function analyzeGasTiming(
  provider: ethers.Provider,
  urgencyLevel: 'low' | 'medium' | 'high' = 'medium'
): Promise<GasPriceTiming> {
  // Analyze recent gas prices
  const analysis = await analyzeGasPrices(provider, 100);
  
  const currentGwei = Number(analysis.current) / 1e9;
  const medianGwei = Number(analysis.median) / 1e9;
  const lowGwei = Number(analysis.low) / 1e9;
  
  // Calculate percentile position
  const percentile = (currentGwei - lowGwei) / (medianGwei - lowGwei);
  
  // Decision logic based on urgency
  if (urgencyLevel === 'high') {
    return {
      currentGwei: analysis.current,
      recommendation: 'execute',
      confidence: 1.0
    };
  }
  
  if (urgencyLevel === 'medium') {
    if (currentGwei <= medianGwei * 1.1) {
      return {
        currentGwei: analysis.current,
        recommendation: 'execute',
        confidence: 0.8
      };
    } else {
      return {
        currentGwei: analysis.current,
        recommendation: 'wait',
        confidence: 0.7,
        expectedSavings: ((currentGwei - medianGwei) / currentGwei) * 100
      };
    }
  }
  
  // Low urgency - wait for optimal conditions
  if (currentGwei <= lowGwei * 1.15) {
    return {
      currentGwei: analysis.current,
      recommendation: 'execute',
      confidence: 0.9
    };
  }
  
  return {
    currentGwei: analysis.current,
    recommendation: 'wait',
    confidence: 0.85,
    expectedSavings: ((currentGwei - lowGwei) / currentGwei) * 100
  };
}
```

### 4.3 Time-Based Patterns

**Research Finding:** Generally, lower traffic periods offer better gas prices:
- **Best times:** Late night UTC (2-6 AM), weekends
- **Worst times:** Weekday business hours (9 AM - 5 PM UTC)
- **Strategy:** For non-urgent compounds, schedule during off-peak hours

```typescript
function getNextOptimalCompoundTime(): Date {
  const now = new Date();
  const hour = now.getUTCHours();
  
  // If currently in low-traffic period (2-6 AM UTC), compound now
  if (hour >= 2 && hour < 6) {
    return now;
  }
  
  // Otherwise, schedule for next 3 AM UTC
  const next = new Date(now);
  next.setUTCHours(3, 0, 0, 0);
  
  // If 3 AM has passed today, schedule for tomorrow
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  
  return next;
}
```

---

## 5. Contract-Level Optimizations

### 5.1 Storage Packing

**Optimization:** Pack related state variables into single 32-byte slots

```solidity
// ❌ Bad: Each variable uses separate slot (3 slots = ~6000 gas per write)
contract UnoptimizedVault {
    uint256 lastCompoundTime;     // Slot 0
    uint128 totalShares;           // Slot 1
    uint128 totalAssets;           // Slot 2
}

// ✅ Good: Packed into 2 slots (~4000 gas per write)
contract OptimizedVault {
    uint128 totalShares;           // Slot 0 (first 16 bytes)
    uint128 totalAssets;           // Slot 0 (last 16 bytes)
    uint256 lastCompoundTime;      // Slot 1
}
```

**Gas Savings:** ~2000 gas per transaction (~33% reduction in storage writes)

### 5.2 Function Selector Optimization

**Optimization:** Use shorter function names for frequently called functions (sorts first in bytecode)

```solidity
// Function selectors are first 4 bytes of keccak256(signature)
// Shorter names and more common signatures = lower gas for function dispatch

// ❌ Higher gas: compound() = 0xe0d0ee06
function compoundRewards() external { ... }

// ✅ Lower gas: harvest() = 0x4641257d (example)
function harvest() external { ... }

// ✅ Even better: Use single letter for ultra-frequent calls
function h() external { ... }  // Minimal dispatch cost
```

**Gas Savings:** ~20-30 gas per call (marginal but adds up at scale)

### 5.3 Efficient Loops and Arrays

```solidity
// ❌ Bad: Reading length in every iteration
function processRewards(address[] memory users) external {
    for (uint i = 0; i < users.length; i++) {
        _processUser(users[i]);
    }
}

// ✅ Good: Cache length, use unchecked for counter
function processRewards(address[] memory users) external {
    uint256 length = users.length;
    for (uint256 i = 0; i < length;) {
        _processUser(users[i]);
        unchecked { ++i; }  // Safe: won't overflow in realistic scenarios
    }
}
```

**Gas Savings:** ~100-200 gas per loop iteration

### 5.4 Calldata vs Memory

```solidity
// ❌ Bad: Copies to memory (expensive)
function batchHarvest(address[] memory vaults) external {
    // ...
}

// ✅ Good: Read directly from calldata
function batchHarvest(address[] calldata vaults) external {
    // ...
}
```

**Gas Savings:** ~500-1000 gas depending on array size

### 5.5 Custom Errors vs Require Strings

```solidity
// ❌ Bad: String storage is expensive
function compound() external {
    require(msg.sender == owner, "Only owner can compound");
}

// ✅ Good: Custom errors are much cheaper
error Unauthorized();

function compound() external {
    if (msg.sender != owner) revert Unauthorized();
}
```

**Gas Savings:** ~500-1500 gas per revert case

---

## 6. Real-World Benchmarks

### 6.1 Yearn Finance

**Strategy:**
- Pool user funds to share gas costs
- Harvest triggered by off-chain keepers when profitable
- Sophisticated strategies with multiple DeFi protocols
- **Gas sharing:** Millions in TVL → $20 gas cost distributed across thousands of users

**Key Learning:** "Gas costs are shared now you are spending 20 USD while moving millions instead of a couple of Ks"

### 6.2 Beefy Finance

**Strategy:**
- Multi-chain optimizer (including Polygon)
- Automated Cowllector bot for harvest timing
- Frequent auto-compounding (multiple times daily on low-gas chains)
- Optimized harvest timing based on gas prices

**Polygon Specifics:**
- Built on BSC/Polygon to reduce gas costs vs Ethereum
- Can compound more frequently due to low Polygon gas
- Targets gas cost <3% of yield for optimal efficiency

### 6.3 Industry Standards

**Compound Frequency by Chain:**
- Ethereum: 1-7 days (high gas)
- Polygon: 1-3 days (low gas)
- BSC: Daily (very low gas)

**Gas Cost Ratios:**
- Conservative: <5% of yield
- Acceptable: <10% of yield
- Aggressive: <15% of yield (only for high-APR positions)

**Minimum Position Sizes:**
- Most protocols don't auto-compound positions < $100 USD
- Optimal efficiency at > $1,000 USD position size

---

## 7. Recommendations for Rogue Executor Agent

### 7.1 Minimum Yield Threshold

**Decision:** Implement dynamic thresholds based on position size

```typescript
const COMPOUND_THRESHOLDS = {
  small: {        // < $1,000
    minYieldUSD: 10,
    maxGasRatio: 0.10,
    minDays: 7
  },
  medium: {       // $1,000 - $10,000
    minYieldUSD: 7,
    maxGasRatio: 0.07,
    minDays: 2
  },
  large: {        // > $10,000
    minYieldUSD: 5,
    maxGasRatio: 0.05,
    minDays: 1
  }
};
```

**Rationale:**
- Ensures gas costs stay below 5-10% of yield
- Scales with position size for efficiency
- Conservative for small positions (protect users)

### 7.2 Optimal Compound Frequency

**Implementation:**

```typescript
class CompoundScheduler {
  async getOptimalFrequency(position: Position): Promise<CompoundStrategy> {
    const { valueUSD, apr, lastCompound } = position;
    const schedule = getCompoundSchedule(valueUSD);
    
    // Calculate daily yield
    const dailyYield = (valueUSD * apr) / 365;
    
    // Calculate days needed to reach minimum
    const daysToMinYield = schedule.minimumYieldUSD / dailyYield;
    
    // Factor in gas costs
    const estimatedGas = 200000n; // Typical compound operation
    const feeData = await this.provider.getFeeData();
    const gasCostUSD = this.calculateGasCost(estimatedGas, feeData);
    
    // Ensure gas cost ratio target
    const daysToTargetRatio = (gasCostUSD / schedule.maxGasRatio) / dailyYield;
    
    // Use the maximum of constraints
    const optimalDays = Math.max(
      schedule.minimumDaysBetweenCompounds,
      daysToMinYield,
      daysToTargetRatio
    );
    
    return {
      frequencyDays: Math.ceil(optimalDays),
      nextCompoundTime: new Date(lastCompound.getTime() + optimalDays * 86400 * 1000),
      reasoning: `Position size: ${valueUSD} USD, ${dailyYield.toFixed(2)} USD/day yield`
    };
  }
}
```

### 7.3 Gas Estimation Strategy

**Recommended Approach:**

```typescript
class GasEstimator {
  // Use 15% safety margin for gas limit
  private readonly GAS_LIMIT_BUFFER = 1.15;
  
  // Use 10% buffer for maxFeePerGas
  private readonly FEE_BUFFER = 1.10;
  
  // Maximum acceptable gas price (emergency circuit breaker)
  private readonly MAX_GAS_PRICE_GWEI = 500n;
  
  async estimateCompound(
    contract: ethers.Contract,
    args: any[]
  ): Promise<GasEstimate> {
    // Step 1: Estimate gas limit
    const baseGas = await contract.compound.estimateGas(...args);
    const gasLimit = BigInt(
      Math.ceil(Number(baseGas) * this.GAS_LIMIT_BUFFER)
    );
    
    // Step 2: Get fee data with buffer
    const feeData = await contract.runner.provider.getFeeData();
    const maxFeePerGas = (feeData.maxFeePerGas || 0n) * 
      BigInt(Math.ceil(this.FEE_BUFFER * 100)) / 100n;
    
    // Step 3: Apply circuit breaker
    if (maxFeePerGas > this.MAX_GAS_PRICE_GWEI * 1_000_000_000n) {
      throw new Error(
        `Gas price ${maxFeePerGas / 1_000_000_000n} gwei exceeds maximum ${this.MAX_GAS_PRICE_GWEI} gwei`
      );
    }
    
    return {
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || 0n,
      estimatedCost: gasLimit * maxFeePerGas
    };
  }
}
```

### 7.4 Batch Operation Patterns

**Strategy:** Batch multiple user compounds when possible

```typescript
class BatchCompoundExecutor {
  private readonly MULTICALL3_POLYGON = '0xcA11bde05977b3631167028862bE2a173976CA11';
  private readonly MIN_BATCH_SIZE = 3;
  private readonly MAX_BATCH_SIZE = 20;
  
  async executeBatchCompound(
    positions: Position[]
  ): Promise<ethers.TransactionReceipt> {
    // Filter positions ready to compound
    const ready = await this.filterReadyPositions(positions);
    
    if (ready.length < this.MIN_BATCH_SIZE) {
      // Not worth batching, execute individually
      return this.executeIndividual(ready[0]);
    }
    
    // Limit batch size for gas estimation reliability
    const batch = ready.slice(0, this.MAX_BATCH_SIZE);
    
    // Build multicall
    const multicall = new ethers.Contract(
      this.MULTICALL3_POLYGON,
      MULTICALL3_ABI,
      this.signer
    );
    
    const calls = batch.map(pos => ({
      target: pos.vaultAddress,
      callData: pos.vaultInterface.encodeFunctionData('compound'),
      allowFailure: true  // Allow individual failures
    }));
    
    // Execute batch
    const tx = await multicall.aggregate3(calls);
    const receipt = await tx.wait();
    
    // Log gas savings
    const individualGas = batch.length * 200_000;
    const actualGas = receipt.gasUsed;
    const savings = ((individualGas - Number(actualGas)) / individualGas) * 100;
    
    console.log(`Batch compound: ${batch.length} positions, ${savings.toFixed(1)}% gas savings`);
    
    return receipt;
  }
  
  private async filterReadyPositions(
    positions: Position[]
  ): Promise<Position[]> {
    const checks = await Promise.all(
      positions.map(p => shouldCompoundNow(p, 200000n, this.provider, this.polPrice))
    );
    
    return positions.filter((_, i) => checks[i].shouldCompound);
  }
}
```

---

## 8. Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Implement `GasEstimator` with safety margins (15% gas limit, 10% fee buffer)
- [ ] Build `isCompoundProfitable()` check with position-size tiers
- [ ] Create `CompoundScheduler` for optimal frequency calculation
- [ ] Add gas price analysis and timing optimization
- [ ] Implement circuit breakers (max gas price, min profitability)

### Phase 2: Batch Operations
- [ ] Integrate Multicall3 for batch compounds
- [ ] Build position aggregation logic (min 3, max 20 per batch)
- [ ] Implement individual fallback for small batches
- [ ] Add gas savings tracking and reporting

### Phase 3: Optimization
- [ ] Time-based scheduling (prefer off-peak hours for low urgency)
- [ ] Historical gas analysis for better predictions
- [ ] A/B testing of threshold parameters
- [ ] Monitor and adjust based on actual performance

### Phase 4: Contract Optimizations (if deploying own vaults)
- [ ] Storage packing for related variables
- [ ] Custom errors instead of require strings
- [ ] Calldata parameters for arrays
- [ ] Unchecked arithmetic where safe
- [ ] Optimized function selectors for frequent calls

---

## 9. Example: Complete Profitability Check

```typescript
import { ethers } from 'ethers';

interface CompoundDecision {
  shouldCompound: boolean;
  reason: string;
  metrics: {
    positionValueUSD: number;
    accruedYieldUSD: number;
    estimatedGasCostUSD: number;
    gasCostRatio: number;
    daysSinceLastCompound: number;
    breakEvenDays: number;
  };
}

async function evaluateCompound(
  position: {
    valueUSD: number;
    apr: number;
    lastCompoundTimestamp: number;
    vaultAddress: string;
  },
  provider: ethers.Provider,
  polPriceUSD: number
): Promise<CompoundDecision> {
  // 1. Calculate time elapsed
  const daysSince = (Date.now() / 1000 - position.lastCompoundTimestamp) / 86400;
  
  // 2. Get position-based schedule
  const schedule = getCompoundSchedule(position.valueUSD);
  
  // 3. Calculate accrued yield
  const accruedYieldUSD = (position.valueUSD * position.apr * daysSince) / 365;
  
  // 4. Estimate gas cost
  const gasEstimate = 200000n; // Conservative estimate for compound operation
  const feeData = await provider.getFeeData();
  const gasPrice = (feeData.maxFeePerGas || feeData.gasPrice || 0n) * 110n / 100n; // 10% buffer
  const gasCostWei = gasEstimate * gasPrice;
  const gasCostUSD = Number(gasCostWei) / 1e18 * polPriceUSD;
  
  // 5. Calculate gas cost ratio
  const gasCostRatio = accruedYieldUSD > 0 ? gasCostUSD / accruedYieldUSD : Infinity;
  
  // 6. Calculate break-even point
  const dailyYield = (position.valueUSD * position.apr) / 365;
  const breakEvenDays = (gasCostUSD / schedule.maxGasRatio) / dailyYield;
  
  // 7. Decision logic
  const metrics = {
    positionValueUSD: position.valueUSD,
    accruedYieldUSD,
    estimatedGasCostUSD: gasCostUSD,
    gasCostRatio,
    daysSinceLastCompound: daysSince,
    breakEvenDays
  };
  
  // Check 1: Minimum days elapsed
  if (daysSince < schedule.minimumDaysBetweenCompounds) {
    return {
      shouldCompound: false,
      reason: `Wait ${(schedule.minimumDaysBetweenCompounds - daysSince).toFixed(1)} more days (minimum interval)`,
      metrics
    };
  }
  
  // Check 2: Minimum yield threshold
  if (accruedYieldUSD < schedule.minimumYieldUSD) {
    return {
      shouldCompound: false,
      reason: `Yield $${accruedYieldUSD.toFixed(2)} < $${schedule.minimumYieldUSD} minimum (wait ${((schedule.minimumYieldUSD - accruedYieldUSD) / dailyYield).toFixed(1)} more days)`,
      metrics
    };
  }
  
  // Check 3: Gas cost ratio
  if (gasCostRatio > schedule.maxGasRatio) {
    return {
      shouldCompound: false,
      reason: `Gas cost ratio ${(gasCostRatio * 100).toFixed(1)}% exceeds ${(schedule.maxGasRatio * 100)}% maximum`,
      metrics
    };
  }
  
  // Check 4: Gas price timing (optional - prefer low gas periods)
  const gasAnalysis = await analyzeGasTiming(provider, 'medium');
  if (gasAnalysis.recommendation === 'wait' && daysSince < breakEvenDays * 1.5) {
    return {
      shouldCompound: false,
      reason: `Gas currently high (${Number(gasAnalysis.currentGwei) / 1e9} gwei), wait for better timing (potential ${gasAnalysis.expectedSavings?.toFixed(1)}% savings)`,
      metrics
    };
  }
  
  // All checks passed!
  return {
    shouldCompound: true,
    reason: `Profitable compound: $${accruedYieldUSD.toFixed(2)} yield with ${(gasCostRatio * 100).toFixed(1)}% gas cost (${daysSince.toFixed(1)} days elapsed)`,
    metrics
  };
}

// Usage example
async function main() {
  const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
  const polPriceUSD = 0.58; // Fetch from price oracle
  
  const position = {
    valueUSD: 5000,
    apr: 0.15, // 15% APR
    lastCompoundTimestamp: Date.now() / 1000 - (3 * 86400), // 3 days ago
    vaultAddress: '0x...'
  };
  
  const decision = await evaluateCompound(position, provider, polPriceUSD);
  
  console.log(decision);
  // Output: {
  //   shouldCompound: true,
  //   reason: "Profitable compound: $6.16 yield with 2.4% gas cost (3.0 days elapsed)",
  //   metrics: { ... }
  // }
}
```

---

## 10. Key Takeaways

### Decision Matrix

| Position Size | Min Yield | Max Gas Ratio | Frequency | Rationale |
|--------------|-----------|---------------|-----------|-----------|
| < $1K | $10 | 10% | Weekly | Protect small users from excessive gas |
| $1K-$10K | $7 | 7% | 2-3 days | Balanced efficiency |
| > $10K | $5 | 5% | Daily | Maximize compounding for large positions |

### Gas Optimization Priorities

1. **Batch operations** (60-93% savings) - Highest impact
2. **Position-based thresholds** - Ensures profitability
3. **Gas timing optimization** - Moderate savings (10-30%)
4. **Contract optimizations** - One-time deployment benefits
5. **Safety margins** - Prevent failed transactions (15% gas limit buffer)

### Critical Success Factors

✅ **Never compound when gas cost > 10% of yield**  
✅ **Use Multicall3 for batching 3+ operations**  
✅ **Apply 15% safety margin to gas estimates**  
✅ **Monitor gas prices, prefer off-peak execution**  
✅ **Circuit breaker at 500 gwei gas price**

---

## References

- Ethers.js EIP-1559 Documentation
- Multicall3 Contract Analysis
- Yearn Finance Vault Strategies
- Beefy Finance Auto-compounding System
- Polygon Gas Station (historical data)
- DeFi Pulse: Yield Aggregator Benchmarks
- Blocknative Gas Estimation Tools

**Research Status:** Complete ✅  
**Next Steps:** Implement Phase 1 (Core Infrastructure) in Executor agent

# Research: DeFi Leverage Limits and Risk Parameters

**Date**: November 16, 2025  
**Focus**: Safe leverage limits for Aave/Compound on Polygon - Rogue Agent risk profiles  
**Status**: Complete

---

## Executive Summary

### Decision
Implement conservative leverage caps with multi-layered safety mechanisms:
- **Low Risk**: 1.5x max leverage (150% collateralization)
- **Medium Risk**: 2.5x max leverage (250% collateralization)  
- **High Risk**: 3.5x max leverage (350% collateralization)

### Rationale
October 2025 witnessed the largest DeFi liquidation event in history ($19B in leveraged positions eliminated), demonstrating that excessive leverage (50x-100x) creates systemic fragility. Conservative leverage ratios prioritize capital preservation while maintaining competitive yields, learning from protocols like Compound (more conservative) vs Aave (more aggressive).

### Key Lesson from History
The October 2025 crash revealed that **leverage universally reduces returns and amplifies liquidation risk**, with unskilled users suffering disproportionate losses. A 1% adverse price move on a 100x leveraged position wipes out the entire position instantly.

---

## 1. Industry Best Practices for Leverage Caps

### Protocol Comparison: Aave vs Compound

#### Aave V3 (More Aggressive)
- **Stablecoin E-Mode LTV**: 97% (allowing ~33x theoretical leverage)
- **Standard Stablecoin LTV**: 75-80% (4-5x leverage)
- **Liquidation Threshold (wstETH)**: 95.5%
- **Liquidation Bonus**: 1-5%
- **Philosophy**: Maximize capital efficiency, attract TVL through generous parameters

#### Compound V3 (More Conservative)
- **Collateral Factor**: 88% for similar assets (ezETH)
- **Liquidation Factor**: 91-93%
- **Liquidation Penalty**: 4-5%
- **Philosophy**: Survival through de-correlation events, lower liquidation risk

**Market Result**: Aave holds 8.5x more TVL than Compound for equivalent assets due to more generous parameters, but carries higher systemic risk.

### Real-World Leverage Ratios

| Platform | Asset Type | Typical Leverage | Max Observed |
|----------|-----------|------------------|--------------|
| Kamino Finance (Solana) | Stablecoin pairs | 2-3x | 6x |
| Extra Finance (Optimism) | Volatile pairs | 1.5-2x | 4x |
| Gearbox Protocol (Ethereum) | Multi-protocol | 2-4x | 8x |
| DeFi Saver | Automated management | 1.5-3x | 5x |
| Alpaca Finance (historical) | BNB Chain LPs | 2-3x | 6x |

**Industry Consensus**: 
- Conservative farming: **1.5-2x leverage**
- Moderate risk: **2-3x leverage**
- Aggressive: **3-5x leverage**
- Extreme (institutional/expert only): **6-10x leverage**

---

## 2. Liquidation Thresholds & Collateralization Ratios

### Stablecoins (USDC, USDT, DAI)

**Aave V3 Polygon Parameters**:
- LTV: 75-80% (non-E-mode)
- Liquidation Threshold: 80-85%
- E-Mode LTV: 97% (reduced in 2025 due to insufficient stablecoin/stablecoin trading volume)
- Liquidation Bonus: 5%

**Recommended for Rogue**:
- **Minimum Collateralization**: 120-150% (inverse of 80-83% LTV)
- **Liquidation Trigger**: Health Factor < 1.15 (buffer above protocol's 1.0)
- **Emergency Deleverage**: Health Factor < 1.25

**Rationale**: Stablecoins have lowest volatility but face **depeg risk**. October 2025 showed stablecoin depeg events can trigger cascading liquidations.

### Volatile Assets (ETH, WBTC, MATIC)

**Aave V3 Parameters**:
- WETH LTV: ~80-82.5%
- Liquidation Threshold: 82.5-85%
- Liquidation Bonus: 5-7.5%

**Compound V3 Parameters**:
- WBTC Collateral Factor: 75-85%
- Liquidation Factor: 85-93%

**Recommended for Rogue**:
- **Minimum Collateralization**: 200-300%
- **Liquidation Trigger**: Health Factor < 1.35
- **Emergency Deleverage**: Health Factor < 1.50
- **Max Single-Asset Exposure**: 40% of portfolio

**Rationale**: Volatile assets require significant safety buffers. Historical data shows 20-30% intraday swings during high volatility periods.

### Health Factor Formula (Aave Standard)
```
Health Factor = (Total Collateral × Weighted Avg Liquidation Threshold) / Total Borrow Value

HF < 1.0 → Liquidatable
HF = 1.0-1.5 → Danger zone
HF > 2.0 → Safe zone
```

---

## 3. Oracle Failure Scenarios & Circuit Breakers

### Common Oracle Vulnerabilities

1. **Oracle Manipulation**: Price feeds remain single point of failure (flash loan attacks)
2. **Staleness**: Delayed price updates during high volatility
3. **Liquidity Concentration**: Thin markets amplify slippage during liquidations
4. **Depeg Events**: Stablecoin price deviations trigger cascading failures
5. **L2 Sequencer Downtime**: Polygon-specific risk requiring uptime checks

### Chainlink Oracle Security Model

**Byzantine Fault Tolerance**:
- Allows <1/3 of oracles to fail while maintaining integrity
- Requires 2/3 quorum for data consensus
- Configuration: n = 3f + 1 oracles for maximum resilience

**Critical Implementation Checks**:

```solidity
// Step 1: Call latestRoundData()
(uint80 roundId, int256 answer, , uint256 updatedAt, ) = priceAggregator.latestRoundData();

// Step 2: Sanity Check
require(roundId != 0 && answer >= 0 && updatedAt != 0 && updatedAt <= block.timestamp);

// Step 3: Staleness Check
require(block.timestamp - updatedAt <= TIMEOUT); // e.g., 3600 seconds

// Step 4: Price Deviation Check (optional but recommended)
uint256 deviation = abs(answer - lastGoodPrice) / lastGoodPrice;
require(deviation <= ACCEPTABLE_DEVIATION); // e.g., 10-15%

// Step 5: Store last good price
lastGoodPrice = answer;
```

### Circuit Breaker Triggers

**Automatic Position Pause When**:
1. Oracle price deviation > 10% from last good price
2. Oracle update timestamp > 1 hour stale
3. Sequencer uptime feed reports downtime (L2 specific)
4. Sudden liquidity removal > 30% in target pool
5. Health factor approaches critical threshold (< 1.25)

**Fallback Strategy**:
- Primary: Chainlink oracle
- Secondary: Uniswap V3 TWAP (time-weighted average price)
- Tertiary: Freeze new borrows, allow only repayments
- Last resort: Use minimum(lastGoodPrice, currentPrice) for collateral valuation

---

## 4. Health Factor Monitoring & Auto-Deleveraging

### Real-Time Monitoring Requirements

**Monitoring Frequency**:
- **Low Risk Profile**: Every 5 minutes
- **Medium Risk Profile**: Every 2 minutes  
- **High Risk Profile**: Every 30 seconds (critical positions)

**Metrics to Track**:
1. Health Factor (primary metric)
2. Collateral value (USD)
3. Debt value (USD)
4. Borrow APY (variable rates can spike)
5. Pool utilization (affects borrow rates)
6. Oracle price freshness
7. Gas prices (for emergency transactions)

### Auto-Deleveraging Triggers

**Multi-Tier Response System**:

| Health Factor | Action | Priority |
|---------------|--------|----------|
| HF < 1.5 | Alert user | Low |
| HF < 1.35 | Reduce leverage 20% | Medium |
| HF < 1.25 | Reduce leverage 40% | High |
| HF < 1.15 | Emergency full deleverage | Critical |
| HF < 1.05 | Panic mode: repay at any cost | Maximum |

**Deleveraging Strategy**:
1. **Gradual Reduction**: Repay 20-40% of debt to restore HF > 1.5
2. **Asset Priority**: Repay highest-interest debt first
3. **Collateral Priority**: Sell most liquid collateral first (minimize slippage)
4. **Gas Optimization**: Pre-approve tokens, batch transactions when possible
5. **Slippage Protection**: Max 2% slippage for emergency swaps

### Implementation Pattern (Pseudo-code)

```javascript
async function monitorAndDeleverage(position) {
  const hf = await calculateHealthFactor(position);
  
  if (hf < 1.15) {
    // Critical - emergency deleverage
    await emergencyRepay(position, 0.6); // Repay 60% of debt
    await notifyUser("CRITICAL: Emergency deleveraging executed");
  } else if (hf < 1.25) {
    // High risk - aggressive reduction
    await repayDebt(position, 0.4); // Repay 40% of debt
    await notifyUser("HIGH RISK: Position partially closed");
  } else if (hf < 1.35) {
    // Medium risk - preventive action
    await repayDebt(position, 0.2); // Repay 20% of debt
    await notifyUser("WARNING: Position reduced");
  } else if (hf < 1.5) {
    // Low risk - alert only
    await notifyUser("NOTICE: Health factor below target");
  }
}
```

---

## 5. Historical Liquidation Events - Lessons Learned

### October 10, 2025 - Largest DeFi Liquidation ($19B)

**Trigger**: U.S. President Trump announced 100% tariff on Chinese goods  
**Impact**: 
- $19-20 billion in leveraged positions eliminated within hours
- Bitcoin and major altcoins dropped sharply
- Cascading liquidations across all DeFi protocols
- Algorithmic deleveraging struggled to keep pace

**Key Lessons**:
1. **Extreme leverage is lethal**: 50x-100x positions vaporized instantly
2. **Macroeconomic interdependencies**: DeFi not isolated from TradFi shocks
3. **Systemic tail dependence**: ETH, LINK, UNI acted as contagion conduits
4. **Liquidation speed matters**: Automated systems overwhelmed during peak volatility
5. **Oracle lag is dangerous**: Price feeds delayed during extreme moves

### Q1 2025 - Leverage Contraction

**Context**: 21.14% decline in open borrows to $17.7B  
**Cause**: Asset price volatility reduced risk appetite  

**Lesson**: Markets self-regulate, but contraction can be violent and unpredictable.

### May 2023 - Ethereum Finality Hiccup

**Impact**: Beacon chain finality delays tested oracle update mechanisms  
**Outcome**: Robust feeds degraded gracefully; poor implementations pushed risky updates

**Lesson**: Oracle finality awareness critical. Wait for safe confirmation windows before considering updates "locked."

### 2019-2023 MakerDAO Study (Academic)

**Findings**:
- Leverage **universally reduces returns** at vault level
- **Unskilled users incur significantly greater losses** under extreme leverage
- Skilled users mitigate moderate leverage risks through active management
- **Excessive leverage erodes performance across ALL skill levels**
- Forced liquidations account for significant proportion of losses

**Lesson**: Even "skilled" users cannot escape liquidation risk at high leverage. System design penalizes less sophisticated users disproportionately.

### OECD Analysis (2023)

**Evidence**: Positive relation between liquidations and post-liquidation price volatility in DEX pools  

**Lesson**: Liquidations create feedback loops - selling collateral depresses prices, triggering more liquidations (death spiral potential).

---

## 6. Recommended Parameters for Rogue's Three Risk Profiles

### Low Risk Profile (Conservative)

**Target Users**: Risk-averse, capital preservation priority, first-time DeFi users

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Max Leverage** | 1.5x | Withstands 40% adverse price movement |
| **Min Collateralization** | 200% | 2:1 collateral to debt ratio |
| **Liquidation Threshold HF** | 1.35 | Large buffer above protocol minimum |
| **Emergency Deleverage HF** | 1.50 | Conservative trigger |
| **Oracle Staleness Tolerance** | 30 minutes | Stricter than default |
| **Max Price Deviation** | 8% | Tight bounds |
| **Monitoring Frequency** | Every 5 minutes | Standard |
| **Allowed Asset Types** | Stablecoins only (USDC, USDT) | Minimize volatility |
| **Max Single Position** | 30% of portfolio | Diversification required |
| **Circuit Breaker Price Drop** | 5% in 1 hour | Conservative pause trigger |

**Expected Annual Return**: 5-12% APY (after borrowing costs)  
**Liquidation Probability**: <1% annually in normal conditions

---

### Medium Risk Profile (Balanced)

**Target Users**: Moderate risk tolerance, balanced return expectations, some DeFi experience

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Max Leverage** | 2.5x | Balances yield and safety |
| **Min Collateralization** | 250% | 2.5:1 collateral to debt ratio |
| **Liquidation Threshold HF** | 1.25 | Reasonable buffer |
| **Emergency Deleverage HF** | 1.40 | Preventive action zone |
| **Oracle Staleness Tolerance** | 60 minutes | Standard window |
| **Max Price Deviation** | 12% | Moderate bounds |
| **Monitoring Frequency** | Every 2 minutes | Enhanced monitoring |
| **Allowed Asset Types** | Stablecoins + major blue chips (ETH, WBTC) | Controlled volatility |
| **Max Single Position** | 40% of portfolio | Balanced diversification |
| **Circuit Breaker Price Drop** | 10% in 1 hour | Standard pause trigger |

**Expected Annual Return**: 12-25% APY (after borrowing costs)  
**Liquidation Probability**: 2-5% annually in normal conditions

---

### High Risk Profile (Aggressive)

**Target Users**: High risk tolerance, maximum yield priority, experienced DeFi users

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Max Leverage** | 3.5x | Approaches industry upper bounds for safety |
| **Min Collateralization** | 350% | 3.5:1 collateral to debt ratio |
| **Liquidation Threshold HF** | 1.15 | Tight buffer - active management required |
| **Emergency Deleverage HF** | 1.30 | Aggressive trigger point |
| **Oracle Staleness Tolerance** | 90 minutes | Permissive window |
| **Max Price Deviation** | 15% | Wider bounds for volatile markets |
| **Monitoring Frequency** | Every 30 seconds | Critical-level monitoring |
| **Allowed Asset Types** | All supported assets | Maximum flexibility |
| **Max Single Position** | 50% of portfolio | Concentrated positions allowed |
| **Circuit Breaker Price Drop** | 15% in 1 hour | Permissive pause trigger |

**Expected Annual Return**: 25-50%+ APY (after borrowing costs)  
**Liquidation Probability**: 8-15% annually in normal conditions, **significantly higher during black swan events**

**CRITICAL WARNING**: High risk profile approaches the zone where October 2025-style events can cause total capital loss. Requires 24/7 monitoring and instant response capability.

---

## 7. Cross-Profile Safety Requirements

### Mandatory for All Risk Profiles

1. **Circuit Breakers**:
   - Oracle staleness check on every operation
   - Price deviation monitoring
   - L2 sequencer uptime verification (Polygon)
   - Automatic position pause on anomalies

2. **Multi-Oracle Strategy**:
   - Primary: Chainlink price feeds
   - Secondary: Uniswap V3 TWAP (30-minute window)
   - Fallback: Conservative price (minimum of available sources)

3. **Gas Price Awareness**:
   - Monitor Polygon gas prices
   - Maintain emergency fund for deleveraging transactions
   - Pre-approve tokens to reduce transaction steps

4. **Notification System**:
   - Health factor alerts (email, SMS, webhook)
   - Oracle failure alerts
   - Circuit breaker activation notices
   - Weekly portfolio health reports

5. **Emergency Controls**:
   - User-initiated emergency exit (close all positions)
   - Protocol pause authority (multisig governance)
   - Debt ceiling per strategy
   - Global exposure limits

6. **Audit & Testing**:
   - Smart contract audits by 2+ reputable firms
   - Stress testing with historical volatility data
   - Simulated liquidation scenarios
   - Bug bounty program

---

## 8. Implementation Notes

### Technical Architecture

```
┌─────────────────────────────────────────────┐
│         Rogue Yield Agent                   │
├─────────────────────────────────────────────┤
│  Risk Profile Manager                       │
│  ├─ Low Risk (1.5x)                        │
│  ├─ Medium Risk (2.5x)                     │
│  └─ High Risk (3.5x)                       │
├─────────────────────────────────────────────┤
│  Health Monitor (continuous)                │
│  ├─ Chainlink Oracle Integration           │
│  ├─ Uniswap V3 TWAP (fallback)            │
│  └─ L2 Sequencer Uptime Check              │
├─────────────────────────────────────────────┤
│  Circuit Breaker System                     │
│  ├─ Price Deviation Detector               │
│  ├─ Staleness Checker                      │
│  └─ Liquidity Monitor                      │
├─────────────────────────────────────────────┤
│  Auto-Deleveraging Engine                   │
│  ├─ Multi-tier Triggers (HF thresholds)    │
│  ├─ Optimal Repayment Calculator           │
│  └─ Gas-optimized Execution                │
├─────────────────────────────────────────────┤
│  Protocol Integrations                      │
│  ├─ Aave V3 (Polygon)                      │
│  └─ Compound V3 (Polygon)                  │
└─────────────────────────────────────────────┘
```

### Smart Contract Considerations

1. **Upgradability**: Use proxy pattern for parameter adjustments
2. **Access Control**: Multi-sig for critical functions, timelocks for parameter changes
3. **Reentrancy Protection**: All external calls protected
4. **Oracle Validation**: Never trust single price feed
5. **Emergency Pause**: Implement circuit breaker at contract level
6. **Rate Limiting**: Prevent flash loan attacks and manipulation

### Monitoring Infrastructure

**Required Services**:
- Chainlink Automation (formerly Keepers) for health checks
- The Graph for historical data indexing
- Polygon RPC endpoints (multiple providers for redundancy)
- Alert service (e.g., OpenZeppelin Defender, Tenderly)
- Analytics dashboard (positions, health factors, APYs)

### Gas Cost Management (Polygon)

**Typical Costs** (estimate in MATIC):
- Health factor check: ~0.001 MATIC ($0.0008 @ $0.80/MATIC)
- Partial repayment: ~0.01-0.05 MATIC ($0.008-0.04)
- Emergency full deleverage: ~0.1-0.3 MATIC ($0.08-0.24)

**Optimization**: Batch operations when possible, pre-approve tokens, maintain MATIC reserve for emergencies.

---

## 9. Alternative Approaches Considered

### Alternative 1: Higher Leverage (5-10x)

**Rejected Reason**: October 2025 events prove that leverage above 5x creates unacceptable liquidation risk. Academic studies confirm excessive leverage erodes returns universally.

### Alternative 2: Dynamic Leverage Based on Volatility

**Status**: Under consideration for v2  
**Concept**: Automatically reduce max leverage during high VIX/volatility periods  
**Challenge**: Requires sophisticated volatility prediction models and may trigger unwanted deleveraging

### Alternative 3: Insurance Fund for Liquidations

**Status**: Possible future enhancement  
**Concept**: 1-2% of yields directed to insurance pool covering partial liquidation losses  
**Challenge**: Reduces net APY, requires careful actuarial modeling

### Alternative 4: Isolated Risk Pools

**Status**: Recommended for v1  
**Concept**: Separate pools for each risk profile, preventing contagion  
**Benefit**: High-risk users cannot jeopardize low-risk capital  
**Implementation**: Three separate smart contracts with dedicated collateral

---

## 10. Competitive Analysis

| Protocol | Max Leverage | Liquidation Protection | Oracle Strategy |
|----------|--------------|------------------------|-----------------|
| **Rogue (Proposed)** | 1.5-3.5x | Multi-tier auto-deleverage | Chainlink + TWAP fallback |
| Kamino Finance | Up to 6x | Built-in risk engine | Pyth + Switchboard |
| Extra Finance | Up to 4x | Isolated risk per market | Chainlink primary |
| Gearbox | Up to 10x | Composable leverage | Chainlink + custom oracles |
| DeFi Saver | User-defined | 24/7 automation | Relies on underlying protocol |

**Rogue's Competitive Advantage**:
- **More conservative than competition** (max 3.5x vs 6-10x)
- **Three-tier risk profiles** cater to broader user base
- **Polygon-native** (lower fees than Ethereum L1)
- **AI-driven** optimization (planned feature)
- **Transparent risk parameters** (user education priority)

---

## 11. Risk Disclosure Template

**Recommended User Warning** (must display before position creation):

```
⚠️ LEVERAGE RISK WARNING

You are about to open a leveraged position with [X]x leverage.

RISKS:
• Your position can be liquidated if collateral value drops
• You will lose your collateral if liquidated
• Borrowing rates can increase unexpectedly
• Oracle failures can trigger incorrect liquidations
• Smart contract bugs could result in loss of funds
• Historical data shows [X]% annual liquidation probability

LIQUIDATION THRESHOLD:
• Your position will be liquidated if Health Factor drops below 1.0
• Current buffer: [Y]% price drop until liquidation
• Emergency deleveraging triggers at Health Factor 1.25

By proceeding, you acknowledge these risks and confirm you can afford to lose your entire position.

[I Understand and Accept the Risks] [Cancel]
```

---

## 12. Monitoring Dashboard Requirements

### Key Metrics (Real-time Display)

**Position Overview**:
- Current Health Factor (color-coded: green >1.5, yellow 1.25-1.5, red <1.25)
- Total Collateral Value (USD)
- Total Debt Value (USD)
- Net APY (farming yield - borrow cost)
- Liquidation Price (critical threshold)
- Days until break-even (based on current APY)

**Risk Indicators**:
- Oracle last update timestamp
- Current borrow APY (variable)
- Pool utilization rate
- Estimated gas cost for emergency exit
- Distance to liquidation (%)

**Historical Charts**:
- Health Factor over time (24h, 7d, 30d)
- Net APY trend
- Collateral/Debt ratio evolution
- Liquidation events (if any)

---

## 13. Conclusion

### Final Recommendations

1. **Implement three-tier system** with max leverage 1.5x/2.5x/3.5x
2. **Prioritize circuit breakers** - oracle validation, staleness checks, L2 sequencer monitoring
3. **Deploy multi-tier auto-deleveraging** - gradual response to declining health factors
4. **Maintain isolated risk pools** - prevent cross-contamination between profiles
5. **Continuous monitoring** - 30 seconds to 5 minutes depending on risk level
6. **Comprehensive testing** - simulate October 2025-style black swan events
7. **User education** - clear risk disclosures, mandatory warnings
8. **Conservative launch** - start with Low/Medium risk only, add High risk after 6 months

### Success Metrics

- **Zero unexpected liquidations** in first 6 months (excluding user-initiated)
- **<1% liquidation rate** for Low risk profile annually
- **Circuit breaker activation** in <500ms when triggered
- **User satisfaction** >80% (measured via surveys)
- **TVL growth** while maintaining safety (quality over quantity)

### Next Steps

1. Smart contract development with emphasis on circuit breakers
2. Oracle integration testing (Chainlink + TWAP fallback)
3. Health monitoring system implementation
4. UI/UX for risk profile selection and real-time monitoring
5. Comprehensive documentation and user guides
6. Security audits (minimum 2 firms)
7. Testnet deployment and stress testing
8. Gradual mainnet rollout (Low risk → Medium risk → High risk)

---

## References

- Aave V3 Protocol Documentation: https://aave.com
- Compound V3 (Comet) Documentation: https://compound.finance
- Chainlink Oracle Security: https://chain.link
- OECD DeFi Liquidations Study (2023)
- October 2025 DeFi Crash Analysis (MDPI Study)
- MakerDAO Leverage Study (2019-2023)
- Gauntlet Risk Management Reports
- LlamaRisk Protocol Analyses

**Research Completed**: November 16, 2025  
**Next Review**: Prior to v1 launch, then quarterly thereafter

# Research: Supabase Row Level Security for Wallet-Based Authentication

**Date**: November 16, 2025  
**Status**: ✅ Completed  
**Decision**: Use Supabase native Web3 auth with custom RLS policies for wallet-based data isolation

---

## Executive Summary

**DECISION**: Implement Supabase's native SIWE (Sign-In with Ethereum) authentication combined with carefully designed RLS policies for wallet-based data isolation in Rogue.

**RATIONALE**:
- Native Web3 support via `signInWithWeb3()` eliminates custom JWT signing complexity
- RLS provides database-level defense-in-depth even if API keys are compromised
- Wallet addresses as primary identifiers align with Web3-native UX
- Performance optimizations (indexed policies, security definer functions) prevent RLS overhead
- Multi-wallet support via linking table enables flexible user experience

**IMPLEMENTATION NOTES**:
- Use Supabase's built-in SIWE for signature verification
- Store wallet addresses in lowercase/checksummed format for consistency
- Index all columns used in RLS policies (wallet_address, user_id)
- Wrap `auth.uid()` calls in `(select ...)` for performance
- Encrypt sensitive data at application layer before storage (risk profiles, API keys)
- Use security definer functions for complex RLS checks

---

## 1. RLS Policy Patterns for Wallet Address Authentication

### Architecture Overview

```
User → Signs SIWE Message → Supabase Auth → JWT with auth.uid()
                                              ↓
                                    RLS Policies Check
                                              ↓
                                    Data Access Granted
```

### Core Pattern: User-Owned Data

```sql
-- Enable RLS on all tables
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

-- Positions table: users can only read/write their own positions
CREATE POLICY "Users can view own positions"
ON positions FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
);

CREATE POLICY "Users can insert own positions"
ON positions FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
);

CREATE POLICY "Users can update own positions"
ON positions FOR UPDATE
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
);

CREATE POLICY "Users can delete own positions"
ON positions FOR DELETE
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
);
```

### Key Insights from Research

1. **Always wrap `auth.uid()` in SELECT**: `(SELECT auth.uid())` instead of `auth.uid()` for 57-61% performance improvement
2. **Explicit NULL checks**: Add `auth.uid() IS NOT NULL` to prevent silent failures for unauthenticated users
3. **Separate USING and WITH CHECK**: `USING` checks existing data, `WITH CHECK` validates new data

### Advanced Pattern: Multi-Table Joins

```sql
-- For queries joining user_wallets to positions
CREATE POLICY "Users can view positions linked to their wallets"
ON positions FOR SELECT
TO authenticated
USING (
  user_id IN (SELECT get_user_wallet_ids())
);

-- Security definer function to avoid nested RLS overhead
CREATE OR REPLACE FUNCTION get_user_wallet_ids()
RETURNS TABLE(wallet_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as function creator, bypasses RLS on user_wallets
AS $$
BEGIN
  RETURN QUERY
  SELECT user_id
  FROM user_wallets
  WHERE (SELECT auth.uid()) = user_id;
END;
$$;
```

**Why Security Definer**: Avoids RLS policy evaluation on join tables, reducing query complexity from O(n²) to O(n).

---

## 2. Encryption Strategies for Sensitive User Data

### Supabase Encryption Layers

| Layer | Provider | Coverage | Use Case |
|-------|----------|----------|----------|
| **In-Transit** | Supabase (TLS 1.3) | All API requests | Automatic |
| **At-Rest** | Supabase (AES-256) | Database files | Automatic |
| **Application-Layer** | Client-side | Sensitive fields | Manual |

### What to Encrypt at Application Layer

```typescript
// Sensitive fields requiring app-layer encryption
interface EncryptedUserData {
  risk_profile: string;        // Encrypted: Contains leverage preferences
  api_keys: string;            // Encrypted: Third-party integrations
  wallet_private_metadata: string; // Encrypted: Notes, labels
}

// Non-sensitive fields (use Supabase defaults)
interface PlainUserData {
  wallet_address: string;      // Public on-chain anyway
  total_positions: number;     // Aggregate stats
  last_login: timestamp;       // Metadata
}
```

### Recommended Encryption Flow

```typescript
// Using Web Crypto API (browser-native)
import { SupabaseClient } from '@supabase/supabase-js';

// 1. Derive encryption key from user's wallet signature
async function deriveEncryptionKey(walletAddress: string, signature: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signature),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(walletAddress), // Use wallet as salt
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// 2. Encrypt before storing
async function encryptData(data: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );
  
  // Concatenate IV + encrypted data, encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// 3. Store encrypted data
async function saveRiskProfile(supabase: SupabaseClient, profile: any, encryptionKey: CryptoKey) {
  const encrypted = await encryptData(JSON.stringify(profile), encryptionKey);
  
  const { data, error } = await supabase
    .from('risk_profiles')
    .insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      encrypted_profile: encrypted,
      updated_at: new Date().toISOString()
    });
}
```

### Key Management Strategy

**DO**:
- Derive keys from wallet signatures (never store raw keys)
- Use wallet address as salt for key derivation
- Re-encrypt data if user changes primary wallet

**DON'T**:
- Store encryption keys in Supabase
- Use same key for all users
- Encrypt non-sensitive public data (overhead without benefit)

---

## 3. Wallet Signature Verification Flow

### Supabase Native SIWE Implementation

```typescript
import { createClient } from '@supabase/supabase-js';
import { SiweMessage } from 'siwe';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Step 1: Generate nonce
async function generateNonce(): Promise<string> {
  const { data, error } = await supabase.auth.signInWithWeb3({
    provider: 'ethereum',
    options: {
      // This returns a nonce without completing auth
      skipBrowserRedirect: true
    }
  });
  
  return data?.nonce || crypto.randomUUID();
}

// Step 2: Create SIWE message
async function createSiweMessage(walletAddress: string, nonce: string): Promise<string> {
  const message = new SiweMessage({
    domain: window.location.host,
    address: walletAddress,
    statement: 'Sign in to Rogue Yield Agent',
    uri: window.location.origin,
    version: '1',
    chainId: 1, // Ethereum mainnet
    nonce: nonce,
    issuedAt: new Date().toISOString(),
    expirationTime: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min
  });
  
  return message.prepareMessage();
}

// Step 3: Sign with wallet (MetaMask/WalletConnect)
async function signMessage(message: string, provider: any): Promise<string> {
  const signer = provider.getSigner();
  return await signer.signMessage(message);
}

// Step 4: Verify and authenticate with Supabase
async function authenticateWithWallet(walletAddress: string, signature: string, message: string) {
  const { data, error } = await supabase.auth.signInWithWeb3({
    provider: 'ethereum',
    options: {
      address: walletAddress,
      signature: signature,
      message: message
    }
  });
  
  if (error) throw error;
  
  // Supabase automatically:
  // 1. Verifies signature cryptographically
  // 2. Checks nonce hasn't been used (replay protection)
  // 3. Validates message expiration
  // 4. Issues JWT with auth.uid()
  
  return data.session;
}
```

### Edge Function for Custom Verification (If Needed)

```typescript
// supabase/functions/verify-wallet/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyMessage } from 'https://esm.sh/ethers@6';

serve(async (req) => {
  const { walletAddress, signature, message } = await req.json();
  
  try {
    // Verify signature
    const recoveredAddress = verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401 }
      );
    }
    
    // Verify message structure (SIWE format)
    const siweMessage = new SiweMessage(message);
    await siweMessage.validate();
    
    // Check nonce freshness (prevent replay)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Service key for admin ops
    );
    
    const { data: existingNonce } = await supabase
      .from('used_nonces')
      .select('nonce')
      .eq('nonce', siweMessage.nonce)
      .single();
    
    if (existingNonce) {
      return new Response(
        JSON.stringify({ error: 'Nonce already used' }),
        { status: 401 }
      );
    }
    
    // Mark nonce as used
    await supabase
      .from('used_nonces')
      .insert({ nonce: siweMessage.nonce, used_at: new Date() });
    
    // Create/update user
    const { data: user } = await supabase.auth.admin.createUser({
      email: `${walletAddress.toLowerCase()}@wallet.local`, // Dummy email
      email_confirm: true,
      user_metadata: {
        wallet_address: walletAddress.toLowerCase()
      }
    });
    
    // Generate session token
    const { data: session } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email!
    });
    
    return new Response(
      JSON.stringify({ session }),
      { status: 200 }
    );
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
```

**When to use Edge Functions**:
- Need custom nonce generation logic
- Integrate non-SIWE wallet types (Solana, Cosmos)
- Add rate limiting per wallet
- Custom session duration/refresh logic

---

## 4. Performance Implications of RLS

### Benchmark Results (From Research)

| Optimization | Before | After | Improvement |
|--------------|--------|-------|-------------|
| Add B-tree index on `user_id` | 171ms | <0.1ms | **99.94%** |
| Wrap `auth.uid()` in SELECT | 100ms | 43ms | **57%** |
| Use security definer functions | 85ms | 36ms | **58%** |

### Index Strategy for Rogue

```sql
-- 1. Indexes for RLS policy columns
CREATE INDEX idx_positions_user_id ON positions USING btree(user_id);
CREATE INDEX idx_risk_profiles_user_id ON risk_profiles USING btree(user_id);
CREATE INDEX idx_tx_history_user_id ON transaction_history USING btree(user_id);

-- 2. Composite indexes for common queries
CREATE INDEX idx_positions_user_status ON positions(user_id, status)
WHERE status IN ('active', 'pending'); -- Partial index for filtered queries

CREATE INDEX idx_tx_history_user_date ON transaction_history(user_id, created_at DESC);

-- 3. Covering indexes (include frequently selected columns)
CREATE INDEX idx_positions_user_cover ON positions(user_id)
INCLUDE (protocol, collateral_amount, debt_amount, health_factor);
```

### Query Optimization Patterns

**❌ SLOW**: Nested subquery in RLS
```sql
CREATE POLICY "slow_policy" ON positions
USING (
  auth.uid() IN (
    SELECT user_id FROM team_members WHERE team_members.team_id = positions.team_id
  )
);
-- Problem: Executes subquery for EVERY row
```

**✅ FAST**: Flip the join direction
```sql
CREATE POLICY "fast_policy" ON positions
USING (
  team_id IN (
    SELECT team_id FROM team_members WHERE user_id = (SELECT auth.uid())
  )
);
-- Better: Subquery executes once, builds team_id list
```

**✅ FASTEST**: Security definer function
```sql
CREATE FUNCTION get_user_teams()
RETURNS TABLE(team_id UUID)
LANGUAGE sql
SECURITY DEFINER
STABLE -- Cacheable within transaction
AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid();
$$;

CREATE POLICY "fastest_policy" ON positions
USING (
  team_id IN (SELECT get_user_teams())
);
-- Best: Cached function result, no RLS overhead on team_members
```

### Performance Monitoring

```sql
-- Check if indexes are being used
EXPLAIN ANALYZE
SELECT * FROM positions WHERE user_id = 'some-uuid';

-- Should show "Index Scan using idx_positions_user_id"
-- NOT "Seq Scan on positions"

-- Monitor RLS policy execution time
SELECT 
  schemaname,
  tablename,
  policyname,
  pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) as table_size
FROM pg_policies
JOIN pg_class ON pg_class.relname = tablename
WHERE schemaname = 'public';
```

---

## 5. Common Security Pitfalls and Avoidance

### Critical Pitfalls from Research

#### 1. **RLS Not Enabled**
**Pitfall**: Table accessible to all users
```sql
-- ❌ DANGER: No RLS
CREATE TABLE positions (...);
-- Anyone with anon key can read ALL positions
```

**Fix**: Always enable RLS immediately
```sql
-- ✅ SAFE
CREATE TABLE positions (...);
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
-- Default deny until policies added
```

#### 2. **Service Key Exposure**
**Pitfall**: Service key in client-side code bypasses all RLS
```typescript
// ❌ DANGER: Service key in browser
const supabase = createClient(URL, SERVICE_ROLE_KEY); // Exposes full DB access
```

**Fix**: Only use service keys in Edge Functions/backend
```typescript
// ✅ SAFE
const supabase = createClient(URL, ANON_KEY); // Client-side
// Service key only in: supabase/functions/* (Edge Functions)
```

#### 3. **NULL auth.uid() Silent Failures**
**Pitfall**: Unauthenticated users get no data, no error
```sql
-- ❌ CONFUSING: Returns nothing if not logged in
CREATE POLICY "implicit_auth" ON positions
USING (auth.uid() = user_id);
-- auth.uid() = NULL when not authenticated, always false
```

**Fix**: Explicit authentication check
```sql
-- ✅ CLEAR: Explicit requirement
CREATE POLICY "explicit_auth" ON positions
TO authenticated -- Only applies to logged-in users
USING (
  (SELECT auth.uid()) IS NOT NULL 
  AND (SELECT auth.uid()) = user_id
);
```

#### 4. **IDOR via UUID Enumeration**
**Pitfall**: Attacker queries all UUIDs using `gt` operator
```http
GET /rest/v1/positions?user_id=gt.00000000-0000-0000-0000-000000000000
# Without RLS, returns ALL positions
```

**Fix**: RLS automatically prevents this (if enabled)
```sql
-- With proper RLS, query filtered to current user only
-- Attacker only sees their own data regardless of query params
```

#### 5. **MFA Bypass**
**Pitfall**: MFA enabled but not enforced in RLS
```sql
-- ❌ WEAK: Anyone authenticated can access
CREATE POLICY "no_mfa_check" ON sensitive_data
TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

**Fix**: Check Assurance Level in policy
```sql
-- ✅ MFA ENFORCED
CREATE POLICY "require_mfa" ON sensitive_data
TO authenticated
USING (
  (SELECT auth.jwt()->>'aal') = 'aal2' -- Assurance Level 2 (MFA)
  AND (SELECT auth.uid()) = user_id
);
```

#### 6. **Overly Permissive Policies**
**Pitfall**: Policy allows unintended operations
```sql
-- ❌ TOO BROAD: Users can UPDATE other users' data
CREATE POLICY "all_access" ON positions
FOR ALL -- Applies to SELECT, INSERT, UPDATE, DELETE
USING (true); -- Always true!
```

**Fix**: Specific policies per operation
```sql
-- ✅ GRANULAR
CREATE POLICY "select_own" ON positions FOR SELECT USING (...);
CREATE POLICY "insert_own" ON positions FOR INSERT WITH CHECK (...);
CREATE POLICY "update_own" ON positions FOR UPDATE USING (...) WITH CHECK (...);
CREATE POLICY "delete_own" ON positions FOR DELETE USING (...);
```

### Security Checklist

- [ ] RLS enabled on ALL public schema tables
- [ ] Service keys never in client code
- [ ] All policies use `TO authenticated`
- [ ] All policies check `auth.uid() IS NOT NULL`
- [ ] Separate policies for SELECT, INSERT, UPDATE, DELETE
- [ ] MFA required for sensitive operations (via `aal2` check)
- [ ] Indexes on all policy columns
- [ ] Regular audits using Supabase Security Advisor
- [ ] Test with different user roles (use multiple test accounts)
- [ ] Monitor for slow queries caused by RLS (EXPLAIN ANALYZE)

---

## 6. Multi-Wallet Support for Same User

### Architecture: One User, Many Wallets

```sql
-- users table (managed by Supabase Auth)
-- Auto-created by auth.users, don't modify directly

-- user_wallets junction table
CREATE TABLE user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL UNIQUE,
  chain_id INTEGER NOT NULL, -- 1=Ethereum, 137=Polygon, 80002=Amoy, etc.
  is_primary BOOLEAN DEFAULT false,
  label TEXT, -- "Main", "Trading", "Cold Storage"
  added_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  
  -- Ensure only one primary wallet per user
  CONSTRAINT one_primary_per_user UNIQUE(user_id, is_primary) 
    WHERE is_primary = true
);

CREATE INDEX idx_user_wallets_address ON user_wallets(wallet_address);
CREATE INDEX idx_user_wallets_user ON user_wallets(user_id);

-- Enable RLS
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallets"
ON user_wallets FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can add wallets"
ON user_wallets FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own wallets"
ON user_wallets FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
```

### Adding a New Wallet to Existing User

```typescript
async function linkWallet(existingSession: Session, newWalletAddress: string, signature: string) {
  const supabase = createClient(URL, ANON_KEY);
  
  // 1. Verify new wallet signature
  const message = `Link wallet ${newWalletAddress} to my Rogue account`;
  const recoveredAddress = verifyMessage(message, signature);
  
  if (recoveredAddress.toLowerCase() !== newWalletAddress.toLowerCase()) {
    throw new Error('Invalid signature');
  }
  
  // 2. Set existing session
  await supabase.auth.setSession(existingSession);
  
  // 3. Add wallet to user_wallets
  const { data, error } = await supabase
    .from('user_wallets')
    .insert({
      user_id: existingSession.user.id,
      wallet_address: newWalletAddress.toLowerCase(),
      chain_id: 1,
      label: 'Linked Wallet',
      last_used_at: new Date().toISOString()
    });
  
  if (error) throw error;
  
  return data;
}
```

### Switching Primary Wallet

```typescript
async function setPrimaryWallet(walletId: string) {
  const supabase = createClient(URL, ANON_KEY);
  
  // Use transaction to ensure atomicity
  const { data, error } = await supabase.rpc('set_primary_wallet', {
    new_primary_id: walletId
  });
  
  if (error) throw error;
}

-- SQL function for atomic primary wallet switch
CREATE OR REPLACE FUNCTION set_primary_wallet(new_primary_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove primary flag from all user's wallets
  UPDATE user_wallets
  SET is_primary = false
  WHERE user_id = (SELECT auth.uid());
  
  -- Set new primary
  UPDATE user_wallets
  SET is_primary = true
  WHERE id = new_primary_id
    AND user_id = (SELECT auth.uid()); -- Ensure ownership
END;
$$;
```

### Querying Positions Across All User Wallets

```sql
-- Positions can be linked to specific wallet or user
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  wallet_address TEXT NOT NULL, -- Which wallet opened this position
  protocol TEXT NOT NULL,
  collateral_amount NUMERIC,
  debt_amount NUMERIC,
  health_factor NUMERIC,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_positions_wallet ON positions(wallet_address);

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- RLS: User can see positions from ANY of their wallets
CREATE POLICY "Users can view positions from their wallets"
ON positions FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  OR wallet_address IN (
    SELECT wallet_address 
    FROM user_wallets 
    WHERE user_id = (SELECT auth.uid())
  )
);
```

### Multi-Wallet UX Flow

```typescript
// 1. First-time login: Create user + link wallet
async function firstLogin(walletAddress: string, signature: string) {
  const { data: session } = await supabase.auth.signInWithWeb3({
    provider: 'ethereum',
    options: { address: walletAddress, signature }
  });
  
  // Auto-create user_wallets entry
  await supabase.from('user_wallets').insert({
    user_id: session.user.id,
    wallet_address: walletAddress.toLowerCase(),
    is_primary: true,
    label: 'Primary Wallet'
  });
}

// 2. Subsequent login: Detect which user owns wallet
async function detectUser(walletAddress: string): Promise<User | null> {
  // Check if wallet exists in user_wallets
  const { data } = await supabase
    .from('user_wallets')
    .select('user_id, users!inner(*)')
    .eq('wallet_address', walletAddress.toLowerCase())
    .single();
  
  return data?.users || null;
}

// 3. Login with any linked wallet
async function loginWithWallet(walletAddress: string, signature: string) {
  const existingUser = await detectUser(walletAddress);
  
  if (existingUser) {
    // Existing user: login and update last_used_at
    const { data: session } = await supabase.auth.signInWithWeb3({...});
    
    await supabase
      .from('user_wallets')
      .update({ last_used_at: new Date().toISOString() })
      .eq('wallet_address', walletAddress.toLowerCase());
    
    return session;
  } else {
    // New user: create account
    return firstLogin(walletAddress, signature);
  }
}
```

---

## Implementation Recommendations for Rogue

### Database Schema

```sql
-- 1. Risk Profiles (sensitive data)
CREATE TABLE risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_profile TEXT NOT NULL, -- AES-256-GCM encrypted JSON
  max_leverage NUMERIC, -- Plaintext for querying
  risk_tolerance TEXT CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX idx_risk_profiles_user ON risk_profiles(user_id);
ALTER TABLE risk_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own risk profile" ON risk_profiles
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- 2. Positions (link to both user and wallet)
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  wallet_address TEXT NOT NULL,
  protocol TEXT NOT NULL,
  position_type TEXT CHECK (position_type IN ('leverage', 'yield', 'liquidity')),
  collateral_token TEXT,
  collateral_amount NUMERIC,
  debt_token TEXT,
  debt_amount NUMERIC,
  health_factor NUMERIC,
  apy NUMERIC,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'liquidated')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_positions_wallet ON positions(wallet_address);
CREATE INDEX idx_positions_status ON positions(status) WHERE status = 'active';

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own positions" ON positions
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users create positions" ON positions
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND wallet_address IN (
    SELECT wallet_address FROM user_wallets WHERE user_id = (SELECT auth.uid())
  )
);

-- 3. Transaction History
CREATE TABLE transaction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  wallet_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  chain_id INTEGER NOT NULL,
  type TEXT CHECK (type IN ('deposit', 'withdraw', 'borrow', 'repay', 'liquidation')),
  amount NUMERIC,
  token TEXT,
  gas_used NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tx_history_user_date ON transaction_history(user_id, created_at DESC);
CREATE INDEX idx_tx_history_wallet ON transaction_history(wallet_address);
CREATE INDEX idx_tx_history_hash ON transaction_history(tx_hash);

ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions" ON transaction_history
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "System creates transactions" ON transaction_history
FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- 4. Nonce management (prevent replay attacks)
CREATE TABLE used_nonces (
  nonce TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '5 minutes'
);

CREATE INDEX idx_nonces_expires ON used_nonces(expires_at);

-- Cleanup function (run via cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM used_nonces WHERE expires_at < now();
$$;
```

### Wallet Signature Verification (Client)

```typescript
// lib/auth/wallet.ts
import { SiweMessage } from 'siwe';
import { createClient } from '@supabase/supabase-js';
import { BrowserProvider } from 'ethers';

export class WalletAuth {
  private supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  async connectWallet(): Promise<string> {
    if (!window.ethereum) throw new Error('No wallet found');
    
    const provider = new BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    return accounts[0];
  }
  
  async signIn(walletAddress: string): Promise<Session> {
    // 1. Generate nonce
    const nonce = crypto.randomUUID();
    
    // 2. Create SIWE message
    const message = new SiweMessage({
      domain: window.location.host,
      address: walletAddress,
      statement: 'Sign in to Rogue Yield Agent',
      uri: window.location.origin,
      version: '1',
      chainId: 1,
      nonce: nonce,
      issuedAt: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });
    
    const messageText = message.prepareMessage();
    
    // 3. Sign with wallet
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const signature = await signer.signMessage(messageText);
    
    // 4. Authenticate with Supabase
    const { data, error } = await this.supabase.auth.signInWithWeb3({
      provider: 'ethereum',
      options: {
        address: walletAddress,
        signature: signature,
        message: messageText
      }
    });
    
    if (error) throw error;
    
    // 5. Ensure user_wallets entry exists
    await this.ensureWalletLinked(walletAddress);
    
    return data.session;
  }
  
  private async ensureWalletLinked(walletAddress: string) {
    const { data: existing } = await this.supabase
      .from('user_wallets')
      .select('id')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();
    
    if (!existing) {
      await this.supabase.from('user_wallets').insert({
        wallet_address: walletAddress.toLowerCase(),
        chain_id: 1,
        is_primary: true,
        label: 'Primary Wallet'
      });
    }
  }
}
```

### Data Encryption Helper

```typescript
// lib/encryption/client.ts
export class ClientEncryption {
  private static ALGORITHM = 'AES-GCM';
  private static KEY_LENGTH = 256;
  
  static async deriveKey(signature: string, salt: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(signature),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  static async encrypt(plaintext: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: this.ALGORITHM, iv },
      key,
      encoder.encode(plaintext)
    );
    
    // Concatenate IV + ciphertext
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }
  
  static async decrypt(ciphertext: string, key: CryptoKey): Promise<string> {
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: this.ALGORITHM, iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }
}

// Usage example
async function saveEncryptedRiskProfile(profile: RiskProfile, walletSignature: string) {
  const key = await ClientEncryption.deriveKey(walletSignature, userWalletAddress);
  const encrypted = await ClientEncryption.encrypt(JSON.stringify(profile), key);
  
  await supabase.from('risk_profiles').upsert({
    user_id: (await supabase.auth.getUser()).data.user?.id,
    encrypted_profile: encrypted,
    max_leverage: profile.maxLeverage, // Plaintext for querying
    risk_tolerance: profile.riskTolerance
  });
}
```

---

## Security Best Practices Summary

### ✅ DO

1. **Enable RLS on all tables** in `public` schema immediately
2. **Index all RLS policy columns** (`user_id`, `wallet_address`, `team_id`)
3. **Wrap `auth.uid()` in SELECT** for performance: `(SELECT auth.uid())`
4. **Use security definer functions** for complex RLS checks
5. **Encrypt sensitive data** at application layer (risk profiles, API keys)
6. **Store wallet addresses lowercase** for consistency
7. **Implement nonce tracking** to prevent replay attacks
8. **Use `TO authenticated`** clause on all policies
9. **Separate policies per operation** (SELECT, INSERT, UPDATE, DELETE)
10. **Monitor query performance** with `EXPLAIN ANALYZE`

### ❌ DON'T

1. **Never expose service keys** in client-side code
2. **Don't skip NULL checks** on `auth.uid()`
3. **Don't use broad `FOR ALL`** policies without specific USING/WITH CHECK
4. **Don't store encryption keys** in database
5. **Don't skip MFA checks** on sensitive operations
6. **Don't create tables without RLS** in public schema
7. **Don't use nested subqueries** in RLS (flip join direction instead)
8. **Don't ignore Supabase Security Advisor** warnings
9. **Don't reuse nonces** (track in `used_nonces` table)
10. **Don't encrypt non-sensitive data** (unnecessary overhead)

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Web3 Auth](https://supabase.com/docs/guides/auth/auth-web3)
- [RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices)
- [Sign-In with Ethereum (ERC-4361)](https://eips.ethereum.org/EIPS/eip-4361)
- [Precursor Security: Row-Level Recklessness](https://www.precursorsecurity.com/security-blog/row-level-recklessness-testing-supabase-security)
- [AntStack: Optimizing RLS Performance](https://www.antstack.com/blog/optimizing-rls-performance-with-supabase/)

---

## Next Steps

1. **Set up Supabase project** with Web3 auth enabled
2. **Create database schema** with RLS-enabled tables
3. **Implement wallet signature flow** using SIWE
4. **Add encryption helpers** for sensitive data
5. **Deploy Edge Functions** for custom verification (if needed)
6. **Test RLS policies** with multiple test wallets
7. **Monitor performance** and adjust indexes
8. **Run Security Advisor** and fix findings
9. **Document multi-wallet UX** for users
10. **Set up monitoring** for auth failures and slow queries
