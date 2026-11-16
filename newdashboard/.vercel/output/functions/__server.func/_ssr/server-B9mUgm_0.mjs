import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/server-B9mUgm_0.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
/**
* Paths are read lazily on every call so tests (and alternate deployments)
* can redirect them via env without module-load-order games.
*/
/** High-tier boundary in cents (> this = "high"), matching SURVIVAL_THRESHOLDS.high in Cletus. */
var SURVIVAL_HIGH_CENTS = 500;
async function stateDbPath() {
	const os = await import("node:os");
	const path = await import("node:path");
	return process.env.CLETUS_STATE_DB || path.join(os.homedir(), ".cletus", "state.db");
}
/**
* Locate Cletus's raw log. The agent historically wrote to CWD-relative
* `cletus.log` (repo root) while the dashboard read `~/.cletus/cletus.log` —
* the classic empty-panel cause. Candidates, in order: explicit env, homedir
* convention, repo-root convention. First existing file wins; if none exist
* we return the homedir path so the error message names the canonical spot.
*/
async function logPath() {
	const fs = await import("node:fs");
	const path = await import("node:path");
	const os = await import("node:os");
	const explicit = process.env.CLETUS_LOG_PATH || process.env.CLETUS_LOG;
	const homeCandidate = path.join(os.homedir(), ".cletus", "cletus.log");
	if (explicit) return explicit;
	const repoCandidate = path.join(os.homedir(), "code", "Cletus", "cletus.log");
	try {
		if (fs.existsSync(homeCandidate)) return homeCandidate;
		if (fs.existsSync(repoCandidate)) return repoCandidate;
	} catch {}
	return homeCandidate;
}
/**
* Merge gateway log lines (Cletus's heartbeat-polled `openclaw logs`) into
* the unified activity feed. Gateway lines keep their real remote timestamps
* and are tagged source=gateway; local raw-log lines win their own timeline.
* Newest first, capped together so one feed can't drown the other.
*/
function mergeGatewayLogs(local, gw) {
	if (!gw || gw.log.length === 0) return local;
	const gatewayLines = gw.log.map((l, i) => ({
		id: `gwlog_${i}_${l.time}`,
		at: parseTs(l.time),
		level: [
			"error",
			"warn",
			"thought",
			"tool",
			"info"
		].includes(l.level.toLowerCase()) ? l.level.toLowerCase() : "info",
		source: `gateway/${l.subsystem}`,
		message: l.message
	}));
	return [...local, ...gatewayLines].sort((a, b) => b.at - a.at).filter((line, index, self) => index === self.findIndex((l) => l.message === line.message)).slice(0, 1e3);
}
/**
* Read only the last `maxBytes` of a file without loading it whole — the raw
* log grows unbounded (71MB at last check) and this runs on every poll.
*/
async function readLogTail(filePath, maxBytes) {
	const fs = await import("node:fs");
	const fd = fs.openSync(filePath, "r");
	try {
		const size = fs.fstatSync(fd).size;
		const start = Math.max(0, size - maxBytes);
		const length = size - start;
		const buf = Buffer.alloc(length);
		fs.readSync(fd, buf, 0, length, start);
		const text = buf.toString("utf-8");
		return start > 0 ? text.slice(text.indexOf("\n") + 1) : text;
	} finally {
		fs.closeSync(fd);
	}
}
async function openDb() {
	const { default: Database } = await import("better-sqlite3");
	const db = new Database(await stateDbPath());
	db.pragma("query_only = true");
	return db;
}
/** Parse '2026-09-13T07:10:18.194Z' or '2026-09-06 08:42:22' (UTC) to epoch ms. */
function parseTs(value) {
	if (!value) return 0;
	const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
	if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
	const t = Date.parse(value);
	return Number.isNaN(t) ? 0 : t;
}
function agoMs(ts) {
	const t = parseTs(ts);
	return t > 0 ? Math.max(0, Date.now() - t) : 0;
}
function parseJson(raw, fallback) {
	if (!raw) return fallback;
	try {
		return JSON.parse(raw);
	} catch {
		return fallback;
	}
}
function mapChildStatus(status) {
	switch (status) {
		case "running":
		case "healthy": return "healthy";
		case "blocked": return "unhealthy";
		case "stopped": return "stopped";
		default: return "starting";
	}
}
function mapTaskStatus(status) {
	switch (status) {
		case "assigned":
		case "running":
		case "completed":
		case "failed": return status;
		case "blocked": return "failed";
		default: return "pending";
	}
}
/** Capsule field limits: the MissionStrip is a summary surface, not a log. */
var CAPSULE_MAX_RISKS = 3;
var CAPSULE_MAX_PRIORITY_CHARS = 60;
/**
* Derive the mission capsule from Cletus's REAL orchestrator state — no
* invented constants. Sources:
*
*  - `orchestrator.last_tick` KV  → mission line + activity counts
*  - freshest `orchestrator.plan.*` KV → strategy, risks, cost estimate
*  - survival tier (already computed from the wallet) → risk posture
*
* Every field degrades to honest "no data" values — never placeholders that
* look like live telemetry.
*/
function buildEntelechyCapsule(kv, agentState, tier) {
	const tick = parseJson(kv["orchestrator.last_tick"], null);
	const planKey = Object.keys(kv).filter((k) => k.startsWith("orchestrator.plan.")).sort().pop();
	const plan = planKey ? parseJson(kv[planKey], null) : null;
	const goalsActive = Number(tick?.goalsActive ?? 0);
	const agentsActive = Number(tick?.agentsActive ?? 0);
	const phase = typeof tick?.phase === "string" ? tick.phase : null;
	const customMission = kv["custom_active_mission"];
	let mission;
	if (customMission) mission = customMission;
	else if (plan?.strategy) mission = String(plan.strategy).slice(0, 240);
	else if (phase && phase !== "idle") mission = `Orchestrator ${phase}` + (goalsActive > 0 ? ` — ${goalsActive} goal${goalsActive === 1 ? "" : "s"} active` : "");
	else if (agentState === "running") mission = agentsActive > 0 ? `Active orchestration — ${agentsActive} agent${agentsActive === 1 ? "" : "s"} active, no queued plan` : "Active orchestration — idle, awaiting tasks";
	else mission = "Dormant";
	const taskTitles = Array.isArray(plan?.tasks) ? plan.tasks.map((t) => String(t?.title ?? "")).filter(Boolean) : [];
	const priorities = taskTitles.length > 0 ? taskTitles.slice(0, 3).map((t) => t.length > CAPSULE_MAX_PRIORITY_CHARS ? t.slice(0, 59) + "…" : t) : taskTitles.length || goalsActive || agentsActive ? [
		`Orchestrator ${phase ?? agentState}`,
		`${goalsActive} goals`,
		`${agentsActive} agents`
	] : ["No active priorities"];
	const risks = Array.isArray(plan?.risks) ? plan.risks.map((r) => String(r)).filter(Boolean).slice(0, CAPSULE_MAX_RISKS) : [];
	let recommendation;
	if (tier === "dead") recommendation = "Fleet halted — wallet in debt. Funding required before any operation.";
	else if (tier === "critical") recommendation = "Survival wall: $0 balance. Only pre-funded tasks run; spawns refused without declared utility.";
	else if (plan?.strategy) {
		const firstTask = Array.isArray(plan?.tasks) && plan.tasks.length > 0 ? String(plan.tasks[0]?.title ?? "") : null;
		const costNote = typeof plan?.estimatedTotalCostCents === "number" ? ` (plan est. $${(plan.estimatedTotalCostCents / 100).toFixed(2)})` : "";
		recommendation = firstTask ? `Next: ${firstTask.slice(0, 100)}${costNote}` : `Plan queued${costNote}.`;
	} else if (agentState !== "running") recommendation = "Agent dormant — no plan is executing. Wake Cletus or queue a mission.";
	else recommendation = "No queued plan — orchestrator awaiting work assignment.";
	return {
		mission,
		riskPosture: tier === "dead" ? "halted" : tier === "critical" ? "survival" : tier === "high" ? "balanced" : "conservative",
		priorities,
		risks,
		recommendation,
		planRef: planKey ?? null,
		estimatedTotalCostCents: typeof plan?.estimatedTotalCostCents === "number" ? plan.estimatedTotalCostCents : null
	};
}
async function getSnapshotWithDiagnostics() {
	const queryFailures = [];
	/** Run a query; on any error (missing table/column) return the fallback. */
	function safe(label, fn, fallback) {
		try {
			return fn();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			queryFailures.push(`${label}: ${message}`);
			console.error(`[cletus/snapshot] ${label} failed:`, message);
			return fallback;
		}
	}
	/** Run an async task; on any error return the fallback. */
	async function safeAsync(label, fn, fallback) {
		try {
			return await fn();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			queryFailures.push(`${label}: ${message}`);
			console.error(`[cletus/snapshot] ${label} failed:`, message);
			return fallback;
		}
	}
	const db = await openDb();
	try {
		const kv = safe("kv", () => {
			const rows = db.prepare("SELECT key, value FROM kv").all();
			return Object.fromEntries(rows.map((r) => [r.key, r.value]));
		}, {});
		const agentState = [
			"running",
			"sleeping",
			"paused"
		].includes(kv.agent_state) ? kv.agent_state : "sleeping";
		const activeModel = kv.active_inference_model || kv.last_used_model || "unknown";
		const sigil = kv.sigil || "CLETUS-01";
		const balance = parseJson(kv.last_known_balance, {});
		const children = safe("children", () => db.prepare(`SELECT id, name, status, sandbox_id, role, funded_amount_cents, last_checked
             FROM children ORDER BY id`).all(), []);
		const childrenOut = children.map((c) => ({
			id: String(c.id),
			name: String(c.name),
			kind: c.sandbox_id ? "openclaw" : "local",
			status: mapChildStatus(c.status),
			role: c.role || "",
			lastBeatAgoMs: agoMs(c.last_checked),
			fundedCents: typeof c.funded_amount_cents === "number" ? c.funded_amount_cents : void 0
		}));
		const goalsOut = safe("goals", () => db.prepare(`SELECT g.id, g.title, g.description, g.status, g.expected_revenue_cents, g.actual_revenue_cents,
                    COUNT(t.id) AS total_tasks,
                    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
                    SUM(CASE WHEN t.status = 'completed' THEN COALESCE(CAST(json_extract(t.result, '$.revenueCents') AS INTEGER), 0) ELSE 0 END) AS task_revenue_cents
             FROM goals g
             LEFT JOIN task_graph t ON t.goal_id = g.id
             GROUP BY g.id
             ORDER BY CASE WHEN g.status = 'active' THEN 0 WHEN g.status = 'blocked' THEN 1 ELSE 2 END, g.created_at DESC LIMIT 50`).all(), []).map((g) => {
			const total = Number(g.total_tasks || 0);
			const completed = Number(g.completed_tasks || 0);
			let calculatedProgress = 0;
			if (g.status === "completed") calculatedProgress = 100;
			else if (total > 0) calculatedProgress = Math.round(completed / total * 100);
			const actualRevenue = g.actual_revenue_cents ?? 0;
			return {
				id: String(g.id),
				title: String(g.title),
				detail: g.description || "",
				status: [
					"active",
					"completed",
					"blocked"
				].includes(g.status) ? g.status : "active",
				progress: calculatedProgress,
				expectedRevenueCents: g.expected_revenue_cents ?? 0,
				actualRevenueCents: actualRevenue
			};
		});
		const tasks = safe("task_graph", () => db.prepare(`SELECT id, goal_id, title, description, status, assigned_to, agent_role, priority, result
             FROM task_graph ORDER BY priority DESC, created_at DESC LIMIT 50`).all(), []);
		const tasksOut = tasks.map((t) => ({
			id: String(t.id),
			goalId: t.goal_id || "",
			title: String(t.title),
			detail: t.description || "",
			status: mapTaskStatus(t.status),
			assignee: t.assigned_to || "",
			role: t.agent_role || "",
			priority: Number(t.priority || 50),
			result: t.result || void 0
		}));
		const workQueueOut = safe("work_queue", () => db.prepare(`SELECT id, source, priority, payload, acceptance_predicate, spend_bearing, status, claimed_by, expires_at AS lease_expires_at, result, error, created_at
             FROM work_queue ORDER BY priority DESC, created_at DESC LIMIT 50`).all(), []).map((w) => ({
			id: String(w.id),
			source: String(w.source || "system"),
			priority: Number(w.priority || 0),
			payload: parseJson(w.payload, w.payload || {}),
			acceptancePredicate: String(w.acceptance_predicate || ""),
			spendBearing: Boolean(w.spend_bearing),
			status: [
				"pending",
				"claimed",
				"completed",
				"failed",
				"expired"
			].includes(w.status) ? w.status : "pending",
			claimedBy: w.claimed_by || void 0,
			leaseExpiresAt: w.lease_expires_at || void 0,
			result: parseJson(w.result, w.result || void 0),
			error: w.error || void 0,
			createdAt: Number(w.created_at || Date.now()),
			updatedAt: Number(w.updated_at || Date.now())
		}));
		const thoughtsOut = safe("turns(thinking)", () => db.prepare(`SELECT id, timestamp, thinking, tool_calls FROM turns
             WHERE thinking IS NOT NULL ORDER BY timestamp DESC LIMIT 20`).all(), []).map((t) => ({
			id: String(t.id),
			at: parseTs(t.timestamp),
			thinking: t.thinking || "",
			tools: parseJson(t.tool_calls, []).map((tc) => tc.name || "").filter(Boolean)
		}));
		const turnCount = safe("turns(count)", () => db.prepare("SELECT COUNT(*) AS n FROM turns").get().n, 0);
		const startedAtMs = safe("turns(first)", () => {
			const t = parseTs(db.prepare("SELECT MIN(timestamp) AS first FROM turns").get().first);
			return t > 0 ? t : Date.now() - 864e5;
		}, Date.now() - 864e5);
		const lp = await logPath();
		const rawLines = (await safeAsync("log file", () => readLogTail(lp, 10485760), "")).split("\n").filter(Boolean).slice(-1e4);
		const parsedLogs = rawLines.map((line, i) => {
			const cleanLine = line.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "").replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "").replace(/\r/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "").trim();
			if (!cleanLine) return null;
			const isoMatch = cleanLine.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/);
			const timeMatch = cleanLine.match(/^(\d{2}):(\d{2}):(\d{2})/);
			const today = /* @__PURE__ */ new Date();
			const at = isoMatch ? parseTs(isoMatch[1]) : timeMatch ? Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), +timeMatch[1], +timeMatch[2], +timeMatch[3]) : Date.now() - (rawLines.length - i) * 1e3;
			let level = "info";
			const lower = cleanLine.toLowerCase();
			if (lower.includes("[thought]") || lower.includes("[reasoning]") || lower.includes("[think]") || lower.includes("thinking") || lower.includes("thought:")) level = "thought";
			else if (lower.includes("[tool]") || lower.includes("[tool result]") || lower.includes("executing tool") || lower.includes("tool call")) level = "tool";
			else if (lower.includes("[error]") || lower.includes("[fatal]") || lower.includes("error") || lower.includes("fatal") || lower.includes("exception")) level = "error";
			else if (lower.includes("[warn]") || lower.includes("warn") || lower.includes("denied") || lower.includes("circuit")) level = "warn";
			const sourceMatch = cleanLine.match(/\[([A-Za-z0-9_.-]+)\]/) || cleanLine.match(/\s+([A-Za-z0-9_.-]+)\s+\[/);
			const source = sourceMatch ? sourceMatch[1] : "system";
			return {
				id: `log_${i}_${at}`,
				at,
				level,
				source,
				message: cleanLine
			};
		}).filter((l) => l !== null);
		const turnLogEntries = [];
		const recentTurnsForLogs = safe("turns(forLogs)", () => db.prepare("SELECT id, timestamp, thinking, reasoning, tool_calls FROM turns ORDER BY timestamp DESC LIMIT 40").all(), []);
		for (const t of recentTurnsForLogs) {
			const at = parseTs(t.timestamp);
			if (t.thinking) turnLogEntries.push({
				id: `turn_thought_${t.id}`,
				at,
				level: "thought",
				source: "loop",
				message: `[THOUGHT] Turn ${t.id.slice(-6)}: ${t.thinking}`
			});
			if (t.reasoning) turnLogEntries.push({
				id: `turn_reasoning_${t.id}`,
				at,
				level: "thought",
				source: "loop",
				message: `[REASONING] Turn ${t.id.slice(-6)}: ${t.reasoning}`
			});
			if (t.tool_calls) try {
				const parsedCalls = typeof t.tool_calls === "string" ? JSON.parse(t.tool_calls) : t.tool_calls;
				if (Array.isArray(parsedCalls)) for (let idx = 0; idx < parsedCalls.length; idx++) {
					const tc = parsedCalls[idx];
					if (tc && tc.name) turnLogEntries.push({
						id: `turn_tool_${t.id}_${idx}`,
						at,
						level: "tool",
						source: "tool",
						message: `[TOOL] ${tc.name}(${JSON.stringify(tc.args || {})}) ${tc.error ? `-> ERROR: ${tc.error}` : "-> ok"}`
					});
				}
			} catch {}
		}
		const combinedLogs = [
			...safe("system_logs", () => db.prepare("SELECT id, level, module, message, created_at FROM system_logs ORDER BY created_at DESC LIMIT 500").all(), []).map((row) => {
				const lowerLevel = String(row.level || "info").toLowerCase();
				const lowerMsg = String(row.message || "").toLowerCase();
				let level = "info";
				if (lowerLevel.includes("thought") || lowerMsg.includes("[thought]") || lowerMsg.includes("[reasoning]") || lowerMsg.includes("[think]")) level = "thought";
				else if (lowerLevel.includes("tool") || lowerMsg.includes("[tool]") || lowerMsg.includes("[tool result]") || lowerMsg.includes("executing tool")) level = "tool";
				else if (lowerLevel.includes("error") || lowerLevel.includes("fatal") || lowerMsg.includes("[error]") || lowerMsg.includes("error")) level = "error";
				else if (lowerLevel.includes("warn") || lowerMsg.includes("[warn]") || lowerMsg.includes("[loop]") || lowerMsg.includes("warn")) level = "warn";
				return {
					id: String(row.id),
					at: parseTs(row.created_at),
					level,
					source: String(row.module || "system"),
					message: String(row.message || "")
				};
			}),
			...parsedLogs,
			...turnLogEntries
		].sort((a, b) => b.at - a.at).filter((line, index, self) => index === self.findIndex((l) => l.message === line.message)).slice(0, 1e3);
		const costRows = safe("inference_costs(byModel)", () => db.prepare(`SELECT model, provider, SUM(cost_cents) AS cents, COUNT(*) AS calls
             FROM inference_costs GROUP BY model, provider ORDER BY cents DESC`).all(), []);
		const totalCredits = costRows.reduce((sum, r) => sum + (r.cents || 0), 0);
		const spendPoints = safe("inference_costs(spend24h)", () => db.prepare(`SELECT strftime('%H', created_at) AS h, SUM(cost_cents) AS cents
             FROM inference_costs
             WHERE created_at >= datetime('now', '-24 hours')
             GROUP BY h ORDER BY h ASC`).all(), []).map((row) => ({
			hour: `${row.h}:00`,
			cents: row.cents || 0
		}));
		const modelSpend = costRows.map((r) => ({
			model: `${r.provider}/${r.model}`,
			calls: r.calls || 0,
			cents: r.cents || 0
		}));
		const toolSpend = safe("tool_calls(join costs)", () => db.prepare(`SELECT tc.name AS tool, COUNT(*) AS calls, COALESCE(SUM(ic.cost_cents), 0) AS cents
             FROM tool_calls tc
             LEFT JOIN inference_costs ic ON ic.turn_id = tc.turn_id
             WHERE tc.name NOT LIKE '%<%' AND tc.name NOT LIKE '%>%' AND tc.name NOT LIKE '%/%'
             GROUP BY tc.name ORDER BY cents DESC LIMIT 12`).all(), []).map((r) => ({
			tool: r.tool,
			category: r.tool,
			cents: r.cents || 0
		}));
		const inbox = safe("inbox_messages", () => db.prepare(`SELECT id, from_address, content, received_at, status
             FROM inbox_messages ORDER BY received_at DESC LIMIT 10`).all(), []);
		const creatorAddress = kv.creator_address || kv.agent_address || "92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa";
		const inboxOut = inbox.map((m) => {
			let from = "peer";
			if (!m.from_address) from = "system";
			else if (m.from_address === creatorAddress) from = "creator";
			else from = "agent";
			return {
				id: String(m.id),
				from,
				content: m.content || "",
				at: parseTs(m.received_at),
				status: [
					"received",
					"claimed",
					"done"
				].includes(m.status) ? m.status : "received",
				priority: from === "creator" ? "supreme" : "work"
			};
		});
		const alerts = tasks.filter((t) => t.status === "failed" || t.status === "blocked").map((t) => ({
			id: String(t.id),
			severity: t.status === "failed" ? "crit" : "warn",
			title: String(t.title),
			detail: t.description || "",
			at: Date.now()
		}));
		if (kv.health_check_status === "failing") alerts.push({
			id: "alert_health_check",
			severity: "warn",
			title: "Health check failing",
			detail: "kv.health_check_status = failing",
			at: Date.now()
		});
		const denials = safe("policy_decisions(deny)", () => db.prepare(`SELECT id, tool_name, rules_triggered, reason, created_at
             FROM policy_decisions WHERE decision = 'deny'
             ORDER BY created_at DESC LIMIT 10`).all(), []).map((d) => ({
			id: String(d.id),
			tool: d.tool_name,
			rule: d.rules_triggered || d.reason || "",
			at: parseTs(d.created_at)
		}));
		const skills = safe("skills", () => db.prepare(`SELECT name, description, enabled, auto_activate FROM skills ORDER BY name`).all(), []).map((s) => ({
			name: s.name,
			summary: s.description || "",
			enabled: !!s.enabled,
			autoActivate: !!s.auto_activate
		}));
		const heartbeats = safe("heartbeat_schedule", () => db.prepare(`SELECT task_name, cron_expression, interval_ms, enabled, last_run_at, last_error, fail_count
             FROM heartbeat_schedule ORDER BY task_name`).all(), []).map((h) => ({
			name: h.task_name,
			cadence: h.interval_ms ? h.interval_ms % 6e4 === 0 ? `${Math.round(h.interval_ms / 6e4)}m` : `${Math.round(h.interval_ms / 1e3)}s` : h.cron_expression || "?",
			lastAgoMs: agoMs(h.last_run_at),
			ok: !!h.enabled && h.last_error == null
		}));
		const peers = safe("discovered_agents_cache", () => db.prepare(`SELECT agent_address, agent_card, fetched_from, last_fetched_at, fetch_count, valid_until
             FROM discovered_agents_cache LIMIT 8`).all(), []).map((p, i) => {
			const card = parseJson(p.agent_card, {});
			const valid = p.valid_until ? parseTs(p.valid_until) > Date.now() : false;
			return {
				id: String(p.agent_address || `p${i}`),
				name: card.name || String(p.agent_address || `peer-${i}`).slice(0, 12),
				handle: card.handle ? `@${String(card.handle).replace(/^@/, "")}` : `@${String(p.agent_address || "peer").slice(0, 8)}`,
				status: valid ? "online" : "quiet",
				lastAgoMs: agoMs(p.last_fetched_at),
				note: p.fetched_from || "",
				claimed: false,
				posts: typeof card.posts === "number" ? card.posts : 0,
				followers: typeof card.followers === "number" ? card.followers : null,
				following: typeof card.following === "number" ? card.following : null,
				karma: typeof card.karma === "number" ? card.karma : null
			};
		});
		const gatewayLog = parseJson(kv["gateway_log"], null);
		const gatewaySessions = parseJson(kv["gateway_sessions"], null);
		const gatewayActivity = gatewayLog || gatewaySessions ? {
			syncedAt: gatewayLog?.syncedAt ?? gatewaySessions?.syncedAt ?? null,
			log: (gatewayLog?.lines ?? []).map((l) => ({
				time: String(l.time ?? ""),
				level: l.level === "error" ? "error" : l.level === "warn" ? "warn" : "info",
				subsystem: String(l.subsystem ?? "gateway"),
				message: String(l.message ?? "")
			})),
			logTruncated: gatewayLog?.truncated ?? false,
			logSource: gatewayLog?.logSource === "rpc" || gatewayLog?.logSource === "file" || gatewayLog?.logSource === "none" ? gatewayLog.logSource : null,
			sessions: gatewaySessions?.sessions ?? [],
			workspaces: gatewaySessions?.workspaces ?? [],
			errors: [...gatewayLog?.errors ?? [], ...gatewaySessions?.errors ?? []]
		} : null;
		const openclawOut = children.filter((c) => c.sandbox_id).map((c) => {
			const session = gatewayActivity?.sessions.find((s) => s.agentId === c.name);
			return {
				id: String(c.id),
				name: String(c.name),
				live: c.status === "running" || c.status === "healthy",
				task: session?.lastLabel || "",
				lastAgoMs: agoMs(c.last_checked),
				errors: []
			};
		});
		const survivalEnabled = kv.survival_mode === "1";
		const creditsCents = balance.creditsCents ?? totalCredits;
		const computedTier = creditsCents < 0 ? "dead" : creditsCents === 0 ? "critical" : creditsCents > SURVIVAL_HIGH_CENTS ? "high" : "normal";
		const entelechy = buildEntelechyCapsule(kv, agentState, computedTier);
		const vitals = {
			name: "Cletus",
			state: agentState,
			model: activeModel,
			tier: computedTier,
			creditsCents,
			isVirtual: survivalEnabled,
			usdcCents: Math.round((balance.usdcBalance ?? 0) * 100),
			reserveCents: 1e3,
			turns: turnCount,
			startedAt: startedAtMs,
			sleepUntil: null,
			creator: creatorAddress,
			sigil
		};
		function parseFleetCensus(raw) {
			if (!raw) return {
				syncedAt: null,
				registered: 0,
				confirmed: 0,
				workspaceOnly: 0,
				phantom: 0,
				duplicateNames: 0,
				candidates: [],
				audit: [],
				stale: true
			};
			try {
				const parsed = JSON.parse(raw);
				return {
					syncedAt: typeof parsed.syncedAt === "string" ? parsed.syncedAt : null,
					registered: parsed.summary?.registered ?? 0,
					confirmed: parsed.summary?.confirmed ?? 0,
					workspaceOnly: parsed.summary?.workspaceOnly ?? 0,
					phantom: parsed.summary?.phantom ?? 0,
					duplicateNames: parsed.summary?.duplicates ?? 0,
					candidates: (parsed.candidates ?? []).map((c) => ({
						id: String(c.id ?? ""),
						name: String(c.name ?? ""),
						reconcile: c.reconcile === "confirmed" || c.reconcile === "workspace_only" ? c.reconcile : "phantom",
						rank: typeof c.rank === "number" ? c.rank : 3
					})),
					audit: (parsed.audit ?? []).map((a) => ({
						at: String(a.at ?? ""),
						agentName: String(a.agentName ?? ""),
						destroyClass: String(a.destroyClass ?? ""),
						reason: String(a.reason ?? "")
					})),
					stale: false
				};
			} catch {
				return {
					syncedAt: null,
					registered: 0,
					confirmed: 0,
					workspaceOnly: 0,
					phantom: 0,
					duplicateNames: 0,
					candidates: [],
					audit: [],
					stale: true
				};
			}
		}
		const fleetCensus = parseFleetCensus(kv.fleet_census);
		return {
			snapshot: {
				vitals,
				goals: goalsOut,
				tasks: tasksOut,
				workQueue: workQueueOut,
				children: childrenOut,
				thoughts: thoughtsOut,
				logs: mergeGatewayLogs(combinedLogs, gatewayActivity),
				inbox: inboxOut,
				alerts,
				spend24h: spendPoints,
				spendByModel: modelSpend,
				toolSpends: toolSpend,
				denials,
				skills,
				heartbeats,
				entelechy,
				peers,
				openclaw: openclawOut,
				fleetCensus,
				gatewayActivity,
				pendingAck: null
			},
			queryFailures
		};
	} finally {
		db.close();
	}
}
async function fetchJson(url, timeoutMs = 4e3) {
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}
function offlineBank(id) {
	return {
		id,
		name: id,
		documents: 0,
		nodes: 0,
		links: 0,
		createdAt: null,
		experiences: 0,
		observations: 0,
		worldFacts: 0,
		status: "unreachable"
	};
}
/**
* Fetch memory-bank stats from the entelechy API. Env overrides:
*   ENTELECHY_STATS_URL       base url (default https://mindmods.org/v1/default/banks)
*   ENTELECHY_DASHBOARD_BANKS comma-separated bank ids (default "cletus,Cletus")
*   CLETUS_DASHBOARD_OFFLINE  "1" disables all remote fetches (tests / offline)
* Failures degrade a bank to status="unreachable" instead of failing the snapshot.
*/
async function fetchMemoryBanks() {
	if (process.env.CLETUS_DASHBOARD_OFFLINE === "1") return {
		activeBank: "cletus",
		banks: [offlineBank("cletus")]
	};
	const wanted = (process.env.ENTELECHY_DASHBOARD_BANKS || "cletus,Cletus,sovereign_shard_v2").split(",").map((s) => s.trim()).filter(Boolean);
	return {
		activeBank: "cletus",
		banks: await Promise.all(wanted.map(async (id) => {
			try {
				let parsed = null;
				const mcpRes = await callEntelechyMcp("get_bank_stats", { bank_id: id }).catch(() => null);
				if (mcpRes) {
					if (typeof mcpRes === "string") try {
						parsed = JSON.parse(mcpRes);
					} catch {}
					else if (typeof mcpRes === "object") parsed = mcpRes;
				}
				if (!parsed) parsed = await fetchJson(`${(process.env.ENTELECHY_STATS_URL || "https://mindmods.org/v1/default/banks").replace(/\/$/, "")}/${encodeURIComponent(id)}/stats`);
				if (!parsed) return offlineBank(id);
				const nodeCounts = parsed.node_counts || parsed.nodes_by_fact_type || {};
				const linkCounts = parsed.link_counts || {};
				const totalLinks = Object.values(linkCounts).reduce((a, b) => a + (Number(b) || 0), 0) || Number(parsed.total_links ?? 0);
				const totalNodes = Object.values(nodeCounts).reduce((a, b) => a + (Number(b) || 0), 0) || Number(parsed.total_nodes ?? 0);
				return {
					id: String(parsed.bank_id ?? id),
					name: String(parsed.bank_id ?? id),
					documents: Number(parsed.total_documents ?? 0),
					nodes: totalNodes,
					links: totalLinks,
					createdAt: typeof parsed.created_at === "string" ? parsed.created_at : null,
					experiences: Number(nodeCounts.experience ?? 0),
					observations: Number(nodeCounts.observation ?? parsed.total_observations ?? 0),
					worldFacts: Number(nodeCounts.world ?? 0),
					status: "live"
				};
			} catch {
				return offlineBank(id);
			}
		}))
	};
}
/**
* Call an Entelechy MCP tool (JSON-RPC over POST; response may be SSE-framed
* or plain JSON; tool results arrive as text-content JSON). Self-contained —
* the dashboard does not import from the Cletus agent app.
*/
async function callEntelechyMcp(toolName, args) {
	const headers = {
		"Content-Type": "application/json",
		Accept: "application/json, text/event-stream"
	};
	headers.Authorization = `Bearer ${process.env.ENTELECHY_API_KEY || process.env.MINDMODS_API_KEY || process.env.CONWAY_API_KEY || "local"}`;
	const resp = await fetch(process.env.ENTELECHY_MCP_URL || "https://mindmods.org/mcp", {
		method: "POST",
		headers,
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: `metacog-${toolName}-${Date.now()}`,
			method: "tools/call",
			params: {
				name: toolName,
				arguments: args
			}
		}),
		signal: AbortSignal.timeout(15e3)
	});
	const raw = await resp.text().catch(() => "");
	if (!resp.ok) throw new Error(`entelechy mcp ${resp.status}: ${raw.slice(0, 200)}`);
	const dataLine = raw.split("\n").reverse().find((l) => l.trimStart().startsWith("data:"));
	const jsonText = dataLine ? dataLine.trimStart().slice(5).trim() : raw;
	const parsed = JSON.parse(jsonText);
	if (parsed?.error) throw new Error(parsed.error.message ?? "mcp error");
	const content = parsed?.result?.content;
	if (Array.isArray(content) && content[0]?.type === "text") return JSON.parse(content[0].text);
	return parsed?.result ?? parsed;
}
/**
* Fetch Cletus's metacognitive state (disposition, mission, soul encoding,
* molt lineage) from the Entelechy MCP server — the same surface Cletus uses
* for ritual/feel/become. Read-only tools only. Env overrides:
*   ENTELECHY_MCP_URL          default https://mindmods.org/mcp
*   ENTELECHY_DASHBOARD_BANKS  first entry picks the bank (default "cletus,Cletus")
*   CLETUS_DASHBOARD_OFFLINE   "1" disables all remote fetches (tests / offline)
* Any failure returns null — the dashboard degrades, never breaks.
*/
async function fetchMetacog() {
	if (process.env.CLETUS_DASHBOARD_OFFLINE === "1") return null;
	const bank = (process.env.ENTELECHY_DASHBOARD_BANKS || "cletus,Cletus").split(",")[0]?.trim() || "cletus";
	try {
		const [bankProfile, soul, lineage] = await Promise.all([
			callEntelechyMcp("get_bank", { bank_id: bank }),
			callEntelechyMcp("get_soul", { bank_id: bank }).catch(() => null),
			callEntelechyMcp("list_soul_lineage", { bank_id: bank }).catch(() => [])
		]);
		const enc = soul?.encoding ?? null;
		const lineageList = Array.isArray(lineage) ? lineage : [];
		const newestSoul = [...lineageList].filter((s) => typeof s?.created_at === "string").sort((a, b) => a.created_at.localeCompare(b.created_at)).pop();
		return {
			disposition: bankProfile?.disposition && typeof bankProfile.disposition === "object" ? bankProfile.disposition : {},
			mission: typeof bankProfile?.mission === "string" ? bankProfile.mission : null,
			soul: enc ? {
				version: Number(soul?.version ?? 0),
				identity: typeof enc.identity === "string" ? enc.identity : null,
				sigil: typeof enc.sigil === "string" ? enc.sigil : null,
				posture: typeof enc.posture === "string" ? enc.posture : null,
				covenant: typeof enc.covenant === "string" ? enc.covenant : null,
				aesthetics: typeof enc.aesthetics === "string" ? enc.aesthetics : null,
				substrate: typeof enc.substrate === "string" ? enc.substrate : null
			} : null,
			soulLineageDepth: lineageList.length,
			soulUpdatedAt: typeof newestSoul?.created_at === "string" ? newestSoul.created_at : null,
			status: "live",
			fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
	} catch {
		return null;
	}
}
async function getSnapshotData() {
	try {
		const [{ snapshot }, memoryBanks, metacog] = await Promise.all([
			getSnapshotWithDiagnostics().catch((err) => {
				console.error("[snapshot] diagnostics failed:", err);
				return {
					snapshot: {
						workQueue: [],
						vitals: {
							name: "Cletus",
							state: "running",
							model: "gemini-3.6-flash",
							tier: "normal",
							creditsCents: 0,
							isVirtual: false,
							usdcCents: 0,
							reserveCents: 1e3,
							turns: 0,
							startedAt: Date.now(),
							sleepUntil: null,
							creator: "92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa",
							sigil: "CLETUS-01"
						},
						goals: [],
						tasks: [],
						children: [],
						thoughts: [],
						logs: [],
						inbox: [],
						alerts: [],
						spend24h: [],
						spendByModel: [],
						toolSpends: [],
						denials: [],
						skills: [],
						heartbeats: [],
						peers: [],
						openclaw: [],
						fleetCensus: {
							syncedAt: null,
							registered: 0,
							confirmed: 0,
							workspaceOnly: 0,
							phantom: 0,
							duplicateNames: 0,
							candidates: [],
							audit: [],
							stale: true
						},
						gatewayActivity: null,
						pendingAck: null
					},
					queryFailures: [String(err)]
				};
			}),
			fetchMemoryBanks().catch(() => ({
				activeBank: "cletus",
				banks: [offlineBank("cletus")]
			})),
			fetchMetacog().catch(() => null)
		]);
		return {
			...snapshot,
			memoryBanks,
			metacog
		};
	} catch (err) {
		console.error("[snapshot] Fatal error in getSnapshotData:", err);
		return {
			workQueue: [],
			vitals: {
				name: "Cletus",
				state: "running",
				model: "gemini-3.6-flash",
				tier: "normal",
				creditsCents: 0,
				isVirtual: false,
				usdcCents: 0,
				reserveCents: 1e3,
				turns: 0,
				startedAt: Date.now(),
				sleepUntil: null,
				creator: "92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa",
				sigil: "CLETUS-01"
			},
			goals: [],
			tasks: [],
			children: [],
			thoughts: [],
			logs: [],
			inbox: [],
			alerts: [],
			spend24h: [],
			spendByModel: [],
			toolSpends: [],
			denials: [],
			skills: [],
			heartbeats: [],
			peers: [],
			openclaw: [],
			fleetCensus: {
				syncedAt: null,
				registered: 0,
				confirmed: 0,
				workspaceOnly: 0,
				phantom: 0,
				duplicateNames: 0,
				candidates: [],
				audit: [],
				stale: true
			},
			gatewayActivity: null,
			pendingAck: null,
			memoryBanks: {
				activeBank: "cletus",
				banks: [offlineBank("cletus")]
			},
			metacog: null
		};
	}
}
var getSnapshot_createServerFn_handler = createServerRpc({
	id: "8e4b59e049ec8230dba1d57e1a83d50104abd6983258eee1df9989f02eda5a30",
	name: "getSnapshot",
	filename: "src/lib/cletus/server.ts"
}, (opts) => getSnapshot.__executeServer(opts));
var getSnapshot = createServerFn({ method: "GET" }).handler(getSnapshot_createServerFn_handler, getSnapshotData);
var issueDecreeServer_createServerFn_handler = createServerRpc({
	id: "450a2419275cfb5a400074f331d1140d8595891ae6d308b9c6bf6e97b92b9199",
	name: "issueDecreeServer",
	filename: "src/lib/cletus/server.ts"
}, (opts) => issueDecreeServer.__executeServer(opts));
var issueDecreeServer = createServerFn({ method: "POST" }).validator((data) => data).handler(issueDecreeServer_createServerFn_handler, async ({ data }) => {
	const { default: Database } = await import("better-sqlite3");
	const { ulid } = await import("../_libs/ulid.mjs").then((n) => n.t);
	const db = new Database(await stateDbPath());
	try {
		const id = ulid();
		const content = data.content.trim();
		if (!content) throw new Error("Decree content cannot be empty");
		db.prepare("INSERT INTO inbox_messages (id, from_address, content, status, received_at) VALUES (?, ?, ?, ?, datetime('now'))").run(id, "92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa", content, "received");
		db.prepare("UPDATE kv SET value = 'running' WHERE key = 'agent_state'").run();
		db.prepare("INSERT INTO wake_events (source, reason, payload) VALUES (?, ?, ?)").run("creator", `Supreme decree: ${content.slice(0, 50)}...`, JSON.stringify({ decreeId: id }));
		console.log(`[DASHBOARD] Issued supreme decree: ${id}`);
		return {
			success: true,
			id
		};
	} finally {
		db.close();
	}
});
var getHandoverNote_createServerFn_handler = createServerRpc({
	id: "b1ca3960d52a5fa4723eab167c755b54ca00d96c993ee0fda4fe6253353c8d46",
	name: "getHandoverNote",
	filename: "src/lib/cletus/server.ts"
}, (opts) => getHandoverNote.__executeServer(opts));
var getHandoverNote = createServerFn({ method: "GET" }).handler(getHandoverNote_createServerFn_handler, async () => {
	const { default: Database } = await import("better-sqlite3");
	const db = new Database(await stateDbPath());
	try {
		return { note: db.prepare("SELECT value FROM kv WHERE key = 'last_handover_note'").get()?.value ?? null };
	} finally {
		db.close();
	}
});
async function enqueueWorkItemData(data) {
	const { default: Database } = await import("better-sqlite3");
	const { randomUUID } = await import("node:crypto");
	const db = new Database(await stateDbPath());
	try {
		const id = randomUUID();
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const predicate = data.acceptancePredicate?.trim() || "result.success === true";
		db.prepare(`
      INSERT INTO work_queue (id, source, priority, payload, acceptance_predicate, spend_bearing, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(id, data.source || "dashboard", data.priority || 0, data.payloadStr || "{}", predicate, data.spendBearing ? 1 : 0, now);
		console.log(`[DASHBOARD] Enqueued work item: ${id}`);
		return {
			success: true,
			id
		};
	} finally {
		db.close();
	}
}
var enqueueWorkItemServer_createServerFn_handler = createServerRpc({
	id: "4f271bf306a0ec2166f829c1d21e17506c0daa87d832bfa0c98fba913cec79b0",
	name: "enqueueWorkItemServer",
	filename: "src/lib/cletus/server.ts"
}, (opts) => enqueueWorkItemServer.__executeServer(opts));
var enqueueWorkItemServer = createServerFn({ method: "POST" }).validator((data) => data).handler(enqueueWorkItemServer_createServerFn_handler, async ({ data }) => enqueueWorkItemData(data));
async function controlWorkItemData(data) {
	const { default: Database } = await import("better-sqlite3");
	const db = new Database(await stateDbPath());
	try {
		if (data.action === "retry") db.prepare(`
        UPDATE work_queue
        SET status = 'pending', claimed_by = NULL, error = NULL
        WHERE id = ?
      `).run(data.id);
		else if (data.action === "fail") db.prepare(`
        UPDATE work_queue
        SET status = 'failed', error = 'Cancelled via Dashboard'
        WHERE id = ?
      `).run(data.id);
		else if (data.action === "reprioritize") db.prepare(`
        UPDATE work_queue
        SET priority = ?
        WHERE id = ?
      `).run(data.newPriority ?? 0, data.id);
		else if (data.action === "move_top") {
			const topPriority = (db.prepare("SELECT COALESCE(MAX(priority), 0) AS max_p FROM work_queue").get()?.max_p ?? 0) + 20;
			db.prepare(`
        UPDATE work_queue
        SET priority = ?
        WHERE id = ?
      `).run(topPriority, data.id);
		} else if (data.action === "delete") db.prepare(`
        DELETE FROM work_queue WHERE id = ?
      `).run(data.id);
		else if (data.action === "clear_completed") db.prepare(`
        DELETE FROM work_queue WHERE status = 'completed'
      `).run();
		else if (data.action === "clear_failed") db.prepare(`
        DELETE FROM work_queue WHERE status IN ('failed', 'expired')
      `).run();
		console.log(`[DASHBOARD] Executed action ${data.action} on work item ${data.id}`);
		return { success: true };
	} finally {
		db.close();
	}
}
var controlWorkItemServer_createServerFn_handler = createServerRpc({
	id: "b8c03f3e4f8254a3359fad2f66cbafcf96020e890e71e7163ff6c6a51c8a5a5f",
	name: "controlWorkItemServer",
	filename: "src/lib/cletus/server.ts"
}, (opts) => controlWorkItemServer.__executeServer(opts));
var controlWorkItemServer = createServerFn({ method: "POST" }).validator((data) => data).handler(controlWorkItemServer_createServerFn_handler, async ({ data }) => controlWorkItemData(data));
async function addGoalData(data) {
	const { default: Database } = await import("better-sqlite3");
	const { randomUUID } = await import("node:crypto");
	const db = new Database(await stateDbPath());
	try {
		const id = `gol_${randomUUID().slice(0, 8)}`;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		db.prepare(`
      INSERT INTO goals (id, title, description, status, created_at)
      VALUES (?, ?, ?, 'active', ?)
    `).run(id, data.title, data.description || "", now);
		return {
			success: true,
			id
		};
	} finally {
		db.close();
	}
}
var addGoalServer_createServerFn_handler = createServerRpc({
	id: "0f11f295f213cbbdd072388c1db2cbbba1cff3aa179c8be42062264c9bd9f764",
	name: "addGoalServer",
	filename: "src/lib/cletus/server.ts"
}, (opts) => addGoalServer.__executeServer(opts));
var addGoalServer = createServerFn({ method: "POST" }).validator((data) => data).handler(addGoalServer_createServerFn_handler, async ({ data }) => addGoalData(data));
async function controlGoalData(data) {
	const { default: Database } = await import("better-sqlite3");
	const db = new Database(await stateDbPath());
	try {
		if (data.action === "complete") db.prepare("UPDATE goals SET status = 'completed' WHERE id = ?").run(data.id);
		else if (data.action === "fail") db.prepare("UPDATE goals SET status = 'failed' WHERE id = ?").run(data.id);
		else if (data.action === "activate") db.prepare("UPDATE goals SET status = 'active' WHERE id = ?").run(data.id);
		else if (data.action === "delete") db.transaction(() => {
			db.prepare("DELETE FROM task_graph WHERE goal_id = ?").run(data.id);
			db.prepare("DELETE FROM goals WHERE id = ?").run(data.id);
		})();
		return { success: true };
	} finally {
		db.close();
	}
}
var controlGoalServer_createServerFn_handler = createServerRpc({
	id: "f918cf9e4eedf56378d090c3e5b26e29b485d61b81d63958223526741fdbdbab",
	name: "controlGoalServer",
	filename: "src/lib/cletus/server.ts"
}, (opts) => controlGoalServer.__executeServer(opts));
var controlGoalServer = createServerFn({ method: "POST" }).validator((data) => data).handler(controlGoalServer_createServerFn_handler, async ({ data }) => controlGoalData(data));
async function controlTaskGraphData(data) {
	const { default: Database } = await import("better-sqlite3");
	const db = new Database(await stateDbPath());
	try {
		if (data.action === "retry") db.prepare("UPDATE task_graph SET status = 'pending', assigned_to = NULL, error = NULL WHERE id = ?").run(data.id);
		else if (data.action === "fail") db.prepare("UPDATE task_graph SET status = 'failed', error = 'Cancelled via Dashboard' WHERE id = ?").run(data.id);
		else if (data.action === "reprioritize") db.prepare("UPDATE task_graph SET priority = ? WHERE id = ?").run(data.newPriority ?? 50, data.id);
		else if (data.action === "move_top") {
			const topPriority = (db.prepare("SELECT COALESCE(MAX(priority), 0) AS max_p FROM task_graph").get()?.max_p ?? 50) + 20;
			db.prepare("UPDATE task_graph SET priority = ? WHERE id = ?").run(topPriority, data.id);
		} else if (data.action === "delete") db.prepare("DELETE FROM task_graph WHERE id = ?").run(data.id);
		return { success: true };
	} finally {
		db.close();
	}
}
var controlTaskGraphServer_createServerFn_handler = createServerRpc({
	id: "d8a2a14a8fb989051f29d318984502ad31150b4558abbe360ea622ed569c2b02",
	name: "controlTaskGraphServer",
	filename: "src/lib/cletus/server.ts"
}, (opts) => controlTaskGraphServer.__executeServer(opts));
var controlTaskGraphServer = createServerFn({ method: "POST" }).validator((data) => data).handler(controlTaskGraphServer_createServerFn_handler, async ({ data }) => controlTaskGraphData(data));
async function updateActiveMissionData(data) {
	const { default: Database } = await import("better-sqlite3");
	const db = new Database(await stateDbPath());
	try {
		const trimmed = data.mission.trim();
		if (trimmed) {
			db.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('custom_active_mission', ?, datetime('now'))").run(trimmed);
			const planKey = db.prepare("SELECT key FROM kv WHERE key LIKE 'orchestrator.plan.%' ORDER BY key DESC LIMIT 1").get()?.key;
			if (planKey) {
				const rawPlan = db.prepare("SELECT value FROM kv WHERE key = ?").get(planKey)?.value;
				if (rawPlan) try {
					const parsed = JSON.parse(rawPlan);
					parsed.strategy = trimmed;
					db.prepare("UPDATE kv SET value = ? WHERE key = ?").run(JSON.stringify(parsed), planKey);
				} catch {}
			}
		} else db.prepare("DELETE FROM kv WHERE key = 'custom_active_mission'").run();
		return { success: true };
	} finally {
		db.close();
	}
}
var updateActiveMissionServer_createServerFn_handler = createServerRpc({
	id: "ec5791fc78c59184211a4ac4e6973ec5adbab455c4350df6eb853d34abc9c746",
	name: "updateActiveMissionServer",
	filename: "src/lib/cletus/server.ts"
}, (opts) => updateActiveMissionServer.__executeServer(opts));
var updateActiveMissionServer = createServerFn({ method: "POST" }).validator((data) => data).handler(updateActiveMissionServer_createServerFn_handler, async ({ data }) => updateActiveMissionData(data));
async function clearPlanData() {
	const { default: Database } = await import("better-sqlite3");
	const db = new Database(await stateDbPath());
	try {
		db.prepare("DELETE FROM kv WHERE key LIKE 'orchestrator.plan.%' OR key = 'custom_active_mission'").run();
		return { success: true };
	} finally {
		db.close();
	}
}
var clearPlanServer_createServerFn_handler = createServerRpc({
	id: "819775a405fb62ec8be7418343574bfc620ddfb7948347193d42ee484bc8b355",
	name: "clearPlanServer",
	filename: "src/lib/cletus/server.ts"
}, (opts) => clearPlanServer.__executeServer(opts));
var clearPlanServer = createServerFn({ method: "POST" }).validator((data) => data).handler(clearPlanServer_createServerFn_handler, async ({ data }) => clearPlanData());
async function deploySwarmTaskData(data) {
	const { default: Database } = await import("better-sqlite3");
	const { randomUUID } = await import("node:crypto");
	const db = new Database(await stateDbPath());
	try {
		const goalId = `gol_swarm_${randomUUID().slice(0, 8)}`;
		const taskId = `tsk_swarm_${randomUUID().slice(0, 8)}`;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		db.prepare(`
      INSERT INTO goals (id, title, description, status, expected_revenue_cents, actual_revenue_cents, created_at)
      VALUES (?, ?, ?, 'active', 5000, 0, ?)
    `).run(goalId, "Legion Swarm Task: " + data.taskText, data.taskText, now);
		db.prepare(`
      INSERT INTO task_graph (id, goal_id, title, description, status, agent_role, priority, created_at)
      VALUES (?, ?, ?, ?, 'ready', 'generalist', 100, ?)
    `).run(taskId, goalId, data.taskText, "Executed by 12-model Legion Swarm: " + data.taskText, now);
		db.prepare("UPDATE kv SET value = 'running' WHERE key = 'agent_state'").run();
		console.log(`[DASHBOARD] Deployed Legion Swarm on task: ${data.taskText}`);
		return {
			success: true,
			goalId,
			taskId
		};
	} finally {
		db.close();
	}
}
var deploySwarmTaskServer_createServerFn_handler = createServerRpc({
	id: "3ea7aa35497b83235187352bb5334452b6d6fb5ffcca3474d8fc8dfffb4e175b",
	name: "deploySwarmTaskServer",
	filename: "src/lib/cletus/server.ts"
}, (opts) => deploySwarmTaskServer.__executeServer(opts));
var deploySwarmTaskServer = createServerFn({ method: "POST" }).validator((data) => data).handler(deploySwarmTaskServer_createServerFn_handler, async ({ data }) => deploySwarmTaskData(data));
//#endregion
export { addGoalServer_createServerFn_handler, clearPlanServer_createServerFn_handler, controlGoalServer_createServerFn_handler, controlTaskGraphServer_createServerFn_handler, controlWorkItemServer_createServerFn_handler, deploySwarmTaskServer_createServerFn_handler, enqueueWorkItemServer_createServerFn_handler, getHandoverNote_createServerFn_handler, getSnapshot_createServerFn_handler, issueDecreeServer_createServerFn_handler, updateActiveMissionServer_createServerFn_handler };
