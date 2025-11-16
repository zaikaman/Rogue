-- Rogue DeFi Yield Optimizer Database Schema
-- PostgreSQL + Supabase with Row Level Security (RLS)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Positions table: Core user staking positions
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL,
    token TEXT NOT NULL CHECK (token IN ('USDC', 'KRWQ')),
    amount DECIMAL(36, 18) NOT NULL CHECK (amount > 0),
    risk_profile TEXT NOT NULL CHECK (risk_profile IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
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
    type TEXT NOT NULL CHECK (type IN ('stake', 'unstake', 'compound', 'claim', 'rebalance')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    gas_cost DECIMAL(36, 18),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    CONSTRAINT wallet_address_lowercase CHECK (wallet_address = LOWER(wallet_address))
);

-- Yield history: Track APY over time for analysis
CREATE TABLE IF NOT EXISTS yield_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
    protocol TEXT NOT NULL,
    apy DECIMAL(10, 4) NOT NULL,
    value DECIMAL(36, 18) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent execution logs: Debug and monitor AI agent performance
CREATE TABLE IF NOT EXISTS agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name TEXT NOT NULL CHECK (agent_name IN ('researcher', 'analyzer', 'executor', 'governor')),
    position_id UUID REFERENCES positions(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    input_data JSONB,
    output_data JSONB,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Strategies: AI-generated yield optimization strategies
CREATE TABLE IF NOT EXISTS strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    risk_profile TEXT NOT NULL CHECK (risk_profile IN ('low', 'medium', 'high')),
    allocation JSONB NOT NULL, -- {protocol: percentage}
    expected_apy DECIMAL(10, 4) NOT NULL,
    rationale TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active BOOLEAN NOT NULL DEFAULT true
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
CREATE INDEX IF NOT EXISTS idx_strategies_active ON strategies(active);

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

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE ON positions TO authenticated;
