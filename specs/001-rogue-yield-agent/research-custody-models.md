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
