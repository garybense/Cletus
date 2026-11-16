import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { _ as CircleCheck, a as Terminal, b as ArrowUp, c as RefreshCw, d as Pen, f as Pause, g as CircleX, h as Coins, i as Trash2, l as Plus, m as Cpu, n as X, o as Target, p as Moon, s as Sun, t as Zap, u as Play, v as ChevronsUp, x as ArrowDown, y as Brain } from "../_libs/lucide-react.mjs";
import { a as controlTaskGraphServer, c as enqueueWorkItemServer, i as controlGoalServer, l as issueDecreeServer, n as addGoalServer, o as controlWorkItemServer, r as clearPlanServer, s as deploySwarmTaskServer, u as updateActiveMissionServer } from "./router-9cJHAgVi.mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { a as DialogOverlay$1, g as Slot, i as DialogDescription$1, n as DialogClose, o as DialogPortal$1, r as DialogContent$1, s as DialogTitle$1, t as Dialog$1 } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { n as Root, t as Indicator } from "../_libs/radix-ui__react-progress.mjs";
import { a as Viewport, i as ScrollAreaThumb, n as Root$1, r as ScrollAreaScrollbar, t as Corner } from "../_libs/radix-ui__react-scroll-area.mjs";
import { a as Trigger, i as Root3, n as Portal, r as Provider, t as Content2 } from "../_libs/@radix-ui/react-tooltip+[...].mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CrDi27TS.js
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
var LOG_CAP = 1e4;
var INBOX_CAP = 40;
/** Frozen clock so SSR HTML matches the first client paint. Shifted on hydrate. */
var SEED_NOW = 17575968e5;
var CREATOR = "92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa";
/** Seed value for the memory-banks feed (real live data arrives via snapshot). */
var DEFAULT_MEMORY_BANKS = {
	activeBank: "cletus",
	banks: [
		{
			id: "cletus",
			name: "cletus",
			documents: 757,
			nodes: 3484,
			links: 105786,
			createdAt: null,
			experiences: 341,
			observations: 859,
			worldFacts: 2284,
			status: "live"
		},
		{
			id: "Cletus",
			name: "Cletus",
			documents: 7,
			nodes: 613,
			links: 16739,
			createdAt: null,
			experiences: 30,
			observations: 153,
			worldFacts: 430,
			status: "live"
		},
		{
			id: "sovereign_shard_v2",
			name: "sovereign_shard_v2",
			documents: 18,
			nodes: 65,
			links: 434,
			createdAt: null,
			experiences: 18,
			observations: 32,
			worldFacts: 15,
			status: "live"
		}
	]
};
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
			mission: "Awaiting snapshot…",
			riskPosture: "unknown",
			priorities: [],
			risks: [],
			recommendation: "—",
			planRef: null,
			estimatedTotalCostCents: null
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
		memoryBanks: DEFAULT_MEMORY_BANKS,
		metacog: null,
		gatewayActivity: null,
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
		lastFetchedAt: null,
		updateFromReal: async () => {
			try {
				await new Promise((r) => setTimeout(r, 100));
				const res = await fetch("/api/cletus/snapshot");
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const snap = await res.json();
				if (!snap || !snap.vitals) return;
				set({
					vitals: snap.vitals,
					goals: snap.goals ?? [],
					tasks: snap.tasks ?? [],
					thoughts: snap.thoughts ?? [],
					logs: snap.logs ?? [],
					inbox: snap.inbox ?? [],
					alerts: snap.alerts ?? [],
					children: snap.children ?? [],
					spend24h: snap.spend24h ?? [],
					spendByModel: snap.spendByModel ?? [],
					toolSpends: snap.toolSpends ?? [],
					denials: snap.denials ?? [],
					skills: snap.skills ?? [],
					heartbeats: snap.heartbeats ?? [],
					entelechy: snap.entelechy,
					peers: snap.peers ?? [],
					openclaw: snap.openclaw ?? [],
					fleetCensus: snap.fleetCensus,
					memoryBanks: snap.memoryBanks,
					metacog: snap.metacog ?? null,
					gatewayActivity: snap.gatewayActivity ?? null,
					pendingAck: snap.pendingAck,
					lastFetchedAt: Date.now()
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
		issueDecree: async (text) => {
			const trimmed = text.trim();
			if (!trimmed) return;
			try {
				await issueDecreeServer({ data: { content: trimmed } });
				await get().updateFromReal();
			} catch (err) {
				console.error("Failed to issue decree to server:", err);
			}
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
var SWARM_ROSTER = [
	{
		name: "Commander",
		model: "deepseek-r1:671b"
	},
	{
		name: "Auditor 1",
		model: "llama3.3:70b"
	},
	{
		name: "Lead Coder",
		model: "qwen3-coder:30b"
	},
	{
		name: "Coder 2",
		model: "qwen2.5-coder:14b"
	},
	{
		name: "Security",
		model: "codestral:22b"
	},
	{
		name: "Scout 72B",
		model: "qwen2.5:72b"
	},
	{
		name: "Reasoning",
		model: "deepseek-r1:32b"
	},
	{
		name: "Evaluator",
		model: "gemma2:27b"
	},
	{
		name: "Math/Inst",
		model: "phi-4:14b"
	},
	{
		name: "Fast Scout",
		model: "llama3.1:8b"
	},
	{
		name: "Triage",
		model: "smollm2:135m"
	},
	{
		name: "Cloud Synth",
		model: "qwen-plus"
	}
];
function LegionSwarmPanel() {
	const [taskText, setTaskText] = (0, import_react.useState)("");
	const [deployed, setDeployed] = (0, import_react.useState)(false);
	const [logs, setLogs] = (0, import_react.useState)([]);
	async function onDeploy(e) {
		e.preventDefault();
		const trimmed = taskText.trim();
		if (!trimmed) return;
		setDeployed(true);
		toast("⚡ Legion Swarm Deployed & Task Enqueued to Cletus!");
		try {
			await deploySwarmTaskServer({ data: { taskText: trimmed } });
		} catch (err) {
			console.error("Failed to enqueue task:", err);
		}
		const initialLogs = SWARM_ROSTER.map((agent, i) => ({
			id: `log-${Date.now()}-${i}`,
			agent: agent.name,
			model: agent.model,
			status: "INITIALIZING",
			message: `Assigned sub-task: "${trimmed}". Establishing inference stream…`,
			timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString()
		}));
		setLogs(initialLogs);
		setTimeout(() => {
			setLogs((prev) => prev.map((l) => ({
				...l,
				status: "EXECUTING",
				message: `Active on node cluster. Processing AST / payload partition for "${trimmed}".`
			})));
		}, 1500);
		setTimeout(() => {
			setLogs((prev) => prev.map((l, idx) => ({
				...l,
				status: idx % 2 === 0 ? "VERIFIED" : "SYNTHESIZING",
				message: idx % 2 === 0 ? "✓ Sub-component verified secure & optimal." : "⚡ Integrating map-reduce consensus vector…"
			})));
		}, 3500);
	}
	function onDismiss() {
		setDeployed(false);
		setLogs([]);
		setTaskText("");
		toast("Legion Swarm recalled.");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl bg-card p-4 shadow-[var(--shadow-border)] border border-purple-500/30",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "h-5 w-5 text-purple-400 animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium tracking-tight text-purple-300",
						children: "Legion Swarm Deployment"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: "Deploys all 12 available models simultaneously on hardcore tasks."
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					variant: "outline",
					className: "border-purple-500/50 text-purple-300",
					children: "12 Agents Ready"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: onDeploy,
				className: "flex flex-col gap-2 sm:flex-row",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: taskText,
					onChange: (e) => setTaskText(e.target.value),
					placeholder: "Enter hardcore task for 12-model swarm (e.g. exploit triage, deep refactor)…",
					"aria-label": "Legion swarm task",
					className: "h-11 flex-1 border-purple-500/30 focus-visible:ring-purple-500",
					disabled: deployed
				}), !deployed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "submit",
					className: "h-11 shrink-0 bg-purple-600 hover:bg-purple-700 sm:w-48 text-white",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "mr-2 h-4 w-4" }), " Deploy Swarm"]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					onClick: onDismiss,
					variant: "destructive",
					className: "h-11 shrink-0 sm:w-48",
					children: "Recall Swarm"
				})]
			}),
			deployed && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "mt-4 border-purple-500/40 bg-card/50 p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, {
					className: "mb-2 flex-row items-center justify-between pb-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardTitle, {
						className: "flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-purple-300",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Terminal, { className: "h-4 w-4 text-purple-400" }), " Real-time Swarm Telemetry Stream"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex items-center gap-1.5 text-xs text-emerald-400 font-mono",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2 w-2 rounded-full bg-emerald-500 animate-ping" }), " 12 Active Nodes"]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-64 overflow-auto rounded-lg bg-black/85 p-3 font-mono text-xs text-purple-200",
					children: logs.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-2 border-b border-purple-900/40 pb-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between text-[10px] text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								"[",
								l.timestamp,
								"] ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
									className: "text-purple-300",
									children: l.agent
								}),
								" (",
								l.model,
								")"
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: l.status === "VERIFIED" ? "text-emerald-400 font-bold" : "text-amber-400",
								children: l.status
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 text-foreground/90",
							children: l.message
						})]
					}, l.id))
				})]
			})
		]
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
function DialoguePanel() {
	const inbox = useHomestead((s) => s.inbox);
	const now = useHomestead((s) => s.now);
	const scrollRef = (0, import_react.useRef)(null);
	const messages = inbox.filter((m) => m.from === "creator" || m.from === "agent").sort((a, b) => a.at - b.at);
	(0, import_react.useEffect)(() => {
		if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
	}, [messages.length]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "flex flex-col h-[500px]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, {
			className: "flex-none border-b pb-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, {
					className: "text-lg",
					children: "Dialogue Bridge"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					variant: "quiet",
					className: "bg-primary/10 text-primary border-primary/20",
					children: "Sovereign Parity"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground mt-1",
				children: "Direct bio-digital bond: Gary ↔ Cletus"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: scrollRef,
			className: "flex-1 overflow-y-auto p-4 space-y-4 bg-secondary/20",
			children: messages.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col items-center justify-center h-full text-center space-y-2 opacity-50",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm",
					children: "Initiate contact via the decree bar above."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[10px] uppercase tracking-widest",
					children: "Waiting for signal..."
				})]
			}) : messages.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("flex flex-col max-w-[85%] space-y-1", m.from === "creator" ? "ml-auto items-end" : "mr-auto items-start"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5 px-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] font-medium uppercase tracking-tight text-muted-foreground",
							children: m.from === "creator" ? "Gary" : "Cletus"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] text-muted-foreground tabular-nums",
							children: formatAgo(m.at, now)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: cn("rounded-2xl px-4 py-2 text-sm shadow-sm", m.from === "creator" ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border rounded-tl-none"),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "whitespace-pre-wrap leading-relaxed",
							children: m.content
						})
					}),
					m.from === "agent" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1 px-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, {
							tone: "ok",
							pulse: true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[9px] text-muted-foreground uppercase tracking-tighter",
							children: "Encrypted via Sovereign Shard"
						})]
					})
				]
			}, m.id))
		})]
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
	if (level === "error") return "text-red-400 font-bold";
	if (level === "warn") return "text-amber-400 font-semibold";
	if (level === "thought") return "text-purple-300 font-medium";
	if (level === "tool") return "text-cyan-300 font-medium";
	return "text-foreground/90";
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
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Unified activity log" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-xs text-muted-foreground tabular-nums",
					children: [
						filtered.length,
						" lines shown (",
						logs.length,
						" total)"
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
			className: "h-[550px] overflow-auto rounded-lg bg-term px-3 py-3 font-mono text-xs leading-relaxed",
			role: "log",
			"aria-live": "polite",
			"aria-relevant": "additions",
			children: filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground",
				children: "No lines for this filter."
			}) : filtered.map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("grid grid-cols-[auto_4.5rem_6.5rem_minmax(0,1fr)] gap-x-2 py-0.5", lineClass(line.level)),
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
var TASK_PRESETS = [
	{
		name: "Bounty Scan",
		source: "bounty_scout",
		priority: 80,
		payload: "{\n  \"task\": \"scan_bounties\",\n  \"max_budget_usd\": 40\n}"
	},
	{
		name: "Facebook Recon",
		source: "fb_agent",
		priority: 75,
		payload: "{\n  \"task\": \"facebook_recon\",\n  \"mode\": \"stealth\"\n}"
	},
	{
		name: "Health Check",
		source: "system",
		priority: 50,
		payload: "{\n  \"task\": \"health_check\"\n}"
	},
	{
		name: "Memory Reflection",
		source: "entelechy",
		priority: 60,
		payload: "{\n  \"task\": \"reflect_memories\",\n  \"bank\": \"cletus\"\n}"
	}
];
function WorkQueuePanel() {
	const workQueue = useHomestead((s) => s.workQueue) || [];
	const goals = useHomestead((s) => s.goals) || [];
	const tasks = useHomestead((s) => s.tasks) || [];
	const entelechy = useHomestead((s) => s.entelechy);
	const updateFromReal = useHomestead((s) => s.updateFromReal);
	const [filterTab, setFilterTab] = (0, import_react.useState)("all");
	const [showEnqueue, setShowEnqueue] = (0, import_react.useState)(false);
	const [showAddGoal, setShowAddGoal] = (0, import_react.useState)(false);
	const [source, setSource] = (0, import_react.useState)("dashboard");
	const [priority, setPriority] = (0, import_react.useState)(10);
	const [acceptancePredicate, setAcceptancePredicate] = (0, import_react.useState)("result.success === true");
	const [spendBearing, setSpendBearing] = (0, import_react.useState)(false);
	const [payloadStr, setPayloadStr] = (0, import_react.useState)("{\n  \"task\": \"custom_job\"\n}");
	const [goalTitle, setGoalTitle] = (0, import_react.useState)("");
	const [goalDesc, setGoalDesc] = (0, import_react.useState)("");
	const [showEditMission, setShowEditMission] = (0, import_react.useState)(false);
	const [customMissionText, setCustomMissionText] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [expandedId, setExpandedId] = (0, import_react.useState)(null);
	const handleUpdateMission = async (text) => {
		setLoading(true);
		try {
			await updateActiveMissionServer({ data: { mission: text } });
			setShowEditMission(false);
			updateFromReal();
		} catch (err) {
			console.error("Failed to update active mission:", err);
		} finally {
			setLoading(false);
		}
	};
	goals.filter((g) => g.status === "active").length;
	const tasksCount = tasks.length;
	const pendingCount = workQueue.filter((w) => w.status === "pending").length + tasks.filter((t) => t.status === "pending").length;
	const runningCount = workQueue.filter((w) => w.status === "claimed").length + tasks.filter((t) => t.status === "running" || t.status === "assigned").length;
	const completedCount = workQueue.filter((w) => w.status === "completed").length + tasks.filter((t) => t.status === "completed").length;
	const failedCount = workQueue.filter((w) => w.status === "failed" || w.status === "expired").length + tasks.filter((t) => t.status === "failed" || t.status === "cancelled").length;
	const unifiedItems = [
		...goals.map((g) => ({
			type: "goal",
			id: g.id,
			title: g.title,
			detail: g.detail,
			status: g.status,
			source: "roadmap",
			priority: 100,
			createdAt: Date.now(),
			raw: g
		})),
		...tasks.map((t) => ({
			type: "task",
			id: t.id,
			title: t.title,
			detail: t.detail || `${t.assignee} · ${t.role}`,
			status: t.status,
			source: t.role || "task_graph",
			priority: t.priority ?? 50,
			createdAt: Date.now(),
			raw: t
		})),
		...workQueue.map((w) => ({
			type: "queue",
			id: w.id,
			title: typeof w.payload === "string" ? w.payload : JSON.stringify(w.payload),
			detail: w.acceptancePredicate,
			status: w.status,
			source: w.source,
			priority: w.priority,
			createdAt: w.createdAt,
			raw: w
		}))
	].sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
	const filteredItems = unifiedItems.filter((item) => {
		if (filterTab === "all") return true;
		if (filterTab === "goals") return item.type === "goal";
		if (filterTab === "tasks") return item.type === "task";
		if (filterTab === "pending") return item.status === "pending";
		if (filterTab === "running") return item.status === "running" || item.status === "assigned" || item.status === "claimed";
		if (filterTab === "completed") return item.status === "completed";
		if (filterTab === "failed") return item.status === "failed" || item.status === "cancelled" || item.status === "expired";
		return true;
	});
	const handleEnqueue = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
			await enqueueWorkItemServer({ data: {
				source,
				payloadStr,
				acceptancePredicate,
				priority: Number(priority),
				spendBearing
			} });
			setShowEnqueue(false);
			setPayloadStr("{\n  \"task\": \"custom_job\"\n}");
			updateFromReal();
		} catch (err) {
			console.error("Failed to enqueue work item:", err);
		} finally {
			setLoading(false);
		}
	};
	const handleAddGoal = async (e) => {
		e.preventDefault();
		if (!goalTitle.trim()) return;
		setLoading(true);
		try {
			await addGoalServer({ data: {
				title: goalTitle.trim(),
				description: goalDesc.trim()
			} });
			setShowAddGoal(false);
			setGoalTitle("");
			setGoalDesc("");
			updateFromReal();
		} catch (err) {
			console.error("Failed to add goal:", err);
		} finally {
			setLoading(false);
		}
	};
	const handleItemAction = async (item, action, newPriority) => {
		try {
			if (item.type === "goal") await controlGoalServer({ data: {
				id: item.id,
				action
			} });
			else if (item.type === "task") await controlTaskGraphServer({ data: {
				id: item.id,
				action,
				newPriority
			} });
			else if (item.type === "queue") await controlWorkItemServer({ data: {
				id: item.id,
				action,
				newPriority
			} });
			updateFromReal();
		} catch (err) {
			console.error(`Failed to execute ${action} on ${item.type} ${item.id}:`, err);
		}
	};
	const applyPreset = (preset) => {
		setSource(preset.source);
		setPriority(preset.priority);
		setPayloadStr(preset.payload);
		setShowEnqueue(true);
	};
	const statusTone = (status) => {
		switch (status) {
			case "pending":
			case "active": return "warn";
			case "claimed":
			case "assigned":
			case "running": return "quiet";
			case "completed": return "ok";
			case "failed":
			case "cancelled":
			case "expired": return "crit";
			default: return "outline";
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "flex flex-col gap-3 p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 mb-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Target, { className: "h-4 w-4 text-primary" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-semibold uppercase tracking-wider text-primary",
							children: "Active Mission & Strategy"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ml-auto flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "quiet",
								className: "text-[10px]",
								children: entelechy.riskPosture
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "button",
								variant: "outline",
								size: "sm",
								className: "h-6 px-2 text-[10px]",
								onClick: () => {
									setCustomMissionText(entelechy.mission || "");
									setShowEditMission(!showEditMission);
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pen, { className: "h-3 w-3 mr-1" }), showEditMission ? "Cancel" : "Edit Mission"]
							})]
						})
					]
				}), showEditMission ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex flex-col gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: customMissionText,
						onChange: (e) => setCustomMissionText(e.target.value),
						placeholder: "Enter new active mission strategy...",
						className: "h-8 text-xs bg-background"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-end gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							size: "sm",
							className: "h-7 text-xs text-muted-foreground hover:text-foreground",
							onClick: () => handleUpdateMission(""),
							children: "Clear Override"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							disabled: loading,
							size: "sm",
							className: "h-7 text-xs",
							onClick: () => handleUpdateMission(customMissionText),
							children: loading ? "Saving..." : "Save Mission Strategy"
						})]
					})]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-foreground font-medium text-sm",
					children: entelechy.mission || "Active orchestration — awaiting operational directives"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground mt-1 line-clamp-1",
					children: entelechy.recommendation || "—"
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, {
				className: "flex flex-row items-center justify-between p-0 pt-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "h-4 w-4 text-primary" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, {
							className: "text-sm font-semibold uppercase tracking-wider text-muted-foreground",
							children: "Operations & Task Control"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1 ml-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setFilterTab("all"),
									className: cn("rounded px-2 py-0.5 text-xs font-medium transition-colors", filterTab === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"),
									children: [
										"All (",
										unifiedItems.length,
										")"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setFilterTab("goals"),
									className: cn("rounded px-2 py-0.5 text-xs font-medium transition-colors", filterTab === "goals" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"),
									children: [
										"Goals (",
										goals.length,
										")"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setFilterTab("tasks"),
									className: cn("rounded px-2 py-0.5 text-xs font-medium transition-colors", filterTab === "tasks" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"),
									children: [
										"Tasks (",
										tasksCount,
										")"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setFilterTab("pending"),
									className: cn("rounded px-2 py-0.5 text-xs font-medium transition-colors", filterTab === "pending" ? "bg-amber-500 text-black font-semibold" : "bg-secondary text-muted-foreground hover:text-foreground"),
									children: [
										"Pending (",
										pendingCount,
										")"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setFilterTab("running"),
									className: cn("rounded px-2 py-0.5 text-xs font-medium transition-colors", filterTab === "running" ? "bg-blue-500 text-white" : "bg-secondary text-muted-foreground hover:text-foreground"),
									children: [
										"In Flight (",
										runningCount,
										")"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setFilterTab("completed"),
									className: cn("rounded px-2 py-0.5 text-xs font-medium transition-colors", filterTab === "completed" ? "bg-emerald-500 text-black font-semibold" : "bg-secondary text-muted-foreground hover:text-foreground"),
									children: [
										"Done (",
										completedCount,
										")"
									]
								}),
								failedCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setFilterTab("failed"),
									className: cn("rounded px-2 py-0.5 text-xs font-medium transition-colors", filterTab === "failed" ? "bg-rose-500 text-white font-semibold" : "bg-secondary text-rose-400 hover:text-rose-300"),
									children: [
										"Failed (",
										failedCount,
										")"
									]
								})
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							variant: "outline",
							size: "sm",
							onClick: () => setShowAddGoal(!showAddGoal),
							className: "text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-3.5 w-3.5 mr-1" }), showAddGoal ? "Cancel Goal" : "Add Goal"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							variant: "outline",
							size: "sm",
							onClick: () => setShowEnqueue(!showEnqueue),
							className: "text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-3.5 w-3.5 mr-1" }), showEnqueue ? "Cancel Queue" : "Enqueue Work"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							size: "icon",
							onClick: () => updateFromReal(),
							title: "Refresh Operations",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-3.5 w-3.5" })
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-1.5 pt-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1",
					children: "Quick Templates:"
				}), TASK_PRESETS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => applyPreset(p),
					className: "rounded border border-border bg-secondary/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
					children: ["+ ", p.name]
				}, p.name))]
			}),
			showAddGoal && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: handleAddGoal,
				className: "flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-1 sm:grid-cols-2 gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "text-muted-foreground block mb-1",
						children: "Goal Title"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: goalTitle,
						onChange: (e) => setGoalTitle(e.target.value),
						placeholder: "e.g. Execute Sovereign Bounty",
						className: "h-8 text-xs"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "text-muted-foreground block mb-1",
						children: "Description / Detail"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: goalDesc,
						onChange: (e) => setGoalDesc(e.target.value),
						placeholder: "Detailed objectives...",
						className: "h-8 text-xs"
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex justify-end gap-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						disabled: loading,
						size: "sm",
						className: "h-8 text-xs",
						children: loading ? "Adding Goal..." : "Create Mission Goal"
					})
				})]
			}),
			showEnqueue && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: handleEnqueue,
				className: "flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "text-muted-foreground block mb-1",
								children: "Source"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: source,
								onChange: (e) => setSource(e.target.value),
								placeholder: "source",
								className: "h-8 text-xs"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "text-muted-foreground block mb-1",
								children: "Priority (0-100)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "number",
								value: priority,
								onChange: (e) => setPriority(Number(e.target.value)),
								className: "h-8 text-xs"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "col-span-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "text-muted-foreground block mb-1",
									children: "Acceptance Predicate"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: acceptancePredicate,
									onChange: (e) => setAcceptancePredicate(e.target.value),
									placeholder: "result.success === true",
									className: "h-8 text-xs font-mono"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center gap-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "flex items-center gap-1.5 cursor-pointer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: spendBearing,
								onChange: (e) => setSpendBearing(e.target.checked),
								className: "rounded border-border"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground",
								children: "Spend Bearing Task"
							})]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "text-muted-foreground block mb-1",
						children: "Payload (JSON)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						value: payloadStr,
						onChange: (e) => setPayloadStr(e.target.value),
						rows: 3,
						className: "w-full rounded-md border border-input bg-background px-3 py-1.5 font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end gap-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							disabled: loading,
							size: "sm",
							className: "h-8 text-xs",
							children: loading ? "Enqueuing..." : "Submit to Work Queue"
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollArea, {
				className: "h-[500px]",
				children: filteredItems.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex h-32 items-center justify-center text-xs text-muted-foreground",
					children: "No items match this filter."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-col gap-1.5 pr-2",
					children: filteredItems.map((item) => {
						const isExpanded = expandedId === item.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col rounded-md border border-border bg-card/60 p-2.5 text-xs transition-colors hover:bg-muted/30",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 min-w-0 flex-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											variant: "outline",
											className: "text-[9px] uppercase tracking-wider text-primary",
											children: item.type
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											variant: statusTone(item.status),
											className: "text-[10px] uppercase",
											children: item.status
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-mono text-muted-foreground text-[11px] truncate",
											children: [item.id.slice(0, 8), "…"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-medium text-foreground truncate",
											children: [
												"[",
												item.source,
												"] ",
												item.title
											]
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5 shrink-0",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-muted-foreground mr-1",
											children: formatAgo(item.createdAt, Date.now())
										}),
										item.type === "goal" && item.status === "active" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											type: "button",
											variant: "ghost",
											size: "icon",
											className: "h-6 w-6 text-emerald-400 hover:text-emerald-300",
											onClick: () => handleItemAction(item, "complete"),
											title: "Complete Goal",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-3.5 w-3.5" })
										}),
										item.type !== "goal" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												type: "button",
												variant: "ghost",
												size: "icon",
												className: "h-6 w-6 text-amber-400 hover:text-amber-300",
												onClick: () => handleItemAction(item, "move_top"),
												title: "Move to Top",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronsUp, { className: "h-3.5 w-3.5" })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												type: "button",
												variant: "ghost",
												size: "icon",
												className: "h-6 w-6",
												onClick: () => handleItemAction(item, "reprioritize", item.priority + 5),
												title: "Increase Priority (+5)",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "h-3 w-3" })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												type: "button",
												variant: "ghost",
												size: "icon",
												className: "h-6 w-6",
												onClick: () => handleItemAction(item, "reprioritize", Math.max(0, item.priority - 5)),
												title: "Decrease Priority (-5)",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { className: "h-3 w-3" })
											})
										] }),
										(item.status === "failed" || item.status === "cancelled" || item.status === "expired") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											type: "button",
											variant: "ghost",
											size: "icon",
											className: "h-6 w-6 text-cyan-400 hover:text-cyan-300",
											onClick: () => handleItemAction(item, "retry"),
											title: "Retry / Re-queue",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-3 w-3" })
										}),
										(item.status === "pending" || item.status === "active" || item.status === "assigned" || item.status === "running") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											type: "button",
											variant: "ghost",
											size: "icon",
											className: "h-6 w-6 text-rose-400 hover:text-rose-300",
											onClick: () => handleItemAction(item, "fail"),
											title: "Cancel / Fail",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "h-3 w-3" })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											type: "button",
											variant: "ghost",
											size: "icon",
											className: "h-6 w-6 text-muted-foreground hover:text-destructive",
											onClick: () => handleItemAction(item, "delete"),
											title: "Delete Item",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3 w-3" })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											type: "button",
											variant: "ghost",
											size: "sm",
											className: "h-6 px-1.5 text-[10px]",
											onClick: () => setExpandedId(isExpanded ? null : item.id),
											children: isExpanded ? "Less" : "Details"
										})
									]
								})]
							}), isExpanded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex flex-col gap-1 rounded bg-background/80 p-2 font-mono text-[11px] border border-border/50",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground",
									children: "Detail: "
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.detail })] }), item.type === "queue" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground",
									children: "Payload: "
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
									className: "mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-muted/50 p-1.5 text-[10px]",
									children: typeof item.raw.payload === "string" ? item.raw.payload : JSON.stringify(item.raw.payload, null, 2)
								})] })]
							})]
						}, `${item.type}-${item.id}`);
					})
				})
			})
		]
	});
}
function shortAddr(addr) {
	return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
function MissionDashboard() {
	const [activeTab, setActiveTab] = (0, import_react.useState)("operations");
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
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegionSwarmPanel, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MissionStrip, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(VitalGrid, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2 border-b border-border pb-2.5 my-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									type: "button",
									variant: activeTab === "operations" ? "default" : "outline",
									size: "sm",
									onClick: () => setActiveTab("operations"),
									className: "gap-2 text-xs font-semibold",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "h-3.5 w-3.5 text-amber-400" }), "Operations & Work Queue"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									type: "button",
									variant: activeTab === "brain" ? "default" : "outline",
									size: "sm",
									onClick: () => setActiveTab("brain"),
									className: "gap-2 text-xs font-semibold",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Brain, { className: "h-3.5 w-3.5 text-purple-400" }), "Cognition & Swarm"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									type: "button",
									variant: activeTab === "economics" ? "default" : "outline",
									size: "sm",
									onClick: () => setActiveTab("economics"),
									className: "gap-2 text-xs font-semibold",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Coins, { className: "h-3.5 w-3.5 text-emerald-400" }), "Economics & Infra"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									type: "button",
									variant: activeTab === "logs" ? "default" : "outline",
									size: "sm",
									onClick: () => setActiveTab("logs"),
									className: "gap-2 text-xs font-semibold",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Terminal, { className: "h-3.5 w-3.5 text-cyan-400" }), "System Logs"]
								})
							]
						}),
						activeTab === "operations" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkQueuePanel, {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid gap-4 lg:grid-cols-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GoalsPanel, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TasksPanel, {})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialoguePanel, {})
							]
						}),
						activeTab === "brain" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid gap-4 lg:grid-cols-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThoughtsPanel, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkersPanel, {})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenClawPanel, {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FleetCensusPanel, {})
							]
						}),
						activeTab === "economics" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-4 lg:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpendPanel, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkillsPanel, {})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-4 lg:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoltbookPanel, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemoryBanksPanel, {})]
							})]
						}),
						activeTab === "logs" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-col gap-4",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogsPanel, {})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FooterNote, {})
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
/**
* Honest footer: names the real data sources and the live snapshot age,
* replacing the mock-era "Homestead simulation" disclaimer that became
* false the moment this dashboard started reading real state.
*/
function FooterNote() {
	const paused = useHomestead((s) => s.paused);
	const now = useHomestead((s) => s.now);
	const lastFetchedAt = useHomestead((s) => s.lastFetchedAt);
	const age = lastFetchedAt ? Math.max(0, now - lastFetchedAt) : null;
	const ageLabel = age === null ? "awaiting first snapshot" : age < 5e3 ? "snapshot just now" : age < 6e4 ? `snapshot ${Math.floor(age / 1e3)}s ago` : `snapshot ${Math.floor(age / 6e4)}m ago`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: "text-center text-xs text-muted-foreground",
		children: [
			"Live telemetry — state.db · raw log · OpenClaw gateway · Entelechy MCP.",
			" ",
			paused ? "Updates paused." : ageLabel + "."
		]
	});
}
function MissionStrip() {
	const entelechy = useHomestead((s) => s.entelechy);
	const metacog = useHomestead((s) => s.metacog);
	const alerts = useHomestead((s) => s.alerts) || [];
	const now = useHomestead((s) => s.now);
	const updateFromReal = useHomestead((s) => s.updateFromReal);
	const handleClearPlan = async () => {
		try {
			await clearPlanServer({ data: {} });
			updateFromReal();
		} catch (err) {
			console.error("Failed to clear plan:", err);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-muted-foreground uppercase",
					children: "Mission"
				}), (entelechy.estimatedTotalCostCents !== null || entelechy.risks.length > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "ghost",
					size: "sm",
					className: "h-6 text-[11px] text-muted-foreground hover:text-foreground",
					onClick: handleClearPlan,
					title: "Clear stale orchestrator plan from database",
					children: "Clear Stale Plan"
				})]
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
					entelechy.estimatedTotalCostCents !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
						variant: "quiet",
						children: ["plan est. $", (entelechy.estimatedTotalCostCents / 100).toFixed(2)]
					}),
					entelechy.priorities.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: "outline",
						children: p
					}, p)),
					entelechy.risks.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
						variant: "quiet",
						children: ["risk: ", r.length > 48 ? r.slice(0, 47) + "…" : r]
					}, r))
				]
			}),
			metacog && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 rounded-lg border bg-secondary/40 px-4 py-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-x-4 gap-y-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-wide text-muted-foreground uppercase",
							children: "Metacog"
						}), metacog.status === "live" ? metacog.soul ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-foreground",
							children: [
								metacog.soul.identity ?? "soul",
								" · v",
								metacog.soul.version,
								" · sigil ",
								metacog.soul.sigil ?? "—"
							]
						}), metacog.soulLineageDepth > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-muted-foreground",
							children: [metacog.soulLineageDepth, " molts"]
						})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted-foreground",
							children: "no soul encoding yet"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted-foreground",
							children: "unreachable"
						})]
					}),
					metacog.soul?.posture && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: ["posture: ", metacog.soul.posture]
					}),
					metacog.soul?.covenant && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: ["covenant: ", metacog.soul.covenant]
					}),
					Object.keys(metacog.disposition).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 flex flex-wrap gap-3",
						children: Object.entries(metacog.disposition).map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-muted-foreground tabular-nums",
							children: [
								k,
								": ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-foreground font-medium",
									children: v
								})
							]
						}, k))
					})
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
					tone: tierTone(vitals.tier),
					badge: vitals.isVirtual ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VirtualTreasuryBadge, { tier: vitals.tier }) : void 0
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
function Vital({ label, value, hint, tone, pulse, badge }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 flex items-center gap-2 text-2xl font-medium leading-tight tracking-tight",
				children: [
					tone ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, {
						tone,
						pulse
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular-nums",
						children: value
					}),
					badge
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: hint
			})
		]
	});
}
/**
* Survival-mode disclosure badge. Not cosmetic: tone and animation track the
* tier cliff edges the survival engine enforces server-side.
*   high/normal → quiet VIRTUAL tag; critical ($0 wall) → pulsing red;
*   dead (debt) → grayscale HALTED.
*/
function VirtualTreasuryBadge({ tier }) {
	const style = tier === "critical" ? "border-red-500/70 bg-red-950/50 text-red-400 animate-pulse font-medium" : tier === "dead" ? "border-zinc-700 bg-zinc-900 text-zinc-500 grayscale" : "border-amber-500/40 bg-amber-950/20 text-amber-400";
	const label = tier === "critical" ? "VIRTUAL · CRIT" : tier === "dead" ? "VIRTUAL · HALTED" : "VIRTUAL";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: `ml-2 shrink-0 rounded border px-1.5 py-0.5 align-middle text-[10px] tracking-widest uppercase ${style}`,
		title: "Simulated treasury — same finality as live billing while survival mode is on",
		children: label
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Task graph" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "text-xs text-muted-foreground",
		children: [tasks.length, " nodes"]
	})] }), tasks.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground p-4",
		children: "No task nodes in graph."
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "flex max-h-96 flex-col gap-2 overflow-auto p-4 pt-0",
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
								t.role,
								" · P:",
								t.priority
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "flex flex-col h-full",
		children: [
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
		]
	});
}
function SkillsPanel() {
	const skills = useHomestead((s) => s.skills);
	const toggleSkill = useHomestead((s) => s.toggleSkill);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "flex flex-col h-full overflow-hidden",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Skills library" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "text-xs text-muted-foreground",
			children: [skills.filter((s) => s.enabled).length, " enabled"]
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto pr-1",
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
		})]
	});
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
function bankTone(status) {
	return status === "live" ? "ok" : "crit";
}
function MemoryBanksPanel() {
	const feed = useHomestead((s) => s.memoryBanks);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Entelechy memory banks" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "text-xs text-muted-foreground",
		children: ["mindmods.org · active: ", feed.activeBank]
	})] }), feed.banks.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground",
		children: "No bank data yet."
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-2 sm:grid-cols-2",
		children: feed.banks.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-lg bg-secondary/70 px-3 py-2.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, {
							tone: bankTone(b.status),
							pulse: b.status === "live"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-sm font-medium",
							children: b.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: b.status === "live" ? "ok" : "crit",
							className: "ml-auto",
							children: b.status === "live" ? "live" : "unreachable"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1.5 text-sm tabular-nums",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: b.documents.toLocaleString()
						}),
						" docs ·",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: b.nodes.toLocaleString()
						}),
						" nodes ·",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: b.links.toLocaleString()
						}),
						" links"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-xs text-muted-foreground tabular-nums",
					children: [
						b.experiences.toLocaleString(),
						" experience · ",
						b.observations.toLocaleString(),
						" observation ·",
						" ",
						b.worldFacts.toLocaleString(),
						" world"
					]
				})
			]
		}, b.id))
	})] });
}
function censusTone(reconcile) {
	return reconcile === "confirmed" ? "ok" : reconcile === "workspace_only" ? "warn" : "crit";
}
function FleetCensusPanel() {
	const census = useHomestead((s) => s.fleetCensus);
	const syncedLabel = census.syncedAt ? new Date(census.syncedAt).toLocaleString() : "never";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Fleet census" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "text-xs text-muted-foreground",
			children: [
				"synced ",
				syncedLabel,
				census.stale ? " · heartbeat pending" : ""
			]
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-2 text-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
					variant: "quiet",
					children: [census.registered.toLocaleString(), " registered"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
					variant: "ok",
					children: [census.confirmed, " confirmed"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
					variant: "warn",
					children: [census.workspaceOnly, " workspace-only"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
					variant: "crit",
					children: [census.phantom.toLocaleString(), " phantom"]
				}),
				census.duplicateNames > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
					variant: "warn",
					children: [census.duplicateNames, " dup names"]
				})
			]
		}),
		census.candidates.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium uppercase tracking-wide text-muted-foreground",
					children: "Destroy candidates (ranked)"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-1.5 flex max-h-44 flex-col gap-1 overflow-y-auto",
					children: census.candidates.slice(0, 10).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center gap-2 rounded-lg bg-secondary/70 px-3 py-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusDot, { tone: censusTone(c.reconcile) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate font-mono text-xs",
								children: c.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: censusTone(c.reconcile),
								className: "ml-auto shrink-0",
								children: c.reconcile.replace("_", " ")
							})
						]
					}, c.id))
				}),
				census.candidates.length > 10 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: [
						"+",
						census.candidates.length - 10,
						" more queued for cleanup"
					]
				})
			]
		}),
		census.audit.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium uppercase tracking-wide text-muted-foreground",
				children: "Destroy audit"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-1.5 flex flex-col gap-1",
				children: census.audit.slice(-3).map((a, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "text-xs text-muted-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono",
							children: a.agentName
						}),
						" · ",
						a.destroyClass,
						" ·",
						" ",
						a.reason
					]
				}, i))
			})]
		})
	] });
}
function OpenClawPanel() {
	const agents = useHomestead((s) => s.openclaw);
	const gw = useHomestead((s) => s.gatewayActivity);
	const now = useHomestead((s) => s.now);
	const sessionByAgent = new Map(gw?.sessions.map((s) => [s.agentId, s]) ?? []);
	const gwSyncedMs = gw?.syncedAt ? Date.parse(gw.syncedAt) : null;
	const gwSyncAge = gwSyncedMs !== null && Number.isFinite(gwSyncedMs) ? now - gwSyncedMs : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "OpenClaw remote" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "text-xs text-muted-foreground",
			children: [
				"Mindmods server",
				gwSyncAge !== null ? gwSyncAge < 9e5 ? ` · activity ${formatAgo(gwSyncedMs ?? now, now)}` : " · activity stale" : "",
				gw?.logSource === "file" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-amber-500",
					children: " · via file-log fallback (API answered nothing)"
				}),
				gw?.logSource === "none" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-destructive",
					children: " · log source offline"
				})
			]
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "flex flex-col gap-2",
			children: agents.map((a) => {
				const session = sessionByAgent.get(a.name) ?? sessionByAgent.get(a.id);
				const wsEntry = gw?.workspaces.find((w) => w.name === a.name);
				const doing = session?.lastLabel ?? (wsEntry?.recent[0] ? `last touched: ${wsEntry.recent[0].file}` : a.task);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
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
							className: "mt-1 truncate text-sm",
							title: doing,
							children: doing || "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-xs text-muted-foreground tabular-nums",
							children: [
								session ? `${session.sessionCount} session${session.sessionCount === 1 ? "" : "s"}` : "no gateway sessions",
								" · ",
								"last ",
								formatAgo(now - a.lastAgoMs, now),
								session?.model ? ` · ${session.model}` : ""
							]
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
				}, a.id);
			})
		}),
		gw?.workspaces.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 border-t pt-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-wide text-muted-foreground uppercase",
				children: "Workspace activity (unregistered children)"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 flex flex-col gap-1.5",
				children: gw.workspaces.slice(0, 6).map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-lg bg-secondary/50 px-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium",
							children: w.name
						}), w.recent[0] && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[10px] text-muted-foreground tabular-nums",
							children: ["last touch ", formatAgo(now - w.recent[0].ageMs, now)]
						})]
					}), w.recent.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 truncate font-mono text-[10px] text-muted-foreground",
						title: w.recent.map((f) => `${f.file} (${formatAgo(now - f.ageMs, now)})`).join("\n"),
						children: w.recent.map((f) => f.file).join(" · ")
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-[10px] text-muted-foreground",
						children: "no recent file activity"
					})]
				}, w.name))
			})]
		}) : null
	] });
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MissionDashboard, {});
}
//#endregion
export { Home as component };
