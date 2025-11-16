---
description: "Task list for Rogue Autonomous DeFi Yield Optimization Agent implementation"
---

# Tasks: Rogue — Autonomous DeFi Yield Optimization Agent

**Input**: Design documents from `/specs/001-rogue-yield-agent/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅

**Tests**: OPTIONAL - Not required per constitution. Manual validation via quickstart.md will be primary acceptance gate.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project structure per implementation plan (frontend/, backend/, contracts/, .specify/)
- [x] T002 Initialize frontend project with Vite + React 18 + TypeScript in frontend/package.json
- [x] T003 [P] Initialize backend project with Node.js 18 + Express + TypeScript in backend/package.json
- [x] T004 [P] Initialize smart contracts project with Hardhat in contracts/package.json
- [x] T005 [P] Configure ESLint and Prettier for frontend in frontend/.eslintrc.json
- [x] T006 [P] Configure ESLint and Prettier for backend in backend/.eslintrc.json
- [x] T007 [P] Configure solhint for smart contracts in contracts/.solhintrc.json
- [x] T008 [P] Setup Tailwind CSS in frontend/tailwind.config.js
 - [x] T009 [P] Create `.env.example` files for frontend, backend, and contracts with required API keys (backend `.env` must include `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPEN_AI_MODEL`)
- [x] T010 [P] Setup .gitignore for Node.js, environment files, and build artifacts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T011 Setup Supabase PostgreSQL database and create initial schema in backend/src/db/schema.sql
- [x] T012 [P] Configure Supabase client with Row Level Security in backend/src/services/supabase.ts
- [x] T013 [P] Setup Alchemy RPC provider configuration in backend/src/utils/rpc.ts
- [x] T014 [P] Implement wallet signature verification middleware in backend/src/middleware/auth.ts
- [x] T015 [P] Implement error handling middleware in backend/src/middleware/error.ts
- [x] T016 [P] Setup structured logging utility in backend/src/utils/logger.ts
- [x] T017 [P] Configure Vercel deployment settings in backend/vercel.json
- [x] T018 [P] Setup RainbowKit wallet connection in frontend/src/components/WalletConnect.tsx
- [x] T019 [P] Create ethers.js wallet utilities in frontend/src/services/wallet.ts
- [x] T020 [P] Setup ADK-TS application framework in backend/src/app.ts
- [x] T021 [P] Configure OpenAI SDK client in `backend/src/utils/openai.ts` to read `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPEN_AI_MODEL` from `backend/.env`
- [x] T022 [P] Setup environment configuration management in `backend/src/utils/constants.ts` to expose `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPEN_AI_MODEL` for application use
- [x] T023 Configure mainnet token addresses (USDC, WMATIC) in backend/src/utils/constants.ts
- [x] T024 [P] Configure Chainlink oracle addresses for Polygon mainnet in backend/src/utils/constants.ts
- [x] T025 Setup Hardhat deployment scripts for Polygon mainnet in contracts/scripts/deploy.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Stake & Auto-Manage (Priority: P1) 🎯 MVP

**Goal**: Users can connect wallet, choose risk profile, stake USDC/KRWQ, and have positions autonomously managed

**Independent Test**: With funded Polygon mainnet wallet, user can complete stake flow, see position in dashboard, and observe at least one automated action (deposit/compound) within configured window

### Implementation for User Story 1

#### Frontend Components

- [ ] T026 [P] [US1] Create RiskSlider component in frontend/src/components/RiskSlider.tsx
- [ ] T027 [P] [US1] Create StakeForm component with USDC/KRWQ input in frontend/src/components/StakeForm.tsx
- [ ] T028 [P] [US1] Create APYCard display component in frontend/src/components/APYCard.tsx
- [ ] T029 [P] [US1] Create Dashboard main view in frontend/src/pages/Dashboard.tsx
- [ ] T030 [US1] Implement API client service in frontend/src/services/api.ts (depends on T026-T029)
- [ ] T031 [US1] Implement smart contract interaction layer in frontend/src/services/contracts.ts
- [ ] T032 [US1] Create usePosition React hook in frontend/src/hooks/usePosition.ts
- [ ] T033 [US1] Create useWallet React hook wrapping RainbowKit in frontend/src/hooks/useWallet.ts
- [ ] T034 [US1] Create currency formatting utilities in frontend/src/utils/format.ts

#### Backend API Endpoints

- [ ] T035 [P] [US1] Implement POST /positions endpoint in backend/src/api/positions.ts
- [ ] T036 [P] [US1] Implement GET /positions/:walletAddress endpoint in backend/src/api/positions.ts
- [ ] T037 [P] [US1] Implement GET /positions/:id endpoint in backend/src/api/positions.ts
- [ ] T038 [P] [US1] Implement GET /health endpoint in backend/src/api/health.ts

#### Backend Services & Data Layer

- [ ] T039 [P] [US1] Create Position entity schema in Supabase (id, wallet_address, token, amount, risk_profile, status, timestamps)
- [ ] T040 [P] [US1] Implement Frax API integration service in backend/src/services/frax-api.ts
- [ ] T041 [P] [US1] Implement Aave subgraph client in backend/src/services/aave-subgraph.ts
- [ ] T042 [P] [US1] Implement Chainlink oracle reader service in backend/src/services/chainlink-oracle.ts
- [ ] T043 [P] [US1] Implement KRWQ conversion utility in backend/src/utils/krwq-conversion.ts

#### ADK-TS Multi-Agent System

- [ ] T044 [P] [US1] Implement Researcher agent (scan Frax/Aave yields) in backend/src/agents/researcher.ts
- [ ] T045 [P] [US1] Implement Analyzer agent (strategy personalization) in backend/src/agents/analyzer.ts
- [ ] T046 [P] [US1] Implement Executor agent (on-chain actions) in backend/src/agents/executor.ts
- [ ] T047 [US1] Create Sequential Workflow Agent orchestrating Researcher → Analyzer → Executor in backend/src/workflows/yield-optimization.ts

#### Smart Contracts

- [ ] T048 [P] [US1] Implement StakingProxy.sol ERC-20 staking contract in contracts/contracts/StakingProxy.sol
- [ ] T049 [US1] Implement YieldHarvester.sol executor contract in contracts/contracts/YieldHarvester.sol
- [ ] T050 [US1] Deploy StakingProxy and YieldHarvester to Polygon mainnet
- [ ] T051 [US1] Create ethers.js wrapper for StakingProxy in backend/src/contracts/staking-proxy.ts
- [ ] T052 [US1] Create ethers.js wrapper for YieldHarvester in backend/src/contracts/yield-harvester.ts

#### Autonomous Execution (Cron)

- [ ] T053 [P] [US1] Implement autonomous scan cron job in backend/src/cron/autonomous-scan.ts
- [ ] T054 [P] [US1] Implement autonomous compound cron job in backend/src/cron/autonomous-compound.ts
- [ ] T055 [US1] Configure node-cron triggers (every 4-24 hours configurable) in backend/src/server.ts

#### Integration & Validation

- [ ] T056 [US1] Integrate frontend StakeForm with backend POST /positions endpoint
- [ ] T057 [US1] Integrate Dashboard with GET /positions endpoint and contract balance queries
- [ ] T058 [US1] Add transaction history logging to Supabase in backend/src/api/transactions.ts
- [ ] T059 [US1] Test end-to-end stake flow on Polygon mainnet per quickstart.md

**Checkpoint**: At this point, User Story 1 should be fully functional - users can stake and positions are autonomously managed

---

## Phase 4: User Story 2 - Adjust Allocations & Monitor (Priority: P2)

**Goal**: Users can view live APY estimates, yield charts, and drag sliders to adjust allocations/risk with immediate impact preview

**Independent Test**: User opens dashboard, views real-time APY for their position, moves allocation slider, sees updated estimates; after confirming, Analyzer updates strategy and Executor schedules next action

### Implementation for User Story 2

#### Frontend Components

- [ ] T060 [P] [US2] Create YieldChart component with Recharts in frontend/src/components/YieldChart.tsx
- [ ] T061 [P] [US2] Create AllocationSlider component (drag-to-adjust) in frontend/src/components/AllocationSlider.tsx
- [ ] T062 [P] [US2] Create PositionDetail page view in frontend/src/pages/PositionDetail.tsx
- [ ] T063 [US2] Update Dashboard to display live APY refresh in frontend/src/pages/Dashboard.tsx

#### Backend API Endpoints

- [ ] T064 [P] [US2] Implement GET /strategies endpoint (Analyzer output) in backend/src/api/strategies.ts
- [ ] T065 [P] [US2] Implement PATCH /positions/:id/allocations endpoint in backend/src/api/positions.ts
- [ ] T066 [US2] Add historical yield data tracking to Supabase schema in backend/src/db/schema.sql

#### Backend Services

- [ ] T067 [US2] Implement yield history aggregation service in backend/src/services/yield-history.ts
- [ ] T068 [US2] Extend Analyzer agent to recalculate on allocation changes in backend/src/agents/analyzer.ts

#### Integration & Validation

- [ ] T069 [US2] Integrate YieldChart with historical yield API endpoint
- [ ] T070 [US2] Integrate AllocationSlider with PATCH /positions/:id/allocations endpoint
- [ ] T071 [US2] Test allocation adjustment flow updates strategy and schedules execution

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can adjust and monitor positions

---

## Phase 5: User Story 3 - Claim / Unstake / Rewards (Priority: P3)

**Goal**: Users can claim accrued rewards, perform one-click unstake triggering on-chain withdrawals, and see ATP token reward allocations

**Independent Test**: Funded managed position allows user to trigger "Claim" and observe reward token balance update and transaction in history; "Unstake" closes position with on-chain confirmation

### Implementation for User Story 3

#### Frontend Components

- [ ] T072 [P] [US3] Create ClaimUnstakeActions component with one-click buttons in frontend/src/components/ClaimUnstakeActions.tsx
- [ ] T073 [P] [US3] Create TransactionHistory table component in frontend/src/components/TransactionHistory.tsx
- [ ] T074 [US3] Update Dashboard to display reward token balances

#### Backend API Endpoints

- [ ] T075 [P] [US3] Implement POST /positions/:id/claim endpoint in backend/src/api/positions.ts
- [ ] T076 [P] [US3] Implement POST /positions/:id/unstake endpoint in backend/src/api/positions.ts
- [ ] T077 [P] [US3] Implement GET /transactions/:walletAddress endpoint in backend/src/api/transactions.ts

#### Backend Services & Agent

- [ ] T078 [P] [US3] Implement Governor agent (ATP reward distribution) in backend/src/agents/governor.ts
- [ ] T079 [US3] Add Governor to Sequential Workflow (Researcher → Analyzer → Executor → Governor) in backend/src/workflows/yield-optimization.ts
- [ ] T080 [US3] Create TransactionRecord entity schema in Supabase (tx_hash, type, timestamp, status, gas_cost, notes)

#### Smart Contracts

- [ ] T081 [P] [US3] Implement ATP token integration (IQAI ATP ERC-20) in backend/src/contracts/atp-token.ts
- [ ] T082 [US3] Add claim and unstake functions to YieldHarvester.sol in contracts/contracts/YieldHarvester.sol
- [ ] T083 [US3] Redeploy updated contracts to Polygon mainnet

#### Integration & Validation

- [ ] T084 [US3] Integrate ClaimUnstakeActions with backend claim/unstake endpoints
- [ ] T085 [US3] Integrate TransactionHistory with GET /transactions endpoint
- [ ] T086 [US3] Test claim flow updates reward balance and logs transaction
- [ ] T087 [US3] Test unstake flow closes position and withdraws funds on-chain

**Checkpoint**: All user stories should now be independently functional - complete lifecycle from stake to claim/unstake

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T088 [P] Update README.md with project overview, setup instructions, and deployment guide
- [ ] T089 [P] Create quickstart.md manual verification steps for mainnet in specs/001-rogue-yield-agent/quickstart.md
- [ ] T090 [P] Update .specify/memory/copilot-instructions.md with ADK-TS, RainbowKit, Recharts context
- [ ] T091 Code cleanup and refactoring across frontend components
- [ ] T092 Code cleanup and refactoring across backend agents and services
- [ ] T093 Performance optimization: frontend bundle analysis and code splitting
- [ ] T094 Performance optimization: backend query optimization and Supabase indexing
- [ ] T095 [P] Gas optimization for smart contracts (batch operations, efficient storage)
- [ ] T096 Security hardening: validate all user inputs, implement rate limiting
- [ ] T097 Security hardening: review smart contract for reentrancy and access control
- [ ] T098 Run quickstart.md validation on Polygon mainnet
- [ ] T099 Final security audit and mainnet deployment verification

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion - MVP foundation
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) completion - Can start in parallel with US1 but integrates with existing position system
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) completion - Can start in parallel with US1/US2 but extends position lifecycle
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories ✅ MVP
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 position system but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Extends US1 position lifecycle but independently testable

### Within Each User Story

#### User Story 1 Execution Order:
1. Frontend components (T026-T034) → Can run in parallel
2. Backend API endpoints (T035-T038) → Can run in parallel
3. Backend services (T039-T043) → Can run in parallel
4. ADK-TS agents (T044-T047) → Agents in parallel, workflow after agents
5. Smart contracts (T048-T052) → Deploy after contract implementation
6. Cron jobs (T053-T055) → After agents and contracts
7. Integration (T056-T059) → After all components ready

#### User Story 2 Execution Order:
1. Frontend components (T060-T063) → Can run in parallel
2. Backend endpoints (T064-T066) → Can run in parallel
3. Backend services (T067-T068) → After Analyzer agent exists (from US1)
4. Integration (T069-T071) → After all components ready

#### User Story 3 Execution Order:
1. Frontend components (T072-T074) → Can run in parallel
2. Backend endpoints (T075-T077) → Can run in parallel
3. Backend services & Governor agent (T078-T080) → Can run in parallel
4. Smart contracts (T081-T083) → After contract extensions
5. Integration (T084-T087) → After all components ready

### Parallel Opportunities

**Within Setup (Phase 1):**
- T003, T004, T005, T006, T007, T008, T009, T010 can all run in parallel

**Within Foundational (Phase 2):**
- T012-T022 (all services/utilities) can run in parallel
- T024 (Chainlink oracle config) can run in parallel with T023 (token addresses config)

**Within User Story 1:**
- Frontend: T026, T027, T028, T029 (components)
- Backend API: T035, T036, T037, T038 (endpoints)
- Backend Services: T039, T040, T041, T042, T043 (all data services)
- Agents: T044, T045, T046 (Researcher, Analyzer, Executor)
- Contracts: T048 can run in parallel with T049
- Cron: T053, T054 (scan and compound jobs)

**Cross-Story Parallelism:**
Once Foundational (Phase 2) completes, different team members can work on US1, US2, US3 in parallel since they are independently testable

---

## Parallel Example: User Story 1 - Batch 1

```bash
# Launch all frontend components together:
- [ ] T026 [P] [US1] Create RiskSlider component
- [ ] T027 [P] [US1] Create StakeForm component
- [ ] T028 [P] [US1] Create APYCard component
- [ ] T029 [P] [US1] Create Dashboard main view

# Launch all backend API endpoints together:
- [ ] T035 [P] [US1] POST /positions endpoint
- [ ] T036 [P] [US1] GET /positions/:walletAddress endpoint
- [ ] T037 [P] [US1] GET /positions/:id endpoint
- [ ] T038 [P] [US1] GET /health endpoint

# Launch all backend services together:
- [ ] T039 [P] [US1] Position entity schema in Supabase
- [ ] T040 [P] [US1] Frax API integration service
- [ ] T041 [P] [US1] Aave subgraph client
- [ ] T042 [P] [US1] Chainlink oracle reader
- [ ] T043 [P] [US1] KRWQ conversion utility

# Launch all agents together:
- [ ] T044 [P] [US1] Researcher agent
- [ ] T045 [P] [US1] Analyzer agent
- [ ] T046 [P] [US1] Executor agent
```

---

## Implementation Strategy

### MVP First (User Story 1 Only) - RECOMMENDED

**Timeline**: ~2-3 weeks for solo developer, ~1 week for team of 3

1. **Week 1**: Complete Phase 1 (Setup) + Phase 2 (Foundational)
   - Day 1-2: Project structure, dependencies, tooling
   - Day 3-5: Database, authentication, wallet integration, ADK-TS setup
   
2. **Week 2-3**: Complete Phase 3 (User Story 1)
   - Day 1-3: Frontend components, backend APIs, services
   - Day 4-6: ADK-TS agents (Researcher, Analyzer, Executor)
   - Day 7-9: Smart contracts, deployment, cron jobs
   - Day 10-12: Integration testing, bug fixes
   
3. **Validation**: Test on Polygon mainnet per quickstart.md
4. **Deploy**: Vercel (frontend/backend) + Polygon mainnet (contracts)
5. **Demo**: MVP ready for beta testing

**STOP HERE for hackathon MVP submission** - This delivers core value proposition

### Incremental Delivery (MVP + Enhancements)

**Timeline**: +1 week per additional user story

1. **Weeks 1-3**: Setup + Foundational + User Story 1 (MVP)
   - Deploy and validate
   
2. **Week 4**: Add User Story 2 (Allocations & Monitoring)
   - Charts, sliders, real-time updates
   - Test independently from US1
   - Deploy updated version
   
3. **Week 5**: Add User Story 3 (Claim/Unstake/Rewards)
   - Governor agent, ATP tokens, transaction history
   - Test independently from US1/US2
   - Deploy complete version
   
4. **Week 6**: Polish (Phase 6)
   - Documentation, optimization, security review
   - Prepare for mainnet migration

### Parallel Team Strategy (3 Developers)

**Once Foundational (Phase 2) is complete:**

- **Developer A (Frontend Lead)**: 
  - US1: T026-T034 (frontend components)
  - US2: T060-T063 (charts, sliders)
  - US3: T072-T074 (claim/unstake UI)
  
- **Developer B (Backend/Agents Lead)**:
  - US1: T035-T047 (APIs, services, ADK-TS agents)
  - US2: T064-T068 (strategies, allocation updates)
  - US3: T075-T080 (claim/unstake logic, Governor agent)
  
- **Developer C (Smart Contracts Lead)**:
  - US1: T048-T052 (StakingProxy, YieldHarvester)
  - US2: (No contract work - support integration)
  - US3: T081-T083 (ATP integration, claim/unstake functions)

**Integration Points**: Coordinate at end of each user story phase for T056-T059, T069-T071, T084-T087

---

## MVP Scope Definition

**Minimum Viable Product = User Story 1 Only**

**What's Included:**
✅ Wallet connection (Polygon mainnet)
✅ Risk profile selection (low/medium/high)
✅ Stake USDC or KRWQ
✅ Multi-agent AI workflow (Researcher → Analyzer → Executor)
✅ Autonomous yield optimization (cron-triggered)
✅ Dashboard with APY estimates
✅ Basic position tracking
✅ Smart contracts (StakingProxy, YieldHarvester)

**What's Deferred to Post-MVP:**
⏸️ Yield charts and historical data (US2)
⏸️ Allocation adjustment sliders (US2)
⏸️ Claim rewards functionality (US3)
⏸️ One-click unstake (US3)
⏸️ ATP token distribution (US3)
⏸️ Transaction history view (US3)

**Why This Scope:**
- Proves core value: "Set-it-and-forget-it robo-harvester"
- Demonstrates multi-agent AI orchestration
- Shows autonomous on-chain execution
- Minimal attack surface for security review
- Can launch in 2-3 weeks

---

## Success Metrics (Per Success Criteria from spec.md)

### SC-001: Stake Flow Completion
**Target**: <3 minutes for 95% of attempts
**Measurement**: Track time from wallet connect (T018) to position visible in dashboard (T057)
**Tasks**: T056, T057, T059

### SC-002: Autonomous Execution Success Rate
**Target**: 98% success over 7-day rolling period
**Measurement**: Log all cron job outcomes in Supabase (T053, T054)
**Tasks**: T053, T054, T055, T016 (error handling)

### SC-003: APY Estimate Accuracy
**Target**: ±15% of realized yield after 7 days for 80% of strategies
**Measurement**: Compare Analyzer estimates (T045) vs actual on-chain yields
**Tasks**: T045, T067 (yield history tracking)

### SC-004: Unstake Completion
**Target**: 99% one-click unstake success when liquidity exists
**Measurement**: Track unstake transaction confirmations (T076)
**Tasks**: T076, T082, T087

### SC-005: Dashboard Responsiveness
**Target**: APY/position refresh <10s from agent run completion
**Measurement**: Frontend polling interval + API response time
**Tasks**: T063 (live APY), T057 (dashboard integration), T094 (query optimization)

---

## Technical Debt & Known Limitations

**Documented for Post-MVP Cleanup:**

1. **Production Mainnet**: All tasks target Polygon mainnet with real USDC/WMATIC/KRWQ tokens and live Chainlink oracles
   
2. **No Automated Tests**: Per constitution, tests are optional. Manual validation via quickstart.md (T089, T098)

3. **Single Oracle**: Initial implementation uses Chainlink only. Research.md recommends dual-oracle (Chainlink + Uniswap TWAP) for enhanced resilience - can add post-MVP

4. **No Sequencer Uptime Check**: Polygon doesn't have L2 sequencer feed (per research.md). Network health monitoring deferred to T096

5. **Governor Agent Scope**: US3 Governor implements basic ATP distribution. Advanced governance (voting, proposals) out of scope

6. **Gas Optimization**: T095 addresses basic optimization. Advanced techniques (batch transactions, EIP-2535 diamonds) deferred

---

## Notes

- **[P] tasks** = different files, no dependencies on task completion order
- **[Story] label** maps task to specific user story (US1, US2, US3) for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **CRITICAL**: Phase 2 (Foundational) MUST complete before any user story work begins

---

**Generated**: 2025-11-16
**Feature**: Rogue Autonomous DeFi Yield Optimization Agent
**Branch**: 001-rogue-yield-agent
**Total Tasks**: 99
**MVP Tasks (Phase 1-3)**: 59 tasks (Setup + Foundational + User Story 1)
**Estimated MVP Timeline**: 2-3 weeks (solo), 1 week (team of 3)
