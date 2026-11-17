import React from 'react';
import { Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

export const SystemMapVisualizer: React.FC = () => {
  return (
    <Card className="p-4 border border-border shadow-sm space-y-3">
      <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between border-b border-border">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Autonomous System State & Architecture Image
        </CardTitle>
        <span className="text-[10px] text-muted-foreground uppercase font-mono">High-Res PNG Generated</span>
      </CardHeader>

      <div className="w-full overflow-hidden rounded-lg border border-border bg-slate-950">
        <img
          src="/diagrams/system_architecture.png"
          alt="Cletus System Architecture & State Visualizer"
          className="w-full h-auto object-cover rounded-lg shadow-md"
        />
      </div>
    </Card>
  );
};
