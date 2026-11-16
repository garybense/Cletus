import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useHomestead } from "@/lib/cletus/store";
import { formatClock } from "@/lib/cletus/format";
import { cn } from "@/lib/utils";
import type { LogLevel } from "@/lib/cletus/types";

type Filter = "all" | "tool" | "thought" | "err";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "tool", label: "Tools" },
  { id: "thought", label: "Thoughts" },
  { id: "err", label: "Errors" },
];

function matches(level: LogLevel, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "tool") return level === "tool";
  if (filter === "thought") return level === "thought";
  return level === "error" || level === "warn";
}

function lineClass(level: LogLevel): string {
  if (level === "error") return "text-destructive";
  if (level === "warn") return "text-warn";
  if (level === "thought") return "text-ok";
  if (level === "tool") return "text-foreground";
  return "text-muted-foreground";
}

export function LogsPanel() {
  const logs = useHomestead((s) => s.logs);
  const [filter, setFilter] = useState<Filter>("all");
  const [autoscroll, setAutoscroll] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const filtered = useMemo(
    () => logs.filter((l) => matches(l.level, filter)).slice().reverse(),
    [logs, filter],
  );

  useEffect(() => {
    if (!autoscroll) return;
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [filtered, autoscroll]);

  return (
    <Card className="p-4">
      <CardHeader className="mb-3 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <CardTitle>Unified activity log</CardTitle>
        <div className="flex flex-wrap items-center gap-1 sm:ml-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "h-9 rounded-md px-3 text-xs font-medium transition-colors",
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAutoscroll((v) => !v)}
            className={cn(
              "h-9 rounded-md px-3 text-xs font-medium transition-colors",
              autoscroll ? "bg-secondary text-foreground" : "bg-secondary text-muted-foreground",
            )}
          >
            Autoscroll {autoscroll ? "on" : "off"}
          </button>
        </div>
      </CardHeader>
      <div
        ref={scroller}
        className="h-80 overflow-auto rounded-lg bg-term px-3 py-3 font-mono text-xs leading-relaxed"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {filtered.length === 0 ? (
          <p className="text-muted-foreground">No lines for this filter.</p>
        ) : (
          filtered.map((line) => (
            <div key={line.id} className={cn("grid grid-cols-[auto_4.5rem_6.5rem_minmax(0,1fr)] gap-x-2", lineClass(line.level))}>
              <span className="text-muted-foreground tabular-nums">{formatClock(line.at)}</span>
              <span className="uppercase opacity-70">{line.level}</span>
              <span className="truncate opacity-70">{line.source}</span>
              <span className="min-w-0 break-all">{line.message}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
