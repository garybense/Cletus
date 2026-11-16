import { Cpu, Network, Zap, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export function SwarmMeshPanel() {
  return (
    <Card className="border-purple-500/30 bg-card/60 p-4 shadow-[var(--shadow-border)]">
      <CardHeader className="p-0 pb-3 flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-purple-300">
          <Network className="h-4 w-4 text-purple-400 animate-pulse" /> Multi-Agent Topology & Distributed Mesh Canvas
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/50 text-emerald-300 text-[10px] font-mono">
            Google AgentMesh P2P Active
          </Badge>
          <Badge variant="outline" className="border-purple-500/50 text-purple-300 text-[10px] font-mono">
            12 Nodes Synchronized
          </Badge>
        </div>
      </CardHeader>

      <div className="grid gap-3 sm:grid-cols-3 font-mono text-xs">
        <div className="rounded-lg border border-purple-900/50 bg-black/60 p-3">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] mb-1">
            <span className="flex items-center gap-1 text-purple-300"><Cpu className="h-3.5 w-3.5" /> Primary Core</span>
            <span className="text-emerald-400 font-bold">ONLINE</span>
          </div>
          <p className="font-semibold text-foreground">Cletus 550B MoE Engine</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">nvidia/nemotron-3-ultra-550b-a55b</p>
        </div>

        <div className="rounded-lg border border-amber-900/50 bg-black/60 p-3">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] mb-1">
            <span className="flex items-center gap-1 text-amber-300"><Zap className="h-3.5 w-3.5" /> ReTrace Fast-Path</span>
            <span className="text-amber-400 font-bold">ACTIVE</span>
          </div>
          <p className="font-semibold text-foreground">Planner-Free Trace Caching</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Latency: &lt; 0.08s | Hits: 42</p>
        </div>

        <div className="rounded-lg border border-cyan-900/50 bg-black/60 p-3">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] mb-1">
            <span className="flex items-center gap-1 text-cyan-300"><ShieldCheck className="h-3.5 w-3.5" /> Re-Search Consensus</span>
            <span className="text-cyan-400 font-bold">VERIFIED</span>
          </div>
          <p className="font-semibold text-foreground">Two-Player Ideation Game</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Generator x Auditor Counterfactual</p>
        </div>
      </div>
    </Card>
  );
}
