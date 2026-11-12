/**
 * Legion Swarm DVR Monitor & Replay Engine
 * Records timestamped telemetry frames of all agent thoughts, tool calls, and task transitions
 * for live DVR-style playback and situational awareness.
 */

import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("dvr-monitor");

export interface DvrFrame {
  id: string;
  timestamp: string;
  frameType: "thought" | "tool_call" | "task_status" | "agent_action";
  agentName: string;
  content: string;
}

export class SwarmDvrMonitor {
  constructor(private readonly db: BetterSqlite3.Database) {
    this.initTable();
  }

  private initTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS swarm_dvr_frames (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        frame_type TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        content TEXT NOT NULL
      )
    `);
  }

  recordFrame(frameType: DvrFrame["frameType"], agentName: string, content: string): void {
    const id = `dvr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();
    try {
      this.db.prepare(`
        INSERT INTO swarm_dvr_frames (id, timestamp, frame_type, agent_name, content)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, timestamp, frameType, agentName, content);
    } catch (e: any) {
      logger.warn(`Failed to record DVR frame: ${e?.message}`);
    }
  }

  getFrames(limit = 50): DvrFrame[] {
    try {
      const rows = this.db.prepare(`
        SELECT id, timestamp, frame_type, agent_name, content
        FROM swarm_dvr_frames
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(limit) as Array<{
        id: string;
        timestamp: string;
        frame_type: string;
        agent_name: string;
        content: string;
      }>;

      return rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        frameType: r.frame_type as DvrFrame["frameType"],
        agentName: r.agent_name,
        content: r.content,
      })).reverse(); // Oldest to newest for replay
    } catch {
      return [];
    }
  }
}
