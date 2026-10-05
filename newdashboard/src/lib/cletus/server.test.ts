import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { getSnapshotWithDiagnostics } from "./server.ts";

/**
 * The schema contract between this dashboard and ~/.cletus/state.db.
 *
 * This DDL mirrors the live Cletus database. If the agent-side schema drifts
 * (renamed/dropped columns, new required tables), the happy-path test below
 * fails CI loudly instead of letting `safe()` quietly render empty sections —
 * which is exactly how the original `funding_amount` vs `funded_amount_cents`
 * mismatch shipped.
 *
 * To re-pin the contract after an intentional upstream migration, diff against
 * the live DB:
 *   sqlite3 ~/.cletus/state.db ".schema" > newdashboard/src/lib/cletus/schema-contract.sql
 * and update this DDL (and the seeds/assertions) to match.
 */
const SCHEMA_CONTRACT_DDL = `
CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE children (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT, sandbox_id TEXT,
  genesis_prompt TEXT, creator_message TEXT, funded_amount_cents INTEGER,
  status TEXT NOT NULL, created_at TEXT NOT NULL, last_checked TEXT,
  chain_type TEXT, role TEXT DEFAULT 'generalist'
);
CREATE TABLE goals (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT,
  status TEXT NOT NULL DEFAULT 'active', strategy TEXT,
  expected_revenue_cents INTEGER NOT NULL DEFAULT 0,
  actual_revenue_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, deadline TEXT, completed_at TEXT
);
CREATE TABLE task_graph (
  id TEXT PRIMARY KEY, parent_id TEXT, goal_id TEXT NOT NULL,
  title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'pending',
  assigned_to TEXT, agent_role TEXT, priority INTEGER NOT NULL DEFAULT 50,
  dependencies TEXT NOT NULL DEFAULT '[]', result TEXT,
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
  actual_cost_cents INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3, retry_count INTEGER NOT NULL DEFAULT 0,
  timeout_ms INTEGER NOT NULL DEFAULT 300000, created_at TEXT NOT NULL,
  started_at TEXT, completed_at TEXT,
  FOREIGN KEY (goal_id) REFERENCES goals(id)
);
CREATE TABLE turns (
  id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, state TEXT NOT NULL,
  input TEXT, input_source TEXT, thinking TEXT, reasoning TEXT,
  tool_calls TEXT, token_usage TEXT, cost_cents INTEGER
);
CREATE TABLE inference_costs (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL, turn_id TEXT,
  model TEXT NOT NULL, provider TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0, latency_ms INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL, task_type TEXT NOT NULL, cache_hit INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE tool_calls (
  id TEXT PRIMARY KEY, turn_id TEXT NOT NULL, name TEXT NOT NULL,
  arguments TEXT NOT NULL, result TEXT, duration_ms INTEGER, error TEXT,
  FOREIGN KEY (turn_id) REFERENCES turns(id)
);
CREATE TABLE inbox_messages (
  id TEXT PRIMARY KEY, from_address TEXT NOT NULL, content TEXT NOT NULL,
  received_at TEXT NOT NULL, processed_at TEXT, reply_to TEXT, to_address TEXT,
  raw_content TEXT, status TEXT DEFAULT 'received',
  retry_count INTEGER DEFAULT 0, max_retries INTEGER DEFAULT 3
);
CREATE TABLE policy_decisions (
  id TEXT PRIMARY KEY, turn_id TEXT, tool_name TEXT NOT NULL,
  tool_args_hash TEXT NOT NULL, risk_level TEXT NOT NULL, decision TEXT NOT NULL,
  rules_evaluated TEXT NOT NULL, rules_triggered TEXT NOT NULL, reason TEXT NOT NULL,
  latency_ms INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (turn_id) REFERENCES turns(id)
);
CREATE TABLE skills (
  name TEXT PRIMARY KEY, description TEXT, auto_activate INTEGER NOT NULL,
  requires TEXT, instructions TEXT, source TEXT, path TEXT,
  enabled INTEGER NOT NULL, installed_at TEXT NOT NULL
);
CREATE TABLE heartbeat_schedule (
  task_name TEXT PRIMARY KEY, cron_expression TEXT, interval_ms INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1, priority INTEGER NOT NULL DEFAULT 50,
  timeout_ms INTEGER NOT NULL DEFAULT 60000, max_retries INTEGER NOT NULL DEFAULT 3,
  tier_minimum TEXT, last_run_at TEXT, next_run_at TEXT, last_result TEXT,
  last_error TEXT, run_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0, lease_owner TEXT, lease_expires_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE discovered_agents_cache (
  agent_address TEXT PRIMARY KEY, agent_card TEXT NOT NULL,
  fetched_from TEXT NOT NULL, card_hash TEXT NOT NULL, valid_until TEXT,
  fetch_count INTEGER NOT NULL DEFAULT 1,
  last_fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE work_queue (
  id TEXT PRIMARY KEY, source TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL DEFAULT '{}', acceptance_predicate TEXT NOT NULL,
  spend_bearing INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
  claimed_by TEXT, lease_expires_at INTEGER, result TEXT, error TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
`;

const SNAPSHOT_KEYS = [
  "alerts",
  "children",
  "denials",
  "entelechy",
  "fleetCensus",
  "gatewayActivity",
  "goals",
  "heartbeats",
  "inbox",
  "logs",
  "openclaw",
  "peers",
  "pendingAck",
  "skills",
  "spend24h",
  "spendByModel",
  "tasks",
  "thoughts",
  "toolSpends",
  "vitals",
  "workQueue",
].sort();

const SEEDS = `
INSERT INTO kv (key, value) VALUES
  ('agent_state', 'running'),
  ('active_inference_model', 'test-model-1'),
  ('agent_address', 'ADDR-CREATOR'),
  ('last_known_balance', '{"creditsCents":123456,"usdcBalance":7.89}'),
  ('fleet_census', '{"syncedAt":"2026-09-14T12:00:00.000Z","summary":{"registered":493,"confirmed":0,"workspaceOnly":14,"phantom":479,"duplicates":1},"candidates":[{"id":"ph-1","name":"worker-executor-3E073N","reconcile":"phantom","rank":1}],"audit":[{"at":"2026-09-14T11:00:00.000Z","agentName":"ghost-agent","destroyClass":"phantom","reason":"surplus phantom row from spawn spree"}]}'),
  ('health_check_status', 'ok');

-- Gateway activity: what the workers are doing (heartbeat-polled via openclaw).
INSERT INTO kv (key, value) VALUES
  ('gateway_log', '{"syncedAt":"2026-09-14T12:00:00.000Z","lines":[{"time":"2026-09-15T05:09:44.361+00:00","level":"error","subsystem":"plugins","message":"worker-1 crashed on rate limit"}],"truncated":false,"errors":[]}'),
  ('gateway_sessions', '{"syncedAt":"2026-09-14T12:00:00.000Z","sessions":[{"agentId":"main","sessionCount":2,"lastLabel":"Automation: Memory Dreaming Promotion","lastAgeMs":7827589,"lastUpdatedAt":1789441200413,"model":"nvidia/nemotron-3-super-120b-a12b"}],"workspaces":[{"name":"bounty-hunter-1","recent":[{"file":"memory/notes.md","ageMs":3600000},{"file":"AGENTS.md","ageMs":86400000}]}],"errors":[]}');

-- Orchestrator mission state: the entelechy capsule derives from these.
INSERT INTO kv (key, value) VALUES
  ('orchestrator.last_tick', '{"phase":"idle","tasksAssigned":0,"tasksCompleted":0,"tasksFailed":0,"goalsActive":1,"agentsActive":2}'),
  ('orchestrator.plan.01TESTPLAN00000000000000000', '{"strategy":"Ship the writeup through the cheapest verified path.","tasks":[{"title":"Write the 40.00 writeup"},{"title":"Verify wallet before funding"}],"risks":["Provider burn under rate limits","Unverified transfer path"],"estimatedTotalCostCents":4000}');

INSERT INTO children (id, name, sandbox_id, funded_amount_cents, status, created_at, last_checked, role) VALUES
  ('child-1', 'Alpha', NULL, 5000, 'running', '2026-09-01 00:00:00', '2026-09-06 08:42:22', 'scout'),
  ('child-2', 'Bravo', 'sbx-9', NULL, 'stopped', '2026-09-01 00:00:00', '2026-09-06 08:43:26', 'worker');

INSERT INTO goals (id, title, description, status, expected_revenue_cents, actual_revenue_cents, created_at) VALUES
  ('goal-1', 'Earn USDC', 'ship the writeup', 'active', 10000, 2500, '2026-08-01 00:00:00');

INSERT INTO task_graph (id, goal_id, title, description, status, assigned_to, agent_role, result, created_at) VALUES
  ('task-1', 'goal-1', 'Writeup', 'do it', 'failed', 'agent-x', 'writer', 'partial result', '2026-08-02 00:00:00');

INSERT INTO turns (id, timestamp, state, thinking, tool_calls) VALUES
  ('turn-1', '2026-09-13T07:10:18.194Z', 'running', 'I should check credits', '[{"name":"check_credits"}]');

INSERT INTO inference_costs (id, session_id, turn_id, model, provider, cost_cents, tier, task_type, created_at) VALUES
  ('ic-1', 'sess-1', 'turn-1', 'model-a', 'prov-a', 150, 'normal', 'tool', datetime('now', '-2 hours')),
  ('ic-2', 'sess-1', NULL, 'model-b', 'prov-b', 50, 'normal', 'chat', datetime('now', '-1 hour'));

INSERT INTO tool_calls (id, turn_id, name, arguments, result, duration_ms) VALUES
  ('tc-1', 'turn-1', 'check_credits', '{}', 'Credit balance', 3);

INSERT INTO inbox_messages (id, from_address, content, received_at, status) VALUES
  ('msg-1', 'ADDR-CREATOR', 'hello creator', '2026-09-11 06:13:13', 'received');

INSERT INTO policy_decisions (id, turn_id, tool_name, tool_args_hash, risk_level, decision, rules_evaluated, rules_triggered, reason, latency_ms, created_at) VALUES
  ('pd-1', 'turn-1', 'transfer', 'hash-1', 'high', 'deny', '[]', '["max_single_transfer"]', 'over limit', 2, '2026-09-12 10:00:00');

INSERT INTO skills (name, description, auto_activate, enabled, installed_at) VALUES
  ('bounty-scout', 'Find bounties', 1, 1, '2026-08-01 00:00:00');

INSERT INTO heartbeat_schedule (task_name, interval_ms, enabled, last_run_at, last_error) VALUES
  ('report_metrics', 60000, 1, '2026-09-13 07:00:00', NULL);

INSERT INTO discovered_agents_cache (agent_address, agent_card, fetched_from, card_hash, valid_until) VALUES
  ('peer-addr-1', '{"name":"Peer One","handle":"peerone"}', 'https://relay.example', 'hash-1', '2099-01-01T00:00:00Z');
`;

const tempDirs: string[] = [];

function makeFixtureDb(ddl: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cletus-snapshot-"));
  tempDirs.push(dir);
  const dbPath = path.join(dir, "state.db");
  const db = new Database(dbPath);
  db.exec(ddl);
  db.close();
  return dbPath;
}

function makeFixtureLog(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cletus-log-"));
  tempDirs.push(dir);
  const logPath = path.join(dir, "cletus.log");
  fs.writeFileSync(
    logPath,
    ["12:00:00 info system heartbeat ok", "12:00:01 error tool credit_check failed"].join("\n"),
  );
  return logPath;
}

function withEnv(dbPath: string, logPath: string, run: () => void | Promise<void>): Promise<void> {
  const savedDb = process.env.CLETUS_STATE_DB;
  const savedLog = process.env.CLETUS_LOG_PATH;
  const savedOffline = process.env.CLETUS_DASHBOARD_OFFLINE;
  process.env.CLETUS_STATE_DB = dbPath;
  process.env.CLETUS_LOG_PATH = logPath;
  // Never hit the real entelechy API from tests.
  process.env.CLETUS_DASHBOARD_OFFLINE = "1";
  return (async () => {
    try {
      await run();
    } finally {
      if (savedDb === undefined) delete process.env.CLETUS_STATE_DB;
      else process.env.CLETUS_STATE_DB = savedDb;
      if (savedLog === undefined) delete process.env.CLETUS_LOG_PATH;
      else process.env.CLETUS_LOG_PATH = savedLog;
      if (savedOffline === undefined) delete process.env.CLETUS_DASHBOARD_OFFLINE;
      else process.env.CLETUS_DASHBOARD_OFFLINE = savedOffline;
    }
  })();
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("cletus snapshot schema contract", () => {
  it("runs every query cleanly against the pinned schema and returns the full snapshot shape", async () => {
    const dbPath = makeFixtureDb(`${SCHEMA_CONTRACT_DDL}\n${SEEDS}`);
    const logPath = makeFixtureLog();

    await withEnv(dbPath, logPath, async () => {
      const { snapshot, queryFailures } = await getSnapshotWithDiagnostics();

      // The core CI alarm: zero queries failed against the contract schema.
      assert.deepEqual(
        queryFailures,
        [],
        `schema drift detected — these queries no longer match ~/.cletus/state.db:\n${queryFailures.join("\n")}`,
      );

      assert.deepEqual(Object.keys(snapshot).sort(), SNAPSHOT_KEYS);

      // Remote entelechy fetches are disabled in tests; the sentinel stays on
      // the outer getSnapshot(), not the diagnostics-only inner snapshot.
      assert.ok(!("memoryBanks" in snapshot), "diagnostics snapshot must not carry remote-only fields");
      assert.ok(!("metacog" in snapshot), "diagnostics snapshot must not carry remote-only metacog");

      // Vitals come from kv, not invented constants. survival_mode is
      // deliberately absent from the fixture → legacy path: isVirtual false,
      // tier computed purely from balance (123456 > 500 → "high").
      assert.deepEqual(snapshot.vitals, {
        name: "Cletus",
        state: "running",
        model: "test-model-1",
        tier: "high",
        creditsCents: 123456,
        isVirtual: false,
        usdcCents: 789,
        reserveCents: 1000,
        turns: 1,
        startedAt: snapshot.vitals.startedAt,
        sleepUntil: null,
        creator: "ADDR-CREATOR",
        sigil: "CLETUS-01",
      });
      assert.ok(snapshot.vitals.startedAt > 0);

      // Children map real columns (funded_amount_cents, sandbox_id, last_checked).
      assert.equal(snapshot.children.length, 2);
      const alpha = snapshot.children.find((c) => c.id === "child-1");
      assert.equal(alpha?.kind, "local");
      assert.equal(alpha?.status, "healthy");
      assert.equal(alpha?.fundedCents, 5000);
      const bravo = snapshot.children.find((c) => c.id === "child-2");
      assert.equal(bravo?.kind, "openclaw");
      assert.equal(bravo?.status, "stopped");

      // Gateway activity rides the kv scan: sessions answer "what are the
      // workers doing", log lines merge into the unified activity feed.
      assert.ok(snapshot.gatewayActivity, "gateway activity must parse from KV");
      assert.equal(snapshot.gatewayActivity?.sessions[0]?.agentId, "main");
      assert.equal(snapshot.gatewayActivity?.sessions[0]?.lastLabel, "Automation: Memory Dreaming Promotion");
      assert.equal(snapshot.gatewayActivity?.workspaces[0]?.name, "bounty-hunter-1");
      assert.equal(snapshot.gatewayActivity?.workspaces[0]?.recent[0]?.file, "memory/notes.md");
      // Fixture KV predates logSource → null (honest "unknown"), not a fabricated "rpc".
      assert.equal(snapshot.gatewayActivity?.logSource, null);
      assert.ok(
        snapshot.logs.some((l) => l.source.startsWith("gateway/") && /worker-1 crashed/.test(l.message)),
        "gateway log lines must merge into the unified activity log",
      );

      // Fleet census parses Cletus's heartbeat KV sync (fleet_census key).
      assert.equal(snapshot.fleetCensus.stale, false);
      assert.equal(snapshot.fleetCensus.registered, 493);
      assert.equal(snapshot.fleetCensus.phantom, 479);
      assert.equal(snapshot.fleetCensus.workspaceOnly, 14);
      assert.equal(snapshot.fleetCensus.candidates[0]?.name, "worker-executor-3E073N");
      assert.equal(snapshot.fleetCensus.candidates[0]?.reconcile, "phantom");
      assert.equal(snapshot.fleetCensus.audit[0]?.agentName, "ghost-agent");

      // Goals use *_revenue_cents (not the invented expected_revenue).
      assert.equal(snapshot.goals[0]?.expectedRevenueCents, 10000);
      assert.equal(snapshot.goals[0]?.actualRevenueCents, 2500);

      // Failed tasks surface as critical alerts.
      assert.equal(snapshot.tasks[0]?.status, "failed");
      assert.equal(snapshot.tasks[0]?.assignee, "agent-x");
      const taskAlert = snapshot.alerts.find((a) => a.id === "task-1");
      assert.equal(taskAlert?.severity, "crit");

      // Thoughts parse turn.thinking + tool_calls names.
      assert.equal(snapshot.thoughts[0]?.thinking, "I should check credits");
      assert.deepEqual(snapshot.thoughts[0]?.tools, ["check_credits"]);

      // Spend aggregates are real, time-independent rows.
      assert.deepEqual(snapshot.spendByModel, [
        { model: "prov-a/model-a", calls: 1, cents: 150 },
        { model: "prov-b/model-b", calls: 1, cents: 50 },
      ]);
      assert.ok(snapshot.spend24h.length >= 1, "recent costs must appear in the 24h chart");
      for (const point of snapshot.spend24h) {
        assert.match(point.hour, /^\d{2}:00$/);
        assert.ok([50, 150].includes(point.cents));
      }
      assert.equal(snapshot.toolSpends[0]?.tool, "check_credits");
      assert.equal(snapshot.toolSpends[0]?.cents, 150);

      // Inbox maps from_address -> creator/peer, parsed timestamps.
      assert.equal(snapshot.inbox[0]?.from, "creator");
      assert.equal(snapshot.inbox[0]?.status, "received");
      assert.ok(snapshot.inbox[0]?.at > 0);

      // Denials come from real policy_decisions.
      assert.equal(snapshot.denials[0]?.tool, "transfer");
      assert.equal(snapshot.denials[0]?.rule, '["max_single_transfer"]');

      // Skills and heartbeats are real tables.
      assert.deepEqual(snapshot.skills, [
        { name: "bounty-scout", summary: "Find bounties", enabled: true, autoActivate: true },
      ]);
      const hb = snapshot.heartbeats.find((h) => h.name === "report_metrics");
      assert.equal(hb?.cadence, "1m");
      assert.equal(hb?.ok, true);

      // Peers come from discovered_agents_cache cards.
      assert.equal(snapshot.peers[0]?.name, "Peer One");
      assert.equal(snapshot.peers[0]?.handle, "@peerone");
      assert.equal(snapshot.peers[0]?.status, "online");

      // Log file lines parse into level/source/message.
      assert.ok(snapshot.logs.some((l) => l.level === "error" && /credit_check/.test(l.message)));

      // Mission capsule derives from orchestrator KV — no invented constants.
      assert.equal(snapshot.entelechy.mission, "Ship the writeup through the cheapest verified path.");
      assert.equal(snapshot.entelechy.riskPosture, "balanced"); // tier "high"
      assert.deepEqual(snapshot.entelechy.priorities, ["Write the 40.00 writeup", "Verify wallet before funding"]);
      assert.deepEqual(snapshot.entelechy.risks, ["Provider burn under rate limits", "Unverified transfer path"]);
      assert.equal(snapshot.entelechy.recommendation, "Next: Write the 40.00 writeup (plan est. $40.00)");
      assert.equal(snapshot.entelechy.planRef, "orchestrator.plan.01TESTPLAN00000000000000000");
      assert.equal(snapshot.entelechy.estimatedTotalCostCents, 4000);
    });
  });

  it("computes critical survival tier and live VIRTUAL state from KV at the $0 boundary", async () => {
    // Survival fixture: identical contract DDL, but Cletus has synced
    // survival_mode=1 and the wallet sits at exactly $0.
    const dbPath = makeFixtureDb(
      `${SCHEMA_CONTRACT_DDL}\n${SEEDS.replace(
        /'last_known_balance', '[^']*'/,
        `'last_known_balance', '{"creditsCents":0,"usdcBalance":0}'`,
      )      .replace(
        "('health_check_status', 'ok');",
        "('health_check_status', 'ok'),\n  ('survival_mode', '1');",
      )
      // Drop the orchestrator seeds: this fixture tests the no-plan capsule
      // path (survival posture with no queued plan).
      .replace(/-- Orchestrator mission state[\s\S]*?4000\}'\);\n/, "")}`,
    );
    const logPath = makeFixtureLog();

    await withEnv(dbPath, logPath, async () => {
      const { snapshot } = await getSnapshotWithDiagnostics();

      // 0 balance maps exactly to "critical" (the hard-wall cliff edge)...
      assert.equal(snapshot.vitals.tier, "critical");
      // ...and the KV-synced survival flag forces the VIRTUAL disclosure.
      assert.equal(snapshot.vitals.isVirtual, true);

      // With no orchestrator plan seeded, the capsule stays honest about it —
      // and the posture reflects the survival wall, not a mood.
      assert.equal(snapshot.entelechy.riskPosture, "survival");
      assert.match(snapshot.entelechy.recommendation, /Survival wall/);
      assert.equal(snapshot.entelechy.planRef, null);
    });
  });

  it("fails loudly (queryFailures) when the schema drifts, degrading instead of throwing", async () => {
    // Drifted fixture: skills table missing, children missing funded_amount_cents.
    const driftedDdl = SCHEMA_CONTRACT_DDL.replace(
      /CREATE TABLE skills [\s\S]*?\);/,
      "",
    ).replace("funded_amount_cents INTEGER,\n  ", "");
    const dbPath = makeFixtureDb(driftedDdl);
    const logPath = makeFixtureLog();

    await withEnv(dbPath, logPath, async () => {
      const { snapshot, queryFailures } = await getSnapshotWithDiagnostics();

      const labels = queryFailures.map((f) => f.split(":")[0]);
      assert.ok(
        labels.includes("skills"),
        `expected a skills failure, got: ${JSON.stringify(queryFailures)}`,
      );
      assert.ok(
        labels.includes("children"),
        `expected a children failure for the dropped column, got: ${JSON.stringify(queryFailures)}`,
      );

      // The snapshot still returns (empty fallbacks), so the alarm is the only signal.
      assert.deepEqual(snapshot.skills, []);
      assert.deepEqual(snapshot.children, []);
    });
  });
});

describe("cletus snapshot API route shape", () => {
  const routePath = fileURLToPath(
    new URL("../../routes/api/cletus/snapshot.ts", import.meta.url),
  );

  it("exports Route as a server route (createFileRoute + server.handlers), never createServerFn", () => {
    const source = fs.readFileSync(routePath, "utf-8");
    assert.match(
      source,
      /export const Route = createFileRoute\("\/api\/cletus\/snapshot"\)/,
      "routeTree.gen.ts calls Route.update() — Route must be a router route object",
    );
    assert.match(source, /server:\s*\{/);
    assert.match(source, /GET:\s*async/);
    assert.doesNotMatch(
      source,
      /Route\s*=\s*createServerFn/,
      "exporting createServerFn as Route crashes the generated route tree on startup",
    );
  });
});
