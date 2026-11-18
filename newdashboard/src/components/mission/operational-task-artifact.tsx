import React from 'react';
import { GitCommit, Code, FileText, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

export const OperationalTaskArtifact: React.FC = () => {
  return (
    <Card className="p-4 bg-slate-950 border border-slate-800 shadow-lg space-y-3 font-mono">
      <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between border-b border-slate-800">
        <CardTitle className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <GitCommit className="h-4 w-4 text-emerald-400" />
          Operational Code Modification & Task Artifact Provenance
        </CardTitle>
        <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-950 border border-emerald-800 rounded">
          REAL TASK OUTPUT
        </span>
      </CardHeader>

      <div className="w-full overflow-hidden rounded-lg border border-slate-800 bg-black">
        <img
          src="/task_artifacts/latest_task_artifact.png"
          alt="Operational Task Artifact Visualizer"
          className="w-full h-auto object-cover rounded-lg"
          onError={(e) => {
            // Hide container cleanly if no artifact has been rendered yet
            (e.target as HTMLElement).parentElement?.classList.add("hidden");
          }}
        />
      </div>
    </Card>
  );
};
