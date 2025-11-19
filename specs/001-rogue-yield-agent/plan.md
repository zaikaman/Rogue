# Implementation Plan: Rogue — Autonomous DeFi Yield Optimization Agent

**Branch**: `001-rogue-yield-agent` | **Date**: 2025-11-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-rogue-yield-agent/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Rogue is an autonomous DeFi yield optimization agent that allows users to connect a Polygon wallet, select a risk profile (low/medium/high), and stake USDC or KRWQ to receive automated yield optimization. The system uses a multi-agent AI workflow (Researcher, Analyzer, Executor, Governor) powered by ADK-TS and OpenAI to scan Frax/Aave yields, personalize strategies, execute on-chain actions (deposits, auto-compounds, hedges), and distribute tokenized rewards via IQAI's ATP. Users interact via a React dashboard showing live APY, yield charts, tx history, and one-click unstake/claim actions. Backend runs on Node.js/Express with Vercel hosting, using Supabase for off-chain data persistence and ethers.js for on-chain execution on Polygon Amoy testnet.

## Technical Context

**Language/Version**: Node.js v18+ (backend), TypeScript 5.x (frontend + backend), Solidity 0.8.x (smart contracts)
**Primary Dependencies**: 
  - Frontend: React 18, Vite 4, RainbowKit (wallet connect), Recharts (yield charts), Tailwind CSS
  - Backend: Express.js, ADK-TS (multi-agent framework), OpenAI SDK (gpt-5-nano-2025-08-07), ethers.js v6, node-cron
  - Smart Contracts: Hardhat, OpenZeppelin (ERC-20 proxy, access control)
  - Database: Supabase (PostgreSQL with Row Level Security)
  - External APIs: Frax Finance API, Aave subgraph (The Graph), Chainlink oracles (price feeds)

**Storage**: Supabase (Postgres) for off-chain persistence (user risk profiles, historical yield data, transaction logs); encrypted and wallet-linked via Row Level Security. No custody of private keys.

**Testing**: NEEDS CLARIFICATION - Per constitution, tests/CI are optional for rapid iteration. Manual verification via quickstart.md will be primary validation method unless automated testing is explicitly required.

**Target Platform**: 
  - Frontend: Web browsers (Chrome, Firefox, Safari) with wallet extensions (MetaMask, WalletConnect)
  - Backend: Vercel serverless functions (Node.js runtime)
  - Smart Contracts: Polygon Amoy testnet (upgrade path to Polygon mainnet post-hackathon)
  - RPC: Alchemy API for Polygon Amoy network access

**Project Type**: Web application (full-stack dApp: React frontend + Node.js backend + Solidity contracts)

**Performance Goals**: 
  - Dashboard APY/position refresh: <10s from agent run completion
  - Stake flow completion: <3 minutes for 95% of attempts
  - Autonomous execution success rate: 98% under normal network conditions (7-day rolling)
  - APY estimate accuracy: ±15% of realized yield after 7 days for 80% of strategies

**Constraints**: 
  - Non-custodial: wallet-signed actions only, no private key storage
  - Oracle dependency: Executor must pause on stale/unavailable Chainlink data
  - Network fees: gas optimization required for auto-compound profitability
  - Slippage tolerance: conservative withdrawal parameters for low liquidity scenarios
  - KRWQ conversion: requires on-chain liquidity pool + stable oracle feed

**Scale/Scope**: 
  - MVP: 10-100 beta users on testnet
  - User positions: up to 1000 concurrent managed positions
  - Agent execution: cron triggers every 4-24 hours (configurable per strategy)
  - Data retention: 90 days of tx history, indefinite position/profile storage
  - Smart contract interactions: ERC-20 staking proxy, yield harvester executor, ATP token integration

## Constitution Check

*GATE: Feature authors MUST document how the plan meets the constitution's mandatory
principles (Code Quality, UX Consistency, Performance). This is a lightweight check and does
not require automated tests or CI enforcement. Maintainers MAY request clarifications.*

### I. Code Quality (NON-NEGOTIABLE)
- **Style & Readability**: TypeScript + ESLint/Prettier for frontend/backend, Solidity linters (solhint) for contracts. Code MUST follow established formatting rules; small, focused modules per agent/service.
- **Review & Pairing**: All PRs MUST be peer-reviewed for style conformance, correctness, and complexity before merge to main.
- **Static Analysis**: ESLint (TS), solhint (Solidity), TypeScript strict mode enabled. Analysis results MUST be reviewed before merge.

**Status**: ✅ COMPLIANT - Tooling plan supports readable, maintainable code with enforced linting and peer review.

### II. User Experience Consistency (MUST)
- **Design Tokens & Patterns**: Tailwind CSS provides design token consistency. Wallet connection via RainbowKit follows established Web3 UX patterns. Dashboard components (APY cards, charts, tx history) use consistent Recharts and Tailwind styling.
- **Errors & Messaging**: All error states (oracle unavailable, tx failure, insufficient liquidity) MUST display actionable user guidance in the dashboard with clear next steps. API error shapes documented in contracts/ phase.
- **Accessibility & Clarity**: Dashboard MUST be keyboard-navigable and screen-reader accessible for core flows (connect wallet, stake, unstake, claim). Risk slider and allocation adjustments provide immediate visual feedback.

**Status**: ✅ COMPLIANT - Design system and error handling plan ensure consistent, accessible UX.

### III. Performance & Efficiency (MUST)
- **Measurable Targets**: 
  - Dashboard refresh: p95 <10s from agent completion (tracked via Supabase query logs + client-side metrics)
  - Stake flow: <3min for 95% of attempts (measured from wallet connect to position visible)
  - Autonomous execution: 98% success rate over 7-day rolling window (logged per cron run)
  - APY accuracy: ±15% for 80% of strategies after 7 days (calculated from on-chain vs estimated yields)
- **Performance Budgeting**: Frontend bundle <500KB gzipped; backend function cold start <2s; Supabase queries optimized with indexes on wallet_address, position_id. Gas costs for auto-compound MUST be <10% of yield to remain profitable.
- **Profiling & Optimization**: Vercel Analytics for backend latency; React DevTools Profiler for frontend rendering; ethers.js batch calls for multi-contract reads.

**Status**: ✅ COMPLIANT - Explicit performance goals with measurable thresholds and profiling plan documented.

### Additional Development Constraints
- **No Mandatory Tests/CI**: Accepted. Manual validation via quickstart.md will serve as primary acceptance gate. Optional unit tests for critical agent logic (strategy selection, risk calculations) MAY be added later.
- **Minimum Tooling**: ESLint, Prettier, solhint configured and enforced via pre-commit hooks (optional) or PR review checklist.
- **Documentation**: quickstart.md MUST include step-by-step wallet connection, stake, view dashboard, and manual compound verification.

**GATE RESULT**: ✅ NO VIOLATIONS - Plan meets all constitutional requirements. No exceptions needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-rogue-yield-agent/
├── spec.md              # Feature specification (already exists)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command) - to be created
├── data-model.md        # Phase 1 output (/speckit.plan command) - to be created
├── quickstart.md        # Phase 1 output (/speckit.plan command) - to be created
├── contracts/           # Phase 1 output (/speckit.plan command) - to be created
│   ├── api.openapi.yaml # Backend API contract (REST endpoints for agents, positions, tx)
│   └── events.schema.json # Smart contract event schemas (Staked, Compounded, Claimed, etc.)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Web application structure (frontend + backend + contracts)

frontend/
├── src/
│   ├── components/
│   │   ├── WalletConnect.tsx      # RainbowKit wallet connection
│   │   ├── RiskSlider.tsx         # Risk profile selector (low/medium/high)
│   │   ├── StakeForm.tsx          # USDC/KRWQ stake input + confirm
│   │   ├── Dashboard.tsx          # Main user dashboard
│   │   ├── APYCard.tsx            # Live APY estimate display
│   │   ├── YieldChart.tsx         # Recharts historical yield visualization
│   │   ├── TransactionHistory.tsx # Table of user tx history
│   │   ├── AllocationSlider.tsx   # Drag-to-adjust allocations (P2 feature)
│   │   └── ClaimUnstakeActions.tsx # One-click claim/unstake buttons
│   ├── pages/
│   │   ├── Home.tsx               # Landing + wallet connect
│   │   └── PositionDetail.tsx     # Individual position management
│   ├── services/
│   │   ├── api.ts                 # Backend API client (fetch wrapper)
│   │   ├── wallet.ts              # ethers.js wallet utilities
│   │   └── contracts.ts           # Smart contract interaction layer
│   ├── hooks/
│   │   ├── usePosition.ts         # React hook for position data
│   │   └── useWallet.ts           # RainbowKit wallet hook
│   ├── utils/
│   │   ├── format.ts              # Number/currency formatting (USDC, KRWQ)
│   │   └── constants.ts           # Contract addresses, chain configs
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                  # Tailwind entry point
├── public/
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json

backend/
├── src/
│   ├── agents/
│   │   ├── researcher.ts          # ADK-TS Researcher agent (scan Frax/Aave yields)
│   │   ├── analyzer.ts            # ADK-TS Analyzer agent (strategy personalization)
│   │   ├── executor.ts            # ADK-TS Executor agent (on-chain actions)
│   │   └── governor.ts            # ADK-TS Governor agent (ATP reward distribution)
│   ├── services/
│   │   ├── frax-api.ts            # Frax Finance API integration
│   │   ├── aave-subgraph.ts       # Aave subgraph queries (The Graph)
│   │   ├── chainlink-oracle.ts    # Chainlink price feed reader
│   │   └── supabase.ts            # Supabase client + query helpers
│   ├── contracts/
│   │   ├── staking-proxy.ts       # ethers.js wrapper for ERC-20 staking contract
│   │   ├── yield-harvester.ts     # ethers.js wrapper for yield harvester executor
│   │   └── atp-token.ts           # ethers.js wrapper for IQAI ATP token
│   ├── cron/
│   │   ├── autonomous-scan.ts     # Cron job: trigger Researcher agent
│   │   └── autonomous-compound.ts # Cron job: trigger Executor auto-compound
│   ├── api/
│   │   ├── positions.ts           # Express routes: GET/POST /positions
│   │   ├── strategies.ts          # Express routes: GET /strategies (Analyzer output)
│   │   ├── transactions.ts        # Express routes: GET /transactions/:wallet
│   │   └── health.ts              # Express route: GET /health
│   ├── middleware/
│   │   ├── auth.ts                # Wallet signature verification middleware
│   │   └── error.ts               # Error handling + user-friendly messages
│   ├── utils/
│   │   ├── krwq-conversion.ts     # KRWQ <-> USDC conversion via oracle
│   │   └── logger.ts              # Structured logging (Vercel logs)
│   ├── app.ts                     # Express app setup
│   └── server.ts                  # Entry point (Vercel serverless adapter)
├── package.json
├── tsconfig.json
└── vercel.json                    # Vercel deployment config

contracts/
├── contracts/
│   ├── StakingProxy.sol           # ERC-20 staking proxy (deposit/withdraw)
│   ├── YieldHarvester.sol         # Executor contract (compound, hedge, emergency pause)
│   └── mocks/
│       ├── MockERC20.sol          # USDC/KRWQ mock for testnet
│       └── MockOracle.sol         # Chainlink oracle mock
├── scripts/
│   ├── deploy.ts                  # Hardhat deployment script
│   └── verify.ts                  # Etherscan/Polygonscan verification
├── test/                          # Optional: Hardhat contract tests
├── hardhat.config.ts
├── package.json
└── tsconfig.json

.specify/
├── memory/
│   ├── constitution.md            # Project constitution (already exists)
│   └── copilot-instructions.md    # GitHub Copilot context (to be updated in Phase 1)
└── scripts/
    └── powershell/
        └── update-agent-context.ps1 # Agent context updater (Phase 1)

README.md
package.json                       # Root workspace config (optional: npm workspaces)
.gitignore
.env.example                       # Environment variables template (API keys, RPC URLs)
```

**Structure Decision**: Web application (Option 2) selected because the project has distinct frontend (React dApp), backend (Node.js API + agents), and smart contracts (Solidity). This separation enables:
- Independent deployment: Vercel for FE/BE, Hardhat for contracts to Polygon testnet
- Clear ownership: frontend team (UI/UX), backend team (agents/API), contracts team (Solidity)
- Technology isolation: React ecosystem vs Node.js/ADK-TS vs Solidity/Hardhat toolchains

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations detected. This section is intentionally left empty per constitution requirements.

---

## Phase 0: Outline & Research

*To be generated by /speckit.plan command. This section will contain research.md with resolutions for all NEEDS CLARIFICATION items from Technical Context and feature spec.*

### Research Tasks (from Technical Context & Feature Spec)

1. **Testing strategy clarification** - Resolve "NEEDS CLARIFICATION" in Technical Context: confirm manual validation approach vs optional automated tests per constitution allowance.
2. **FR-013: Governance & ATP reward distribution** - Research IQAI ATP tokenomics, reward distribution schedule, and vesting rules for stakers.
3. **FR-014: Custody model for automated execution** - Research trade-offs: delegated smart-contract approvals (EIP-2612, meta-transactions) vs per-transaction user signatures; evaluate UX friction vs security.
4. **FR-015: Leverage caps for high-risk strategies** - Research safe leverage limits for DeFi yield farming (Aave/Compound best practices), liquidation thresholds, and oracle failure scenarios.
5. **ADK-TS multi-agent patterns** - Find best practices for ADK-TS agent orchestration: error handling, state persistence, agent communication patterns.
6. **Frax Finance API integration** - Research Frax API endpoints for pool yields, liquidity availability, and KRWQ conversion mechanics.
7. **Aave subgraph query patterns** - Research The Graph subgraph schema for Aave v3 on Polygon: yield rates, user positions, available markets.
8. **Chainlink oracle reliability** - Research Chainlink price feed availability on Polygon Amoy, staleness detection, and fallback strategies.
9. **Supabase Row Level Security for wallet isolation** - Find best practices for wallet-based RLS policies, encryption patterns for sensitive data.
10. **Gas optimization for auto-compound profitability** - Research ethers.js gas estimation strategies, batch transaction patterns, and compound frequency heuristics.

---

## Phase 1: Design & Contracts

*To be generated by /speckit.plan command. This section will contain data-model.md, contracts/, and quickstart.md.*

### Expected Outputs

1. **data-model.md** - Entity definitions extracted from feature spec (User, WalletConnection, Position, Strategy, Agent, TransactionRecord, OraclePrice, RewardToken) with fields, relationships, validation rules, state transitions.

2. **contracts/api.openapi.yaml** - OpenAPI 3.0 schema for backend REST API:
   - POST /positions - Create new managed position
   - GET /positions/:walletAddress - List user positions
   - GET /positions/:id - Get position detail
   - PATCH /positions/:id/allocations - Update allocation/risk
   - POST /positions/:id/unstake - Trigger unstake
   - POST /positions/:id/claim - Trigger claim
   - GET /strategies - List available strategies (Analyzer output)
   - GET /transactions/:walletAddress - List user tx history
   - GET /health - Health check

3. **contracts/events.schema.json** - Smart contract event schemas:
   - Staked(address user, uint256 amount, uint8 riskProfile)
   - Compounded(address user, uint256 yieldAmount, uint256 newTotal)
   - Claimed(address user, uint256 rewardAmount)
   - Unstaked(address user, uint256 amount, uint256 fee)
   - EmergencyPause(address executor, string reason)

4. **quickstart.md** - Manual verification steps:
   - Install MetaMask and add Polygon Amoy testnet
   - Fund wallet with test MATIC, USDC (faucet links)
   - Connect wallet to localhost:5173 (frontend dev server)
   - Complete stake flow (select risk, enter amount, confirm)
   - View dashboard: verify position appears, APY estimate displayed
   - Trigger manual compound (backend API call or admin panel)
   - Verify transaction in tx history
   - One-click unstake and verify withdrawal transaction

5. **Agent context update** - Run `.specify/scripts/powershell/update-agent-context.ps1 -AgentType copilot` to update `.specify/memory/copilot-instructions.md` with new technologies from this plan (ADK-TS, RainbowKit, Recharts, Supabase, Hardhat, Chainlink, Frax/Aave APIs).

---

## Next Steps (Post-Planning)

After `/speckit.plan` command completes Phase 0 and Phase 1:

1. Review `research.md` to ensure all NEEDS CLARIFICATION items are resolved.
2. Validate `data-model.md` entity definitions against feature spec requirements.
3. Review `contracts/api.openapi.yaml` for API completeness and error handling.
4. Execute manual verification steps in `quickstart.md` as development progresses.
5. Run `/speckit.tasks` command to generate `tasks.md` (Phase 2 - implementation task breakdown).

**Command ends after Phase 1 planning. Implementation tasks are NOT generated by /speckit.plan.**
