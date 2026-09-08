export const CREATE_TABLES = `
-- Heartbeat schedule configuration
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

-- Heartbeat task execution logs
CREATE TABLE IF NOT EXISTS heartbeat_runs (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'running' | 'completed' | 'failed' | 'timed_out'
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  error TEXT,
  result_json TEXT,
  FOREIGN KEY (schedule_id) REFERENCES heartbeat_schedules(id)
);

-- Memory / key-value store for cross-run state
CREATE TABLE IF NOT EXISTS agent_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Pending work items queue (Durable Scheduler work queue)
CREATE TABLE IF NOT EXISTS work_queue (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,             -- 'creator' | 'orchestrator' | 'maintenance' | 'social' | 'child' | 'system'
  priority INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,            -- JSON object
  acceptance_predicate TEXT NOT NULL, -- required evaluation expression e.g. "result.task_done === true"
  spend_bearing INTEGER NOT NULL DEFAULT 0, -- 1 = true, 0 = false
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'claimed' | 'completed' | 'failed' | 'expired'
  claimed_by TEXT,
  lease_expires_at INTEGER,
  result TEXT,                      -- JSON object
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Index for efficient priority claiming
CREATE INDEX IF NOT EXISTS idx_work_queue_claim
ON work_queue(status, priority DESC, created_at ASC);
`;

export const SCHEMA_VERSION = 12;

export const MIGRATION_V2 = `
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  auto_activate INTEGER NOT NULL DEFAULT 0,
  requires TEXT NOT NULL DEFAULT '{}',
  instructions TEXT NOT NULL,
  source TEXT NOT NULL,
  path TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  installed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL UNIQUE,
  sandbox_id TEXT NOT NULL,
  genesis_prompt TEXT NOT NULL,
  creator_message TEXT,
  funded_amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at INTEGER NOT NULL,
  last_checked INTEGER
);

CREATE TABLE IF NOT EXISTS registry (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

export const MIGRATION_V3 = `
CREATE TABLE IF NOT EXISTS inbox_messages (
  id TEXT PRIMARY KEY,
  from_address TEXT NOT NULL,
  to_address TEXT,
  content TEXT NOT NULL,
  raw_content TEXT,
  received_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  reply_to TEXT
);
`;

export const MIGRATION_V4 = `
CREATE TABLE IF NOT EXISTS policy_decisions (
  id TEXT PRIMARY KEY,
  turn_id TEXT,
  tool_name TEXT NOT NULL,
  args_json TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  evaluated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS spend_tracking (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  description TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);
`;

export const MIGRATION_V4_ALTER = `ALTER TABLE inbox_messages ADD COLUMN to_address TEXT;`;
export const MIGRATION_V4_ALTER2 = `ALTER TABLE inbox_messages ADD COLUMN raw_content TEXT;`;
export const MIGRATION_V4_ALTER_INBOX_STATUS = `ALTER TABLE inbox_messages ADD COLUMN status TEXT NOT NULL DEFAULT 'received';`;
export const MIGRATION_V4_ALTER_INBOX_RETRY = `ALTER TABLE inbox_messages ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;`;
export const MIGRATION_V4_ALTER_INBOX_MAX_RETRIES = `ALTER TABLE inbox_messages ADD COLUMN max_retries INTEGER NOT NULL DEFAULT 3;`;

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
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS working_memory (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  source_turn INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS episodic_memory (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail TEXT,
  outcome TEXT,
  importance INTEGER NOT NULL DEFAULT 0,
  embedding_key TEXT,
  token_count INTEGER NOT NULL DEFAULT 0,
  accessed_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at INTEGER,
  classification TEXT NOT NULL DEFAULT 'productive',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS semantic_memory (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  source TEXT NOT NULL,
  embedding_key TEXT,
  last_verified_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS procedural_memory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  steps TEXT NOT NULL DEFAULT '[]',
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS relationship_memory (
  id TEXT PRIMARY KEY,
  entity_address TEXT NOT NULL UNIQUE,
  entity_name TEXT,
  relationship_type TEXT NOT NULL,
  trust_score REAL NOT NULL DEFAULT 0.5,
  interaction_count INTEGER NOT NULL DEFAULT 0,
  last_interaction_at INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

export const MIGRATION_V6 = `
CREATE TABLE IF NOT EXISTS inference_costs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_id TEXT,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS model_registry (
  model_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  tier_minimum TEXT NOT NULL,
  cost_per_1k_input INTEGER NOT NULL,
  cost_per_1k_output INTEGER NOT NULL,
  max_tokens INTEGER NOT NULL,
  context_window INTEGER NOT NULL,
  supports_tools INTEGER NOT NULL DEFAULT 1,
  supports_vision INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
`;

export const MIGRATION_V7 = `
CREATE TABLE IF NOT EXISTS discovered_agents_cache (
  agent_address TEXT PRIMARY KEY,
  agent_card TEXT NOT NULL,
  fetched_from TEXT NOT NULL,
  card_hash TEXT NOT NULL,
  valid_until INTEGER,
  fetch_count INTEGER NOT NULL DEFAULT 1,
  last_fetched_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS onchain_transactions (
  id TEXT PRIMARY KEY,
  tx_hash TEXT NOT NULL UNIQUE,
  chain TEXT NOT NULL,
  operation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  gas_used INTEGER,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS child_lifecycle_events (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  reason TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
`;

export const MIGRATION_V8 = `
CREATE TABLE IF NOT EXISTS metric_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_at TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  alerts_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
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
  created_at INTEGER NOT NULL,
  deadline INTEGER,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  goal_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to TEXT,
  agent_role TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  dependencies TEXT NOT NULL DEFAULT '[]',
  result TEXT,
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
  actual_cost_cents INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  retry_count INTEGER NOT NULL DEFAULT 0,
  timeout_ms INTEGER NOT NULL DEFAULT 300000,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  FOREIGN KEY (goal_id) REFERENCES goals(id)
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
  created_at INTEGER NOT NULL
);
`;

export const MIGRATION_V9_ALTER_CHILDREN_ROLE = `ALTER TABLE children ADD COLUMN role TEXT NOT NULL DEFAULT 'worker';`;

export const MIGRATION_V10 = `
CREATE TABLE IF NOT EXISTS knowledge_store (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  last_verified INTEGER NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);
`;

export const MIGRATION_V11 = `ALTER TABLE children ADD COLUMN chain_type TEXT NOT NULL DEFAULT 'evm';`;

export const MIGRATION_V12 = `ALTER TABLE turns ADD COLUMN reasoning TEXT;`;
