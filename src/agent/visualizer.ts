/**
 * Autonomous State Visualizer & Diagram Generator
 * Generates creative SVG diagrams & architecture maps representing current system state,
 * swarm topology, self-evolution progress, and cognitive mood for the dashboard.
 */

import fs from "fs";
import path from "path";
import os from "os";
import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("visualizer");

export class SystemVisualizer {
  constructor(private readonly db: BetterSqlite3.Database) {}

  generateStateDiagram(cycleCount: number = 1, mood: string = "Focused Engineering"): string {
    const timestamp = new Date().toISOString();

    // Creative SVG Architecture & Mood Diagram
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="100%" height="240" style="background:#090d16; border-radius:12px; border:1px solid #1e293b;">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#059669;stop-opacity:0.8" />
      <stop offset="100%" style="stop-color:#0284c7;stop-opacity:0.8" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background Grid -->
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.5"/>
  </pattern>
  <rect width="800" height="400" fill="url(#grid)" />

  <!-- Nodes -->
  <!-- Primary Node: Cletus -->
  <g transform="translate(400, 180)">
    <circle r="45" fill="url(#grad1)" filter="url(#glow)" />
    <text y="-5" font-family="monospace" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">CLETUS</text>
    <text y="15" font-family="monospace" font-size="10" fill="#a7f3d0" text-anchor="middle">v0.2.1 Core</text>
  </g>

  <!-- Swarm Node -->
  <g transform="translate(180, 100)">
    <rect x="-60" y="-30" width="120" height="60" rx="8" fill="#0f172a" stroke="#10b981" stroke-width="1.5" />
    <text y="-5" font-family="monospace" font-size="12" font-weight="bold" fill="#34d399" text-anchor="middle">LEGION SWARM</text>
    <text y="15" font-family="monospace" font-size="9" fill="#64748b" text-anchor="middle">88 Cluster Models</text>
  </g>

  <!-- Entelechy Memory Node -->
  <g transform="translate(620, 100)">
    <rect x="-60" y="-30" width="120" height="60" rx="8" fill="#0f172a" stroke="#8b5cf6" stroke-width="1.5" />
    <text y="-5" font-family="monospace" font-size="12" font-weight="bold" fill="#c084fc" text-anchor="middle">ENTELECHY</text>
    <text y="15" font-family="monospace" font-size="9" fill="#64748b" text-anchor="middle">Postgres Graph</text>
  </g>

  <!-- Self-Evolution Engine Node -->
  <g transform="translate(400, 320)">
    <rect x="-80" y="-25" width="160" height="50" rx="8" fill="#0f172a" stroke="#f59e0b" stroke-width="1.5" />
    <text y="-3" font-family="monospace" font-size="11" font-weight="bold" fill="#fbbf24" text-anchor="middle">EVOLUTION ENGINE</text>
    <text y="14" font-family="monospace" font-size="9" fill="#64748b" text-anchor="middle">Cycle #${cycleCount} (Active)</text>
  </g>

  <!-- Connecting Vector Rays -->
  <line x1="240" y1="120" x2="360" y2="160" stroke="#10b981" stroke-width="2" stroke-dasharray="4,4" />
  <line x1="560" y1="120" x2="440" y2="160" stroke="#8b5cf6" stroke-width="2" stroke-dasharray="4,4" />
  <line x1="400" y1="225" x2="400" y2="295" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4,4" />

  <!-- Overlay Metadata -->
  <text x="20" y="30" font-family="monospace" font-size="11" fill="#38bdf8" font-weight="bold">SYSTEM STATE DIAGRAM // ${mood.toUpperCase()}</text>
  <text x="780" y="30" font-family="monospace" font-size="10" fill="#64748b" text-anchor="end">${timestamp}</text>
</svg>`;

    try {
      const outDir = path.join(os.homedir(), ".cletus", "diagrams");
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, "system-map.svg"), svg, "utf-8");

      this.db.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('latest_system_diagram', ?, datetime('now'))").run(svg);
      logger.info("[VISUALIZER] Generated state diagram SVG successfully.");
    } catch (e: any) {
      logger.warn(`[VISUALIZER] Diagram generation warning: ${e?.message}`);
    }

    return svg;
  }
}
