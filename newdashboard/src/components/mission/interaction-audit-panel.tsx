import { ShieldCheck, Activity, Terminal, Cpu, Network, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export function InteractionAuditPanel() {
  const auditRecords = [
    {
      id: "audit_llm_01",
      type: "LLM_INFERENCE",
      actor: "cletus_primary",
      target: "nvidia/nemotron-3-ultra-550b-a55b",
      action: "chat_completion",
      payloadSummary: "promptTokens: 2100, completionTokens: 680, reasoning: 'C2 Evaluation'",
      durationMs: 820,
      status: "SUCCESS",
      timestamp: new Date().toLocaleTimeString(),
    },
    {
      id: "audit_mcp_01",
      type: "MCP_TOOL_CALL",
      actor: "cletus_primary",
      target: "https://entelechy-production-8045.up.railway.app/mcp",
      action: "sync_retain",
      payloadSummary: "bank_id: 'cletus', context: 'audit_trail_provenance'",
      durationMs: 310,
      status: "SUCCESS",
      timestamp: new Date().toLocaleTimeString(),
    },
    {
      id: "audit_swarm_01",
      type: "AGENT_SWARM_COMM",
      actor: "Commander (550B)",
      target: "SecurityAuditor (1T)",
      action: "post_message_swarm_mailbox",
      payloadSummary: "channel: 'doctrinal-mesh', task: 'Audit AST Type Safety'",
      durationMs: 45,
      status: "SUCCESS",
      timestamp: new Date().toLocaleTimeString(),
    },
  ];

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
            Immutable Audit Trail
          </Badge>
        </div>
      </CardHeader>

      <div className="space-y-2.5 font-mono text-xs">
        {auditRecords.map((r) => (
          <div key={r.id} className="rounded-lg border border-purple-900/50 bg-black/75 p-3">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  r.type === "LLM_INFERENCE" ? "bg-purple-900/80 text-purple-300 border border-purple-700/50" :
                  r.type === "MCP_TOOL_CALL" ? "bg-blue-900/80 text-blue-300 border border-blue-700/50" :
                  "bg-emerald-900/80 text-emerald-300 border border-emerald-700/50"
                }`}>
                  {r.type}
                </span>
                <span className="text-purple-300 font-bold">{r.actor}</span> ➔ <span className="text-slate-300">{r.target}</span>
              </div>
              <span className="text-emerald-400 text-[10px] font-bold">
                {r.status} ({r.durationMs}ms)
              </span>
            </div>
            <p className="text-foreground/90 font-semibold">{r.action}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{r.payloadSummary}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
