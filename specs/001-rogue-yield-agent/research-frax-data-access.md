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
