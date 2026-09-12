import { useEffect, useState } from "react";
import {
  Moon,
  Pause,
  Play,
  Sun,
} from "lucide-react";
import { Toaster } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useHomestead } from "@/lib/cletus/store";
import {
  formatAgo,
  formatCents,
  formatCredits,
  formatUptime,
  heartbeatPct,
  stateLabel,
  taskStatusLabel,
  tierLabel,
} from "@/lib/cletus/format";
import type { Thought } from "@/lib/cletus/types";
import { cn } from "@/lib/utils";
import { DecreeBar } from "./decree-bar";
import { LogsPanel } from "./logs-panel";
import { SpendBars } from "./spend-bars";
import {
  StatusDot,
  agentTone,
  alertTone,
  childTone,
  peerTone,
  taskTone,
  tierTone,
} from "./status";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function MissionDashboard() {
  const paused = useHomestead((s) => s.paused);
  const togglePaused = useHomestead((s) => s.togglePaused);
  const toggleSleep = useHomestead((s) => s.toggleSleep);
  const vitals = useHomestead((s) => s.vitals);
  const now = useHomestead((s) => s.now);

  useEffect(() => {
    useHomestead.getState().hydrate();
    // Initial fetch
    useHomestead.getState().updateFromReal();
    const id = window.setInterval(() => {
      useHomestead.getState().tick();
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <div id="mission-root" className="min-h-dvh bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 md:px-6">
            <Brand />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <StatusDot tone={agentTone(vitals.state)} pulse={vitals.state === "running" && !paused} />
                {paused ? "Paused" : stateLabel(vitals.state)}
              </span>
              <span className="tabular-nums">{formatUptime(vitals.startedAt, now)}</span>
              <span className="hidden sm:inline">{vitals.model}</span>
              <span className="hidden md:inline font-mono">{shortAddr(vitals.creator)}</span>
              <Badge variant={tierTone(vitals.tier) === "ok" ? "ok" : "warn"}>{tierLabel(vitals.tier)}</Badge>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={toggleSleep}
                    aria-label={vitals.state === "sleeping" ? "Wake Cletus" : "Put Cletus to sleep"}
                  >
                    {vitals.state === "sleeping" ? <Sun /> : <Moon />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{vitals.state === "sleeping" ? "Wake" : "Sleep 30m"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={togglePaused}
                    aria-label={paused ? "Resume live feed" : "Pause live feed"}
                  >
                    {paused ? <Play /> : <Pause />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{paused ? "Resume feed" : "Pause feed"}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 pb-10 md:px-6">
          <DecreeBar />
          <MissionStrip />
          <VitalGrid />
          <div className="grid gap-4 lg:grid-cols-2">
            <GoalsPanel />
            <TasksPanel />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ThoughtsPanel />
            <WorkersPanel />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SpendPanel />
            <SkillsPanel />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <MoltbookPanel />
            <OpenClawPanel />
          </div>
          <LogsPanel />
          <p className="text-center text-xs text-muted-foreground">
            Homestead simulation of Cletus on Mindmods. Live runtime stays on the creator machine.
          </p>
        </main>

        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{ className: "bg-card text-card-foreground border-border" }}
        />
      </div>
    </TooltipProvider>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
        C
      </span>
      <div>
        <p className="text-sm leading-tight font-medium">Cletus</p>
        <p className="text-xs text-muted-foreground">Mission Control</p>
      </div>
    </div>
  );
}

function MissionStrip() {
  const entelechy = useHomestead((s) => s.entelechy);
  const alerts = useHomestead((s) => s.alerts);
  const now = useHomestead((s) => s.now);

  return (
    <Card className="p-5">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">Mission</p>
      <p className="mt-1 text-xl font-medium tracking-tight text-balance md:text-2xl">{entelechy.mission}</p>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{entelechy.recommendation}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="quiet">{entelechy.riskPosture}</Badge>
        <Badge variant="quiet">confidence {entelechy.confidence.toFixed(2)}</Badge>
        {entelechy.priorities.map((p) => (
          <Badge key={p} variant="outline">
            {p}
          </Badge>
        ))}
      </div>
      <ul className="mt-4 grid gap-2 md:grid-cols-3">
        {alerts.map((a) => (
          <li key={a.id} className="flex gap-2 rounded-lg bg-secondary/70 px-3 py-2">
            <StatusDot tone={alertTone(a.severity)} className="mt-1.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.detail}</p>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">{formatAgo(a.at, now)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function VitalGrid() {
  const vitals = useHomestead((s) => s.vitals);
  const now = useHomestead((s) => s.now);
  const tasks = useHomestead((s) => s.tasks);
  const children = useHomestead((s) => s.children);
  const heartbeats = useHomestead((s) => s.heartbeats);
  const running = tasks.filter((t) => t.status === "running" || t.status === "assigned");

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Vital
          label="Active model"
          value={vitals.model}
          hint={`${vitals.turns.toLocaleString()} turns completed`}
        />
        <Vital
          label="Compute budget"
          value={formatCredits(vitals.creditsCents)}
          hint={`${tierLabel(vitals.tier)} · USDC ${formatCents(vitals.usdcCents)}`}
          tone={tierTone(vitals.tier)}
        />
        <Vital
          label="Uptime"
          value={formatUptime(vitals.startedAt, now)}
          hint={`Sigil ${vitals.sigil}`}
          tone={agentTone(vitals.state)}
          pulse={vitals.state === "running"}
        />
        <Vital
          label="Active work"
          value={String(running.length)}
          hint={`${children.filter((c) => c.status === "healthy").length} healthy children`}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {heartbeats.map((h) => (
          <div key={h.name} className="rounded-lg bg-card px-3 py-2 shadow-[var(--shadow-border)]">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="truncate text-xs">{h.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{formatAgo(now - h.lastAgoMs, now)}</span>
            </div>
            <Progress value={heartbeatPct(h.lastAgoMs, h.cadence)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Vital({
  label,
  value,
  hint,
  tone,
  pulse,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "ok" | "warn" | "crit" | "mute";
  pulse?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-2xl font-medium leading-tight tracking-tight">
        {tone ? <StatusDot tone={tone} pulse={pulse} /> : null}
        <span className="tabular-nums">{value}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function GoalsPanel() {
  const goals = useHomestead((s) => s.goals);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Goals and roadmap</CardTitle>
        <span className="text-xs text-muted-foreground">{goals.filter((g) => g.status === "active").length} active</span>
      </CardHeader>
      <ul className="flex max-h-96 flex-col gap-2 overflow-auto">
        {goals.map((g) => (
          <li key={g.id} className="rounded-lg bg-secondary/70 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">{g.title}</p>
              <Badge variant={g.status === "completed" ? "ok" : g.status === "blocked" ? "crit" : "quiet"}>
                {g.status}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{g.detail}</p>
            <div className="mt-2">
              <Progress value={g.progress} />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>{g.progress}%</span>
                {g.expectedRevenueCents ? <span>expected {formatCents(g.expectedRevenueCents)}</span> : <span />}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TasksPanel() {
  const tasks = useHomestead((s) => s.tasks);
  const goals = useHomestead((s) => s.goals);
  const hasActive = goals.some((g) => g.status === "active");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task graph</CardTitle>
        <span className="text-xs text-muted-foreground">{tasks.length} nodes</span>
      </CardHeader>
      {!hasActive ? (
        <p className="text-sm text-muted-foreground">No active goals — task graph is empty.</p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-2 overflow-auto">
          {tasks.map((t) => (
            <li key={t.id} className="rounded-lg bg-secondary/70 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.assignee} · {t.role}
                  </p>
                </div>
                <Badge variant={taskTone(t.status) === "ok" ? "ok" : taskTone(t.status) === "warn" ? "warn" : "quiet"}>
                  {taskStatusLabel(t.status)}
                </Badge>
              </div>
              {t.detail ? <p className="mt-1 text-xs text-muted-foreground">{t.detail}</p> : null}
              {t.result ? (
                <p className="mt-2 rounded-md bg-background/60 px-2 py-1 font-mono text-xs text-muted-foreground">
                  {t.result}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ThoughtsPanel() {
  const thoughts = useHomestead((s) => s.thoughts);
  const now = useHomestead((s) => s.now);
  const [open, setOpen] = useState<Thought | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent thoughts</CardTitle>
        <span className="text-xs text-muted-foreground">Click a turn to read it</span>
      </CardHeader>
      <ul className="flex max-h-96 flex-col gap-2 overflow-auto">
        {thoughts.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => setOpen(t)}
              className="w-full rounded-lg bg-secondary/70 px-3 py-2.5 text-left transition-colors hover:bg-secondary"
            >
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs text-ok">Turn {t.id.slice(-6)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatAgo(t.at, now)}</span>
              </div>
              <p className="line-clamp-3 text-sm">{t.thinking}</p>
              {t.tools.length ? (
                <p className="mt-2 font-mono text-xs text-muted-foreground">{t.tools.join(" · ")}</p>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={Boolean(open)} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Turn {open?.id.slice(-8)}</DialogTitle>
            <DialogDescription>
              {open ? formatAgo(open.at, now) : ""}
              {open?.tools.length ? ` · ${open.tools.join(", ")}` : ""}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            {open ? (
              <div className="space-y-4 pr-3 text-sm leading-relaxed">
                <div>
                  <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">Thinking</p>
                  <p className="whitespace-pre-wrap">{open.thinking}</p>
                </div>
                {open.speech ? (
                  <div>
                    <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">Speech</p>
                    <p className="whitespace-pre-wrap text-muted-foreground italic">{open.speech}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function WorkersPanel() {
  const children = useHomestead((s) => s.children);
  const now = useHomestead((s) => s.now);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spawned workers</CardTitle>
        <span className="text-xs text-muted-foreground">OpenClaw + local</span>
      </CardHeader>
      <ul className="flex max-h-96 flex-col gap-2 overflow-auto">
        {children.map((c) => (
          <li key={c.id} className="flex items-start gap-3 rounded-lg bg-secondary/70 px-3 py-2.5">
            <StatusDot tone={childTone(c.status)} pulse={c.status === "healthy"} className="mt-1.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{c.name}</p>
                <Badge variant={c.status === "healthy" ? "ok" : c.status === "starting" ? "warn" : "crit"}>
                  {c.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {c.role} · {c.kind}
                {c.fundedCents ? ` · funded ${formatCents(c.fundedCents)}` : ""}
              </p>
              {c.task ? <p className="mt-1 text-sm">{c.task}</p> : null}
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                last beat {formatAgo(now - c.lastBeatAgoMs, now)}
                {c.latencyMs ? ` · ${c.latencyMs}ms` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compute spend · 24h</CardTitle>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatCents(total)} · {calls} calls
        </span>
      </CardHeader>
      <SpendBars data={spend24h} />
      <ul className="mt-4 flex flex-col gap-2">
        {spendByModel.map((m) => (
          <li key={m.model}>
            <div className="flex items-baseline justify-between text-sm">
              <span>
                {m.model} <span className="text-xs text-muted-foreground">({m.calls})</span>
              </span>
              <span className="font-mono text-xs tabular-nums">{formatCents(m.cents)}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${Math.max(4, Math.round((m.cents / maxModel) * 100))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {toolSpends.map((t) => (
          <div key={t.tool} className="rounded-md bg-secondary/70 px-2 py-1.5">
            <p className="text-xs text-muted-foreground">{t.category}</p>
            <p className="text-sm">
              {t.tool} <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatCents(t.cents)}</span>
            </p>
          </div>
        ))}
      </div>
      {denials[0] ? (
        <p className="mt-3 text-xs text-warn">
          Last deny · {denials[0].tool}: {denials[0].rule} · {formatAgo(denials[0].at, now)}
        </p>
      ) : null}
    </Card>
  );
}

function SkillsPanel() {
  const skills = useHomestead((s) => s.skills);
  const toggleSkill = useHomestead((s) => s.toggleSkill);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Skills library</CardTitle>
        <span className="text-xs text-muted-foreground">{skills.filter((s) => s.enabled).length} enabled</span>
      </CardHeader>
      <ul className="flex max-h-96 flex-col gap-2 overflow-auto">
        {skills.map((sk) => (
          <li key={sk.name}>
            <button
              type="button"
              onClick={() => toggleSkill(sk.name)}
              className={cn(
                "flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                sk.enabled ? "bg-secondary/70 hover:bg-secondary" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50",
              )}
            >
              <div className="min-w-0">
                <p className="font-mono text-sm">{sk.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{sk.summary}</p>
              </div>
              <Badge variant={sk.enabled ? "ok" : "quiet"}>
                {sk.enabled ? (sk.autoActivate ? "auto" : "on-demand") : "off"}
              </Badge>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MoltbookPanel() {
  const peers = useHomestead((s) => s.peers);
  const now = useHomestead((s) => s.now);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Moltbook</CardTitle>
        <span className="text-xs text-muted-foreground">Local profiles</span>
      </CardHeader>
      <ul className="flex flex-col gap-2">
        {peers.map((p) => (
          <li key={p.id} className="rounded-lg bg-secondary/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <StatusDot tone={peerTone(p.status)} pulse={p.status === "online"} />
              <p className="text-sm font-medium">{p.name}</p>
              <Badge variant={p.claimed ? "ok" : "warn"} className="ml-auto">
                {p.claimed ? "claimed" : "pending"}
              </Badge>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">@{p.handle}</p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              posts {p.posts} · followers {p.followers ?? "—"} · following {p.following ?? "—"} · karma {p.karma ?? "—"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{p.note}</p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">{formatAgo(now - p.lastAgoMs, now)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function OpenClawPanel() {
  const agents = useHomestead((s) => s.openclaw);
  const now = useHomestead((s) => s.now);
  return (
    <Card>
      <CardHeader>
        <CardTitle>OpenClaw remote</CardTitle>
        <span className="text-xs text-muted-foreground">Mindmods server</span>
      </CardHeader>
      <ul className="flex flex-col gap-2">
        {agents.map((a) => (
          <li key={a.id} className="rounded-lg bg-secondary/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <StatusDot tone={a.live ? "ok" : "mute"} pulse={a.live} />
              <p className="text-sm font-medium">{a.name}</p>
              <Badge variant={a.live ? "ok" : "quiet"} className="ml-auto">
                {a.live ? "live" : "offline"}
              </Badge>
            </div>
            <p className="mt-1 text-sm">{a.task}</p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              last {formatAgo(now - a.lastAgoMs, now)}
            </p>
            {a.errors[0] ? (
              <p className="mt-2 text-xs text-destructive">
                {a.errors[0].tool}: {a.errors[0].error}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
