# 🔍 Pre-Production Audit: Base Mainnet Deployment

**Date**: November 19, 2025  
**Test Amount**: 0.01 USDC (~$0.01)  
**Network**: Base Mainnet (Chain ID: 8453)

---

## ⚠️ CRITICAL ISSUES FOUND

### 🚨 Issue #1: Frontend Contract Addresses Still Using Testnet
**Location**: `frontend/src/services/contracts.ts`  
**Severity**: CRITICAL - Will cause transaction failures

```typescript
// CURRENT (WRONG):
export const CONTRACTS = {
  STAKING_PROXY: '0xBe038f9Fa03C127e5E565a77b5b6DD1507B223a1',  // Sepolia testnet
  YIELD_HARVESTER: '0xa26A882e63B598B7f4B39C56fB014A7F4398FbFD',  // Sepolia testnet
  USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',          // Polygon Amoy testnet
  WMATIC: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',        // Polygon Amoy testnet
}

// NEEDS TO BE (Base Mainnet):
export const CONTRACTS = {
  STAKING_PROXY: process.env.VITE_STAKING_PROXY_ADDRESS || '0x0000...', // Deploy to Base first
  YIELD_HARVESTER: process.env.VITE_YIELD_HARVESTER_ADDRESS || '0x0000...', // Deploy to Base first
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',  // Base Mainnet USDC ✅
  WETH: '0x4200000000000000000000000000000000000006',  // Base Mainnet WETH ✅
}
```

**Impact**: Staking transactions will fail because contracts don't exist on Base Mainnet yet.

---

### 🚨 Issue #2: Smart Contracts NOT Deployed to Base Mainnet
**Location**: `contracts/` directory  
**Severity**: CRITICAL - Cannot stake without deployed contracts

**Required Actions**:
1. Deploy `StakingProxy.sol` to Base Mainnet
2. Deploy `YieldHarvester.sol` to Base Mainnet  
3. Update `.env` files with new contract addresses
4. Verify contracts on Basescan

**Command to Deploy**:
```bash
cd contracts
npx hardhat run scripts/deploy.ts --network base
```

---

### 🚨 Issue #3: Chain Parameter Mismatch
**Location**: Multiple backend files  
**Severity**: HIGH - Agent workflows still reference testnets

**Files with testnet references**:
- `backend/src/workflows/yield-optimization-enhanced.ts` - Line 20: `chains?: ('mumbai' | 'sepolia' | 'base_sepolia')[]`
- `backend/src/agents/researcher-enhanced.ts` - Line 29: `z.enum(['mumbai', 'sepolia', 'base_sepolia'])`
- `backend/src/services/transaction-executor.ts` - Lines 25-27
- `backend/src/api/positions.ts` - Line 23: `z.enum(['mumbai', 'sepolia', 'base_sepolia'])`

**Should be**: `chain: 'base'` (single chain, Base Mainnet)

---

### 🚨 Issue #4: Agent Research Logic May Not Work on Base
**Location**: `backend/src/agents/researcher-enhanced.ts`  
**Severity**: MEDIUM - Agents won't find Base opportunities

The Researcher agent is hardcoded to scan specific testnets:
```typescript
if (chain === 'mumbai') {
  // Aave + Frax on Polygon
  const [aave, frax] = await Promise.all([...]);
} else if (chain === 'sepolia') {
  // Lido staking on Sepolia
  const lidoAPR = await getLidoAPR('sepolia');
}
```

**Missing**: Logic for scanning Base Mainnet protocols (Aave V3, Aerodrome, Moonwell, etc.)

---

### ⚠️ Issue #5: Minimum Deposit Amount Too Low
**Test Amount**: 0.01 USDC  
**Severity**: LOW - May not cover gas fees

**Analysis**:
- Base gas fees: ~$0.01-0.05 per transaction
- Staking requires: Approve + Stake = 2 transactions = ~$0.02-0.10 in gas
- With 0.01 USDC deposit, you may not have enough ETH for gas

**Recommendation**: Have at least **0.005 ETH (~$10)** in wallet for gas fees.

---

## ✅ WORKING COMPONENTS

### 1. Backend Configuration ✅
- Base Mainnet RPC configured correctly
- Chain ID 8453 set properly
- Chainlink price feeds updated to Base
- Aave V3 subgraph pointing to Base

### 2. Frontend Wallet Integration ✅
- WalletConnect configured for Base chain
- Network switching logic uses correct chainId (8453)
- UI messaging updated to "Base Mainnet"

### 3. Unstaking Logic ✅
**Location**: `backend/src/api/positions.ts` Line 266  
**Flow**:
1. POST `/positions/:id/unstake`
2. Validates position ownership
3. Calls `unstakeTokens()` from StakingProxy contract
4. Updates position status to "closed"
5. Records transaction in database
6. Returns tokens to user wallet

**Status**: Code looks correct, but **requires deployed contracts**.

### 4. API Multichain Endpoint ✅
Now shows only Base Mainnet opportunities:
- Aave V3 USDC (5.8% APY)
- Aave V3 ETH (3.2% APY)
- Uniswap V3 ETH-USDC LP (8.5% APY)
- Aerodrome USDC-DAI LP (12.3% APY)
- Moonwell USDC (6.2% APY)

---

## 📊 STAKING FLOW ANALYSIS

### Current Flow (Frontend → Backend):

```
1. User connects wallet (Base Mainnet, chainId 8453) ✅
2. User enters amount (0.01 USDC) ✅
3. User selects risk profile (low/medium/high) ✅
4. Frontend checks if correct network ✅
   - If wrong: prompts network switch ✅
5. Frontend approves USDC to StakingProxy ❌ (contract not deployed)
6. Frontend calls stakingContract.stake() ❌ (contract not deployed)
7. Frontend sends tx_hash to backend API ⏸️
8. Backend creates position record ✅
9. Backend triggers agent workflow ⚠️ (needs Base logic)
```

### Agent Workflow (Should Execute Automatically):

```
RESEARCHER AGENT 🔍
├─ Scans Base Mainnet for opportunities ❌ (hardcoded for testnets)
├─ Fetches Aave V3 yields ✅ (API configured correctly)
├─ Fetches Aerodrome/Moonwell yields ❌ (not implemented)
└─ Returns top opportunities

TRADER/ANALYZER AGENT 💰
├─ Receives research data ✅
├─ Creates allocation based on risk profile ✅
├─ Optimizes for expected APY ✅
└─ Outputs action plan

GOVERNOR AGENT 🛡️
├─ Validates risk parameters ✅
├─ Checks slippage tolerance ✅
├─ Approves or rejects execution ✅
└─ Logs decision

EXECUTOR AGENT ⚙️
├─ Deposits to selected protocols ❌ (needs Base contracts)
├─ Records on-chain transactions ⏸️
└─ Updates position in database ✅
```

---

## 🔧 REQUIRED FIXES (Priority Order)

### 1. DEPLOY SMART CONTRACTS TO BASE MAINNET 🔴
```bash
# In contracts/ directory
npx hardhat run scripts/deploy.ts --network base
```
**Then update**:
- `backend/.env`: `STAKING_PROXY_ADDRESS`, `YIELD_HARVESTER_ADDRESS`
- `frontend/.env`: `VITE_STAKING_PROXY_ADDRESS`, `VITE_YIELD_HARVESTER_ADDRESS`

### 2. UPDATE FRONTEND CONTRACT ADDRESSES 🔴
File: `frontend/src/services/contracts.ts`
- Change USDC to Base Mainnet address: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Remove WMATIC, add WETH: `0x4200000000000000000000000000000000000006`
- Update contract addresses after deployment

### 3. UPDATE AGENT LOGIC FOR BASE MAINNET 🟡
File: `backend/src/agents/researcher-enhanced.ts`
- Remove mumbai/sepolia logic
- Add Base-specific protocol scanning
- Update chain type definitions throughout

### 4. UPDATE CHAIN ENUMS THROUGHOUT BACKEND 🟡
Replace all instances of:
```typescript
z.enum(['mumbai', 'sepolia', 'base_sepolia'])
```
With:
```typescript
z.enum(['base']).default('base')
```

Or simply:
```typescript
chain: 'base' as const
```

### 5. TEST STAKING FLOW 🟢
**After contracts deployed**:
1. Approve 0.01 USDC to StakingProxy
2. Call stake(USDC_ADDRESS, 10000, 0) // 0.01 USDC, low risk
3. Verify position created in database
4. Check agent logs to see if workflow triggered
5. Test unstaking

---

## 💡 RECOMMENDATIONS

### For 0.01 USDC Test:
1. **Get Base ETH first**: You need ~0.005 ETH for gas
2. **Get Base USDC**: Bridge or buy 0.01 USDC on Base
3. **Deploy contracts**: Critical first step
4. **Start with low risk**: Test with "low" risk profile first

### For Agent Functionality:
- The agents **will not research** until you update the logic for Base
- Current code only scans Mumbai (Polygon Amoy) and Sepolia
- You'll need to add Base-specific data sources

### For Production:
- Consider using a real oracle for price feeds
- Add proper error handling for failed transactions
- Implement retry logic for blockchain calls
- Add monitoring/alerting for stuck positions

---

## 🎯 NEXT STEPS

1. **Deploy contracts to Base Mainnet** (30 min)
2. **Update all contract addresses** (10 min)
3. **Fix chain enum issues** (15 min)
4. **Update agent research logic** (1 hour)
5. **Test with 0.01 USDC** (15 min)
6. **Monitor agent execution** (ongoing)

---

## ⚡ QUICK FIX CHECKLIST

- [ ] Deploy StakingProxy to Base Mainnet
- [ ] Deploy YieldHarvester to Base Mainnet
- [ ] Update frontend CONTRACTS object
- [ ] Update backend .env with new addresses
- [ ] Change all chain enums from testnet to 'base'
- [ ] Update researcher agent for Base protocols
- [ ] Test approve + stake with 0.01 USDC
- [ ] Verify agent workflow triggers
- [ ] Test unstaking flow
- [ ] Check transaction records in database

---

**Status**: ⚠️ NOT READY FOR MAINNET TESTING  
**Blocker**: Smart contracts not deployed to Base Mainnet

Once contracts are deployed and addresses updated, the flow should work for basic staking/unstaking. Agent research functionality will need additional work to scan Base-specific protocols.
