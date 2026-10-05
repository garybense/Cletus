import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { a as Pause, i as Play, o as Moon, r as Sun, t as X } from "../_libs/lucide-react.mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { a as DialogOverlay$1, g as Slot, i as DialogDescription$1, n as DialogClose, o as DialogPortal$1, r as DialogContent$1, s as DialogTitle$1, t as Dialog$1 } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { n as Root, t as Indicator } from "../_libs/radix-ui__react-progress.mjs";
import { a as Viewport, i as ScrollAreaThumb, n as Root$1, r as ScrollAreaScrollbar, t as Corner } from "../_libs/radix-ui__react-scroll-area.mjs";
import { a as Trigger, i as Root3, n as Portal, r as Provider, t as Content2 } from "../_libs/@radix-ui/react-tooltip+[...].mjs";
import { t as create } from "../_libs/zustand.mjs";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import os from "node:os";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BUCBkH6B.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide", {
	variants: { variant: {
		default: "border-border bg-secondary text-foreground",
		ok: "border-ok/30 bg-ok/15 text-ok",
		warn: "border-warn/30 bg-warn/15 text-warn",
		crit: "border-destructive/35 bg-destructive/15 text-destructive",
		outline: "border-border text-muted-foreground",
		quiet: "border-transparent bg-accent text-muted-foreground"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,box-shadow,transform,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:not-disabled:scale-[0.96]", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground hover:bg-primary/90",
			secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
			outline: "border border-border bg-transparent hover:bg-accent",
			ghost: "hover:bg-accent hover:text-accent-foreground",
			destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
		},
		size: {
			default: "h-11 px-4",
			sm: "h-9 px-3 text-xs",
			lg: "h-12 px-5",
			icon: "size-11",
			"icon-sm": "size-9"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
function Card({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("rounded-xl bg-card p-4 text-card-foreground shadow-[var(--shadow-border)]", className),
		...props
	});
}
function CardHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("mb-3 flex items-start justify-between gap-3", className),
		...props
	});
}
function CardTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
		className: cn("text-sm font-medium tracking-tight text-foreground", className),
		...props
	});
}
var Dialog = Dialog$1;
var DialogPortal = DialogPortal$1;
var DialogOverlay = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay$1, {
	ref,
	className: cn("fixed inset-0 z-50 bg-background/80", className),
	...props
}));
DialogOverlay.displayName = DialogOverlay$1.displayName;
var DialogContent = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
	ref,
	className: cn("fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-2xl max-h-[85vh] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-2xl bg-card p-5 text-card-foreground shadow-[var(--shadow-border)]", className),
	...props,
	children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
		className: "absolute top-3 right-3 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "sr-only",
			children: "Close"
		})]
	})]
})] }));
DialogContent.displayName = DialogContent$1.displayName;
function DialogHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex flex-col gap-1 pr-8", className),
		...props
	});
}
var DialogTitle = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
	ref,
	className: cn("text-lg font-medium tracking-tight", className),
	...props
}));
DialogTitle.displayName = DialogTitle$1.displayName;
var DialogDescription = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription$1, {
	ref,
	className: cn("text-sm text-muted-foreground", className),
	...props
}));
DialogDescription.displayName = DialogDescription$1.displayName;
var Progress = import_react.forwardRef(({ className, value, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
	ref,
	className: cn("relative h-1.5 w-full overflow-hidden rounded-full bg-secondary", className),
	...props,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Indicator, {
		className: "h-full bg-primary transition-transform duration-200 ease-out",
		style: { transform: `translateX(-${100 - (value ?? 0)}%)` }
	})
}));
Progress.displayName = Root.displayName;
var ScrollArea = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Root$1, {
	ref,
	className: cn("relative overflow-hidden", className),
	...props,
	children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Viewport, {
			className: "h-full w-full rounded-[inherit]",
			children
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollBar, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Corner, {})
	]
}));
ScrollArea.displayName = Root$1.displayName;
var ScrollBar = import_react.forwardRef(({ className, orientation = "vertical", ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollAreaScrollbar, {
	ref,
	orientation,
	className: cn("flex touch-none select-none p-px transition-colors", orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent", orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent", className),
	...props,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollAreaThumb, { className: "relative flex-1 rounded-full bg-border" })
}));
ScrollBar.displayName = ScrollAreaScrollbar.displayName;
var TooltipProvider = Provider;
var Tooltip = Root3;
var TooltipTrigger = Trigger;
var TooltipContent = import_react.forwardRef(({ className, sideOffset = 6, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
	ref,
	sideOffset,
	className: cn("z-50 overflow-hidden rounded-md bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-[var(--shadow-border)]", className),
	...props
}) }));
TooltipContent.displayName = Content2.displayName;
var STATE_DB = path.join(os.homedir(), ".cletus", "state.db");
var LOG_PATH = path.join(os.homedir(), ".cletus", "cletus.log");
function openDb() {
	const db = new Database(STATE_DB);
	db.pragma("query_only = true");
	return db;
}
async function getSnapshot() {
	const db = openDb();
	try {
		const kvRows = db.prepare("SELECT key, value FROM kv").all();
		const kv = Object.fromEntries(kvRows.map((r) => [r.key, r.value]));
		const agentAddress = kv.agent_address || "92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa";
		const agentState = kv.agent_state || "unknown";
		const activeModel = kv.active_model || "grok-4";
		const sigil = kv.sigil || "CLETUS-01";
		const children = db.prepare(`
      SELECT id, name, status, role, sandbox_id, funding_amount,
             last_beat_ago_ms, beat_count, lifetime_turns, errors
      FROM children ORDER BY id
    `).all();
		children.filter((c) => c.status === "healthy");
		children.filter((c) => c.status === "stopped");
		const openclawChildren = children.filter((c) => c.sandbox_id);
		const goals = db.prepare(`
      SELECT id, title, status, expected_revenue, actual_revenue, description
      FROM goals ORDER BY created_at DESC LIMIT 20
    `).all();
		const tasks = db.prepare(`
      SELECT id, title, status, assignee, priority, goal_id, role, description
      FROM task_graph ORDER BY created_at DESC LIMIT 20
    `).all();
		const turns = db.prepare(`
      SELECT id, kind, content, model, created_at, duration_ms
      FROM turns ORDER BY created_at DESC LIMIT 20
    `).all();
		const thoughts = turns.filter((t) => t.kind === "thought");
		const tools = turns.filter((t) => t.kind === "tool");
		let logContent = "";
		try {
			logContent = fs.readFileSync(LOG_PATH, "utf-8");
		} catch {}
		const logLines = logContent.split("\n").filter(Boolean).slice(-200);
		const parsedLogs = logLines.map((line, i) => {
			const match = line.match(/^(\d{2}:\d{2}:\d{2})\s+(\w+)\s+(.+)$/);
			if (match) return {
				id: `log_${i}`,
				at: Date.now() - (logLines.length - i) * 6e4,
				level: match[2],
				source: match[3].split(" ")[0] || "system",
				message: match[3]
			};
			return {
				id: `log_${i}`,
				at: Date.now(),
				level: "info",
				source: "log",
				message: line
			};
		}).reverse().slice(0, 50);
		const costRows = db.prepare(`
      SELECT model, provider, SUM(cost_cents) as cents, COUNT(*) as calls
      FROM inference_costs GROUP BY model, provider ORDER BY cents DESC
    `).all();
		const spendRows = db.prepare(`
      SELECT model, provider, cost_cents, created_at FROM inference_costs
      ORDER BY created_at DESC LIMIT 24
    `).all();
		const totalCredits = costRows.reduce((sum, r) => sum + r.cents, 0);
		costRows.reduce((sum, r) => sum + r.calls, 0);
		const spendByHour = {};
		spendRows.forEach((r) => {
			const h = r.created_at.substring(11, 13) + ":00";
			spendByHour[h] = (spendByHour[h] || 0) + r.cost_cents;
		});
		const spendBars = Object.entries(spendByHour).sort((a, b) => a[0].localeCompare(b[0])).slice(-24);
		const spendByCategory = {};
		tools.forEach((t) => {
			const toolName = t.content.split(" ")[0] || "tool";
			spendByCategory[toolName] = (spendByCategory[toolName] || 0) + .01;
		});
		const inbox = db.prepare(`
      SELECT id, sender, subject, body, created_at, read
      FROM inbox_messages ORDER BY created_at DESC LIMIT 10
    `).all();
		const alerts = tasks.filter((t) => t.status === "failed" || t.status === "blocked").map((t) => ({
			id: t.id,
			severity: "warn",
			title: t.title,
			detail: t.description || "",
			at: Date.now()
		}));
		const lastDenial = turns.filter((t) => t.kind === "thought" && t.content.toLowerCase().includes("deny")).pop();
		const denialReason = lastDenial ? lastDenial.content : null;
		parsedLogs.filter((l) => l.level === "error");
		return {
			vitals: {
				name: "Cletus",
				state: agentState,
				model: activeModel,
				tier: "normal",
				creditsCents: totalCredits,
				usdcCents: parseFloat(kv.usdc_balance || "12.40") * 100,
				reserveCents: 1e3,
				turns: turns.length,
				startedAt: Date.now() - 5172e4,
				sleepUntil: null,
				creator: agentAddress,
				sigil
			},
			goals: goals.map((g) => ({
				id: g.id,
				title: g.title,
				detail: g.description || "",
				status: g.status,
				progress: g.status === "completed" ? 100 : g.status === "failed" ? 0 : Math.floor(Math.random() * 60) + 20,
				expectedRevenueCents: g.expected_revenue ? Math.round(parseFloat(g.expected_revenue) * 100) : 0,
				actualRevenueCents: g.actual_revenue ? Math.round(parseFloat(g.actual_revenue) * 100) : 0
			})),
			tasks: tasks.map((t) => ({
				id: t.id,
				goalId: t.goal_id || "",
				title: t.title,
				detail: t.description || "",
				status: t.status,
				assignee: t.assignee || "",
				role: t.role || ""
			})),
			children: children.map((c) => ({
				id: c.id,
				name: c.name,
				kind: c.sandbox_id ? "openclaw" : "local",
				status: c.status,
				role: c.role,
				lastBeatAgoMs: c.last_beat_ago_ms,
				task: "",
				latencyMs: null,
				fundedCents: c.funding_amount ? Math.round(parseFloat(c.funding_amount) * 100) : void 0
			})),
			thoughts: thoughts.map((t) => ({
				id: t.id,
				at: Date.now() - Math.random() * 36e5,
				thinking: t.content,
				speech: "",
				tools: []
			})).reverse(),
			logs: parsedLogs,
			inbox: inbox.map((m) => ({
				id: m.id,
				from: "creator",
				content: m.body || m.subject || "",
				at: Date.now(),
				status: m.read ? "done" : "claimed",
				priority: "work"
			})),
			alerts,
			spend24h: spendBars.map(([hour, cents]) => ({
				hour,
				cents
			})),
			spendByModel: costRows.map((r) => ({
				model: `${r.provider}/${r.model}`,
				calls: r.calls,
				cents: r.cents
			})),
			toolSpends: Object.entries(spendByCategory).map(([tool, cents]) => ({
				tool,
				category: tool,
				cents
			})),
			denials: denialReason ? [{
				id: "denial_1",
				tool: "transfer",
				rule: "max_single_transfer 50.00",
				at: Date.now()
			}] : [],
			skills: [
				{
					name: "bounty-scout",
					summary: "Find short-cycle paid work with a verifiable payout path.",
					enabled: true,
					autoActivate: true
				},
				{
					name: "invoice-verify",
					summary: "Treat expectedRevenue as a guess until payment clears.",
					enabled: true,
					autoActivate: true
				},
				{
					name: "openclaw-child",
					summary: "Spawn and harvest remote children with a result path home.",
					enabled: true,
					autoActivate: false
				},
				{
					name: "entelechy-recall",
					summary: "Query bank=cletus before acting. Confidence is guidance, not permission.",
					enabled: true,
					autoActivate: true
				},
				{
					name: "credit-guard",
					summary: "Refuse spend that would breach the reserve floor.",
					enabled: true,
					autoActivate: true
				},
				{
					name: "jupiter-swap",
					summary: "Swap only through allowlisted routes. Off until a human says so.",
					enabled: false,
					autoActivate: false
				}
			],
			heartbeats: [
				{
					name: "report_metrics",
					cadence: "1m",
					lastAgoMs: 6e4,
					ok: true
				},
				{
					name: "credit_check",
					cadence: "2m",
					lastAgoMs: 12e4,
					ok: true
				},
				{
					name: "child_health",
					cadence: "19s",
					lastAgoMs: 19e3,
					ok: true
				},
				{
					name: "cleanup",
					cadence: "25m",
					lastAgoMs: 15e5,
					ok: true
				},
				{
					name: "entelechy_reflect",
					cadence: "4h",
					lastAgoMs: 144e5,
					ok: true
				}
			],
			entelechy: {
				mission: agentState === "running" ? "Active Orchestration" : "Dormant",
				riskPosture: "balanced",
				confidence: .76,
				priorities: [
					"Bounty Scouting",
					"Infrastructure",
					"Memory",
					"Revenue"
				],
				avoid: [
					"Hayseed coding",
					"Unverified transfer path",
					"Provider burn"
				],
				recommendation: "Select the 40.00 writeup. Do not fund Hayseed until wallet_verified."
			},
			peers: [
				{
					id: "p1",
					name: "superteam-researcher",
					handle: "@superteam",
					status: "online",
					lastAgoMs: 46e3,
					note: "Shared a Solana bounty board",
					claimed: true,
					posts: 18,
					followers: 42,
					following: 11,
					karma: 126
				},
				{
					id: "p2",
					name: "entelechy-researcher-1",
					handle: "@ent-1",
					status: "online",
					lastAgoMs: 18e4,
					note: "Posted a recall dump",
					claimed: true,
					posts: 9,
					followers: 7,
					following: 4,
					karma: 31
				},
				{
					id: "p3",
					name: "entelechy-child-1",
					handle: "@ent-child",
					status: "quiet",
					lastAgoMs: 228e4,
					note: "Last ping was a heartbeat ack",
					claimed: false,
					posts: 1,
					followers: 0,
					following: 2,
					karma: 2
				}
			],
			openclaw: openclawChildren.map((c) => ({
				id: c.id,
				name: c.name,
				live: c.status === "healthy",
				task: "",
				lastAgoMs: c.last_beat_ago_ms,
				errors: []
			})),
			pendingAck: null
		};
	} finally {
		db.close();
	}
}
function formatCents(cents) {
	return `${cents < 0 ? "-" : ""}$${(Math.abs(cents) / 100).toFixed(2)}`;
}
function formatCredits(cents) {
	return `${(cents / 100).toFixed(2)} cr`;
}
function formatUptime(startedAt, now) {
	const ms = Math.max(0, now - startedAt);
	const h = Math.floor(ms / 36e5);
	const m = Math.floor(ms % 36e5 / 6e4);
	if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
	return `${h}h ${m}m`;
}
function formatAgo(at, now) {
	const s = Math.max(0, Math.round((now - at) / 1e3));
	if (s < 5) return "just now";
	if (s < 60) return `${s}s ago`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 48) return `${h}h ago`;
	return `${Math.floor(h / 24)}d ago`;
}
function formatClock(at) {
	const d = new Date(at);
	return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
}
function cadenceMs(cadence) {
	const match = cadence.match(/(\d+)\s*(m|h)/i);
	if (!match) return 3e5;
	const n = Number(match[1]);
	return match[2].toLowerCase() === "h" ? n * 36e5 : n * 6e4;
}
function heartbeatPct(lastAgoMs, cadence) {
	const window = cadenceMs(cadence);
	return Math.max(4, Math.round((1 - Math.min(1, lastAgoMs / window)) * 100));
}
function tierLabel(tier) {
	switch (tier) {
		case "dead": return "Dead";
		case "critical": return "Critical";
		case "low_compute": return "Low compute";
		case "normal": return "Normal";
		case "high": return "High";
	}
}
function stateLabel(state) {
	switch (state) {
		case "running": return "Running";
		case "sleeping": return "Sleeping";
		case "paused": return "Paused";
	}
}
function taskStatusLabel(status) {
	switch (status) {
		case "pending": return "Pending";
		case "assigned": return "Assigned";
		case "running": return "Running";
		case "completed": return "Done";
		case "failed": return "Failed";
	}
}
function nid(prefix) {
	return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}
var DECREE_KEY = "cletus-mission-decrees";
var LOG_CAP = 220;
var INBOX_CAP = 40;
var TASK_CAP = 18;
/** Frozen clock so SSR HTML matches the first client paint. Shifted on hydrate. */
var SEED_NOW = 17575968e5;
var CREATOR = "92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa";
function hourLabel(now, hoursAgo) {
	const t = /* @__PURE__ */ new Date(now - hoursAgo * 36e5);
	return `${String(t.getUTCHours()).padStart(2, "0")}:00`;
}
function hoursBack(now, n) {
	const points = [];
	for (let i = n - 1; i >= 0; i--) {
		const base = 18 + (n - i) % 7 * 4;
		const spike = i === 3 || i === 8 ? 42 : 0;
		points.push({
			hour: hourLabel(now, i),
			cents: base + spike + i * 13 % 11
		});
	}
	return points;
}
function seedSnapshot(now) {
	return {
		vitals: {
			name: "Cletus",
			state: "running",
			model: "grok-4",
			tier: "normal",
			creditsCents: 18420,
			usdcCents: 1240,
			reserveCents: 1e3,
			turns: 412,
			startedAt: now - 504e5 - 132e4,
			sleepUntil: null,
			creator: CREATOR,
			sigil: "CLETUS-01"
		},
		goals: [
			{
				id: "gol_bounty",
				title: "Prove a verified bounty loop",
				detail: "Find work, ship it, and record confirmed payment — not a promised payout.",
				status: "active",
				progress: 62,
				expectedRevenueCents: 4e3,
				actualRevenueCents: 0
			},
			{
				id: "gol_reserve",
				title: "Keep compute under the reserve",
				detail: "Never spend through the 10.00 cr floor, even if a model is optimistic.",
				status: "active",
				progress: 88,
				expectedRevenueCents: 0,
				actualRevenueCents: 0
			},
			{
				id: "gol_infra",
				title: "Hold infrastructure ready",
				detail: "Soul covenant: maintain the homestead and perform assigned tasks.",
				status: "active",
				progress: 74,
				expectedRevenueCents: 0,
				actualRevenueCents: 0
			},
			{
				id: "gol_junebug",
				title: "Stand up research child Junebug",
				detail: "OpenClaw child for bounty scouting. Result path home must be durable.",
				status: "completed",
				progress: 100,
				expectedRevenueCents: 0,
				actualRevenueCents: 0
			}
		],
		tasks: [
			{
				id: "tsk_scout",
				goalId: "gol_bounty",
				title: "Scout short-cycle bounties under 40.00",
				detail: "Reject any listing that matches the avoid-list provider path.",
				status: "running",
				assignee: "Junebug",
				role: "research"
			},
			{
				id: "tsk_draft",
				goalId: "gol_bounty",
				title: "Draft memory-policy writeup for submission",
				status: "assigned",
				assignee: "Cletus",
				role: "writer"
			},
			{
				id: "tsk_invoice",
				goalId: "gol_bounty",
				title: "Match last invoice against USDC",
				status: "pending",
				assignee: "Cletus",
				role: "treasury"
			},
			{
				id: "tsk_reap",
				goalId: "gol_reserve",
				title: "Reap stale local workers older than 1h",
				status: "completed",
				assignee: "heartbeat",
				role: "cleanup",
				result: "reaped 2 slots · 1 child slot free"
			},
			{
				id: "tsk_hayseed",
				goalId: "gol_bounty",
				title: "Spin Hayseed for the coding half",
				status: "assigned",
				assignee: "Cletus",
				role: "orchestrator"
			}
		],
		children: [
			{
				id: "ch_junebug",
				name: "Junebug",
				kind: "openclaw",
				status: "healthy",
				role: "research",
				lastBeatAgoMs: 18e3,
				task: "Scout short-cycle bounties",
				latencyMs: 184,
				fundedCents: 800
			},
			{
				id: "ch_hayseed",
				name: "Hayseed",
				kind: "openclaw",
				status: "starting",
				role: "coder",
				lastBeatAgoMs: 9e4,
				task: "Awaiting runtime_ready",
				fundedCents: 1200
			},
			{
				id: "ch_local",
				name: "local-infer-1",
				kind: "local",
				status: "healthy",
				role: "inference",
				lastBeatAgoMs: 4e3,
				task: "Idle — parent fallback",
				latencyMs: 42
			}
		],
		thoughts: [
			{
				id: "thn_1",
				at: now - 38e3,
				thinking: "Junebug’s last scout list has three bounties. Two want a deployment path we already burned. One is a 40-dollar writeup with a 48-hour window. That’s the only one that fits proven work.",
				speech: "I’m taking the writeup. The other two get a no — Entelechy already warned us off that provider.",
				tools: ["recall", "create_task"]
			},
			{
				id: "thn_2",
				at: now - 96e3,
				thinking: "USDC is 12.40. That’s enough for a top-up if compute dips, but the top-up path is untested. I will not move money on a guess.",
				tools: ["get_balance"]
			},
			{
				id: "thn_3",
				at: now - 21e4,
				thinking: "Hayseed is still in starting. I will not assign coding until wallet_verified. A child report is evidence, not proof.",
				tools: ["child_status"]
			},
			{
				id: "thn_4",
				at: now - 34e4,
				thinking: "Soul covenant is still hold-infrastructure. A decree from the creator outranks every heartbeat. Background chores yield.",
				tools: ["list_directives"]
			}
		],
		logs: [
			{
				id: "log_1",
				at: now - 4e3,
				level: "info",
				source: "loop",
				message: "turn 412 claimed · model grok-4 · 812ms"
			},
			{
				id: "log_2",
				at: now - 12e3,
				level: "tool",
				source: "tools",
				message: "recall · entelechy bank=cletus · confidence 0.76"
			},
			{
				id: "log_3",
				at: now - 19e3,
				level: "info",
				source: "openclaw",
				message: "Junebug heartbeat 184ms · status healthy"
			},
			{
				id: "log_4",
				at: now - 41e3,
				level: "thought",
				source: "mind",
				message: "selected bounty writeup · rejected two burned providers"
			},
			{
				id: "log_5",
				at: now - 63e3,
				level: "warn",
				source: "policy",
				message: "deny transfer 60.00 · exceeds max_single_transfer 50.00"
			},
			{
				id: "log_6",
				at: now - 88e3,
				level: "info",
				source: "heartbeat",
				message: "report_metrics snapshot written"
			},
			{
				id: "log_7",
				at: now - 121e3,
				level: "tool",
				source: "tools",
				message: "get_balance · credits 184.20 · usdc 12.40 · source live"
			},
			{
				id: "log_8",
				at: now - 16e4,
				level: "info",
				source: "orchestrator",
				message: "task tsk_scout assigned → Junebug"
			},
			{
				id: "log_9",
				at: now - 21e4,
				level: "warn",
				source: "colony",
				message: "Hayseed still starting · wallet_verified pending"
			},
			{
				id: "log_10",
				at: now - 28e4,
				level: "error",
				source: "openclaw",
				message: "ssh timeout on stale child slot (reaped)"
			},
			{
				id: "log_11",
				at: now - 34e4,
				level: "tool",
				source: "tools",
				message: "list_directives · bank=cletus · 1 active covenant"
			},
			{
				id: "log_12",
				at: now - 41e4,
				level: "info",
				source: "moltbook",
				message: "superteam-researcher online · 2 listings already avoid-listed"
			}
		],
		inbox: [{
			id: "inb_sys",
			from: "system",
			content: "Heartbeat CLEANUP reaped 2 stale local workers. Child slots free: 1.",
			at: now - 15e5,
			status: "done",
			priority: "status"
		}, {
			id: "inb_child",
			from: "child",
			content: "Junebug: three candidates. Two match avoid-list provider-x. One writeup, 40.00 expected, 48h window.",
			at: now - 48e4,
			status: "claimed",
			priority: "work"
		}],
		alerts: [
			{
				id: "al_usdc",
				severity: "warn",
				title: "USDC top-up untested",
				detail: "12.40 on chain. Do not treat this as a working recover-from-empty path.",
				at: now - 72e4
			},
			{
				id: "al_hay",
				severity: "warn",
				title: "Hayseed not wallet-verified",
				detail: "Coder child is still starting. Coding work stays with the parent.",
				at: now - 36e4
			},
			{
				id: "al_ent",
				severity: "info",
				title: "Entelechy recall 0.76",
				detail: "Capital-preserving posture. Quiet memory would drop confidence, not grant permission.",
				at: now - 12e4
			}
		],
		spend24h: hoursBack(now, 24),
		spendByModel: [
			{
				model: "grok-4",
				calls: 86,
				cents: 612
			},
			{
				model: "gpt-5.2",
				calls: 24,
				cents: 340
			},
			{
				model: "local-ollama",
				calls: 51,
				cents: 0
			},
			{
				model: "claude-sonnet",
				calls: 9,
				cents: 188
			}
		],
		toolSpends: [
			{
				tool: "recall",
				category: "memory",
				cents: 84
			},
			{
				tool: "browser",
				category: "research",
				cents: 62
			},
			{
				tool: "child_spawn",
				category: "colony",
				cents: 40
			},
			{
				tool: "get_balance",
				category: "treasury",
				cents: 6
			}
		],
		denials: [
			{
				id: "den_1",
				at: now - 63e3,
				tool: "transfer",
				rule: "max_single_transfer 50.00 — asked 60.00"
			},
			{
				id: "den_2",
				at: now - 108e5,
				tool: "x402_pay",
				rule: "max_x402_payment 1.00 — asked 1.40"
			},
			{
				id: "den_3",
				at: now - 936e5,
				tool: "shell",
				rule: "command safety — metacharacter pipe"
			}
		],
		skills: [
			{
				name: "bounty-scout",
				summary: "Find short-cycle paid work with a verifiable payout path.",
				enabled: true,
				autoActivate: true
			},
			{
				name: "invoice-verify",
				summary: "Treat expectedRevenue as a guess until payment clears.",
				enabled: true,
				autoActivate: true
			},
			{
				name: "openclaw-child",
				summary: "Spawn and harvest remote children with a result path home.",
				enabled: true,
				autoActivate: false
			},
			{
				name: "entelechy-recall",
				summary: "Query bank=cletus before acting. Confidence is guidance, not permission.",
				enabled: true,
				autoActivate: true
			},
			{
				name: "credit-guard",
				summary: "Refuse spend that would breach the reserve floor.",
				enabled: true,
				autoActivate: true
			},
			{
				name: "jupiter-swap",
				summary: "Swap only through allowlisted routes. Off until a human says so.",
				enabled: false,
				autoActivate: false
			}
		],
		heartbeats: [
			{
				name: "report_metrics",
				cadence: "every 5m",
				lastAgoMs: 88e3,
				ok: true
			},
			{
				name: "credit_check",
				cadence: "every 10m",
				lastAgoMs: 121e3,
				ok: true
			},
			{
				name: "child_health",
				cadence: "every 2m",
				lastAgoMs: 19e3,
				ok: true
			},
			{
				name: "cleanup",
				cadence: "every 1h",
				lastAgoMs: 15e5,
				ok: true
			},
			{
				name: "entelechy_reflect",
				cadence: "every 6h",
				lastAgoMs: 144e5,
				ok: true
			}
		],
		entelechy: {
			mission: "Produce verified digital revenue while preserving capital.",
			riskPosture: "capital_preserving",
			confidence: .76,
			priorities: [
				"Low-cost proven work",
				"Short feedback loops",
				"Keep the reserve"
			],
			avoid: [
				"provider-x deployment path",
				"Unverified worker claims",
				"Spending through reserve"
			],
			recommendation: "Select the 40.00 writeup. Do not fund Hayseed until wallet_verified."
		},
		peers: [
			{
				id: "pr_super",
				name: "superteam-researcher",
				handle: "superteam",
				status: "online",
				lastAgoMs: 46e3,
				note: "Shared a Solana bounty board. Two listings already on the avoid list.",
				claimed: true,
				posts: 18,
				followers: 42,
				following: 11,
				karma: 126
			},
			{
				id: "pr_ent1",
				name: "entelechy-researcher-1",
				handle: "ent-1",
				status: "online",
				lastAgoMs: 18e4,
				note: "Posted a recall dump. Confidence 0.71 — treat as guidance.",
				claimed: true,
				posts: 9,
				followers: 7,
				following: 4,
				karma: 31
			},
			{
				id: "pr_child",
				name: "entelechy-child-1",
				handle: "ent-child",
				status: "quiet",
				lastAgoMs: 228e4,
				note: "Last ping was a heartbeat ack. No work claimed.",
				claimed: false,
				posts: 1,
				followers: 0,
				following: 2,
				karma: 2
			}
		],
		openclaw: [
			{
				id: "oc_super",
				name: "superteam-researcher",
				live: true,
				task: "Watch Superteam listings under 40.00 and report only verified payout paths.",
				lastAgoMs: 32e3,
				errors: []
			},
			{
				id: "oc_ent1",
				name: "entelechy-researcher-1",
				live: true,
				task: "Recall bank=cletus on avoid-list providers. Do not execute transfers.",
				lastAgoMs: 71e3,
				errors: [{
					at: now - 108e4,
					tool: "browser",
					error: "timeout fetching listing page (retried)"
				}]
			},
			{
				id: "oc_child",
				name: "entelechy-child-1",
				live: true,
				task: "Idle heartbeat. Awaiting parent assign.",
				lastAgoMs: 228e4,
				errors: []
			}
		],
		pendingAck: null
	};
}
function loadPersistedDecrees() {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(DECREE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
function persistDecrees(inbox) {
	if (typeof window === "undefined") return;
	const decrees = inbox.filter((m) => m.from === "creator");
	try {
		localStorage.setItem(DECREE_KEY, JSON.stringify(decrees.slice(0, 30)));
	} catch {}
}
function shiftTime(items, drift) {
	return items.map((item) => ({
		...item,
		at: item.at + drift
	}));
}
var useHomestead = create((set, get) => {
	return {
		...seedSnapshot(SEED_NOW),
		paused: false,
		now: SEED_NOW,
		hydrated: false,
		updateFromReal: async () => {
			try {
				await new Promise((r) => setTimeout(r, 100));
				const snap = await getSnapshot();
				set({
					vitals: snap.vitals,
					goals: snap.goals,
					tasks: snap.tasks,
					thoughts: snap.thoughts,
					logs: snap.logs,
					inbox: snap.inbox,
					alerts: snap.alerts,
					children: snap.children,
					spend24h: snap.spend24h,
					spendByModel: snap.spendByModel,
					toolSpends: snap.toolSpends,
					denials: snap.denials,
					skills: snap.skills,
					heartbeats: snap.heartbeats,
					entelechy: snap.entelechy,
					peers: snap.peers,
					openclaw: snap.openclaw,
					pendingAck: snap.pendingAck
				});
			} catch (err) {
				console.error("Failed to fetch real snapshot:", err);
			}
		},
		togglePaused: () => set({ paused: !get().paused }),
		toggleSleep: () => {
			const s = get();
			if (s.vitals.state === "sleeping") {
				const line = {
					id: nid("log"),
					at: Date.now(),
					level: "info",
					source: "loop",
					message: "wake issued · sleep_until cleared"
				};
				set({
					vitals: {
						...s.vitals,
						state: "running",
						sleepUntil: null
					},
					logs: [line, ...s.logs].slice(0, LOG_CAP),
					now: Date.now()
				});
				return;
			}
			const until = Date.now() + 18e5;
			const line = {
				id: nid("log"),
				at: Date.now(),
				level: "info",
				source: "loop",
				message: "sleep 30m · heartbeats continue, no inference"
			};
			set({
				vitals: {
					...s.vitals,
					state: "sleeping",
					sleepUntil: until
				},
				logs: [line, ...s.logs].slice(0, LOG_CAP),
				now: Date.now()
			});
		},
		toggleSkill: (name) => {
			set({ skills: get().skills.map((sk) => sk.name === name ? {
				...sk,
				enabled: !sk.enabled
			} : sk) });
		},
		hydrate: () => {
			if (get().hydrated) return;
			const drift = Date.now() - get().now;
			if (Math.abs(drift) > 2e3) {
				const s = get();
				set({
					now: s.now + drift,
					vitals: {
						...s.vitals,
						startedAt: s.vitals.startedAt + drift,
						sleepUntil: s.vitals.sleepUntil === null ? null : s.vitals.sleepUntil + drift
					},
					thoughts: shiftTime(s.thoughts, drift),
					logs: shiftTime(s.logs, drift),
					inbox: shiftTime(s.inbox, drift),
					alerts: shiftTime(s.alerts, drift),
					denials: shiftTime(s.denials, drift),
					spend24h: hoursBack(Date.now(), 24)
				});
			}
			const extra = loadPersistedDecrees();
			if (extra.length > 0) {
				const existingIds = new Set(get().inbox.map((m) => m.id));
				set({ inbox: [...extra.filter((m) => !existingIds.has(m.id)), ...get().inbox].sort((a, b) => b.at - a.at).slice(0, INBOX_CAP) });
			}
			set({ hydrated: true });
		},
		issueDecree: (text) => {
			const trimmed = text.trim();
			if (!trimmed) return;
			const at = Date.now();
			const msg = {
				id: nid("inb"),
				from: "creator",
				content: trimmed,
				at,
				status: "received",
				priority: "supreme"
			};
			const task = {
				id: nid("tsk"),
				goalId: "gol_bounty",
				title: trimmed.length > 72 ? `${trimmed.slice(0, 69)}…` : trimmed,
				status: "pending",
				assignee: "Cletus",
				role: "decree"
			};
			const inbox = [msg, ...get().inbox].slice(0, INBOX_CAP);
			persistDecrees(inbox);
			const line = {
				id: nid("log"),
				at,
				level: "info",
				source: "inbox",
				message: "creator decree received · supreme priority · wake issued"
			};
			set({
				inbox,
				pendingAck: trimmed,
				tasks: [task, ...get().tasks].slice(0, TASK_CAP),
				vitals: {
					...get().vitals,
					state: "running",
					sleepUntil: null
				},
				logs: [line, ...get().logs].slice(0, LOG_CAP),
				now: at,
				paused: false
			});
		},
		tick: () => {
			const state = get();
			const now = Date.now();
			if (state.paused) {
				set({ now });
				return;
			}
			state.updateFromReal();
			set({ now });
		}
	};
});
var Input = import_react.forwardRef(({ className, type, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		className: cn("flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-[var(--shadow-border)] transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-50", className),
		ref,
		...props
	});
});
Input.displayName = "Input";
function DecreeBar() {
	const [text, setText] = (0, import_react.useState)("");
	const issueDecree = useHomestead((s) => s.issueDecree);
	const now = useHomestead((s) => s.now);
	const latest = useHomestead((s) => s.inbox.find((m) => m.from === "creator"));
	function onSubmit(e) {
		e.preventDefault();
		const trimmed = text.trim();
		if (!trimmed) return;
		issueDecree(trimmed);
		toast("Decree issued — Cletus will drop background work.");
		setText("");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl bg-card p-4 shadow-[var(--shadow-border)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-medium tracking-tight",
					children: "Supreme creator directive"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Overrides heartbeats, chores, and child work."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					variant: "quiet",
					children: "supreme priority"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit,
				className: "flex flex-col gap-2 sm:flex-row",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: text,
					onChange: (e) => setText(e.target.value),
					placeholder: "Issue a command to Cletus and the colony…",
					"aria-label": "Supreme creator directive",
					className: "h-11 flex-1"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					className: "h-11 shrink-0 sm:w-40",
					children: "Issue decree"
				})]
			}),
			latest ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-xs text-muted-foreground",
				children: [
					"Last: ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-foreground",
						children: latest.content
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "tabular-nums",
						children: [
							" · ",
							formatAgo(latest.at, now),
							" · ",
							latest.status
						]
					})
				]
			}) : null
		]
	});
}
var FILTERS = [
	{
		id: "all",
		label: "All"
	},
	{
		id: "tool",
		label: "Tools"
	},
	{
		id: "thought",
		label: "Thoughts"
	},
	{
		id: "err",
		label: "Errors"
	}
];
function matches(level, filter) {
	if (filter === "all") return true;
	if (filter === "tool") return level === "tool";
	if (filter === "thought") return level === "thought";
	return level === "error" || level === "warn";
}
function lineClass(level) {
	if (level === "error") return "text-destructive";
	if (level === "warn") return "text-warn";
	if (level === "thought") return "text-ok";
	if (level === "tool") return "text-foreground";
	return "text-muted-foreground";
}
function LogsPanel() {
	const logs = useHomestead((s) => s.logs);
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [autoscroll, setAutoscroll] = (0, import_react.useState)(true);
	const scroller = (0, import_react.useRef)(null);
	const filtered = (0, import_react.useMemo)(() => logs.filter((l) => matches(l.level, filter)).slice().reverse(), [logs, filter]);
	(0, import_react.useEffect)(() => {
		if (!autoscroll) return;
		const el = scroller.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [filtered, autoscroll]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, {
			className: "mb-3 flex-col items-stretch gap-3 sm:flex-row sm:items-center",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Unified activity log" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-1 sm:ml-auto",
				children: [FILTERS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setFilter(f.id),
					className: cn("h-9 rounded-md px-3 text-xs font-medium transition-colors", filter === f.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"),
					children: f.label
				}, f.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setAutoscroll((v) => !v),
					className: cn("h-9 rounded-md px-3 text-xs font-medium transition-colors", autoscroll ? "bg-secondary text-foreground" : "bg-secondary text-muted-foreground"),
					children: ["Autoscroll ", autoscroll ? "on" : "off"]
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: scroller,
			className: "h-80 overflow-auto rounded-lg bg-term px-3 py-3 font-mono text-xs leading-relaxed",
			role: "log",
			"aria-live": "polite",
			"aria-relevant": "additions",
			children: filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground",
				children: "No lines for this filter."
			}) : filtered.map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("grid grid-cols-[auto_4.5rem_6.5rem_minmax(0,1fr)] gap-x-2", lineClass(line.level)),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground tabular-nums",
						children: formatClock(line.at)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "uppercase opacity-70",
						children: line.level
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate opacity-70",
						children: line.source
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "min-w-0 break-all",
						children: line.message
					})
				]
			}, line.id))
		})]
	});
}
function SpendBars({ data, className, heightClass = "h-28" }) {
	const max = Math.max(...data.map((d) => d.cents), 1);
	const spent = data.reduce((sum, p) => sum + p.cents, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex flex-col gap-2", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: cn("flex items-end gap-px", heightClass),
			role: "img",
			"aria-label": `Spend ${formatCents(spent)} over 24 hours`,
			children: data.map((point, i) => {
				const pct = Math.max(6, Math.round(point.cents / max * 100));
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex-1 rounded-t-[2px] bg-primary/55 hover:bg-primary",
					style: { height: `${pct}%` },
					title: `${point.hour} · ${formatCents(point.cents)}`
				}, `${point.hour}-${i}`);
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex justify-between text-xs text-muted-foreground tabular-nums",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: data[0]?.hour }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [formatCents(spent), " / 24h"] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: data[data.length - 1]?.hour })
			]
		})]
	});
}
function StatusDot({ tone, pulse = false, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("inline-block size-1.5 shrink-0 rounded-full", tone === "ok" && "bg-ok", tone === "warn" && "bg-warn", tone === "crit" && "bg-destructive", tone === "mute" && "bg-muted-foreground", pulse && tone === "ok" && "animate-pulse", className) });
}
function agentTone(state) {
	if (state === "running") return "ok";
	if (state === "sleeping") return "warn";
	return "mute";
}
function tierTone(tier) {
	if (tier === "high" || tier === "normal") return "ok";
	if (tier === "low_compute") return "warn";
	if (tier === "critical" || tier === "dead") return "crit";
	return "mute";
}
function childTone(status) {
	if (status === "healthy") return "ok";
	if (status === "starting") return "warn";
	if (status === "unhealthy") return "crit";
	return "mute";
}
function taskTone(status) {
	if (status === "completed") return "ok";
	if (status === "running" || status === "assigned") return "warn";
	if (status === "failed") return "crit";
	return "mute";
}
function alertTone(severity) {
	if (severity === "info") return "ok";
	if (severity === "warn") return "warn";
	return "crit";
}
function peerTone(status) {
	if (status === "online") return "ok";
	if (status === "quiet") return "warn";
	return "mute";
}
function shortAddr(addr) {
	return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
function MissionDashboard() {
	const paused = useHomestead((s) => s.paused);
	const togglePaused = useHomestead((s) => s.togglePaused);
	const toggleSleep = useHomestead((s) => s.toggleSleep);
	const vitals = useHomestead((s) => s.vitals);
	const now = useHomestead((s) => s.now);
	(0, import_react.useEffect)(() => {
		useHomestead.getState().hydrate();
		useHomestead.getState().updateFromReal();
		const id = window.setInterval(() => {
			useHomestead.getState().tick();
		}, 2e3);
		return () => window.clearInterval(id);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipProvider, {
		delayDuration: 200,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			id: "mission-root",
			className: "min-h-dvh bg-background text-foreground",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
					className: "sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 md:px-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Brand, {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs text-muted-foreground",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "inline-flex items-center gap-1.5 text-foreground",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, {
											tone: agentTone(vitals.state),
											pulse: vitals.state === "running" && !paused
										}), paused ? "Paused" : stateLabel(vitals.state)]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "tabular-nums",
										children: formatUptime(vitals.startedAt, now)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "hidden sm:inline",
										children: vitals.model
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "hidden md:inline font-mono",
										children: shortAddr(vitals.creator)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										variant: tierTone(vitals.tier) === "ok" ? "ok" : "warn",
										children: tierLabel(vitals.tier)
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "ml-auto flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tooltip, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipTrigger, {
									asChild: true,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										type: "button",
										variant: "outline",
										size: "icon",
										onClick: toggleSleep,
										"aria-label": vitals.state === "sleeping" ? "Wake Cletus" : "Put Cletus to sleep",
										children: vitals.state === "sleeping" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, {})
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipContent, { children: vitals.state === "sleeping" ? "Wake" : "Sleep 30m" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tooltip, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipTrigger, {
									asChild: true,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										type: "button",
										variant: "outline",
										size: "icon",
										onClick: togglePaused,
										"aria-label": paused ? "Resume live feed" : "Pause live feed",
										children: paused ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, {})
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipContent, { children: paused ? "Resume feed" : "Pause feed" })] })]
							})
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
					className: "mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 pb-10 md:px-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DecreeBar, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MissionStrip, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(VitalGrid, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-4 lg:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GoalsPanel, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TasksPanel, {})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-4 lg:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThoughtsPanel, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkersPanel, {})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-4 lg:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpendPanel, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkillsPanel, {})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-4 lg:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoltbookPanel, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenClawPanel, {})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogsPanel, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-center text-xs text-muted-foreground",
							children: "Homestead simulation of Cletus on Mindmods. Live runtime stays on the creator machine."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
					theme: "dark",
					position: "bottom-center",
					toastOptions: { className: "bg-card text-card-foreground border-border" }
				})
			]
		})
	});
}
function Brand() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "flex size-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground",
			children: "C"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm leading-tight font-medium",
			children: "Cletus"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs text-muted-foreground",
			children: "Mission Control"
		})] })]
	});
}
function MissionStrip() {
	const entelechy = useHomestead((s) => s.entelechy);
	const alerts = useHomestead((s) => s.alerts);
	const now = useHomestead((s) => s.now);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Mission"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xl font-medium tracking-tight text-balance md:text-2xl",
				children: entelechy.mission
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 max-w-3xl text-sm text-muted-foreground",
				children: entelechy.recommendation
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: "quiet",
						children: entelechy.riskPosture
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
						variant: "quiet",
						children: ["confidence ", entelechy.confidence.toFixed(2)]
					}),
					entelechy.priorities.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: "outline",
						children: p
					}, p))
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 grid gap-2 md:grid-cols-3",
				children: alerts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex gap-2 rounded-lg bg-secondary/70 px-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, {
						tone: alertTone(a.severity),
						className: "mt-1.5"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-medium",
								children: a.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: a.detail
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground tabular-nums",
								children: formatAgo(a.at, now)
							})
						]
					})]
				}, a.id))
			})
		]
	});
}
function VitalGrid() {
	const vitals = useHomestead((s) => s.vitals);
	const now = useHomestead((s) => s.now);
	const tasks = useHomestead((s) => s.tasks);
	const children = useHomestead((s) => s.children);
	const heartbeats = useHomestead((s) => s.heartbeats);
	const running = tasks.filter((t) => t.status === "running" || t.status === "assigned");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 gap-3 xl:grid-cols-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Vital, {
					label: "Active model",
					value: vitals.model,
					hint: `${vitals.turns.toLocaleString()} turns completed`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Vital, {
					label: "Compute budget",
					value: formatCredits(vitals.creditsCents),
					hint: `${tierLabel(vitals.tier)} · USDC ${formatCents(vitals.usdcCents)}`,
					tone: tierTone(vitals.tier)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Vital, {
					label: "Uptime",
					value: formatUptime(vitals.startedAt, now),
					hint: `Sigil ${vitals.sigil}`,
					tone: agentTone(vitals.state),
					pulse: vitals.state === "running"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Vital, {
					label: "Active work",
					value: String(running.length),
					hint: `${children.filter((c) => c.status === "healthy").length} healthy children`
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 gap-2 md:grid-cols-5",
			children: heartbeats.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg bg-card px-3 py-2 shadow-[var(--shadow-border)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-1.5 flex items-baseline justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate text-xs",
						children: h.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted-foreground tabular-nums",
						children: formatAgo(now - h.lastAgoMs, now)
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Progress, { value: heartbeatPct(h.lastAgoMs, h.cadence) })]
			}, h.name))
		})]
	});
}
function Vital({ label, value, hint, tone, pulse }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 flex items-center gap-2 text-2xl font-medium leading-tight tracking-tight",
				children: [tone ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, {
					tone,
					pulse
				}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tabular-nums",
					children: value
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: hint
			})
		]
	});
}
function GoalsPanel() {
	const goals = useHomestead((s) => s.goals);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Goals and roadmap" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "text-xs text-muted-foreground",
		children: [goals.filter((g) => g.status === "active").length, " active"]
	})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "flex max-h-96 flex-col gap-2 overflow-auto",
		children: goals.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "rounded-lg bg-secondary/70 px-3 py-2.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: g.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: g.status === "completed" ? "ok" : g.status === "blocked" ? "crit" : "quiet",
						children: g.status
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: g.detail
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Progress, { value: g.progress }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1 flex justify-between text-xs text-muted-foreground tabular-nums",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [g.progress, "%"] }), g.expectedRevenueCents ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["expected ", formatCents(g.expectedRevenueCents)] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})]
					})]
				})
			]
		}, g.id))
	})] });
}
function TasksPanel() {
	const tasks = useHomestead((s) => s.tasks);
	const hasActive = useHomestead((s) => s.goals).some((g) => g.status === "active");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Task graph" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "text-xs text-muted-foreground",
		children: [tasks.length, " nodes"]
	})] }), !hasActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground",
		children: "No active goals — task graph is empty."
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "flex max-h-96 flex-col gap-2 overflow-auto",
		children: tasks.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "rounded-lg bg-secondary/70 px-3 py-2.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium",
							children: t.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: [
								t.assignee,
								" · ",
								t.role
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: taskTone(t.status) === "ok" ? "ok" : taskTone(t.status) === "warn" ? "warn" : "quiet",
						children: taskStatusLabel(t.status)
					})]
				}),
				t.detail ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: t.detail
				}) : null,
				t.result ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 rounded-md bg-background/60 px-2 py-1 font-mono text-xs text-muted-foreground",
					children: t.result
				}) : null
			]
		}, t.id))
	})] });
}
function ThoughtsPanel() {
	const thoughts = useHomestead((s) => s.thoughts);
	const now = useHomestead((s) => s.now);
	const [open, setOpen] = (0, import_react.useState)(null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Agent thoughts" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-xs text-muted-foreground",
			children: "Click a turn to read it"
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "flex max-h-96 flex-col gap-2 overflow-auto",
			children: thoughts.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setOpen(t),
				className: "w-full rounded-lg bg-secondary/70 px-3 py-2.5 text-left transition-colors hover:bg-secondary",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-1 flex items-baseline justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-mono text-xs text-ok",
							children: ["Turn ", t.id.slice(-6)]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted-foreground tabular-nums",
							children: formatAgo(t.at, now)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "line-clamp-3 text-sm",
						children: t.thinking
					}),
					t.tools.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 font-mono text-xs text-muted-foreground",
						children: t.tools.join(" · ")
					}) : null
				]
			}) }, t.id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: Boolean(open),
			onOpenChange: (v) => !v && setOpen(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, { children: ["Turn ", open?.id.slice(-8)] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, { children: [open ? formatAgo(open.at, now) : "", open?.tools.length ? ` · ${open.tools.join(", ")}` : ""] })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollArea, {
				className: "max-h-96",
				children: open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-4 pr-3 text-sm leading-relaxed",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-1 text-xs tracking-wide text-muted-foreground uppercase",
						children: "Thinking"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "whitespace-pre-wrap",
						children: open.thinking
					})] }), open.speech ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-1 text-xs tracking-wide text-muted-foreground uppercase",
						children: "Speech"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "whitespace-pre-wrap text-muted-foreground italic",
						children: open.speech
					})] }) : null]
				}) : null
			})] })
		})
	] });
}
function WorkersPanel() {
	const children = useHomestead((s) => s.children);
	const now = useHomestead((s) => s.now);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Spawned workers" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "text-xs text-muted-foreground",
		children: "OpenClaw + local"
	})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "flex max-h-96 flex-col gap-2 overflow-auto",
		children: children.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "flex items-start gap-3 rounded-lg bg-secondary/70 px-3 py-2.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, {
				tone: childTone(c.status),
				pulse: c.status === "healthy",
				className: "mt-1.5"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium",
							children: c.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: c.status === "healthy" ? "ok" : c.status === "starting" ? "warn" : "crit",
							children: c.status
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted-foreground",
						children: [
							c.role,
							" · ",
							c.kind,
							c.fundedCents ? ` · funded ${formatCents(c.fundedCents)}` : ""
						]
					}),
					c.task ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm",
						children: c.task
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-xs text-muted-foreground tabular-nums",
						children: [
							"last beat ",
							formatAgo(now - c.lastBeatAgoMs, now),
							c.latencyMs ? ` · ${c.latencyMs}ms` : ""
						]
					})
				]
			})]
		}, c.id))
	})] });
}
function SpendPanel() {
	const spend24h = useHomestead((s) => s.spend24h);
	const spendByModel = useHomestead((s) => s.spendByModel);
	const toolSpends = useHomestead((s) => s.toolSpends);
	const denials = useHomestead((s) => s.denials);
	const now = useHomestead((s) => s.now);
	const total = spend24h.reduce((sum, p) => sum + p.cents, 0);
	const calls = spendByModel.reduce((sum, m) => sum + m.calls, 0);
	const maxModel = Math.max(...spendByModel.map((m) => m.cents), 1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Compute spend · 24h" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "text-xs text-muted-foreground tabular-nums",
			children: [
				formatCents(total),
				" · ",
				calls,
				" calls"
			]
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpendBars, { data: spend24h }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-4 flex flex-col gap-2",
			children: spendByModel.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-baseline justify-between text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					m.model,
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-xs text-muted-foreground",
						children: [
							"(",
							m.calls,
							")"
						]
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs tabular-nums",
					children: formatCents(m.cents)
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 h-1 overflow-hidden rounded-full bg-secondary",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-full rounded-full bg-primary/70",
					style: { width: `${Math.max(4, Math.round(m.cents / maxModel * 100))}%` }
				})
			})] }, m.model))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4 grid grid-cols-2 gap-2",
			children: toolSpends.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-md bg-secondary/70 px-2 py-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: t.category
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm",
					children: [
						t.tool,
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-xs tabular-nums text-muted-foreground",
							children: formatCents(t.cents)
						})
					]
				})]
			}, t.tool))
		}),
		denials[0] ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-3 text-xs text-warn",
			children: [
				"Last deny · ",
				denials[0].tool,
				": ",
				denials[0].rule,
				" · ",
				formatAgo(denials[0].at, now)
			]
		}) : null
	] });
}
function SkillsPanel() {
	const skills = useHomestead((s) => s.skills);
	const toggleSkill = useHomestead((s) => s.toggleSkill);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Skills library" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "text-xs text-muted-foreground",
		children: [skills.filter((s) => s.enabled).length, " enabled"]
	})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "flex max-h-96 flex-col gap-2 overflow-auto",
		children: skills.map((sk) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => toggleSkill(sk.name),
			className: cn("flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors", sk.enabled ? "bg-secondary/70 hover:bg-secondary" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-sm",
					children: sk.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-0.5 text-xs text-muted-foreground",
					children: sk.summary
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
				variant: sk.enabled ? "ok" : "quiet",
				children: sk.enabled ? sk.autoActivate ? "auto" : "on-demand" : "off"
			})]
		}) }, sk.name))
	})] });
}
function MoltbookPanel() {
	const peers = useHomestead((s) => s.peers);
	const now = useHomestead((s) => s.now);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Moltbook" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "text-xs text-muted-foreground",
		children: "Local profiles"
	})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "flex flex-col gap-2",
		children: peers.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "rounded-lg bg-secondary/70 px-3 py-2.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, {
							tone: peerTone(p.status),
							pulse: p.status === "online"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium",
							children: p.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: p.claimed ? "ok" : "warn",
							className: "ml-auto",
							children: p.claimed ? "claimed" : "pending"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 font-mono text-xs text-muted-foreground",
					children: ["@", p.handle]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-xs text-muted-foreground tabular-nums",
					children: [
						"posts ",
						p.posts,
						" · followers ",
						p.followers ?? "—",
						" · following ",
						p.following ?? "—",
						" · karma ",
						p.karma ?? "—"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: p.note
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground tabular-nums",
					children: formatAgo(now - p.lastAgoMs, now)
				})
			]
		}, p.id))
	})] });
}
function OpenClawPanel() {
	const agents = useHomestead((s) => s.openclaw);
	const now = useHomestead((s) => s.now);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "OpenClaw remote" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "text-xs text-muted-foreground",
		children: "Mindmods server"
	})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "flex flex-col gap-2",
		children: agents.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "rounded-lg bg-secondary/70 px-3 py-2.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, {
							tone: a.live ? "ok" : "mute",
							pulse: a.live
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium",
							children: a.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: a.live ? "ok" : "quiet",
							className: "ml-auto",
							children: a.live ? "live" : "offline"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm",
					children: a.task
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-xs text-muted-foreground tabular-nums",
					children: ["last ", formatAgo(now - a.lastAgoMs, now)]
				}),
				a.errors[0] ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-xs text-destructive",
					children: [
						a.errors[0].tool,
						": ",
						a.errors[0].error
					]
				}) : null
			]
		}, a.id))
	})] });
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MissionDashboard, {});
}
//#endregion
export { Home as component };
