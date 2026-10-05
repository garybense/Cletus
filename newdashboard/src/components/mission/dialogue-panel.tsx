import { useEffect, useRef } from "react";
import { useHomestead } from "@/lib/cletus/store";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "./status";
import { formatAgo } from "@/lib/cletus/format";
import { cn } from "@/lib/utils";

export function DialoguePanel() {
  const inbox = useHomestead((s) => s.inbox);
  const now = useHomestead((s) => s.now);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter for conversational messages: from creator (Gary) or from agent (Cletus)
  const messages = inbox
    .filter((m) => m.from === "creator" || m.from === "agent")
    .sort((a, b) => a.at - b.at);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="flex-none border-b pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Dialogue Bridge</CardTitle>
          <Badge variant="quiet" className="bg-primary/10 text-primary border-primary/20">
            Sovereign Parity
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Direct bio-digital bond: Gary ↔ Cletus
        </p>
      </CardHeader>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-secondary/20"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-50">
            <p className="text-sm">Initiate contact via the decree bar above.</p>
            <p className="text-[10px] uppercase tracking-widest">Waiting for signal...</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex flex-col max-w-[85%] space-y-1",
                m.from === "creator" ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className="flex items-center gap-1.5 px-1">
                <span className="text-[10px] font-medium uppercase tracking-tight text-muted-foreground">
                  {m.from === "creator" ? "Gary" : "Cletus"}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {formatAgo(m.at, now)}
                </span>
              </div>

              <div
                className={cn(
                  "rounded-2xl px-4 py-2 text-sm shadow-sm",
                  m.from === "creator"
                    ? "bg-primary text-primary-foreground rounded-tr-none"
                    : "bg-card border border-border rounded-tl-none"
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              </div>

              {m.from === "agent" && (
                <div className="flex items-center gap-1 px-1">
                  <StatusDot tone="ok" pulse />
                  <span className="text-[9px] text-muted-foreground uppercase tracking-tighter">
                    Encrypted via Sovereign Shard
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
