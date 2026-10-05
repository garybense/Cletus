/**
 * MMAS Schema Migration - V13
 * 
 * Adds tables for Massive Multi-Agent System harness:
 * - mmas_nodes: Registry of Ollama nodes
 * - mmas_trades: Arbitrage opportunity and execution tracking
 * - mmas_votes: Consensus voting records
 * - mmas_market_snapshots: Price feed data
 */

export const MIGRATION_V13 = `
-- MMAS Ollama node registry
CREATE TABLE IF NOT EXISTS mmas_nodes (
  id TEXT PRIMARY KEY,
  wave TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status TEXT DEFAULT 'healthy',
  last_heartbeat TIMESTAMP,
  node_metrics TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MMAS trades and opportunities
CREATE TABLE IF NOT EXISTS mmas_trades (
  id TEXT PRIMARY KEY,
  wave_id TEXT,
  signal_hash TEXT,
  pair TEXT,
  side TEXT,
  price REAL,
  amount_cents INTEGER,
  confidence REAL,
  execution_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  executed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mmas_trades_wave ON mmas_trades(wave_id);
CREATE INDEX IF NOT EXISTS idx_mmas_trades_pair ON mmas_trades(pair);
CREATE INDEX IF NOT EXISTS idx_mmas_trades_created ON mmas_trades(created_at);
CREATE INDEX IF NOT EXISTS idx_mmas_trades_status ON mmas_trades(execution_status);

-- Consensus votes
CREATE TABLE IF NOT EXISTS mmas_votes (
  id TEXT PRIMARY KEY,
  trade_id TEXT REFERENCES mmas_trades(id),
  node_id TEXT REFERENCES mmas_nodes(id),
  confidence REAL,
  voting_power REAL,
  signature TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mmas_votes_trade ON mmas_votes(trade_id);
CREATE INDEX IF NOT EXISTS idx_mmas_votes_node ON mmas_votes(node_id);

-- Market snapshots
CREATE TABLE IF NOT EXISTS mmas_market_snapshots (
  id TEXT PRIMARY KEY,
  pair TEXT,
  prices_json TEXT,
  orderbook_64 TEXT,
  ts TIMESTAMP,
  wave_hashes TEXT
);

CREATE INDEX IF NOT EXISTS idx_mmas_snapshots_pair ON mmas_market_snapshots(pair);
CREATE INDEX IF NOT EXISTS idx_mmas_snapshots_ts ON mmas_market_snapshots(ts);

-- Add mmas_enabled flag to kv
INSERT OR IGNORE INTO kv (key, value) VALUES ('mmas_enabled', 'false');
`;

// Migration registration
export default {
  version: 13,
  apply: MIGRATION_V13,
  description: 'MMAS harness schema for 1000+ Ollama node orchestration'
};