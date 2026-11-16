export type AgentState = "running" | "sleeping" | "paused";

export type SurvivalTier = "dead" | "critical" | "low_compute" | "normal" | "high";

export type GoalStatus = "active" | "completed" | "blocked";
export type TaskStatus = "pending" | "assigned" | "running" | "completed" | "failed";
export type WorkItemStatus = "pending" | "claimed" | "completed" | "failed" | "expired";
export type ChildKind = "local" | "openclaw";
export type ChildStatus = "healthy" | "starting" | "unhealthy" | "stopped";
export type LogLevel = "info" | "warn" | "error" | "tool" | "thought";
export type InboxFrom = "creator" | "peer" | "system" | "child" | "agent";
export type InboxPriority = "supreme" | "work" | "status";
export type AlertSeverity = "info" | "warn" | "crit";
export type PeerStatus = "online" | "quiet" | "offline";

export interface WorkItem {
  id: string;
  source: string;
  priority: number;
  payload: Record<string, any> | string;
  acceptancePredicate: string;
  spendBearing: boolean;
  status: WorkItemStatus;
  claimedBy?: string;
  leaseExpiresAt?: number;
  result?: Record<string, any> | string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Goal {
  id: string;
  title: string;
  detail: string;
  status: GoalStatus;
  progress: number;
  expectedRevenueCents: number;
  actualRevenueCents: number;
}

export interface Task {
  id: string;
  goalId: string;
  title: string;
  detail?: string;
  status: TaskStatus;
  assignee: string;
  role: string;
  result?: string;
}

export interface Child {
  id: string;
  name: string;
  kind: ChildKind;
  status: ChildStatus;
  role: string;
  lastBeatAgoMs: number;
  task?: string;
  latencyMs?: number;
  fundedCents?: number;
}

export interface Thought {
  id: string;
  at: number;
  thinking: string;
  speech?: string;
  tools: string[];
}

export interface LogLine {
  id: string;
  at: number;
  level: LogLevel;
  source: string;
  message: string;
}

export interface InboxMessage {
  id: string;
  from: InboxFrom;
  content: string;
  at: number;
  status: "received" | "claimed" | "done";
  priority: InboxPriority;
}

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  at: number;
}

export interface SpendPoint {
  hour: string;
  cents: number;
}

export interface ModelSpend {
  model: string;
  calls: number;
  cents: number;
}

export interface ToolSpend {
  tool: string;
  category: string;
  cents: number;
}

export interface PolicyDenial {
  id: string;
  tool: string;
  rule: string;
  at: number;
}

export interface Skill {
  name: string;
  summary: string;
  enabled: boolean;
  autoActivate: boolean;
}

export interface Heartbeat {
  name: string;
  cadence: string;
  lastAgoMs: number;
  ok: boolean;
}

export interface EntelechyCapsule {
  mission: string;
  riskPosture: string;
  priorities: string[];
  /** Top risks from the plan's own risk list (truncated for the strip). */
  risks: string[];
  recommendation: string;
  /** KV key of the plan this capsule was derived from (null = no plan yet). */
  planRef: string | null;
  /** The plan's own cost estimate in cents (null = not stated). */
  estimatedTotalCostCents: number | null;
}

export interface Peer {
  id: string;
  name: string;
  handle: string;
  status: PeerStatus;
  lastAgoMs: number;
  note: string;
  claimed: boolean;
  posts: number;
  followers: number | null;
  following: number | null;
  karma: number | null;
}

export interface OpenClawAgent {
  id: string;
  name: string;
  live: boolean;
  task: string;
  lastAgoMs: number;
  errors: Array<{ at: number; tool: string; error: string }>;
}

/** One normalized line from the OpenClaw gateway log (via KV sync). */
export interface GatewayLogLine {
  time: string;
  level: "info" | "warn" | "error";
  subsystem: string;
  message: string;
}

/** Per-agent session summary from the OpenClaw gateway. */
export interface GatewayAgentSession {
  agentId: string;
  sessionCount: number;
  lastLabel: string | null;
  lastAgeMs: number | null;
  lastUpdatedAt: number | null;
  model: string | null;
}

/**
 * Recent activity for a workspace-only child. These workspaces contain no log
 * files — the honest signal is which files were touched most recently.
 */
export interface WorkspaceTail {
  name: string;
  /** Up to 3 most recently modified files, newest first. */
  recent: Array<{ file: string; ageMs: number }>;
}

export interface GatewayActivityFeed {
  syncedAt: string | null;
  log: GatewayLogLine[];
  logTruncated: boolean;
  /** Which path fed `log`: the OpenClaw API (preferred), the SSH file fallback, or neither. */
  logSource: "rpc" | "file" | "none" | null;
  sessions: GatewayAgentSession[];
  workspaces: WorkspaceTail[];
  errors: string[];
}

export interface MemoryBankStats {
  id: string;
  name: string;
  documents: number;
  nodes: number;
  links: number;
  createdAt: string | null;
  experiences: number;
  observations: number;
  worldFacts: number;
  status: "live" | "unreachable";
}

export interface MemoryBanksFeed {
  activeBank: string;
  banks: MemoryBankStats[];
}

export interface Vitals {
  name: string;
  state: AgentState;
  model: string;
  tier: SurvivalTier;
  creditsCents: number;
  usdcCents: number;
  reserveCents: number;
  turns: number;
  startedAt: number;
  sleepUntil: number | null;
  creator: string;
  sigil: string;
  /** True when Cletus runs in survival mode: the balance is a simulated
   *  wallet and tier edges carry live-billing finality. */
  isVirtual: boolean;
}

/**
 * Fleet census synced from Cletus's heartbeat (KV key `fleet_census`).
 * Server reads it from the same KV scan as every other key — no remote calls.
 */
export interface FleetCensusFeed {
  /** ISO timestamp of the last heartbeat census sync (null = never synced). */
  syncedAt: string | null;
  registered: number;
  confirmed: number;
  workspaceOnly: number;
  phantom: number;
  duplicateNames: number;
  /** Top destroy candidates ranked by the reconciler. */
  candidates: Array<{
    id: string;
    name: string;
    reconcile: "confirmed" | "workspace_only" | "phantom";
    rank: number;
  }>;
  /** Recent destroy audit entries (agent, reason, when). */
  audit: Array<{
    at: string;
    agentName: string;
    destroyClass: string;
    reason: string;
  }>;
  /** true when the KV key is absent or unparseable (heartbeat not running / old DB). */
  stale: boolean;
}

/**
 * Metacognitive state fetched from the Entelechy MCP server (mindmods.org/mcp):
 * the bank's disposition sliders, mission line, and the current soul encoding
 * (the "become" identity state) plus its molt lineage depth.
 */
export interface MetacogState {
  /** Bank disposition sliders, e.g. { skepticism: 4, literalism: 4, empathy: 3 }. */
  disposition: Record<string, number>;
  /** The bank's mission line, verbatim. */
  mission: string | null;
  /** Current soul encoding, null when the bank has no soul yet. */
  soul: {
    version: number;
    identity: string | null;
    sigil: string | null;
    posture: string | null;
    covenant: string | null;
    aesthetics: string | null;
    substrate: string | null;
  } | null;
  /** Depth of the molt lineage (number of soul versions). */
  soulLineageDepth: number;
  /** When the current soul version was created (ISO). */
  soulUpdatedAt: string | null;
  status: "live" | "unreachable";
  fetchedAt: string;
}

export interface HomesteadSnapshot {
  vitals: Vitals;
  goals: Goal[];
  tasks: Task[];
  workQueue: WorkItem[];
  children: Child[];
  thoughts: Thought[];
  logs: LogLine[];
  inbox: InboxMessage[];
  alerts: AlertItem[];
  spend24h: SpendPoint[];
  spendByModel: ModelSpend[];
  toolSpends: ToolSpend[];
  denials: PolicyDenial[];
  skills: Skill[];
  heartbeats: Heartbeat[];
  entelechy: EntelechyCapsule;
  peers: Peer[];
  openclaw: OpenClawAgent[];
  fleetCensus: FleetCensusFeed;
  memoryBanks: MemoryBanksFeed;
  /** Gateway activity (worker sessions + log lines), null until Cletus's heartbeat has synced. */
  gatewayActivity: GatewayActivityFeed | null;
  /** Remote metacog state — null when offline mode or the MCP server is unreachable. */
  metacog: MetacogState | null;
  pendingAck: string | null;
}
