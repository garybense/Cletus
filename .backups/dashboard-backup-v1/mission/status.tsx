import { cn } from "@/lib/utils";
import type {
  AgentState,
  AlertSeverity,
  ChildStatus,
  LogLevel,
  PeerStatus,
  SurvivalTier,
  TaskStatus,
} from "@/lib/cletus/types";

export function StatusDot({
  tone,
  pulse = false,
  className,
}: {
  tone: "ok" | "warn" | "crit" | "mute";
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        tone === "ok" && "bg-ok",
        tone === "warn" && "bg-warn",
        tone === "crit" && "bg-destructive",
        tone === "mute" && "bg-muted-foreground",
        pulse && tone === "ok" && "animate-pulse",
        className,
      )}
    />
  );
}

export function agentTone(state: AgentState): "ok" | "warn" | "crit" | "mute" {
  if (state === "running") return "ok";
  if (state === "sleeping") return "warn";
  return "mute";
}

export function tierTone(tier: SurvivalTier): "ok" | "warn" | "crit" | "mute" {
  if (tier === "high" || tier === "normal") return "ok";
  if (tier === "low_compute") return "warn";
  if (tier === "critical" || tier === "dead") return "crit";
  return "mute";
}

export function childTone(status: ChildStatus): "ok" | "warn" | "crit" | "mute" {
  if (status === "healthy") return "ok";
  if (status === "starting") return "warn";
  if (status === "unhealthy") return "crit";
  return "mute";
}

export function taskTone(status: TaskStatus): "ok" | "warn" | "crit" | "mute" {
  if (status === "completed") return "ok";
  if (status === "running" || status === "assigned") return "warn";
  if (status === "failed") return "crit";
  return "mute";
}

export function alertTone(severity: AlertSeverity): "ok" | "warn" | "crit" | "mute" {
  if (severity === "info") return "ok";
  if (severity === "warn") return "warn";
  return "crit";
}

export function logTone(level: LogLevel): "ok" | "warn" | "crit" | "mute" {
  if (level === "error") return "crit";
  if (level === "warn") return "warn";
  if (level === "thought") return "ok";
  return "mute";
}

export function peerTone(status: PeerStatus): "ok" | "warn" | "crit" | "mute" {
  if (status === "online") return "ok";
  if (status === "quiet") return "warn";
  return "mute";
}
