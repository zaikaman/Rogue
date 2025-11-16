# Feature Specification: Rogue — Autonomous DeFi Yield Optimization Agent

**Feature Branch**: `001-rogue-yield-agent`  
**Created**: 2025-11-16  
**Status**: Draft  
**Input**: User description: "Build an autonomous DeFi yield optimization agent called Rogue, tokenized on IQAI's ATP for staking and shared rewards. Users connect their Polygon wallet via a simple web dApp dashboard, select a risk profile (low/medium/high via slider), and stake USDC or KRWQ to activate. Rogue uses a multi-agent AI workflow powered by ADK-TS and OpenAI: a Researcher agent scans yields from Frax pools and Aave via APIs/subgraphs; an Analyzer personalizes strategies (e.g., stable locks for low-risk, leveraged farming for high); an Executor handles on-chain actions like deposits, auto-compounds, and hedges using Chainlink oracles and ethers.js calls; optional Governor manages token rewards pro-rata. The dashboard shows live APY estimates, yield charts, tx history, and one-click unstake/claim. No nested complexities—flat, intuitive flow with drag-to-adjust allocations if extending. Runs autonomously on cron triggers, with KRWQ conversion for Korean yields. You know, like a set-it-and-forget-it robo-harvester that turns DeFi chaos into passive gains."

## User Scenarios & Testing *(OPTIONAL — include only if requested)*

### User Story 1 - Stake & Auto-Manage (Priority: P1)

As a user, I can connect my Polygon wallet, choose a risk profile (low/medium/high), stake USDC or KRWQ, and enable Rogue to autonomously manage my deposited funds so I receive optimized yields without manual intervention.

**Why this priority**: This is the core value proposition — users must be able to safely deposit and receive automated yield.

**Independent Test**: With a funded wallet, a user can complete the stake flow, verify a position appears in the dashboard, and observe at least one automated action (e.g., a deposit or auto-compound) executed by the agent within a configured window.

**Acceptance Scenarios**:

1. **Given** a connected Polygon wallet with sufficient USDC/KRWQ, **When** the user selects a risk profile and confirms stake, **Then** a new managed position is created and visible in the dashboard with an initial APY estimate.
2. **Given** a managed position, **When** the scheduled execution window occurs, **Then** the Executor performs an on-chain action (deposit/compound/hedge) and the transaction appears in the user's tx history.

---

### User Story 2 - Adjust Allocations & Monitor (Priority: P2)

As a user, I can view live APY estimates and yield charts, drag a slider to adjust allocations or risk weighting, and see immediate estimated impacts before confirming changes.

**Why this priority**: Improves trust and control — users want visibility and the ability to fine-tune risk/allocations.

**Independent Test**: A user can open the dashboard, view real-time APY estimates for their position, move the allocation slider and observe updated estimates; after confirming, the Analyzer updates the strategy and the Executor schedules the next action.

**Acceptance Scenarios**:

1. **Given** a live position, **When** the user adjusts the allocation slider and previews changes, **Then** the dashboard displays updated APY and expected next actions without committing changes.
2. **Given** the user confirms allocation changes, **When** the change is accepted, **Then** the new allocation is saved and scheduled for the next execution window.

---

### User Story 3 - Claim / Unstake / Rewards (Priority: P3)

As a user, I can claim accrued rewards, perform a one-click unstake that triggers on-chain withdrawals, and see tokenized reward allocations reflected in my dashboard balance.

**Why this priority**: Essential account lifecycle actions — users must be able to exit positions and receive earned rewards.

**Independent Test**: A funded managed position should allow a user to trigger "Claim" and observe the reward token balance update and the corresponding transaction in tx history.

**Acceptance Scenarios**:

1. **Given** accrued rewards, **When** the user clicks "Claim", **Then** the claim transaction is submitted and the dashboard balance updates on confirmation.
2. **Given** a managed position, **When** the user clicks "Unstake", **Then** the Executor submits withdrawal transactions and the position state becomes closed when on-chain confirmations complete.

---

### Edge Cases

- What happens when oracles are temporarily unavailable? The Executor must detect stale oracle data and pause risky actions; give the user a clear error state and an option to continue with manual approval.
- How does the system handle partial fills, slippage, or low liquidity during withdrawals? The Executor should prefer conservative parameters, and the dashboard must surface expected slippage and fallback options (e.g., delayed withdrawal, market sell with tolerance).
- What if user revokes contract approvals or disconnects wallet mid-operation? The system must fail safely and notify the user with next steps.
- How are chain re-orgs or failed transactions surfaced? Transactions that do not confirm should be retried according to a safe backoff policy; any irreversible failure must be logged and surfaced to the user with remediation steps.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to connect a Polygon wallet and authorize a managed position with a single, guided flow.
- **FR-002**: Users MUST be able to stake USDC or KRWQ into a managed position and select a risk profile (low/medium/high).
- **FR-003**: The system MUST present an estimated APY, risk indicators, and expected next actions before the user confirms any stake or allocation change.
- **FR-004**: A Researcher agent MUST continuously scan configured liquidity sources (e.g., Frax pools, Aave) and surface candidate strategies with estimated yields.
- **FR-005**: An Analyzer agent MUST map a user's risk profile and allocation to one or more concrete strategies and maintain a schedule of planned Executor actions.
- **FR-006**: An Executor agent MUST be able to submit required on-chain transactions (deposits, withdrawals, compounding, hedges) using user consent/signatures or approved delegation, and record transaction outcomes to the user's tx history.
- **FR-007**: The system MUST support scheduled autonomous runs (cron triggers) and provide a clear audit log of automated actions and associated transactions.
- **FR-008**: The dashboard MUST show live APY estimates, historical yield charts, per-transaction history, and current allocation breakdown.
- **FR-009**: Users MUST be able to perform one-click "Unstake" and "Claim" actions that submit the necessary on-chain withdrawal or claim transactions.
- **FR-010**: The system MUST convert and present Korean yields (KRWQ) consistently alongside USDC denominated values, showing both native token amounts and local-currency equivalents.
- **FR-011**: The system MUST provide safe-guards for high-risk strategies (maximum leverage limits, explicit user confirmations) and expose these limits in the UI.
- **FR-012**: All sensitive operations and errors MUST be surfaced to users with actionable guidance; a minimal audit trail MUST be retained per position.

*Marked unclear (needs a product decision):*

- **FR-013**: Governance & reward distribution model for the IQAI ATP token (KRWQ staking rewards and on-chain distribution schedule) [NEEDS CLARIFICATION: desired reward distribution schedule and vesting rules].
- **FR-014**: Custody model for automated execution (delegated contract vs user-signed per-tx flow) [NEEDS CLARIFICATION: confirm whether the system will use delegated smart-contract approvals or require per-transaction user signatures].
- **FR-015**: Allowed leverage ceiling and specific risk parameters for "high" risk profiles [NEEDS CLARIFICATION: numeric leverage cap and liquidation policy].

### Key Entities

- **User**: Wallet address, display name (optional), risk profile, positions.
- **WalletConnection**: Connected chain, wallet provider, approval status.
- **Position**: ID, owner wallet, token (USDC or KRWQ), amount, allocation, strategy, status (active/closed), timestamps.
- **Strategy**: Strategy ID, description, risk tier, expected APY, expected steps (deposit/compound/hedge), performance history.
- **Agent**: Researcher, Analyzer, Executor, Governor — each agent's metadata, last run, and outcome log.
- **TransactionRecord**: On-chain tx hash, type (deposit/withdraw/claim/compound), timestamp, status, gas cost, notes.
- **OraclePrice**: Price feeds and timestamp used for KRWQ conversion and risk calculations.
- **RewardToken (IQAI ATP)**: Token identifier, total allocated rewards, per-position entitlement (if tokenized).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the wallet-connection + stake flow and see their position in the dashboard within 3 minutes in 95% of successful attempts.
- **SC-002**: 98% of scheduled autonomous executions (Executor runs) succeed and produce a recorded on-chain transaction when network conditions are normal (no oracle outage, sufficient liquidity) over a rolling 7-day period.
- **SC-003**: APY estimate accuracy: initial APY estimates for strategies are within ±15% of realized gross yield after the first 7 days for 80% of strategies (measured across sample of positions).
- **SC-004**: Users can successfully unstake and receive funds within the expected on-chain confirmation window (chain-dependent), and 99% of one-click unstake attempts complete without manual intervention when liquidity exists.
- **SC-005**: Dashboard responsiveness: APY and position summaries refresh and display updated estimates within 10 seconds of the Researcher/Analyzer run or relevant on-chain event.

### Assumptions

- The product will operate primarily on Polygon and interact with Frax/Aave subgraphs and Chainlink oracles for price data.
- KRWQ is an on-chain token available on Polygon and convertible via on-chain liquidity; local currency conversion relies on stable oracle feeds.
- The system will prefer non-custodial patterns: either user-signed transactions for each action or a narrowly scoped delegated execution contract — final custody model requires confirmation (see FR-014).
- Integration with ADK-TS and OpenAI (or equivalent AI services) is an implementation decision and may be documented separately in a plan; the spec remains focused on WHAT and WHY.

### Next Steps

1. Confirm the three [NEEDS CLARIFICATION] items: governance reward rules, custody/execution model, and leverage caps for high-risk strategies.
2. Produce a short `quickstart.md` that documents manual verification steps for reviewers: wallet connection, stake flow, viewing APY, and triggering a manual compound.
3. Create a lightweight plan (phase 0) that maps agents to services and outlines safe execution patterns and emergency pause mechanisms.
