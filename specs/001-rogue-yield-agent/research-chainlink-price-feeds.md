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
