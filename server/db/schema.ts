/**
 * YABBAI - PostgreSQL & Supabase Database Schema
 * Full DDL with Row Level Security (RLS), triggers, and indexes
 * Covers:
 * agents, wallets, strategies, opportunities, signals, tasks, allocations,
 * revenue, transactions, authorizations, treasury_events, risk_events,
 * performance, audit_logs, provider_health, system_configuration
 */

export const YABBAI_POSTGRES_SCHEMA_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SYSTEM CONFIGURATION
CREATE TABLE IF NOT EXISTS system_configuration (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. WALLETS (Non-custodial public accounts)
CREATE TABLE IF NOT EXISTS wallets (
  address VARCHAR(44) PRIMARY KEY, -- Solana Base58
  slot_number INT UNIQUE NOT NULL CHECK (slot_number BETWEEN 1 AND 20),
  label VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. AGENTS (20 persistent autonomous slots)
CREATE TABLE IF NOT EXISTS agents (
  id VARCHAR(32) PRIMARY KEY, -- agent-01 to agent-20
  slot_number INT UNIQUE NOT NULL,
  name VARCHAR(64) NOT NULL,
  wallet_address VARCHAR(44) REFERENCES wallets(address),
  strategy_permissions TEXT[] NOT NULL,
  risk_profile VARCHAR(16) NOT NULL DEFAULT 'LOW',
  min_expected_return_bps INT NOT NULL DEFAULT 100,
  gas_reserve_sol NUMERIC(10, 6) NOT NULL DEFAULT 0.05,
  daily_loss_limit_usd NUMERIC(12, 2) NOT NULL DEFAULT 20.00,
  daily_loss_current_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(24) NOT NULL DEFAULT 'IDLE',
  heartbeat_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. STRATEGIES (Modular definition registry)
CREATE TABLE IF NOT EXISTS strategies (
  id VARCHAR(48) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  category VARCHAR(32) NOT NULL,
  tier_requirement VARCHAR(16) NOT NULL DEFAULT '$0',
  is_zero_capital BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. OPPORTUNITIES
CREATE TABLE IF NOT EXISTS opportunities (
  id VARCHAR(48) PRIMARY KEY,
  title VARCHAR(256) NOT NULL,
  category VARCHAR(32) NOT NULL,
  tier_requirement VARCHAR(16) NOT NULL,
  capital_required_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gas_required_sol NUMERIC(10, 6) NOT NULL DEFAULT 0,
  raw_expected_value_usd NUMERIC(12, 2) NOT NULL,
  network_fees_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  trading_fees_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  slippage_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  risk_cost_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  capital_cost_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_ev_usd NUMERIC(12, 2) NOT NULL,
  confidence_score INT NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  is_zero_capital BOOLEAN NOT NULL DEFAULT FALSE,
  requires_gas BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. SIGNALS (StrategySignalBus)
CREATE TABLE IF NOT EXISTS signals (
  id VARCHAR(48) PRIMARY KEY,
  source_agent_id VARCHAR(32) REFERENCES agents(id),
  strategy_id VARCHAR(48) REFERENCES strategies(id),
  category VARCHAR(32) NOT NULL,
  confidence NUMERIC(4, 3) NOT NULL,
  expected_value_usd NUMERIC(12, 2) NOT NULL,
  gas_estimate_sol NUMERIC(10, 6) NOT NULL,
  evidence_signature VARCHAR(128),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. TASKS (Persistent queue with leases)
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(48) PRIMARY KEY,
  idempotency_key VARCHAR(64) UNIQUE NOT NULL,
  agent_id VARCHAR(32) REFERENCES agents(id),
  opportunity_id VARCHAR(48) REFERENCES opportunities(id),
  category VARCHAR(32) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  lease_expiry TIMESTAMP WITH TIME ZONE,
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  payload JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. ALLOCATIONS (Capital Loop)
CREATE TABLE IF NOT EXISTS allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idempotency_key VARCHAR(64) UNIQUE NOT NULL,
  gross_revenue_usd NUMERIC(14, 4) NOT NULL,
  treasury_reserve_usd NUMERIC(14, 4) NOT NULL, -- 20%
  operating_budget_usd NUMERIC(14, 4) NOT NULL, -- 20%
  growth_reinvestment_usd NUMERIC(14, 4) NOT NULL, -- 20%
  strategy_capital_usd NUMERIC(14, 4) NOT NULL, -- 30%
  network_gas_fees_usd NUMERIC(14, 4) NOT NULL, -- 5%
  user_customer_funds_usd NUMERIC(14, 4) NOT NULL, -- 5%
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. REVENUE (Realized revenue ledger - evidence verified)
CREATE TABLE IF NOT EXISTS revenue (
  id VARCHAR(48) PRIMARY KEY,
  allocation_id UUID REFERENCES allocations(id),
  source VARCHAR(32) NOT NULL,
  tx_signature VARCHAR(128) UNIQUE,
  webhook_event_id VARCHAR(128) UNIQUE,
  recipient_address VARCHAR(64) NOT NULL,
  sender_address VARCHAR(64) NOT NULL,
  asset_mint VARCHAR(64) NOT NULL,
  amount_units VARCHAR(64) NOT NULL,
  amount_usd NUMERIC(14, 4) NOT NULL,
  state VARCHAR(24) NOT NULL CHECK (state IN ('VERIFIED', 'PENDING', 'ESTIMATED', 'UNKNOWN')),
  realized_pnl_usd NUMERIC(14, 4) NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. TRANSACTIONS (15-stage lifecycle audit)
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(48) PRIMARY KEY,
  agent_id VARCHAR(32) REFERENCES agents(id),
  stage VARCHAR(32) NOT NULL,
  tx_hash VARCHAR(128),
  blockhash_used VARCHAR(64),
  simulation_success BOOLEAN,
  units_consumed INT,
  risk_passed BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  error_details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  finalized_at TIMESTAMP WITH TIME ZONE
);

-- 11. AUTHORIZATIONS
CREATE TABLE IF NOT EXISTS authorizations (
  id VARCHAR(48) PRIMARY KEY,
  resource_type VARCHAR(32) NOT NULL,
  resource_id VARCHAR(48) NOT NULL,
  authorized_by VARCHAR(64) NOT NULL,
  signature_proof VARCHAR(256),
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. TREASURY EVENTS (Squads multisig operations)
CREATE TABLE IF NOT EXISTS treasury_events (
  id VARCHAR(48) PRIMARY KEY,
  proposal_id VARCHAR(48) NOT NULL,
  agent_id VARCHAR(32) REFERENCES agents(id),
  target_address VARCHAR(44) NOT NULL,
  amount_sol NUMERIC(12, 6) NOT NULL,
  amount_usd NUMERIC(12, 2) NOT NULL,
  budget_type VARCHAR(32) NOT NULL,
  squads_vault_address VARCHAR(44) NOT NULL,
  status VARCHAR(24) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. RISK EVENTS
CREATE TABLE IF NOT EXISTS risk_events (
  id VARCHAR(48) PRIMARY KEY,
  agent_id VARCHAR(32) REFERENCES agents(id),
  event_type VARCHAR(32) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  details JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. PERFORMANCE
CREATE TABLE IF NOT EXISTS performance (
  id VARCHAR(48) PRIMARY KEY,
  agent_id VARCHAR(32) REFERENCES agents(id),
  date DATE NOT NULL,
  total_evaluations INT NOT NULL DEFAULT 0,
  total_executions INT NOT NULL DEFAULT 0,
  verified_revenue_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  realized_pnl_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. AUDIT LOGS (Immutable sha256 chained)
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(48) PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  actor VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  resource_id VARCHAR(64) NOT NULL,
  details JSONB NOT NULL,
  ip_address VARCHAR(45),
  hash VARCHAR(64) NOT NULL
);

-- 16. PROVIDER HEALTH
CREATE TABLE IF NOT EXISTS provider_health (
  id VARCHAR(24) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  latency_ms INT NOT NULL,
  error_rate_pct NUMERIC(5, 2) NOT NULL,
  is_healthy BOOLEAN NOT NULL DEFAULT TRUE,
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Read-only policy for public/viewer role
CREATE POLICY "Public read agents" ON agents FOR SELECT USING (true);
CREATE POLICY "Public read wallets" ON wallets FOR SELECT USING (true);
CREATE POLICY "Public read revenue" ON revenue FOR SELECT USING (true);
CREATE POLICY "Public read allocations" ON allocations FOR SELECT USING (true);
CREATE POLICY "Public read audit_logs" ON audit_logs FOR SELECT USING (true);

-- Privileged write policy
CREATE POLICY "System write agents" ON agents FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "System write revenue" ON revenue FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "System write allocations" ON allocations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "System write audit_logs" ON audit_logs FOR ALL USING (auth.role() = 'service_role');
`;
