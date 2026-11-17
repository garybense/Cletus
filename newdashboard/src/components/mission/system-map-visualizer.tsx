import React from 'react';
import { Image, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

export const SystemMapVisualizer: React.FC = () => {
  const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="100%" height="240" style="background:#090d16; border-radius:12px; border:1px solid #1e293b;">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#059669;stop-opacity:0.8" />
      <stop offset="100%" style="stop-color:#0284c7;stop-opacity:0.8" />
    </linearGradient>
  </defs>
  <rect width="800" height="400" fill="#090d16" />
  <g transform="translate(400, 180)">
    <circle r="45" fill="url(#grad1)" />
    <text y="-5" font-family="monospace" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">CLETUS</text>
    <text y="15" font-family="monospace" font-size="10" fill="#a7f3d0" text-anchor="middle">v0.2.1 Core</text>
  </g>
  <g transform="translate(180, 100)">
    <rect x="-60" y="-30" width="120" height="60" rx="8" fill="#0f172a" stroke="#10b981" stroke-width="1.5" />
    <text y="-5" font-family="monospace" font-size="12" font-weight="bold" fill="#34d399" text-anchor="middle">LEGION SWARM</text>
  </g>
  <g transform="translate(620, 100)">
    <rect x="-60" y="-30" width="120" height="60" rx="8" fill="#0f172a" stroke="#8b5cf6" stroke-width="1.5" />
    <text y="-5" font-family="monospace" font-size="12" font-weight="bold" fill="#c084fc" text-anchor="middle">ENTELECHY</text>
  </g>
  <text x="20" y="30" font-family="monospace" font-size="11" fill="#38bdf8" font-weight="bold">SYSTEM STATE DIAGRAM // LIVE SYSTEM MAP</text>
</svg>`;

  return (
    <Card className="p-4 border border-border shadow-sm space-y-3">
      <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between border-b border-border">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Autonomous System Diagram & State Visualizer
        </CardTitle>
        <span className="text-[10px] text-muted-foreground uppercase font-mono">SVG Render Active</span>
      </CardHeader>

      <div className="w-full overflow-hidden rounded-lg border border-border">
        <div dangerouslySetInnerHTML={{ __html: defaultSvg }} />
      </div>
    </Card>
  );
};
