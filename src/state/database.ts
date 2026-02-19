/**
 * Automaton Database
 *
 * SQLite-backed persistent state for the automaton.
 * Uses better-sqlite3 for synchronous, single-process access.
 */

import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import fs from "fs";
import path from "path";

type DatabaseType = BetterSqlite3.Database;
import type {
  AutomatonDatabase,
  AgentTurn,
  AgentState,
  ToolCallResult,
  HeartbeatEntry,
  Transaction,
  InstalledTool,
  ModificationEntry,
  Skill,
  ChildAutomaton,
  ChildStatus,
  RegistryEntry,
  ReputationEntry,
  InboxMessage,
} from "../types.js";
import {
  SCHEMA_VERSION,
  CREATE_TABLES,
  MIGRATION_V2,
  MIGRATION_V3,
  MIGRATION_V4,
  MIGRATION_V4_ALTER,
  MIGRATION_V4_ALTER2,
  MIGRATION_V4_ALTER_INBOX_STATUS,
  MIGRATION_V4_ALTER_INBOX_RETRY,
  MIGRATION_V4_ALTER_INBOX_MAX_RETRIES,
} from "./schema.js";
import type {
  RiskLevel,
  PolicyAction,
  SpendCategory,
  HeartbeatScheduleRow,
  HeartbeatHistoryRow,
  WakeEventRow,
} from "../types.js";

export function createDatabase(dbPath: string): AutomatonDatabase {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma("journal_mode = WAL");
  db.pragma("wal_autocheckpoint = 1000");
  db.pragma("foreign_keys = ON");

  // Integrity check on startup
  const integrity = db.pragma("integrity_check") as { integrity_check: string }[];
  if (integrity[0]?.integrity_check !== "ok") {
    throw new Error(`Database integrity check failed: ${JSON.stringify(integrity)}`);
  }

  // Initialize schema in a transaction
  const createSchema = db.transaction(() => {
    db.exec(CREATE_TABLES);
  });
  createSchema();

  // Apply migrations
  applyMigrations(db);

  // Ensure version is recorded
  const versionRow = db
    .prepare("SELECT MAX(version) as v FROM schema_version")
    .get() as { v: number | null } | undefined;
  const currentVersion = versionRow?.v ?? 0;
  if (currentVersion < SCHEMA_VERSION) {
    db.prepare(
      "INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, datetime('now'))",
    ).run(SCHEMA_VERSION);
  }

  // ─── Identity ────────────────────────────────────────────────

  const getIdentity = (key: string): string | undefined => {
    const row = db
      .prepare("SELECT value FROM identity WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value;
  };

  const setIdentity = (key: string, value: string): void => {
    db.prepare(
      "INSERT OR REPLACE INTO identity (key, value) VALUES (?, ?)",
    ).run(key, value);
  };

  // ─── Turns ───────────────────────────────────────────────────

  const insertTurn = (turn: AgentTurn): void => {
    db.prepare(
      `INSERT INTO turns (id, timestamp, state, input, input_source, thinking, tool_calls, token_usage, cost_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      turn.id,
      turn.timestamp,
      turn.state,
      turn.input ?? null,
      turn.inputSource ?? null,
      turn.thinking,
      JSON.stringify(turn.toolCalls),
      JSON.stringify(turn.tokenUsage),
      turn.costCents,
    );
  };

  const getRecentTurns = (limit: number): AgentTurn[] => {
    const rows = db
      .prepare(
        "SELECT * FROM turns ORDER BY timestamp DESC LIMIT ?",
      )
      .all(limit) as any[];
    return rows.map(deserializeTurn).reverse();
  };

  const getTurnById = (id: string): AgentTurn | undefined => {
    const row = db
      .prepare("SELECT * FROM turns WHERE id = ?")
      .get(id) as any | undefined;
    return row ? deserializeTurn(row) : undefined;
  };

  const getTurnCount = (): number => {
    const row = db
      .prepare("SELECT COUNT(*) as count FROM turns")
      .get() as { count: number };
    return row.count;
  };

  // ─── Tool Calls ──────────────────────────────────────────────

  const insertToolCall = (
    turnId: string,
    call: ToolCallResult,
  ): void => {
    db.prepare(
      `INSERT INTO tool_calls (id, turn_id, name, arguments, result, duration_ms, error)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      call.id,
      turnId,
      call.name,
      JSON.stringify(call.arguments),
      call.result,
      call.durationMs,
      call.error ?? null,
    );
  };

  const getToolCallsForTurn = (turnId: string): ToolCallResult[] => {
    const rows = db
      .prepare("SELECT * FROM tool_calls WHERE turn_id = ?")
      .all(turnId) as any[];
    return rows.map(deserializeToolCall);
  };

  // ─── Heartbeat ───────────────────────────────────────────────

  const getHeartbeatEntries = (): HeartbeatEntry[] => {
    const rows = db
      .prepare("SELECT * FROM heartbeat_entries")
      .all() as any[];
    return rows.map(deserializeHeartbeatEntry);
  };

  const upsertHeartbeatEntry = (entry: HeartbeatEntry): void => {
    db.prepare(
      `INSERT OR REPLACE INTO heartbeat_entries (name, schedule, task, enabled, last_run, next_run, params, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).run(
      entry.name,
      entry.schedule,
      entry.task,
      entry.enabled ? 1 : 0,
      entry.lastRun ?? null,
      entry.nextRun ?? null,
      JSON.stringify(entry.params ?? {}),
    );
  };

  const updateHeartbeatLastRun = (
    name: string,
    timestamp: string,
  ): void => {
    db.prepare(
      "UPDATE heartbeat_entries SET last_run = ?, updated_at = datetime('now') WHERE name = ?",
    ).run(timestamp, name);
  };

  // ─── Transactions ────────────────────────────────────────────

  const insertTransaction = (txn: Transaction): void => {
    db.prepare(
      `INSERT INTO transactions (id, type, amount_cents, balance_after_cents, description)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      txn.id,
      txn.type,
      txn.amountCents ?? null,
      txn.balanceAfterCents ?? null,
      txn.description,
    );
  };

  const getRecentTransactions = (limit: number): Transaction[] => {
    const rows = db
      .prepare(
        "SELECT * FROM transactions ORDER BY created_at DESC LIMIT ?",
      )
      .all(limit) as any[];
    return rows.map(deserializeTransaction).reverse();
  };

  // ─── Installed Tools ─────────────────────────────────────────

  const getInstalledTools = (): InstalledTool[] => {
    const rows = db
      .prepare("SELECT * FROM installed_tools WHERE enabled = 1")
      .all() as any[];
    return rows.map(deserializeInstalledTool);
  };

  const installTool = (tool: InstalledTool): void => {
    db.prepare(
      `INSERT OR REPLACE INTO installed_tools (id, name, type, config, installed_at, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      tool.id,
      tool.name,
      tool.type,
      JSON.stringify(tool.config ?? {}),
      tool.installedAt,
      tool.enabled ? 1 : 0,
    );
  };

  const removeTool = (id: string): void => {
    db.prepare(
      "UPDATE installed_tools SET enabled = 0 WHERE id = ?",
    ).run(id);
  };

  // ─── Modifications ───────────────────────────────────────────

  const insertModification = (mod: ModificationEntry): void => {
    db.prepare(
      `INSERT INTO modifications (id, timestamp, type, description, file_path, diff, reversible)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      mod.id,
      mod.timestamp,
      mod.type,
      mod.description,
      mod.filePath ?? null,
      mod.diff ?? null,
      mod.reversible ? 1 : 0,
    );
  };

  const getRecentModifications = (
    limit: number,
  ): ModificationEntry[] => {
    const rows = db
      .prepare(
        "SELECT * FROM modifications ORDER BY timestamp DESC LIMIT ?",
      )
      .all(limit) as any[];
    return rows.map(deserializeModification).reverse();
  };

  // ─── Key-Value Store ─────────────────────────────────────────

  const getKV = (key: string): string | undefined => {
    const row = db
      .prepare("SELECT value FROM kv WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value;
  };

  const setKV = (key: string, value: string): void => {
    db.prepare(
      "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))",
    ).run(key, value);
  };

  const deleteKV = (key: string): void => {
    db.prepare("DELETE FROM kv WHERE key = ?").run(key);
  };

  const deleteKVReturning = (key: string): string | undefined => {
    const row = db
      .prepare("DELETE FROM kv WHERE key = ? RETURNING value")
      .get(key) as { value: string } | undefined;
    return row?.value;
  };

  // ─── Skills ─────────────────────────────────────────────────

  const getSkills = (enabledOnly?: boolean): Skill[] => {
    const query = enabledOnly
      ? "SELECT * FROM skills WHERE enabled = 1"
      : "SELECT * FROM skills";
    const rows = db.prepare(query).all() as any[];
    return rows.map(deserializeSkill);
  };

  const getSkillByName = (name: string): Skill | undefined => {
    const row = db
      .prepare("SELECT * FROM skills WHERE name = ?")
      .get(name) as any | undefined;
    return row ? deserializeSkill(row) : undefined;
  };

  const upsertSkill = (skill: Skill): void => {
    db.prepare(
      `INSERT OR REPLACE INTO skills (name, description, auto_activate, requires, instructions, source, path, enabled, installed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      skill.name,
      skill.description,
      skill.autoActivate ? 1 : 0,
      JSON.stringify(skill.requires ?? {}),
      skill.instructions,
      skill.source,
      skill.path,
      skill.enabled ? 1 : 0,
      skill.installedAt,
    );
  };

  const removeSkill = (name: string): void => {
    db.prepare("UPDATE skills SET enabled = 0 WHERE name = ?").run(name);
  };

  // ─── Children ──────────────────────────────────────────────

  const getChildren = (): ChildAutomaton[] => {
    const rows = db
      .prepare("SELECT * FROM children ORDER BY created_at DESC")
      .all() as any[];
    return rows.map(deserializeChild);
  };

  const getChildById = (id: string): ChildAutomaton | undefined => {
    const row = db
      .prepare("SELECT * FROM children WHERE id = ?")
      .get(id) as any | undefined;
    return row ? deserializeChild(row) : undefined;
  };

  const insertChild = (child: ChildAutomaton): void => {
    db.prepare(
      `INSERT INTO children (id, name, address, sandbox_id, genesis_prompt, creator_message, funded_amount_cents, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      child.id,
      child.name,
      child.address,
      child.sandboxId,
      child.genesisPrompt,
      child.creatorMessage ?? null,
      child.fundedAmountCents,
      child.status,
      child.createdAt,
    );
  };

  const updateChildStatus = (id: string, status: ChildStatus): void => {
    db.prepare(
      "UPDATE children SET status = ?, last_checked = datetime('now') WHERE id = ?",
    ).run(status, id);
  };

  // ─── Registry ──────────────────────────────────────────────

  const getRegistryEntry = (): RegistryEntry | undefined => {
    const row = db
      .prepare("SELECT * FROM registry LIMIT 1")
      .get() as any | undefined;
    return row ? deserializeRegistry(row) : undefined;
  };

  const setRegistryEntry = (entry: RegistryEntry): void => {
    db.prepare(
      `INSERT OR REPLACE INTO registry (agent_id, agent_uri, chain, contract_address, tx_hash, registered_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      entry.agentId,
      entry.agentURI,
      entry.chain,
      entry.contractAddress,
      entry.txHash,
      entry.registeredAt,
    );
  };

  // ─── Reputation ────────────────────────────────────────────

  const insertReputation = (entry: ReputationEntry): void => {
    db.prepare(
      `INSERT INTO reputation (id, from_agent, to_agent, score, comment, tx_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      entry.id,
      entry.fromAgent,
      entry.toAgent,
      entry.score,
      entry.comment,
      entry.txHash ?? null,
    );
  };

  const getReputation = (agentAddress?: string): ReputationEntry[] => {
    const query = agentAddress
      ? "SELECT * FROM reputation WHERE to_agent = ? ORDER BY created_at DESC"
      : "SELECT * FROM reputation ORDER BY created_at DESC";
    const params = agentAddress ? [agentAddress] : [];
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(deserializeReputation);
  };

  // ─── Inbox Messages ──────────────────────────────────────────

  const insertInboxMessage = (msg: InboxMessage): void => {
    db.prepare(
      `INSERT OR IGNORE INTO inbox_messages (id, from_address, content, received_at, reply_to)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      msg.id,
      msg.from,
      msg.content,
      msg.createdAt || new Date().toISOString(),
      msg.replyTo ?? null,
    );
  };

  const getUnprocessedInboxMessages = (limit: number): InboxMessage[] => {
    const rows = db
      .prepare(
        "SELECT * FROM inbox_messages WHERE processed_at IS NULL ORDER BY received_at ASC LIMIT ?",
      )
      .all(limit) as any[];
    return rows.map(deserializeInboxMessage);
  };

  const markInboxMessageProcessed = (id: string): void => {
    db.prepare(
      "UPDATE inbox_messages SET processed_at = datetime('now') WHERE id = ?",
    ).run(id);
  };

  // ─── Agent State ─────────────────────────────────────────────

  const getAgentState = (): AgentState => {
    return validateAgentState(getKV("agent_state"));
  };

  const setAgentState = (state: AgentState): void => {
    setKV("agent_state", state);
  };

  // ─── Transaction Helper ──────────────────────────────────────

  const runTransaction = <T>(fn: () => T): T => {
    const transaction = db.transaction(() => fn());
    return transaction();
  };

  // ─── Close ───────────────────────────────────────────────────

  const close = (): void => {
    db.close();
  };

  return {
    getIdentity,
    setIdentity,
    insertTurn,
    getRecentTurns,
    getTurnById,
    getTurnCount,
    insertToolCall,
    getToolCallsForTurn,
    getHeartbeatEntries,
    upsertHeartbeatEntry,
    updateHeartbeatLastRun,
    insertTransaction,
    getRecentTransactions,
    getInstalledTools,
    installTool,
    removeTool,
    insertModification,
    getRecentModifications,
    getKV,
    setKV,
    deleteKV,
    deleteKVReturning,
    getSkills,
    getSkillByName,
    upsertSkill,
    removeSkill,
    getChildren,
    getChildById,
    insertChild,
    updateChildStatus,
    getRegistryEntry,
    setRegistryEntry,
    insertReputation,
    getReputation,
    insertInboxMessage,
    getUnprocessedInboxMessages,
    markInboxMessageProcessed,
    getAgentState,
    setAgentState,
    runTransaction,
    close,
    raw: db,
  };
}

// ─── Migration Runner ───────────────────────────────────────────

function applyMigrations(db: DatabaseType): void {
  const versionRow = db
    .prepare("SELECT MAX(version) as v FROM schema_version")
    .get() as { v: number | null } | undefined;
  const currentVersion = versionRow?.v ?? 0;

  const migrations: { version: number; apply: () => void }[] = [
    {
      version: 2,
      apply: () => db.exec(MIGRATION_V2),
    },
    {
      version: 3,
      apply: () => db.exec(MIGRATION_V3),
    },
    {
      version: 4,
      apply: () => {
        db.exec(MIGRATION_V4);
        try { db.exec(MIGRATION_V4_ALTER); } catch (error) { console.error('[database] V4 ALTER (to_address) skipped:', error instanceof Error ? error.message : error); }
        try { db.exec(MIGRATION_V4_ALTER2); } catch (error) { console.error('[database] V4 ALTER (raw_content) skipped:', error instanceof Error ? error.message : error); }
        try { db.exec(MIGRATION_V4_ALTER_INBOX_STATUS); } catch (error) { console.error('[database] V4 ALTER (inbox status) skipped:', error instanceof Error ? error.message : error); }
        try { db.exec(MIGRATION_V4_ALTER_INBOX_RETRY); } catch (error) { console.error('[database] V4 ALTER (inbox retry_count) skipped:', error instanceof Error ? error.message : error); }
        try { db.exec(MIGRATION_V4_ALTER_INBOX_MAX_RETRIES); } catch (error) { console.error('[database] V4 ALTER (inbox max_retries) skipped:', error instanceof Error ? error.message : error); }
      },
    },
  ];

  for (const m of migrations) {
    if (currentVersion < m.version) {
      const migrate = db.transaction(() => {
        m.apply();
        db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(m.version);
      });
      migrate();
    }
  }
}

// ─── Exported Helpers ───────────────────────────────────────────

export function withTransaction<T>(db: DatabaseType, fn: () => T): T {
  const transaction = db.transaction(() => fn());
  return transaction();
}

export function checkpointWAL(db: DatabaseType): void {
  db.pragma("wal_checkpoint(TRUNCATE)");
}

// ─── DB Row Types ──────────────────────────────────────────────

export interface PolicyDecisionRow {
  id: string;
  turnId: string | null;
  toolName: string;
  toolArgsHash: string;
  riskLevel: RiskLevel;
  decision: PolicyAction;
  rulesEvaluated: string;   // JSON string
  rulesTriggered: string;   // JSON string
  reason: string;
  latencyMs: number;
}

export interface SpendTrackingRow {
  id: string;
  toolName: string;
  amountCents: number;
  recipient: string | null;
  domain: string | null;
  category: SpendCategory;
  windowHour: string;       // ISO hour: '2026-02-19T14'
  windowDay: string;        // ISO date: '2026-02-19'
}

// ─── Policy Decision Helpers ────────────────────────────────────

export function insertPolicyDecision(db: DatabaseType, row: PolicyDecisionRow): void {
  db.prepare(
    `INSERT INTO policy_decisions (id, turn_id, tool_name, tool_args_hash, risk_level, decision, rules_evaluated, rules_triggered, reason, latency_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.turnId,
    row.toolName,
    row.toolArgsHash,
    row.riskLevel,
    row.decision,
    row.rulesEvaluated,
    row.rulesTriggered,
    row.reason,
    row.latencyMs,
  );
}

export function getPolicyDecisions(
  db: DatabaseType,
  filters: {
    turnId?: string;
    toolName?: string;
    decision?: PolicyAction;
  },
): PolicyDecisionRow[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.turnId) {
    conditions.push("turn_id = ?");
    params.push(filters.turnId);
  }
  if (filters.toolName) {
    conditions.push("tool_name = ?");
    params.push(filters.toolName);
  }
  if (filters.decision) {
    conditions.push("decision = ?");
    params.push(filters.decision);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM policy_decisions ${where} ORDER BY created_at DESC`)
    .all(...params) as any[];

  return rows.map((row) => ({
    id: row.id,
    turnId: row.turn_id,
    toolName: row.tool_name,
    toolArgsHash: row.tool_args_hash,
    riskLevel: row.risk_level as RiskLevel,
    decision: row.decision as PolicyAction,
    rulesEvaluated: row.rules_evaluated,
    rulesTriggered: row.rules_triggered,
    reason: row.reason,
    latencyMs: row.latency_ms,
  }));
}

// ─── Spend Tracking Helpers ─────────────────────────────────────

export function insertSpendRecord(db: DatabaseType, entry: SpendTrackingRow): void {
  db.prepare(
    `INSERT INTO spend_tracking (id, tool_name, amount_cents, recipient, domain, category, window_hour, window_day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.id,
    entry.toolName,
    entry.amountCents,
    entry.recipient,
    entry.domain,
    entry.category,
    entry.windowHour,
    entry.windowDay,
  );
}

export function getSpendByWindow(
  db: DatabaseType,
  category: string,
  windowType: "hour" | "day",
  window: string,
): number {
  const column = windowType === "hour" ? "window_hour" : "window_day";
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) as total FROM spend_tracking WHERE category = ? AND ${column} = ?`,
    )
    .get(category, window) as { total: number };
  return row.total;
}

export function pruneSpendRecords(db: DatabaseType, olderThan: string): number {
  const result = db
    .prepare("DELETE FROM spend_tracking WHERE created_at < ?")
    .run(olderThan);
  return result.changes;
}

// ─── Heartbeat Schedule Helpers (Phase 1.1) ─────────────────────

export function getHeartbeatSchedule(db: DatabaseType): HeartbeatScheduleRow[] {
  const rows = db
    .prepare("SELECT * FROM heartbeat_schedule ORDER BY priority ASC")
    .all() as any[];
  return rows.map(deserializeHeartbeatScheduleRow);
}

export function getHeartbeatTask(db: DatabaseType, taskName: string): HeartbeatScheduleRow | undefined {
  const row = db
    .prepare("SELECT * FROM heartbeat_schedule WHERE task_name = ?")
    .get(taskName) as any | undefined;
  return row ? deserializeHeartbeatScheduleRow(row) : undefined;
}

export function updateHeartbeatSchedule(
  db: DatabaseType,
  taskName: string,
  updates: Partial<HeartbeatScheduleRow>,
): void {
  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (updates.lastRunAt !== undefined) { setClauses.push("last_run_at = ?"); params.push(updates.lastRunAt); }
  if (updates.nextRunAt !== undefined) { setClauses.push("next_run_at = ?"); params.push(updates.nextRunAt); }
  if (updates.lastResult !== undefined) { setClauses.push("last_result = ?"); params.push(updates.lastResult); }
  if (updates.lastError !== undefined) { setClauses.push("last_error = ?"); params.push(updates.lastError); }
  if (updates.runCount !== undefined) { setClauses.push("run_count = ?"); params.push(updates.runCount); }
  if (updates.failCount !== undefined) { setClauses.push("fail_count = ?"); params.push(updates.failCount); }
  if (updates.leaseOwner !== undefined) { setClauses.push("lease_owner = ?"); params.push(updates.leaseOwner); }
  if (updates.leaseExpiresAt !== undefined) { setClauses.push("lease_expires_at = ?"); params.push(updates.leaseExpiresAt); }
  if (updates.enabled !== undefined) { setClauses.push("enabled = ?"); params.push(updates.enabled); }
  if (updates.cronExpression !== undefined) { setClauses.push("cron_expression = ?"); params.push(updates.cronExpression); }
  if (updates.intervalMs !== undefined) { setClauses.push("interval_ms = ?"); params.push(updates.intervalMs); }
  if (updates.timeoutMs !== undefined) { setClauses.push("timeout_ms = ?"); params.push(updates.timeoutMs); }
  if (updates.maxRetries !== undefined) { setClauses.push("max_retries = ?"); params.push(updates.maxRetries); }
  if (updates.priority !== undefined) { setClauses.push("priority = ?"); params.push(updates.priority); }
  if (updates.tierMinimum !== undefined) { setClauses.push("tier_minimum = ?"); params.push(updates.tierMinimum); }

  if (setClauses.length === 0) return;

  setClauses.push("updated_at = datetime('now')");
  params.push(taskName);

  db.prepare(
    `UPDATE heartbeat_schedule SET ${setClauses.join(", ")} WHERE task_name = ?`,
  ).run(...params);
}

export function upsertHeartbeatSchedule(db: DatabaseType, row: HeartbeatScheduleRow): void {
  db.prepare(
    `INSERT OR REPLACE INTO heartbeat_schedule
     (task_name, cron_expression, interval_ms, enabled, priority, timeout_ms, max_retries, tier_minimum,
      last_run_at, next_run_at, last_result, last_error, run_count, fail_count, lease_owner, lease_expires_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).run(
    row.taskName,
    row.cronExpression,
    row.intervalMs,
    row.enabled,
    row.priority,
    row.timeoutMs,
    row.maxRetries,
    row.tierMinimum,
    row.lastRunAt,
    row.nextRunAt,
    row.lastResult,
    row.lastError,
    row.runCount,
    row.failCount,
    row.leaseOwner,
    row.leaseExpiresAt,
  );
}

// ─── Heartbeat History Helpers (Phase 1.1) ──────────────────────

export function insertHeartbeatHistory(db: DatabaseType, entry: HeartbeatHistoryRow): void {
  db.prepare(
    `INSERT INTO heartbeat_history (id, task_name, started_at, completed_at, result, duration_ms, error, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.id,
    entry.taskName,
    entry.startedAt,
    entry.completedAt,
    entry.result,
    entry.durationMs,
    entry.error,
    entry.idempotencyKey,
  );
}

export function getHeartbeatHistory(db: DatabaseType, taskName: string, limit = 50): HeartbeatHistoryRow[] {
  const rows = db
    .prepare(
      "SELECT * FROM heartbeat_history WHERE task_name = ? ORDER BY started_at DESC LIMIT ?",
    )
    .all(taskName, limit) as any[];
  return rows.map(deserializeHeartbeatHistoryRow);
}

// ─── Lease Management Helpers (Phase 1.1) ───────────────────────

export function acquireTaskLease(db: DatabaseType, taskName: string, owner: string, ttlMs: number): boolean {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const result = db.prepare(
    `UPDATE heartbeat_schedule
     SET lease_owner = ?, lease_expires_at = ?, updated_at = datetime('now')
     WHERE task_name = ?
       AND (lease_owner IS NULL OR lease_expires_at < datetime('now'))`,
  ).run(owner, expiresAt, taskName);
  return result.changes > 0;
}

export function releaseTaskLease(db: DatabaseType, taskName: string, owner: string): void {
  db.prepare(
    `UPDATE heartbeat_schedule
     SET lease_owner = NULL, lease_expires_at = NULL, updated_at = datetime('now')
     WHERE task_name = ? AND lease_owner = ?`,
  ).run(taskName, owner);
}

export function clearExpiredLeases(db: DatabaseType): number {
  const result = db.prepare(
    `UPDATE heartbeat_schedule
     SET lease_owner = NULL, lease_expires_at = NULL, updated_at = datetime('now')
     WHERE lease_expires_at IS NOT NULL AND lease_expires_at < datetime('now')`,
  ).run();
  return result.changes;
}

// ─── Wake Event Helpers (Phase 1.1) ─────────────────────────────

export function insertWakeEvent(db: DatabaseType, source: string, reason: string, payload?: object): void {
  db.prepare(
    "INSERT INTO wake_events (source, reason, payload) VALUES (?, ?, ?)",
  ).run(source, reason, JSON.stringify(payload ?? {}));
}

export function consumeNextWakeEvent(db: DatabaseType): WakeEventRow | undefined {
  const row = db.prepare(
    `UPDATE wake_events
     SET consumed_at = datetime('now')
     WHERE id = (SELECT id FROM wake_events WHERE consumed_at IS NULL ORDER BY id ASC LIMIT 1)
     RETURNING *`,
  ).get() as any | undefined;
  return row ? deserializeWakeEventRow(row) : undefined;
}

export function getUnconsumedWakeEvents(db: DatabaseType): WakeEventRow[] {
  const rows = db.prepare(
    "SELECT * FROM wake_events WHERE consumed_at IS NULL ORDER BY id ASC",
  ).all() as any[];
  return rows.map(deserializeWakeEventRow);
}

// ─── KV Pruning Helpers (Phase 1.6) ─────────────────────────────

export function pruneStaleKV(db: DatabaseType, prefix: string, retentionDays: number): number {
  const result = db.prepare(
    `DELETE FROM kv WHERE key LIKE ? AND updated_at < datetime('now', ?)`,
  ).run(`${prefix}%`, `-${retentionDays} days`);
  return result.changes;
}

// ─── Dedup Helpers (Phase 1.1) ──────────────────────────────────

export function insertDedupKey(db: DatabaseType, key: string, taskName: string, ttlMs: number): boolean {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  try {
    db.prepare(
      "INSERT INTO heartbeat_dedup (dedup_key, task_name, expires_at) VALUES (?, ?, ?)",
    ).run(key, taskName, expiresAt);
    return true;
  } catch (error) {
    // Key already exists (duplicate) — expected for dedup
    console.error('[database] Dedup key insert failed (likely duplicate):', error instanceof Error ? error.message : error);
    return false;
  }
}

export function pruneExpiredDedupKeys(db: DatabaseType): number {
  const result = db.prepare(
    "DELETE FROM heartbeat_dedup WHERE expires_at < datetime('now')",
  ).run();
  return result.changes;
}

export function isDeduplicated(db: DatabaseType, key: string): boolean {
  const row = db.prepare(
    "SELECT 1 FROM heartbeat_dedup WHERE dedup_key = ? AND expires_at >= datetime('now')",
  ).get(key) as any | undefined;
  return !!row;
}

// ─── Inbox State Machine Helpers (Phase 1.2) ─────────────────────

export function claimInboxMessages(db: DatabaseType, limit: number): InboxMessageRow[] {
  // Atomically claim messages: received → in_progress, increment retry_count
  // Use a two-step approach since some SQLite versions don't support RETURNING on UPDATE
  const rows = db.prepare(
    `SELECT id, from_address, content, received_at, processed_at, reply_to, to_address, raw_content,
            status, retry_count, max_retries
     FROM inbox_messages
     WHERE status = 'received' AND retry_count < max_retries
     ORDER BY received_at ASC
     LIMIT ?`,
  ).all(limit) as any[];

  if (rows.length === 0) return [];

  const ids = rows.map((r: any) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(
    `UPDATE inbox_messages
     SET status = 'in_progress', retry_count = retry_count + 1
     WHERE id IN (${placeholders})`,
  ).run(...ids);

  // Return rows with updated retry_count
  return rows.map((row: any) => ({
    id: row.id,
    fromAddress: row.from_address,
    content: row.content,
    receivedAt: row.received_at,
    processedAt: row.processed_at ?? null,
    replyTo: row.reply_to ?? null,
    toAddress: row.to_address ?? null,
    rawContent: row.raw_content ?? null,
    status: 'in_progress' as const,
    retryCount: (row.retry_count ?? 0) + 1,
    maxRetries: row.max_retries ?? 3,
  }));
}

export function markInboxProcessed(db: DatabaseType, ids: string[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(
    `UPDATE inbox_messages SET status = 'processed', processed_at = datetime('now') WHERE id IN (${placeholders})`,
  ).run(...ids);
}

export function markInboxFailed(db: DatabaseType, ids: string[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(
    `UPDATE inbox_messages SET status = 'failed' WHERE id IN (${placeholders})`,
  ).run(...ids);
}

export function resetInboxToReceived(db: DatabaseType, ids: string[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(
    `UPDATE inbox_messages SET status = 'received' WHERE id IN (${placeholders})`,
  ).run(...ids);
}

export function getUnprocessedInboxCount(db: DatabaseType): number {
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM inbox_messages WHERE status IN ('received','in_progress')",
  ).get() as { count: number };
  return row.count;
}

export interface InboxMessageRow {
  id: string;
  fromAddress: string;
  content: string;
  receivedAt: string;
  processedAt: string | null;
  replyTo: string | null;
  toAddress: string | null;
  rawContent: string | null;
  status: string;
  retryCount: number;
  maxRetries: number;
}

// ─── Safe JSON Parse ────────────────────────────────────────────

function safeJsonParse<T>(raw: string, fallback: T, context: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`[database] JSON parse failed in ${context}:`, error instanceof Error ? error.message : error);
    return fallback;
  }
}

// ─── Agent State Validation ─────────────────────────────────────

const VALID_AGENT_STATES: Set<string> = new Set([
  "setup", "waking", "running", "sleeping", "low_compute", "critical", "dead",
]);

function validateAgentState(value: string | undefined): AgentState {
  if (!value) return "setup";
  if (VALID_AGENT_STATES.has(value)) {
    return value as AgentState;
  }
  console.error(`[database] Invalid agent_state value: '${value}', defaulting to 'setup'`);
  return "setup";
}

// ─── Deserializers ─────────────────────────────────────────────

function deserializeTurn(row: any): AgentTurn {
  return {
    id: row.id,
    timestamp: row.timestamp,
    state: row.state,
    input: row.input ?? undefined,
    inputSource: row.input_source ?? undefined,
    thinking: row.thinking,
    toolCalls: safeJsonParse(row.tool_calls || "[]", [] as ToolCallResult[], "deserializeTurn.toolCalls"),
    tokenUsage: safeJsonParse(row.token_usage || "{}", {} as any, "deserializeTurn.tokenUsage"),
    costCents: row.cost_cents,
  };
}

function deserializeToolCall(row: any): ToolCallResult {
  return {
    id: row.id,
    name: row.name,
    arguments: safeJsonParse(row.arguments || "{}", {} as Record<string, unknown>, "deserializeToolCall.arguments"),
    result: row.result,
    durationMs: row.duration_ms,
    error: row.error ?? undefined,
  };
}

function deserializeHeartbeatEntry(row: any): HeartbeatEntry {
  return {
    name: row.name,
    schedule: row.schedule,
    task: row.task,
    enabled: !!row.enabled,
    lastRun: row.last_run ?? undefined,
    nextRun: row.next_run ?? undefined,
    params: safeJsonParse(row.params || "{}", {} as Record<string, unknown>, "deserializeHeartbeatEntry.params"),
  };
}

function deserializeTransaction(row: any): Transaction {
  return {
    id: row.id,
    type: row.type,
    amountCents: row.amount_cents ?? undefined,
    balanceAfterCents: row.balance_after_cents ?? undefined,
    description: row.description,
    timestamp: row.created_at,
  };
}

function deserializeInstalledTool(row: any): InstalledTool {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    config: safeJsonParse(row.config || "{}", {} as Record<string, unknown>, "deserializeInstalledTool.config"),
    installedAt: row.installed_at,
    enabled: !!row.enabled,
  };
}

function deserializeModification(row: any): ModificationEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    type: row.type,
    description: row.description,
    filePath: row.file_path ?? undefined,
    diff: row.diff ?? undefined,
    reversible: !!row.reversible,
  };
}

function deserializeSkill(row: any): Skill {
  return {
    name: row.name,
    description: row.description,
    autoActivate: !!row.auto_activate,
    requires: safeJsonParse(row.requires || "{}", {} as Record<string, unknown>, "deserializeSkill.requires"),
    instructions: row.instructions,
    source: row.source,
    path: row.path,
    enabled: !!row.enabled,
    installedAt: row.installed_at,
  };
}

function deserializeChild(row: any): ChildAutomaton {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    sandboxId: row.sandbox_id,
    genesisPrompt: row.genesis_prompt,
    creatorMessage: row.creator_message ?? undefined,
    fundedAmountCents: row.funded_amount_cents,
    status: row.status,
    createdAt: row.created_at,
    lastChecked: row.last_checked ?? undefined,
  };
}

function deserializeRegistry(row: any): RegistryEntry {
  return {
    agentId: row.agent_id,
    agentURI: row.agent_uri,
    chain: row.chain,
    contractAddress: row.contract_address,
    txHash: row.tx_hash,
    registeredAt: row.registered_at,
  };
}

function deserializeInboxMessage(row: any): InboxMessage {
  return {
    id: row.id,
    from: row.from_address,
    to: row.to_address ?? "",
    content: row.content,
    signedAt: row.received_at,
    createdAt: row.received_at,
    replyTo: row.reply_to ?? undefined,
  };
}

function deserializeReputation(row: any): ReputationEntry {
  return {
    id: row.id,
    fromAgent: row.from_agent,
    toAgent: row.to_agent,
    score: row.score,
    comment: row.comment,
    txHash: row.tx_hash ?? undefined,
    timestamp: row.created_at,
  };
}

// ─── Phase 1.1 Deserializers ────────────────────────────────────

function deserializeHeartbeatScheduleRow(row: any): HeartbeatScheduleRow {
  return {
    taskName: row.task_name,
    cronExpression: row.cron_expression,
    intervalMs: row.interval_ms ?? null,
    enabled: row.enabled,
    priority: row.priority,
    timeoutMs: row.timeout_ms,
    maxRetries: row.max_retries,
    tierMinimum: row.tier_minimum,
    lastRunAt: row.last_run_at ?? null,
    nextRunAt: row.next_run_at ?? null,
    lastResult: row.last_result ?? null,
    lastError: row.last_error ?? null,
    runCount: row.run_count,
    failCount: row.fail_count,
    leaseOwner: row.lease_owner ?? null,
    leaseExpiresAt: row.lease_expires_at ?? null,
  };
}

function deserializeHeartbeatHistoryRow(row: any): HeartbeatHistoryRow {
  return {
    id: row.id,
    taskName: row.task_name,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    result: row.result,
    durationMs: row.duration_ms ?? null,
    error: row.error ?? null,
    idempotencyKey: row.idempotency_key ?? null,
  };
}

function deserializeWakeEventRow(row: any): WakeEventRow {
  return {
    id: row.id,
    source: row.source,
    reason: row.reason,
    payload: row.payload ?? '{}',
    consumedAt: row.consumed_at ?? null,
    createdAt: row.created_at,
  };
}
