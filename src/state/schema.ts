export const SCHEMA_VERSION = 12;

export const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identity (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS turns (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  state TEXT NOT NULL,
  input TEXT,
  input_source TEXT,
  thinking TEXT NOT NULL,
  reasoning TEXT,
  tool_calls TEXT NOT NULL,
  token_usage TEXT NOT NULL,
  cost_cents INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  turn_id TEXT NOT NULL,
  name TEXT NOT NULL,
  arguments TEXT NOT NULL,
  result TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  error TEXT,
  FOREIGN KEY (turn_id) REFERENCES turns(id)
);

CREATE TABLE IF NOT EXISTS heartbeat_entries (
  name TEXT PRIMARY KEY,
  schedule TEXT NOT NULL,
  task TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run TEXT,
  next_run TEXT,
  params TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  amount_cents INTEGER,
  balance_after_cents INTEGER,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS installed_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  installed_at TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS modifications (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  file_path TEXT,
  diff TEXT,
  reversible INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS heartbeat_schedules (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  cron_expr TEXT,
  interval_ms INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_run_at INTEGER,
  next_run_at INTEGER
);

CREATE TABLE IF NOT EXISTS heartbeat_runs (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  error TEXT,
  result_json TEXT,
  FOREIGN KEY (schedule_id) REFERENCES heartbeat_schedules(id)
);

CREATE TABLE IF NOT EXISTS agent_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS work_queue (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  acceptance_predicate TEXT NOT NULL,
  spend_bearing INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  claimed_by TEXT,
  lease_expires_at INTEGER,
  result TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_queue_claim
ON work_queue(status, priority DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS heartbeat_schedule (
  task_name TEXT PRIMARY KEY,
  cron_expression TEXT,
  interval_ms INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 50,
  timeout_ms INTEGER NOT NULL DEFAULT 60000,
  max_retries INTEGER NOT NULL DEFAULT 3,
  tier_minimum TEXT NOT NULL DEFAULT 'sleeping',
  last_run_at TEXT,
  next_run_at TEXT,
  last_result TEXT,
  last_error TEXT,
  run_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  lease_expires_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS heartbeat_history (
  id TEXT PRIMARY KEY,
  task_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  result TEXT NOT NULL,
  duration_ms INTEGER,
  error TEXT,
  idempotency_key TEXT,
  FOREIGN KEY (task_name) REFERENCES heartbeat_schedule(task_name)
);

CREATE TABLE IF NOT EXISTS wake_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  reason TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS heartbeat_dedup (
  dedup_key TEXT PRIMARY KEY,
  task_name TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const MIGRATION_V2 = `
CREATE TABLE IF NOT EXISTS skills (
  name TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  auto_activate INTEGER NOT NULL DEFAULT 0,
  requires TEXT NOT NULL DEFAULT '{}',
  instructions TEXT NOT NULL,
  source TEXT NOT NULL,
  path TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  installed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  sandbox_id TEXT NOT NULL,
  genesis_prompt TEXT NOT NULL,
  creator_message TEXT,
  funded_amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_checked TEXT,
  chain_type TEXT DEFAULT 'evm'
);

CREATE TABLE IF NOT EXISTS registry (
  agent_id TEXT PRIMARY KEY,
  agent_uri TEXT NOT NULL,
  chain TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  registered_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reputation (
  id TEXT PRIMARY KEY,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  score INTEGER NOT NULL,
  comment TEXT NOT NULL,
  tx_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const MIGRATION_V3 = `
CREATE TABLE IF NOT EXISTS inbox_messages (
  id TEXT PRIMARY KEY,
  from_address TEXT NOT NULL,
  content TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  reply_to TEXT
);
`;

export const MIGRATION_V4 = `
CREATE TABLE IF NOT EXISTS policy_decisions (
  id TEXT PRIMARY KEY,
  turn_id TEXT,
  tool_name TEXT NOT NULL,
  tool_args_hash TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  decision TEXT NOT NULL,
  rules_evaluated TEXT NOT NULL,
  rules_triggered TEXT NOT NULL,
  reason TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS spend_tracking (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  recipient TEXT,
  domain TEXT,
  category TEXT NOT NULL,
  window_hour TEXT NOT NULL,
  window_day TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const MIGRATION_V4_ALTER = `ALTER TABLE inbox_messages ADD COLUMN to_address TEXT;`;
export const MIGRATION_V4_ALTER2 = `ALTER TABLE inbox_messages ADD COLUMN raw_content TEXT;`;
export const MIGRATION_V4_ALTER_INBOX_STATUS = `ALTER TABLE inbox_messages ADD COLUMN status TEXT DEFAULT 'received';`;
export const MIGRATION_V4_ALTER_INBOX_RETRY = `ALTER TABLE inbox_messages ADD COLUMN retry_count INTEGER DEFAULT 0;`;
export const MIGRATION_V4_ALTER_INBOX_MAX_RETRIES = `ALTER TABLE inbox_messages ADD COLUMN max_retries INTEGER DEFAULT 3;`;

export const MIGRATION_V5 = `
CREATE TABLE IF NOT EXISTS soul_history (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  change_source TEXT NOT NULL,
  change_reason TEXT,
  previous_version_id TEXT,
  approved_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS working_memory (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  source_turn TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS episodic_memory (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail TEXT,
  outcome TEXT,
  importance REAL NOT NULL DEFAULT 0.5,
  embedding_key TEXT,
  token_count INTEGER NOT NULL DEFAULT 0,
  accessed_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TEXT,
  classification TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS semantic_memory (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  source TEXT NOT NULL,
  embedding_key TEXT,
  last_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(category, key)
);

CREATE TABLE IF NOT EXISTS procedural_memory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  steps TEXT NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS relationship_memory (
  id TEXT PRIMARY KEY,
  entity_address TEXT NOT NULL UNIQUE,
  entity_name TEXT,
  relationship_type TEXT NOT NULL,
  trust_score REAL NOT NULL DEFAULT 0.5,
  interaction_count INTEGER NOT NULL DEFAULT 0,
  last_interaction_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session_summaries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  key_decisions TEXT NOT NULL DEFAULT '[]',
  tools_used TEXT NOT NULL DEFAULT '[]',
  outcomes TEXT NOT NULL DEFAULT '[]',
  turn_count INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const MIGRATION_V6 = `
CREATE TABLE IF NOT EXISTS inference_costs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_id TEXT,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_cents INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  tier TEXT NOT NULL,
  task_type TEXT NOT NULL,
  cache_hit INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS model_registry (
  model_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  tier_minimum TEXT NOT NULL,
  cost_per_1k_input REAL NOT NULL,
  cost_per_1k_output REAL NOT NULL,
  max_tokens INTEGER NOT NULL,
  context_window INTEGER NOT NULL,
  supports_tools INTEGER NOT NULL DEFAULT 1,
  supports_vision INTEGER NOT NULL DEFAULT 0,
  parameter_style TEXT NOT NULL DEFAULT 'openai',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const MIGRATION_V7 = `
CREATE TABLE IF NOT EXISTS child_lifecycle_events (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  reason TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS discovered_agents_cache (
  agent_address TEXT PRIMARY KEY,
  agent_card TEXT NOT NULL,
  fetched_from TEXT NOT NULL,
  card_hash TEXT NOT NULL,
  valid_until TEXT,
  fetch_count INTEGER NOT NULL DEFAULT 1,
  last_fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS onchain_transactions (
  id TEXT PRIMARY KEY,
  tx_hash TEXT NOT NULL UNIQUE,
  chain TEXT NOT NULL,
  operation TEXT NOT NULL,
  status TEXT NOT NULL,
  gas_used INTEGER,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const MIGRATION_V8 = `
CREATE TABLE IF NOT EXISTS metric_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_at TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  alerts_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const MIGRATION_V9 = `
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  strategy TEXT,
  expected_revenue_cents INTEGER NOT NULL DEFAULT 0,
  actual_revenue_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  deadline TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS task_graph (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  goal_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to TEXT,
  agent_role TEXT,
  priority INTEGER NOT NULL DEFAULT 50,
  dependencies TEXT NOT NULL DEFAULT '[]',
  result TEXT,
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
  actual_cost_cents INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  retry_count INTEGER NOT NULL DEFAULT 0,
  timeout_ms INTEGER NOT NULL DEFAULT 300000,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS event_stream (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  agent_address TEXT NOT NULL,
  goal_id TEXT,
  task_id TEXT,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  compacted_to TEXT,
  created_at TEXT NOT NULL
);
`;

export const MIGRATION_V9_ALTER_CHILDREN_ROLE = `ALTER TABLE children ADD COLUMN role TEXT;`;

export const MIGRATION_V10 = `
CREATE TABLE IF NOT EXISTS knowledge_store (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  last_verified TEXT NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT
);
`;

export const MIGRATION_V11 = `ALTER TABLE children ADD COLUMN chain_type TEXT DEFAULT 'evm';`;

export const MIGRATION_V12 = `ALTER TABLE turns ADD COLUMN reasoning TEXT;`;
