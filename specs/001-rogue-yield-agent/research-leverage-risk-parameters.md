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

