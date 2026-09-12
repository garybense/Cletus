import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHomestead } from "@/lib/cletus/store";
import { formatAgo } from "@/lib/cletus/format";
import { Badge } from "@/components/ui/badge";

export function DecreeBar() {
  const [text, setText] = useState("");
  const issueDecree = useHomestead((s) => s.issueDecree);
  const now = useHomestead((s) => s.now);
  const latest = useHomestead((s) => s.inbox.find((m) => m.from === "creator"));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    issueDecree(trimmed);
    toast("Decree issued — Cletus will drop background work.");
    setText("");
  }

  return (
    <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium tracking-tight">Supreme creator directive</p>
          <p className="text-xs text-muted-foreground">Overrides heartbeats, chores, and child work.</p>
        </div>
        <Badge variant="quiet">supreme priority</Badge>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Issue a command to Cletus and the colony…"
          aria-label="Supreme creator directive"
          className="h-11 flex-1"
        />
        <Button type="submit" className="h-11 shrink-0 sm:w-40">
          Issue decree
        </Button>
      </form>
      {latest ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Last: <span className="text-foreground">{latest.content}</span>
          <span className="tabular-nums"> · {formatAgo(latest.at, now)} · {latest.status}</span>
        </p>
      ) : null}
    </section>
  );
}
