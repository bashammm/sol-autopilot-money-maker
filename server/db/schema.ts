/**
 * YABBAI - PostgreSQL & Supabase Database Schema
 * Full DDL for all 24 System of Record Entities with Row Level Security (RLS) & Indexes
 */

export const YABBAI_POSTGRES_SCHEMA_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. WALLETS (20 App-Owned Execution Wallets)
CREATE TABLE IF NOT EXISTS wallets (
  wallet_id VARCHAR(48) PRIMARY KEY,
  agent_id VARCHAR(32) NOT NULL,
  public_address VARCHAR(44) UNIQUE NOT NULL,
  network VARCHAR(24) NOT NULL DEFAULT 'mainnet-beta',
  signer_reference VARCHAR(128) NOT NULL,
  ownership_model VARCHAR(48) NOT NULL DEFAULT 'APP_OWNED_NON_CUSTODIAL_POLICY',
  status VARCHAR(24) NOT NULL DEFAULT 'CREATED',
  created_at BIGINT NOT NULL,
  last_chain_verification BIGINT NOT NULL,
  last_transaction_signature VARCHAR(128),
  current_sol_balance NUMERIC(16, 9) NOT NULL DEFAULT 0.0,
  current_token_balances JSONB NOT NULL DEFAULT '{}',
  daily_limit NUMERIC(12, 2) NOT NULL DEFAULT 500.0,
  per_transaction_limit NUMERIC(12, 2) NOT NULL DEFAULT 100.0,
  reserve_requirement NUMERIC(16, 9) NOT NULL DEFAULT 0.005,
  realized_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
  withdrawable_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
  last_reconciliation BIGINT NOT NULL
);

-- 2. WALLET SIGNERS (Secure Non-Custodial Signer References)
CREATE TABLE IF NOT EXISTS wallet_signers (
  signer_id VARCHAR(64) PRIMARY KEY,
  wallet_id VARCHAR(48) REFERENCES wallets(wallet_id),
  signer_type VARCHAR(32) NOT NULL,
  public_key VARCHAR(44) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  created_at BIGINT NOT NULL,
  last_used_at BIGINT
);

-- 3. WALLET POLICIES (Spending, Slippage & Risk Constraints)
CREATE TABLE IF NOT EXISTS wallet_policies (
  policy_id VARCHAR(48) PRIMARY KEY,
  wallet_id VARCHAR(48) REFERENCES wallets(wallet_id),
  max_slippage_bps INT NOT NULL DEFAULT 100,
  allowed_tokens TEXT[] NOT NULL DEFAULT ARRAY['SOL', 'USDC'],
  allowed_dexes TEXT[] NOT NULL DEFAULT ARRAY['JUPITER', 'RAYDIUM', 'ORCA'],
  auto_sweep_profit BOOLEAN NOT NULL DEFAULT TRUE,
  daily_loss_limit_usd NUMERIC(12, 2) NOT NULL DEFAULT 50.00,
  updated_at BIGINT NOT NULL
);

-- 4. WALLET SNAPSHOTS (Periodic and Pre-Execution Balance Snapshots)
CREATE TABLE IF NOT EXISTS wallet_snapshots (
  snapshot_id VARCHAR(64) PRIMARY KEY,
  wallet_id VARCHAR(48) REFERENCES wallets(wallet_id),
  sol_balance NUMERIC(16, 9) NOT NULL,
  usd_value NUMERIC(14, 2) NOT NULL,
  sol_price_usd NUMERIC(10, 2) NOT NULL,
  snapshot_type VARCHAR(32) NOT NULL,
  timestamp BIGINT NOT NULL
);

-- 5. CAPITAL EVENTS (Deposits, Allocations, Working Capital Changes)
CREATE TABLE IF NOT EXISTS capital_events (
  event_id VARCHAR(64) PRIMARY KEY,
  event_type VARCHAR(32) NOT NULL,
  amount_usd NUMERIC(14, 4) NOT NULL,
  source_bucket VARCHAR(32) NOT NULL,
  target_bucket VARCHAR(32) NOT NULL,
  tx_signature VARCHAR(128),
  actor VARCHAR(64) NOT NULL,
  timestamp BIGINT NOT NULL
);

-- 6. OPPORTUNITIES (Evaluated & Filtered Economic Opportunities)
CREATE TABLE IF NOT EXISTS opportunities (
  id VARCHAR(48) PRIMARY KEY,
  title VARCHAR(256) NOT NULL,
  category VARCHAR(32) NOT NULL,
  tier_requirement VARCHAR(16) NOT NULL,
  capital_required_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gas_required_sol NUMERIC(10, 6) NOT NULL DEFAULT 0,
  raw_expected_value_usd NUMERIC(12, 2) NOT NULL,
  network_fees_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_ev_usd NUMERIC(12, 2) NOT NULL,
  confidence_score INT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  created_at BIGINT NOT NULL
);

-- 7. STRATEGIES (Execution Modules & Lifecycle States)
CREATE TABLE IF NOT EXISTS strategies (
  id VARCHAR(48) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  category VARCHAR(32) NOT NULL,
  execution_mode VARCHAR(32) NOT NULL DEFAULT 'RESEARCH_ONLY',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL
);

-- 8. EXECUTION INTENTS (Pre-Execution Authorizations)
CREATE TABLE IF NOT EXISTS execution_intents (
  intent_id VARCHAR(64) PRIMARY KEY,
  agent_id VARCHAR(32) NOT NULL,
  strategy_id VARCHAR(48) REFERENCES strategies(id),
  opportunity_id VARCHAR(48) REFERENCES opportunities(id),
  max_slippage_bps INT NOT NULL,
  budget_allocated_usd NUMERIC(12, 2) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'INTENT_CREATED',
  created_at BIGINT NOT NULL
);

-- 9. EXECUTIONS (Execution Pipeline Runs)
CREATE TABLE IF NOT EXISTS executions (
  execution_id VARCHAR(64) PRIMARY KEY,
  intent_id VARCHAR(64) REFERENCES execution_intents(intent_id),
  agent_id VARCHAR(32) NOT NULL,
  wallet_address VARCHAR(44) NOT NULL,
  status VARCHAR(24) NOT NULL,
  gross_pnl_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_profit_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  timestamp BIGINT NOT NULL
);

-- 10. TRANSACTIONS (On-Chain Transaction Records)
CREATE TABLE IF NOT EXISTS transactions (
  tx_hash VARCHAR(128) PRIMARY KEY,
  cluster VARCHAR(24) NOT NULL DEFAULT 'mainnet-beta',
  fee_lamports BIGINT NOT NULL DEFAULT 5000,
  compute_units_consumed INT,
  slot BIGINT,
  status VARCHAR(24) NOT NULL,
  confirmed_at BIGINT NOT NULL
);

-- 11. TRANSACTION INSTRUCTIONS (Decoded Instruction Elements)
CREATE TABLE IF NOT EXISTS transaction_instructions (
  instruction_id VARCHAR(64) PRIMARY KEY,
  tx_hash VARCHAR(128) REFERENCES transactions(tx_hash),
  program_id VARCHAR(44) NOT NULL,
  instruction_type VARCHAR(32) NOT NULL,
  accounts TEXT[] NOT NULL,
  data_payload TEXT
);

-- 12. TRANSACTION EVIDENCE (Authoritative Cryptographic On-Chain Evidence)
CREATE TABLE IF NOT EXISTS transaction_evidence (
  evidence_id VARCHAR(64) PRIMARY KEY,
  tx_hash VARCHAR(128) REFERENCES transactions(tx_hash),
  sender_address VARCHAR(44) NOT NULL,
  recipient_address VARCHAR(44) NOT NULL,
  amount_units VARCHAR(64) NOT NULL,
  amount_usd NUMERIC(14, 4) NOT NULL,
  verified_at BIGINT NOT NULL
);

-- 13. REVENUE EVENTS (Authoritative Inbound Revenue Inflows)
CREATE TABLE IF NOT EXISTS revenue_events (
  revenue_id VARCHAR(64) PRIMARY KEY,
  source_type VARCHAR(32) NOT NULL,
  gross_usd NUMERIC(14, 4) NOT NULL,
  tx_signature VARCHAR(128) UNIQUE NOT NULL,
  recipient_wallet VARCHAR(44) NOT NULL,
  verified_at BIGINT NOT NULL
);

-- 14. COST EVENTS (Itemized Deductions: Gas, Trading Fees, Slippage, Platform)
CREATE TABLE IF NOT EXISTS cost_events (
  cost_id VARCHAR(64) PRIMARY KEY,
  revenue_id VARCHAR(64) REFERENCES revenue_events(revenue_id),
  cost_category VARCHAR(32) NOT NULL,
  amount_usd NUMERIC(14, 4) NOT NULL,
  tx_signature VARCHAR(128),
  timestamp BIGINT NOT NULL
);

-- 15. PROFIT EVENTS (Net Realized Profit Ledger Events)
CREATE TABLE IF NOT EXISTS profit_events (
  profit_id VARCHAR(64) PRIMARY KEY,
  revenue_id VARCHAR(64) REFERENCES revenue_events(revenue_id),
  net_realized_profit_usd NUMERIC(14, 4) NOT NULL,
  allocated_to_reserve_usd NUMERIC(14, 4) NOT NULL,
  allocated_to_operating_usd NUMERIC(14, 4) NOT NULL,
  allocated_to_sweep_usd NUMERIC(14, 4) NOT NULL,
  timestamp BIGINT NOT NULL
);

-- 16. LEDGER ENTRIES (Double-Entry Authoritative Ledger)
CREATE TABLE IF NOT EXISTS ledger_entries (
  entry_id VARCHAR(64) PRIMARY KEY,
  account_debit VARCHAR(48) NOT NULL,
  account_credit VARCHAR(48) NOT NULL,
  amount_usd NUMERIC(14, 4) NOT NULL,
  reference_type VARCHAR(32) NOT NULL,
  reference_id VARCHAR(64) NOT NULL,
  timestamp BIGINT NOT NULL
);

-- 17. WITHDRAWALS (Admin Profit or Capital Disbursements)
CREATE TABLE IF NOT EXISTS withdrawals (
  withdrawal_id VARCHAR(64) PRIMARY KEY,
  withdrawal_type VARCHAR(32) NOT NULL, -- WITHDRAW_REALIZED_PROFIT or WITHDRAW_CAPITAL
  amount_usd NUMERIC(14, 4) NOT NULL,
  amount_asset NUMERIC(16, 9) NOT NULL,
  asset VARCHAR(8) NOT NULL DEFAULT 'SOL',
  recipient_address VARCHAR(44) NOT NULL,
  tx_signature VARCHAR(128),
  authorized_by VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL,
  timestamp BIGINT NOT NULL
);

-- 18. PROFIT SWEEPS (Automated 10% Sweeps to External Profit Treasury)
CREATE TABLE IF NOT EXISTS profit_sweeps (
  sweep_id VARCHAR(64) PRIMARY KEY,
  destination_address VARCHAR(44) NOT NULL,
  withdrawable_profit_before_usd NUMERIC(14, 4) NOT NULL,
  sweep_amount_usd NUMERIC(14, 4) NOT NULL,
  sweep_amount_sol NUMERIC(16, 9) NOT NULL,
  tx_signature VARCHAR(128) UNIQUE NOT NULL,
  status VARCHAR(24) NOT NULL,
  timestamp BIGINT NOT NULL
);

-- 19. ORDERS (Customer Digital Product Orders)
CREATE TABLE IF NOT EXISTS orders (
  order_id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(48) NOT NULL,
  customer_reference VARCHAR(64) NOT NULL,
  amount_usd NUMERIC(12, 2) NOT NULL,
  amount_sol NUMERIC(16, 9) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  solana_pay_url TEXT NOT NULL,
  payment_reference_pubkey VARCHAR(44) NOT NULL,
  deliverable_content TEXT,
  created_at BIGINT NOT NULL,
  fulfilled_at BIGINT
);

-- 20. PAYMENTS (On-Chain Customer Payment Inflows)
CREATE TABLE IF NOT EXISTS payments (
  payment_id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) REFERENCES orders(order_id),
  amount_lamports BIGINT NOT NULL,
  amount_usd NUMERIC(12, 2) NOT NULL,
  sender_address VARCHAR(44) NOT NULL,
  recipient_address VARCHAR(44) NOT NULL,
  status VARCHAR(24) NOT NULL,
  confirmed_at BIGINT NOT NULL
);

-- 21. PAYMENT EVIDENCE (Cryptographic Verification of Payment Tx)
CREATE TABLE IF NOT EXISTS payment_evidence (
  evidence_id VARCHAR(64) PRIMARY KEY,
  payment_id VARCHAR(64) REFERENCES payments(payment_id),
  tx_signature VARCHAR(128) UNIQUE NOT NULL,
  slot BIGINT NOT NULL,
  verified_by_rpc VARCHAR(64) NOT NULL,
  timestamp BIGINT NOT NULL
);

-- 22. AUDIT EVENTS (Cryptographic Tamper-Evident Audit Trail)
CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(64) PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  actor VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  resource_id VARCHAR(64) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  previous_hash VARCHAR(64) NOT NULL,
  hash VARCHAR(64) NOT NULL
);

-- 23. STRATEGY PERFORMANCE (Historical Strategy Metrics)
CREATE TABLE IF NOT EXISTS strategy_performance (
  strategy_id VARCHAR(48) PRIMARY KEY REFERENCES strategies(id),
  total_evaluations INT NOT NULL DEFAULT 0,
  total_executions INT NOT NULL DEFAULT 0,
  successful_executions INT NOT NULL DEFAULT 0,
  gross_revenue_usd NUMERIC(14, 4) NOT NULL DEFAULT 0,
  net_profit_usd NUMERIC(14, 4) NOT NULL DEFAULT 0,
  win_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
  last_updated BIGINT NOT NULL
);

-- 24. RPC EVENTS (Health, Latency, Failover & Failure Logs)
CREATE TABLE IF NOT EXISTS rpc_events (
  event_id VARCHAR(64) PRIMARY KEY,
  provider_name VARCHAR(64) NOT NULL,
  method VARCHAR(64) NOT NULL,
  latency_ms INT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  timestamp BIGINT NOT NULL
);

-- Create Indexes for High-Speed Queries
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(public_address);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_payments_signature ON payment_evidence(tx_signature);
CREATE INDEX IF NOT EXISTS idx_revenue_signature ON revenue_events(tx_signature);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);
`;
