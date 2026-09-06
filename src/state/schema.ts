export const SCHEMA_VERSION = 12;

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

export const MIGRATION_V2 = ``;
export const MIGRATION_V3 = ``;
export const MIGRATION_V4 = ``;
export const MIGRATION_V4_ALTER = ``;
export const MIGRATION_V4_ALTER2 = ``;
export const MIGRATION_V4_ALTER_INBOX_STATUS = ``;
export const MIGRATION_V4_ALTER_INBOX_RETRY = ``;
export const MIGRATION_V4_ALTER_INBOX_MAX_RETRIES = ``;
export const MIGRATION_V5 = ``;
export const MIGRATION_V6 = ``;
export const MIGRATION_V7 = ``;
export const MIGRATION_V8 = ``;
export const MIGRATION_V9 = ``;
export const MIGRATION_V9_ALTER_CHILDREN_ROLE = ``;
export const MIGRATION_V10 = ``;
export const MIGRATION_V11 = ``;
export const MIGRATION_V12 = ``;
