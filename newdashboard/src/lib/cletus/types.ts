export type AgentState = "running" | "sleeping" | "paused";

export type SurvivalTier = "dead" | "critical" | "low_compute" | "normal" | "high";

export type GoalStatus = "active" | "completed" | "blocked";
export type TaskStatus = "pending" | "assigned" | "running" | "completed" | "failed";
export type ChildKind = "local" | "openclaw";
export type ChildStatus = "healthy" | "starting" | "unhealthy" | "stopped";
export type LogLevel = "info" | "warn" | "error" | "tool" | "thought";
export type InboxFrom = "creator" | "peer" | "system" | "child";
export type InboxPriority = "supreme" | "work" | "status";
export type AlertSeverity = "info" | "warn" | "crit";
export type PeerStatus = "online" | "quiet" | "offline";

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
  confidence: number;
  priorities: string[];
  avoid: string[];
  recommendation: string;
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
}

export interface HomesteadSnapshot {
  vitals: Vitals;
  goals: Goal[];
  tasks: Task[];
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
  pendingAck: string | null;
}
