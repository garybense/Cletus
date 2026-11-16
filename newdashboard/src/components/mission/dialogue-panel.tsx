import { useEffect, useRef, useState } from "react";
import { useHomestead } from "@/lib/cletus/store";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusDot } from "./status";
import { formatAgo } from "@/lib/cletus/format";
import { cn } from "@/lib/utils";
import { Send, Layers } from "lucide-react";

export function DialoguePanel() {
  const inbox = useHomestead((s) => s.inbox);
  const now = useHomestead((s) => s.now);
  const issueDecree = useHomestead((s) => s.issueDecree);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messageText, setMessageText] = useState("");
  const [activeContext, setActiveContext] = useState("sovereign");

  // Filter for conversational messages
  const messages = inbox
    .filter((m) => m.from === "creator" || m.from === "agent")
    .sort((a, b) => a.at - b.at);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSendMessage = () => {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    // Dispatch message with active context tag
    const formattedContent = `[CONTEXT: ${activeContext.toUpperCase()}] ${trimmed}`;
    issueDecree(formattedContent);
    setMessageText("");
  };

  return (
    <Card className="flex flex-col h-[600px] border-border shadow-sm">
      <CardHeader className="flex-none border-b pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold">Interactive Cletus Chat & Context Switcher</CardTitle>
            <Badge variant="quiet" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
              Evolving Long-Term Memory
            </Badge>
          </div>

          {/* Active Context Selector */}
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={activeContext}
              onChange={(e) => setActiveContext(e.target.value)}
              className="bg-background border border-input rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="sovereign">Context: Sovereign Bank</option>
              <option value="cletus">Context: Cletus Core Bank</option>
              <option value="swarm">Context: Legion Swarm Workspace</option>
              <option value="general">Context: General Architecture</option>
            </select>
          </div>
        </div>
      </CardHeader>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20 font-mono"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-50 text-xs">
            <p>Direct communication bridge active.</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Type a message below to converse with Cletus.</p>
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
                <span className="text-[10px] font-bold uppercase text-foreground">
                  {m.from === "creator" ? "Operator (Gary)" : "Cletus"}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {formatAgo(m.at, now)}
                </span>
              </div>

              <div
                className={cn(
                  "rounded-xl px-3.5 py-2 text-xs leading-relaxed shadow-sm",
                  m.from === "creator"
                    ? "bg-primary text-primary-foreground rounded-tr-none font-sans"
                    : "bg-card border border-border rounded-tl-none font-mono"
                )}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Interactive Chat Input Footer */}
      <div className="p-3 border-t border-border bg-background flex gap-2">
        <Input
          type="text"
          placeholder={`Message Cletus under active context [${activeContext.toUpperCase()}]...`}
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          className="text-xs font-mono"
        />
        <Button size="sm" onClick={handleSendMessage} className="gap-1.5 px-4 font-semibold text-xs">
          <Send className="h-3.5 w-3.5" />
          Send
        </Button>
      </div>
    </Card>
  );
}
