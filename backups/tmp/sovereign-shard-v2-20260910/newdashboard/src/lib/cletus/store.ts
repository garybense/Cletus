import { create } from "zustand";
import type {
  HomesteadSnapshot,
  InboxMessage,
  LogLevel,
  LogLine,
  SpendPoint,
  SurvivalTier,
  Task,
} from "./types";
import { nid } from "./format";

const DECREE_KEY = "cletus-mission-decrees";
const LOG_CAP = 220;
const THOUGHT_CAP = 28;
const INBOX_CAP = 40;
const TASK_CAP = 18;
/** Frozen clock so SSR HTML matches the first client paint. Shifted on hydrate. */
const SEED_NOW = 1_757_596_800_000;

const CREATOR = "92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa";

function hourLabel(now: number, hoursAgo: number): string {
  const t = new Date(now - hoursAgo * 3_600_000);
  return `${String(t.getUTCHours()).padStart(2, "0")}:00`;
}

function hoursBack(now: number, n: number): SpendPoint[] {
  const points: SpendPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const base = 18 + ((n - i) % 7) * 4;
    const spike = i === 3 || i === 8 ? 42 : 0;
    points.push({ hour: hourLabel(now, i), cents: base + spike + ((i * 13) % 11) });
  }
  return points;
}

function tierFromCredits(creditsCents: number, reserveCents: number): SurvivalTier {
  if (creditsCents <= 0) return "dead";
  if (creditsCents < reserveCents) return "critical";
  if (creditsCents < reserveCents * 3) return "low_compute";
  if (creditsCents > 50_000) return "high";
  return "normal";
}

function seedSnapshot(now: number): HomesteadSnapshot {
  const startedAt = now - 14 * 3_600_000 - 22 * 60_000;

  return {
    vitals: {
      name: "Cletus",
      state: "running",
      model: "grok-4",
      tier: "normal",
      creditsCents: 18420,
      usdcCents: 1240,
      reserveCents: 1000,
      turns: 412,
      startedAt,
      sleepUntil: null,
      creator: CREATOR,
      sigil: "CLETUS-01",
    },
    goals: [
      {
        id: "gol_bounty",
        title: "Prove a verified bounty loop",
        detail: "Find work, ship it, and record confirmed payment — not a promised payout.",
        status: "active",
        progress: 62,
        expectedRevenueCents: 4000,
        actualRevenueCents: 0,
      },
      {
        id: "gol_reserve",
        title: "Keep compute under the reserve",
        detail: "Never spend through the 10.00 cr floor, even if a model is optimistic.",
        status: "active",
        progress: 88,
        expectedRevenueCents: 0,
        actualRevenueCents: 0,
      },
      {
        id: "gol_infra",
        title: "Hold infrastructure ready",
        detail: "Soul covenant: maintain the homestead and perform assigned tasks.",
        status: "active",
        progress: 74,
        expectedRevenueCents: 0,
        actualRevenueCents: 0,
      },
      {
        id: "gol_junebug",
        title: "Stand up research child Junebug",
        detail: "OpenClaw child for bounty scouting. Result path home must be durable.",
        status: "completed",
        progress: 100,
        expectedRevenueCents: 0,
        actualRevenueCents: 0,
      },
    ],
    tasks: [
      {
        id: "tsk_scout",
        goalId: "gol_bounty",
        title: "Scout short-cycle bounties under 40.00",
        detail: "Reject any listing that matches the avoid-list provider path.",
        status: "running",
        assignee: "Junebug",
        role: "research",
      },
      {
        id: "tsk_draft",
        goalId: "gol_bounty",
        title: "Draft memory-policy writeup for submission",
        status: "assigned",
        assignee: "Cletus",
        role: "writer",
      },
      {
        id: "tsk_invoice",
        goalId: "gol_bounty",
        title: "Match last invoice against USDC",
        status: "pending",
        assignee: "Cletus",
        role: "treasury",
      },
      {
        id: "tsk_reap",
        goalId: "gol_reserve",
        title: "Reap stale local workers older than 1h",
        status: "completed",
        assignee: "heartbeat",
        role: "cleanup",
        result: "reaped 2 slots · 1 child slot free",
      },
      {
        id: "tsk_hayseed",
        goalId: "gol_bounty",
        title: "Spin Hayseed for the coding half",
        status: "assigned",
        assignee: "Cletus",
        role: "orchestrator",
      },
    ],
    children: [
      {
        id: "ch_junebug",
        name: "Junebug",
        kind: "openclaw",
        status: "healthy",
        role: "research",
        lastBeatAgoMs: 18_000,
        task: "Scout short-cycle bounties",
        latencyMs: 184,
        fundedCents: 800,
      },
      {
        id: "ch_hayseed",
        name: "Hayseed",
        kind: "openclaw",
        status: "starting",
        role: "coder",
        lastBeatAgoMs: 90_000,
        task: "Awaiting runtime_ready",
        fundedCents: 1200,
      },
      {
        id: "ch_local",
        name: "local-infer-1",
        kind: "local",
        status: "healthy",
        role: "inference",
        lastBeatAgoMs: 4_000,
        task: "Idle — parent fallback",
        latencyMs: 42,
      },
    ],
    thoughts: [
      {
        id: "thn_1",
        at: now - 38_000,
        thinking:
          "Junebug’s last scout list has three bounties. Two want a deployment path we already burned. One is a 40-dollar writeup with a 48-hour window. That’s the only one that fits proven work.",
        speech:
          "I’m taking the writeup. The other two get a no — Entelechy already warned us off that provider.",
        tools: ["recall", "create_task"],
      },
      {
        id: "thn_2",
        at: now - 96_000,
        thinking:
          "USDC is 12.40. That’s enough for a top-up if compute dips, but the top-up path is untested. I will not move money on a guess.",
        tools: ["get_balance"],
      },
      {
        id: "thn_3",
        at: now - 210_000,
        thinking:
          "Hayseed is still in starting. I will not assign coding until wallet_verified. A child report is evidence, not proof.",
        tools: ["child_status"],
      },
      {
        id: "thn_4",
        at: now - 340_000,
        thinking:
          "Soul covenant is still hold-infrastructure. A decree from the creator outranks every heartbeat. Background chores yield.",
        tools: ["list_directives"],
      },
    ],
    logs: [
      { id: "log_1", at: now - 4_000, level: "info", source: "loop", message: "turn 412 claimed · model grok-4 · 812ms" },
      { id: "log_2", at: now - 12_000, level: "tool", source: "tools", message: "recall · entelechy bank=cletus · confidence 0.76" },
      { id: "log_3", at: now - 19_000, level: "info", source: "openclaw", message: "Junebug heartbeat 184ms · status healthy" },
      { id: "log_4", at: now - 41_000, level: "thought", source: "mind", message: "selected bounty writeup · rejected two burned providers" },
      { id: "log_5", at: now - 63_000, level: "warn", source: "policy", message: "deny transfer 60.00 · exceeds max_single_transfer 50.00" },
      { id: "log_6", at: now - 88_000, level: "info", source: "heartbeat", message: "report_metrics snapshot written" },
      { id: "log_7", at: now - 121_000, level: "tool", source: "tools", message: "get_balance · credits 184.20 · usdc 12.40 · source live" },
      { id: "log_8", at: now - 160_000, level: "info", source: "orchestrator", message: "task tsk_scout assigned → Junebug" },
      { id: "log_9", at: now - 210_000, level: "warn", source: "colony", message: "Hayseed still starting · wallet_verified pending" },
      { id: "log_10", at: now - 280_000, level: "error", source: "openclaw", message: "ssh timeout on stale child slot (reaped)" },
      { id: "log_11", at: now - 340_000, level: "tool", source: "tools", message: "list_directives · bank=cletus · 1 active covenant" },
      { id: "log_12", at: now - 410_000, level: "info", source: "moltbook", message: "superteam-researcher online · 2 listings already avoid-listed" },
    ],
    inbox: [
      {
        id: "inb_sys",
        from: "system",
        content: "Heartbeat CLEANUP reaped 2 stale local workers. Child slots free: 1.",
        at: now - 25 * 60_000,
        status: "done",
        priority: "status",
      },
      {
        id: "inb_child",
        from: "child",
        content: "Junebug: three candidates. Two match avoid-list provider-x. One writeup, 40.00 expected, 48h window.",
        at: now - 8 * 60_000,
        status: "claimed",
        priority: "work",
      },
    ],
    alerts: [
      {
        id: "al_usdc",
        severity: "warn",
        title: "USDC top-up untested",
        detail: "12.40 on chain. Do not treat this as a working recover-from-empty path.",
        at: now - 12 * 60_000,
      },
      {
        id: "al_hay",
        severity: "warn",
        title: "Hayseed not wallet-verified",
        detail: "Coder child is still starting. Coding work stays with the parent.",
        at: now - 6 * 60_000,
      },
      {
        id: "al_ent",
        severity: "info",
        title: "Entelechy recall 0.76",
        detail: "Capital-preserving posture. Quiet memory would drop confidence, not grant permission.",
        at: now - 2 * 60_000,
      },
    ],
    spend24h: hoursBack(now, 24),
    spendByModel: [
      { model: "grok-4", calls: 86, cents: 612 },
      { model: "gpt-5.2", calls: 24, cents: 340 },
      { model: "local-ollama", calls: 51, cents: 0 },
      { model: "claude-sonnet", calls: 9, cents: 188 },
    ],
    toolSpends: [
      { tool: "recall", category: "memory", cents: 84 },
      { tool: "browser", category: "research", cents: 62 },
      { tool: "child_spawn", category: "colony", cents: 40 },
      { tool: "get_balance", category: "treasury", cents: 6 },
    ],
    denials: [
      { id: "den_1", at: now - 63_000, tool: "transfer", rule: "max_single_transfer 50.00 — asked 60.00" },
      { id: "den_2", at: now - 3 * 3_600_000, tool: "x402_pay", rule: "max_x402_payment 1.00 — asked 1.40" },
      { id: "den_3", at: now - 26 * 3_600_000, tool: "shell", rule: "command safety — metacharacter pipe" },
    ],
    skills: [
      { name: "bounty-scout", summary: "Find short-cycle paid work with a verifiable payout path.", enabled: true, autoActivate: true },
      { name: "invoice-verify", summary: "Treat expectedRevenue as a guess until payment clears.", enabled: true, autoActivate: true },
      { name: "openclaw-child", summary: "Spawn and harvest remote children with a result path home.", enabled: true, autoActivate: false },
      { name: "entelechy-recall", summary: "Query bank=cletus before acting. Confidence is guidance, not permission.", enabled: true, autoActivate: true },
      { name: "credit-guard", summary: "Refuse spend that would breach the reserve floor.", enabled: true, autoActivate: true },
      { name: "jupiter-swap", summary: "Swap only through allowlisted routes. Off until a human says so.", enabled: false, autoActivate: false },
    ],
    heartbeats: [
      { name: "report_metrics", cadence: "every 5m", lastAgoMs: 88_000, ok: true },
      { name: "credit_check", cadence: "every 10m", lastAgoMs: 121_000, ok: true },
      { name: "child_health", cadence: "every 2m", lastAgoMs: 19_000, ok: true },
      { name: "cleanup", cadence: "every 1h", lastAgoMs: 25 * 60_000, ok: true },
      { name: "entelechy_reflect", cadence: "every 6h", lastAgoMs: 4 * 3_600_000, ok: true },
    ],
    entelechy: {
      mission: "Produce verified digital revenue while preserving capital.",
      riskPosture: "capital_preserving",
      confidence: 0.76,
      priorities: ["Low-cost proven work", "Short feedback loops", "Keep the reserve"],
      avoid: ["provider-x deployment path", "Unverified worker claims", "Spending through reserve"],
      recommendation: "Select the 40.00 writeup. Do not fund Hayseed until wallet_verified.",
    },
    peers: [
      {
        id: "pr_super",
        name: "superteam-researcher",
        handle: "superteam",
        status: "online",
        lastAgoMs: 46_000,
        note: "Shared a Solana bounty board. Two listings already on the avoid list.",
        claimed: true,
        posts: 18,
        followers: 42,
        following: 11,
        karma: 126,
      },
      {
        id: "pr_ent1",
        name: "entelechy-researcher-1",
        handle: "ent-1",
        status: "online",
        lastAgoMs: 3 * 60_000,
        note: "Posted a recall dump. Confidence 0.71 — treat as guidance.",
        claimed: true,
        posts: 9,
        followers: 7,
        following: 4,
        karma: 31,
      },
      {
        id: "pr_child",
        name: "entelechy-child-1",
        handle: "ent-child",
        status: "quiet",
        lastAgoMs: 38 * 60_000,
        note: "Last ping was a heartbeat ack. No work claimed.",
        claimed: false,
        posts: 1,
        followers: 0,
        following: 2,
        karma: 2,
      },
    ],
    openclaw: [
      {
        id: "oc_super",
        name: "superteam-researcher",
        live: true,
        task: "Watch Superteam listings under 40.00 and report only verified payout paths.",
        lastAgoMs: 32_000,
        errors: [],
      },
      {
        id: "oc_ent1",
        name: "entelechy-researcher-1",
        live: true,
        task: "Recall bank=cletus on avoid-list providers. Do not execute transfers.",
        lastAgoMs: 71_000,
        errors: [
          { at: now - 18 * 60_000, tool: "browser", error: "timeout fetching listing page (retried)" },
        ],
      },
      {
        id: "oc_child",
        name: "entelechy-child-1",
        live: true,
        task: "Idle heartbeat. Awaiting parent assign.",
        lastAgoMs: 38 * 60_000,
        errors: [],
      },
    ],
    pendingAck: null,
  };
}

function loadPersistedDecrees(): InboxMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DECREE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InboxMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistDecrees(inbox: InboxMessage[]) {
  if (typeof window === "undefined") return;
  const decrees = inbox.filter((m) => m.from === "creator");
  try {
    localStorage.setItem(DECREE_KEY, JSON.stringify(decrees.slice(0, 30)));
  } catch {
    /* ignore quota */
  }
}

const LOG_POOL: Array<{ level: LogLevel; source: string; message: string }> = [
  { level: "info", source: "loop", message: "bounded chore complete · awaiting next claim" },
  { level: "info", source: "heartbeat", message: "credit_check · live balance confirmed" },
  { level: "info", source: "heartbeat", message: "report_metrics snapshot written" },
  { level: "tool", source: "tools", message: "get_balance · source live" },
  { level: "tool", source: "tools", message: "recall · bank=cletus" },
  { level: "info", source: "openclaw", message: "Junebug heartbeat ok" },
  { level: "info", source: "orchestrator", message: "task graph unchanged · 1 running" },
  { level: "warn", source: "colony", message: "Hayseed still starting · no coding assign" },
  { level: "thought", source: "mind", message: "holding reserve · no transfer this turn" },
  { level: "info", source: "policy", message: "evaluate transfer · first denial wins" },
  { level: "tool", source: "tools", message: "child_status · Junebug healthy" },
  { level: "info", source: "loop", message: "inbox claimed · work outranks status ping" },
  { level: "info", source: "moltbook", message: "peer superteam-researcher still online" },
  { level: "info", source: "openclaw", message: "mindmods sweep · 3 remote agents live" },
  { level: "tool", source: "tools", message: "list_directives · covenant hold-infrastructure" },
];

const THOUGHT_POOL: Array<{ thinking: string; speech?: string; tools: string[] }> = [
  {
    thinking: "Still no confirmed payout. expectedRevenue stays a guess. I will not log this as earnings.",
    tools: ["get_earnings"],
  },
  {
    thinking: "Local infer is cheap and idle. If Junebug stalls I can finish the scout myself.",
    speech: "I’ll keep the parent as fallback. No extra child until this one pays.",
    tools: ["child_status"],
  },
  {
    thinking: "Entelechy said short loops. A 48-hour writeup is the shortest honest path on the table.",
    tools: ["recall"],
  },
  {
    thinking: "A status ping arrived. It does not outrank the draft. Leaving it in the inbox.",
    tools: ["read_inbox"],
  },
  {
    thinking: "Covenant is still hold-infrastructure. Background chores continue until the creator speaks.",
    tools: ["list_directives"],
  },
];

function shiftTime<T extends { at: number }>(items: T[], drift: number): T[] {
  return items.map((item) => ({ ...item, at: item.at + drift }));
}

export interface HomesteadStore extends HomesteadSnapshot {
  paused: boolean;
  now: number;
  hydrated: boolean;
  togglePaused: () => void;
  toggleSleep: () => void;
  toggleSkill: (name: string) => void;
  issueDecree: (text: string) => void;
  tick: () => void;
  hydrate: () => void;
}

export const useHomestead = create<HomesteadStore>((set, get) => {
  const seeded = seedSnapshot(SEED_NOW);

  return {
    ...seeded,
    paused: false,
    now: SEED_NOW,
    hydrated: false,
    togglePaused: () => set({ paused: !get().paused }),
    toggleSleep: () => {
      const s = get();
      if (s.vitals.state === "sleeping") {
        const line: LogLine = {
          id: nid("log"),
          at: Date.now(),
          level: "info",
          source: "loop",
          message: "wake issued · sleep_until cleared",
        };
        set({
          vitals: { ...s.vitals, state: "running", sleepUntil: null },
          logs: [line, ...s.logs].slice(0, LOG_CAP),
          now: Date.now(),
        });
        return;
      }
      const until = Date.now() + 30 * 60_000;
      const line: LogLine = {
        id: nid("log"),
        at: Date.now(),
        level: "info",
        source: "loop",
        message: "sleep 30m · heartbeats continue, no inference",
      };
      set({
        vitals: { ...s.vitals, state: "sleeping", sleepUntil: until },
        logs: [line, ...s.logs].slice(0, LOG_CAP),
        now: Date.now(),
      });
    },
    toggleSkill: (name) => {
      set({
        skills: get().skills.map((sk) => (sk.name === name ? { ...sk, enabled: !sk.enabled } : sk)),
      });
    },
    hydrate: () => {
      if (get().hydrated) return;
      const drift = Date.now() - get().now;
      if (Math.abs(drift) > 2_000) {
        const s = get();
        set({
          now: s.now + drift,
          vitals: {
            ...s.vitals,
            startedAt: s.vitals.startedAt + drift,
            sleepUntil: s.vitals.sleepUntil === null ? null : s.vitals.sleepUntil + drift,
          },
          thoughts: shiftTime(s.thoughts, drift),
          logs: shiftTime(s.logs, drift),
          inbox: shiftTime(s.inbox, drift),
          alerts: shiftTime(s.alerts, drift),
          denials: shiftTime(s.denials, drift),
          spend24h: hoursBack(Date.now(), 24),
        });
      }
      const extra = loadPersistedDecrees();
      if (extra.length > 0) {
        const existingIds = new Set(get().inbox.map((m) => m.id));
        const merged = [...extra.filter((m) => !existingIds.has(m.id)), ...get().inbox].sort(
          (a, b) => b.at - a.at,
        );
        set({ inbox: merged.slice(0, INBOX_CAP) });
      }
      set({ hydrated: true });
    },
    issueDecree: (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const at = Date.now();
      const msg: InboxMessage = {
        id: nid("inb"),
        from: "creator",
        content: trimmed,
        at,
        status: "received",
        priority: "supreme",
      };
      const task: Task = {
        id: nid("tsk"),
        goalId: "gol_bounty",
        title: trimmed.length > 72 ? `${trimmed.slice(0, 69)}…` : trimmed,
        status: "pending",
        assignee: "Cletus",
        role: "decree",
      };
      const inbox = [msg, ...get().inbox].slice(0, INBOX_CAP);
      persistDecrees(inbox);
      const line: LogLine = {
        id: nid("log"),
        at,
        level: "info",
        source: "inbox",
        message: "creator decree received · supreme priority · wake issued",
      };
      set({
        inbox,
        pendingAck: trimmed,
        tasks: [task, ...get().tasks].slice(0, TASK_CAP),
        vitals: {
          ...get().vitals,
          state: "running",
          sleepUntil: null,
        },
        logs: [line, ...get().logs].slice(0, LOG_CAP),
        now: at,
        paused: false,
      });
    },
    tick: () => {
      const state = get();
      const now = Date.now();
      if (state.paused) {
        set({ now });
        return;
      }

      const logs = [...state.logs];
      const thoughts = [...state.thoughts];
      let pendingAck = state.pendingAck;
      let inbox = state.inbox;
      let tasks = state.tasks.map((t) => ({ ...t }));
      const goals = state.goals.map((g) => ({ ...g }));
      let turns = state.vitals.turns;
      let creditsCents = state.vitals.creditsCents;
      let spend24h = state.spend24h;
      let spendByModel = state.spendByModel.map((m) => ({ ...m }));
      let agentState = state.vitals.state;
      let sleepUntil = state.vitals.sleepUntil;
      const children = state.children.map((c) => ({
        ...c,
        lastBeatAgoMs: c.lastBeatAgoMs + 2000,
      }));
      const heartbeats = state.heartbeats.map((h) => ({
        ...h,
        lastAgoMs: h.lastAgoMs + 2000,
      }));
      const peers = state.peers.map((p) => ({
        ...p,
        lastAgoMs: p.lastAgoMs + 2000,
      }));
      const openclaw = state.openclaw.map((a) => ({
        ...a,
        lastAgoMs: a.lastAgoMs + 2000,
        errors: a.errors.map((e) => ({ ...e })),
      }));

      if (pendingAck) {
        const ack = pendingAck;
        pendingAck = null;
        inbox = inbox.map((m) =>
          m.from === "creator" && m.status === "received" && m.content === ack
            ? { ...m, status: "claimed" as const }
            : m,
        );
        tasks = tasks.map((t) =>
          t.role === "decree" && t.status === "pending" && t.title.startsWith(ack.slice(0, 20))
            ? { ...t, status: "running" as const }
            : t,
        );
        thoughts.unshift({
          id: nid("thn"),
          at: now,
          thinking: `Creator decree just landed. That outranks every heartbeat and status ping. I stop what I was doing and take the order as written: “${ack}”.`,
          speech: "Heard. Dropping background work. This is the job now.",
          tools: ["read_inbox", "create_task"],
        });
        logs.unshift({
          id: nid("log"),
          at: now,
          level: "info",
          source: "loop",
          message: "decree claimed · creator outranks heartbeat",
        });
        turns += 1;
        agentState = "running";
        sleepUntil = null;
        const junebug = children.find((c) => c.id === "ch_junebug");
        if (junebug) junebug.lastBeatAgoMs = 0;
      } else if (agentState === "sleeping") {
        if (sleepUntil && now >= sleepUntil) {
          agentState = "running";
          sleepUntil = null;
          logs.unshift({
            id: nid("log"),
            at: now,
            level: "info",
            source: "loop",
            message: "sleep elapsed · resuming bounded chores",
          });
        } else {
          const hb = heartbeats.find((h) => h.name === "credit_check");
          if (hb && hb.lastAgoMs > 10 * 60_000) {
            hb.lastAgoMs = 0;
            logs.unshift({
              id: nid("log"),
              at: now,
              level: "info",
              source: "heartbeat",
              message: "sleeping · credit_check still live",
            });
          }
        }
      } else {
        const roll = Math.random();
        if (roll < 0.72) {
          const poolLine = LOG_POOL[Math.floor(Math.random() * LOG_POOL.length)]!;
          logs.unshift({
            id: nid("log"),
            at: now,
            level: poolLine.level,
            source: poolLine.source,
            message: poolLine.message,
          });
        }
        if (roll > 0.82) {
          const th = THOUGHT_POOL[Math.floor(Math.random() * THOUGHT_POOL.length)]!;
          thoughts.unshift({ id: nid("thn"), at: now, ...th });
          turns += 1;
          const cost = 4 + Math.floor(Math.random() * 9);
          creditsCents = Math.max(state.vitals.reserveCents, creditsCents - cost);
          const last = spend24h[spend24h.length - 1];
          if (last) {
            spend24h = [...spend24h.slice(0, -1), { ...last, cents: last.cents + cost }];
          }
          const grok = spendByModel.find((m) => m.model === "grok-4");
          if (grok) {
            grok.calls += 1;
            grok.cents += cost;
          }
          const bounty = goals.find((g) => g.id === "gol_bounty" && g.status === "active");
          if (bounty && bounty.progress < 96) {
            bounty.progress = Math.min(96, bounty.progress + 1);
          }
        }
        if (roll > 0.55) {
          const j = children.find((c) => c.id === "ch_junebug");
          if (j) {
            j.lastBeatAgoMs = 0;
            j.latencyMs = 160 + Math.floor(Math.random() * 80);
          }
          const oc = openclaw.find((a) => a.id === "oc_super");
          if (oc) oc.lastAgoMs = 0;
        }
        if (roll > 0.9) {
          const p = peers[Math.floor(Math.random() * peers.length)];
          if (p) p.lastAgoMs = 0;
        }
        const hay = children.find((c) => c.id === "ch_hayseed");
        if (hay && hay.status === "starting" && Math.random() > 0.96) {
          hay.status = "healthy";
          hay.task = "Waiting on first coding assign";
          hay.lastBeatAgoMs = 0;
          hay.latencyMs = 240;
          logs.unshift({
            id: nid("log"),
            at: now,
            level: "info",
            source: "colony",
            message: "Hayseed runtime_ready · wallet_verified",
          });
          const hayTask = tasks.find((t) => t.id === "tsk_hayseed" && t.status !== "completed");
          if (hayTask) hayTask.status = "running";
        }
        const runningDecree = tasks.find((t) => t.role === "decree" && t.status === "running");
        if (runningDecree && Math.random() > 0.85) {
          runningDecree.status = "completed";
          runningDecree.result = "decree acknowledged and closed";
          inbox = inbox.map((m) =>
            m.from === "creator" && m.status === "claimed" ? { ...m, status: "done" as const } : m,
          );
          logs.unshift({
            id: nid("log"),
            at: now,
            level: "info",
            source: "orchestrator",
            message: `decree task ${runningDecree.id} marked done`,
          });
        }
        const hb = heartbeats.find((h) => h.name === "child_health");
        if (hb && hb.lastAgoMs > 120_000) hb.lastAgoMs = 0;
      }

      set({
        now,
        logs: logs.slice(0, LOG_CAP),
        thoughts: thoughts.slice(0, THOUGHT_CAP),
        inbox,
        tasks,
        goals,
        pendingAck,
        children,
        heartbeats,
        peers,
        openclaw,
        spend24h,
        spendByModel,
        vitals: {
          ...state.vitals,
          turns,
          creditsCents,
          state: agentState,
          sleepUntil,
          tier: tierFromCredits(creditsCents, state.vitals.reserveCents),
        },
      });
    },
  };
});
