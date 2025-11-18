-- Rogue DeFi Yield Optimizer Database Schema
-- PostgreSQL + Supabase with Row Level Security (RLS)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Positions table: Core user staking positions
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL,
    token TEXT NOT NULL CHECK (token = 'USDC'),
    amount DECIMAL(36, 18) NOT NULL CHECK (amount > 0),
    risk_profile TEXT NOT NULL CHECK (risk_profile IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed', 'unstaking')),
    chain TEXT NOT NULL DEFAULT 'mumbai' CHECK (chain IN ('mumbai', 'sepolia', 'base_sepolia')),
    allocation JSONB DEFAULT '{}',
    strategy_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_action_at TIMESTAMPTZ,
    CONSTRAINT wallet_address_lowercase CHECK (wallet_address = LOWER(wallet_address))
);

-- Transaction records: History of all on-chain actions
CREATE TABLE IF NOT EXISTS transaction_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    tx_hash TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('stake', 'unstake', 'compound', 'claim', 'rebalance', 'swap', 'bridge')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    chain TEXT CHECK (chain IN ('mumbai', 'sepolia', 'base_sepolia')),
    from_token TEXT,
    to_token TEXT,
    amount DECIMAL(36, 18),
    gas_cost DECIMAL(36, 18),
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    CONSTRAINT wallet_address_lowercase CHECK (wallet_address = LOWER(wallet_address))
);

-- Yield history: Track APY over time for analysis
CREATE TABLE IF NOT EXISTS yield_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
    protocol TEXT NOT NULL,
    chain TEXT NOT NULL CHECK (chain IN ('mumbai', 'sepolia', 'base_sepolia')),
    asset TEXT NOT NULL,
    apy DECIMAL(10, 4) NOT NULL,
    value DECIMAL(36, 18) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent execution logs: Debug and monitor AI agent performance
CREATE TABLE IF NOT EXISTS agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name TEXT NOT NULL CHECK (agent_name IN ('researcher', 'researcher_enhanced', 'analyzer', 'trader_enhanced', 'executor', 'executor_enhanced', 'governor', 'governor_enhanced', 'workflow')),
    position_id UUID REFERENCES positions(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    input_data JSONB,
    output_data JSONB,
    metadata JSONB,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Strategies: AI-generated yield optimization strategies
CREATE TABLE IF NOT EXISTS strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
    name TEXT,
    description TEXT,
    risk_tier TEXT NOT NULL CHECK (risk_tier IN ('low', 'medium', 'high')),
    allocation JSONB NOT NULL,
    protocol_allocations JSONB,
    action_plan JSONB,
    expected_apy DECIMAL(10, 4) NOT NULL,
    risk_score INTEGER,
    leverage_ratio DECIMAL(4, 2) DEFAULT 1.0,
    min_amount DECIMAL(36, 18),
    max_amount DECIMAL(36, 18),
    rationale TEXT,
    metadata JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Portfolio holdings: Track user token balances across chains
CREATE TABLE IF NOT EXISTS portfolio_holdings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL,
    token_symbol TEXT NOT NULL,
    token_name TEXT NOT NULL,
    chain TEXT NOT NULL CHECK (chain IN ('mumbai', 'sepolia', 'base_sepolia')),
    balance DECIMAL(36, 18) NOT NULL DEFAULT 0,
    value_usd DECIMAL(36, 2),
    protocol TEXT,
    apy DECIMAL(10, 4),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT wallet_address_lowercase CHECK (wallet_address = LOWER(wallet_address)),
    CONSTRAINT unique_holding UNIQUE (wallet_address, token_symbol, chain, protocol)
);

-- Bridge transactions: Track cross-chain transfers
CREATE TABLE IF NOT EXISTS bridge_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL,
    source_chain TEXT NOT NULL CHECK (source_chain IN ('mumbai', 'sepolia', 'base_sepolia')),
    dest_chain TEXT NOT NULL CHECK (dest_chain IN ('mumbai', 'sepolia', 'base_sepolia')),
    token TEXT NOT NULL,
    amount DECIMAL(36, 18) NOT NULL,
    source_tx_hash TEXT NOT NULL,
    dest_tx_hash TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
    fee DECIMAL(36, 18),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    CONSTRAINT wallet_address_lowercase CHECK (wallet_address = LOWER(wallet_address))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_positions_wallet ON positions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transaction_records(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transactions_position ON transaction_records(position_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transaction_records(type);
CREATE INDEX IF NOT EXISTS idx_yield_history_position ON yield_history(position_id);
CREATE INDEX IF NOT EXISTS idx_yield_history_timestamp ON yield_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_logs(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategies_position ON strategies(position_id);
CREATE INDEX IF NOT EXISTS idx_strategies_active ON strategies(is_active);
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_wallet ON portfolio_holdings(wallet_address);
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_chain ON portfolio_holdings(chain);
CREATE INDEX IF NOT EXISTS idx_bridge_transactions_wallet ON bridge_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_bridge_transactions_status ON bridge_transactions(status);
CREATE INDEX IF NOT EXISTS idx_positions_chain ON positions(chain);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for positions table
DROP TRIGGER IF EXISTS update_positions_updated_at ON positions;
CREATE TRIGGER update_positions_updated_at
    BEFORE UPDATE ON positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE yield_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

-- Positions: Users can only view/modify their own positions
CREATE POLICY "Users can view own positions"
    ON positions FOR SELECT
    USING (auth.jwt() ->> 'wallet_address' = wallet_address);

CREATE POLICY "Users can insert own positions"
    ON positions FOR INSERT
    WITH CHECK (auth.jwt() ->> 'wallet_address' = wallet_address);

CREATE POLICY "Users can update own positions"
    ON positions FOR UPDATE
    USING (auth.jwt() ->> 'wallet_address' = wallet_address);

-- Service role can do everything (for backend agents)
CREATE POLICY "Service role has full access to positions"
    ON positions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Transaction records: Users can view own transactions
CREATE POLICY "Users can view own transactions"
    ON transaction_records FOR SELECT
    USING (auth.jwt() ->> 'wallet_address' = wallet_address);

CREATE POLICY "Service role has full access to transactions"
    ON transaction_records FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Yield history: Users can view history for their positions
CREATE POLICY "Users can view yield history for own positions"
    ON yield_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM positions
            WHERE positions.id = yield_history.position_id
            AND positions.wallet_address = auth.jwt() ->> 'wallet_address'
        )
    );

CREATE POLICY "Service role has full access to yield history"
    ON yield_history FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Agent logs: Service role only (internal debugging)
CREATE POLICY "Service role has full access to agent logs"
    ON agent_logs FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Strategies: Users can view strategies for their positions
CREATE POLICY "Users can view strategies for own positions"
    ON strategies FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM positions
            WHERE positions.id = strategies.position_id
            AND positions.wallet_address = auth.jwt() ->> 'wallet_address'
        )
    );

CREATE POLICY "Service role has full access to strategies"
    ON strategies FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Portfolio holdings: Users can view their own holdings
ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own portfolio holdings"
    ON portfolio_holdings FOR SELECT
    USING (auth.jwt() ->> 'wallet_address' = wallet_address);

CREATE POLICY "Service role has full access to portfolio holdings"
    ON portfolio_holdings FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Bridge transactions: Users can view their own bridge transactions
ALTER TABLE bridge_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bridge transactions"
    ON bridge_transactions FOR SELECT
    USING (auth.jwt() ->> 'wallet_address' = wallet_address);

CREATE POLICY "Service role has full access to bridge transactions"
    ON bridge_transactions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE ON positions TO authenticated;
