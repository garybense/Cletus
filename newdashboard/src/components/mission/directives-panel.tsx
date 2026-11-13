import { ShieldAlert, BookOpen, Anchor } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export function DirectivesPanel() {
  return (
    <Card className="border-blue-500/30 bg-card/60 p-4 shadow-[var(--shadow-border)]">
      <CardHeader className="p-0 pb-3 flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-blue-300">
          <BookOpen className="h-4 w-4 text-blue-400" /> Metacognitive Directives & Pinned Memory Browser
        </CardTitle>
        <Badge variant="outline" className="border-blue-500/50 text-blue-300 text-[10px] font-mono">
          Entelechy Bank: 'cletus'
        </Badge>
      </CardHeader>

      <div className="space-y-2 text-xs font-mono">
        <div className="rounded-lg border border-blue-900/50 bg-black/60 p-2.5">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="flex items-center gap-1.5 text-blue-300 font-bold">
              <ShieldAlert className="h-3.5 w-3.5 text-blue-400" /> DIRECTIVE: nvidia_models_access_rule
            </span>
            <span className="text-emerald-400 text-[10px] font-bold">ACTIVE</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            RESOURCE PROVENANCE & CAPABILITY ANCHOR: Cletus has full, direct access to all NVIDIA NIM frontier models (550B, 120B Vision, 30B Lightning, Mistral Large, Gemma 4, GLM 5.3). Verified for all future swarm implementations.
          </p>
        </div>

        <div className="rounded-lg border border-blue-900/50 bg-black/60 p-2.5">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="flex items-center gap-1.5 text-blue-300 font-bold">
              <Anchor className="h-3.5 w-3.5 text-blue-400" /> DIRECTIVE: build_verification_rule
            </span>
            <span className="text-emerald-400 text-[10px] font-bold">ACTIVE</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            HARD RULE: All Cletus codebase refactors and self-evolution turns must pass agent build (npm run build) and dashboard typecheck (npx tsc --noEmit) with 0 errors.
          </p>
        </div>
      </div>
    </Card>
  );
}
