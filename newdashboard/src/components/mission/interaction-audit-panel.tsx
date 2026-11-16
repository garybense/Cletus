import { ShieldCheck, Activity, Terminal, Cpu, Network, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useHomestead } from "@/lib/cletus/store";
import type { LogLine } from "@/lib/cletus/types";

export function InteractionAuditPanel() {
  const logs = useHomestead((s: any) => s.logs || []);
  const auditLogs = logs.filter((l: LogLine) => l.level === "tool" || l.level === "thought" || l.level === "error").slice(0, 10);

  return (
    <Card className="border-purple-500/30 bg-card/60 p-4 shadow-[var(--shadow-border)]">
      <CardHeader className="p-0 pb-3 flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-purple-300">
          <Activity className="h-4 w-4 text-purple-400 animate-pulse" /> Total Information Awareness: Full Interaction Audit Matrix
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-purple-500/50 text-purple-300 text-[10px] font-mono">
            100% Ingestion Parity
          </Badge>
          <Badge variant="outline" className="border-emerald-500/50 text-emerald-300 text-[10px] font-mono">
            {logs.length} Total Events
          </Badge>
        </div>
      </CardHeader>

      <div className="space-y-2.5 font-mono text-xs max-h-72 overflow-auto">
        {auditLogs.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Awaiting live interaction events...</p>
        ) : (
          auditLogs.map((l: LogLine) => (
            <div key={l.id} className="rounded-lg border border-purple-900/50 bg-black/75 p-3">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    l.level === "tool" ? "bg-blue-900/80 text-blue-300 border border-blue-700/50" :
                    l.level === "thought" ? "bg-purple-900/80 text-purple-300 border border-purple-700/50" :
                    "bg-red-900/80 text-red-300 border border-red-700/50"
                  }`}>
                    {l.source.toUpperCase()}
                  </span>
                  <span className="text-purple-300 font-bold">{l.level}</span>
                </div>
                <span className="text-emerald-400 text-[10px] font-bold">
                  {new Date(l.at).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-foreground/90 font-semibold">{l.message}</p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
