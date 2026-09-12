import { createServerFn } from "@tanstack/react-start";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { HomesteadSnapshot, LogLine, Thought, Vitals, Goal, Task, OpenClawAgent } from "./types";

const DB_PATH = path.join(os.homedir(), ".cletus", "state.db");
const LOG_PATH = path.join(process.cwd(), "..", "cletus.log"); // Assuming Cletus root is parent of newdashboard

function getCletusDb() {
  return new Database(DB_PATH, { readonly: true });
}

export const getSnapshot = createServerFn({ method: "GET" }).handler(async (): Promise<HomesteadSnapshot> => {
  const db = getCletusDb();
  const now = Date.now();

  try {
    // 1. Fetch Vitals
    const agentStateRow = db.prepare("SELECT value FROM kv WHERE key = 'agent_state'").get() as { value: string } | undefined;
    const configRow = db.prepare("SELECT value FROM kv WHERE key = 'config'").get() as { value: string } | undefined;
    const config = configRow ? JSON.parse(configRow.value) : {};

    // We'll calculate turns from the turns table
    const turnsCount = db.prepare("SELECT COUNT(*) as count FROM turns").get() as { count: number };
    const lastTurn = db.prepare("SELECT created_at FROM turns ORDER BY created_at DESC LIMIT 1").get() as { created_at: string } | undefined;

    const vitals: Vitals = {
      name: "Cletus",
      state: (agentStateRow?.value as any) || "running",
      model: config.primaryModel || "gemini-1.5-pro",
      tier: "normal", // We can derive this later if needed
      creditsCents: config.creditBalanceOverrideCents || 0,
      usdcCents: 0,
      reserveCents: 1000,
      turns: turnsCount.count,
      startedAt: lastTurn ? new Date(lastTurn.created_at).getTime() - (3600000 * 2) : now - 3600000,
      sleepUntil: null,
      creator: "92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa",
      sigil: "CLETUS-01",
    };

    // 2. Fetch Goals
    const goalRows = db.prepare("SELECT * FROM goals ORDER BY created_at DESC LIMIT 10").all() as any[];
    const goals: Goal[] = goalRows.map(r => ({
      id: r.id,
      title: r.title,
      detail: r.description || "",
      status: r.status as any,
      progress: r.status === 'completed' ? 100 : 0, // Simplified
      expectedRevenueCents: 0,
      actualRevenueCents: 0,
    }));

    // 3. Fetch Tasks
    const taskRows = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC LIMIT 20").all() as any[];
    const tasks: Task[] = taskRows.map(r => ({
      id: r.id,
      goalId: r.goal_id || "default",
      title: r.title,
      detail: r.description || "",
      status: r.status as any,
      assignee: "Cletus",
      role: "worker",
    }));

    // 4. Fetch Thoughts (from turns table)
    const turnRows = db.prepare("SELECT * FROM turns ORDER BY created_at DESC LIMIT 10").all() as any[];
    const thoughts: Thought[] = turnRows.map(r => ({
      id: r.id,
      at: new Date(r.created_at).getTime(),
      thinking: r.thinking || r.reasoning || "",
      speech: "",
      tools: [],
    }));

    // 5. Fetch Logs (from cletus.log)
    const logs: LogLine[] = [];
    if (fs.existsSync(LOG_PATH)) {
      const content = fs.readFileSync(LOG_PATH, "utf-8");
      const lines = content.split("\n").filter(l => l.trim()).slice(-50);
      lines.forEach((l, i) => {
        const level = l.includes("ERROR") ? "error" : l.includes("WARN") ? "warn" : "info";
        logs.push({
          id: `log_${i}`,
          at: now - (lines.length - i) * 1000,
          level: level as any,
          source: "Cletus",
          message: l,
        });
      });
    }

    // Combine into snapshot (using some seeded data for missing parts to keep it beautiful)
    return {
      vitals,
      goals,
      tasks,
      thoughts,
      logs,
      children: [],
      inbox: [],
      alerts: [],
      spend24h: [],
      spendByModel: [],
      toolSpends: [],
      denials: [],
      skills: [],
      heartbeats: [],
      entelechy: {
        mission: vitals.state === "running" ? "Active Orchestration" : "Dormant",
        riskPosture: "balanced",
        confidence: 0.9,
        priorities: ["Social Outpost", "Facebook Mission"],
        avoid: ["Redundant registration"],
        recommendation: "Continue with Facebook messaging mission.",
      },
      peers: [],
      openclaw: [],
      pendingAck: null,
    };
  } finally {
    db.close();
  }
});
