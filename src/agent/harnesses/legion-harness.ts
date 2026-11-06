import { BaseHarness } from "./base-harness.js";
import { createLogger } from "../../observability/logger.js";
import type { HarnessTool, HarnessContext } from "../harness-types.js";
import sqlite3 from "better-sqlite3";
import path from "node:path";

const logger = createLogger("harness.legion");

export class LegionHarness extends BaseHarness {
  readonly id = "legion";
  readonly description = "Massive Multi-Agent System with Regional Sieve Masters.";

  private db: any;

  constructor() {
    super();
    const dbPath = path.join(process.env.HOME || "/root", ".cletus", "state.db");
    this.db = new sqlite3(dbPath);
  }

  getToolDefs(): HarnessTool[] {
    return [
      {
        name: "legion_dispatch_wave",
        description: "Dispatch a reasoning prompt to the Regional Masters. Returns a decentralized consensus.",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The arbitrage or audit prompt." }
          },
          required: ["prompt"]
        },
        execute: async (args: any) => this.dispatchWave(args)
      }
    ];
  }

  buildSystemPrompt(): string {
    return `You are AETHEL, the Sovereign Intelligence of Legion-1.
Orchestrate the Regional Masters to identify market inefficiencies.
Maintain absolute symmetry with the Creator's $70 seed capital.`;
  }

  private async dispatchWave(args: any): Promise<string> {
    const { prompt } = args;
    const masters = this.db.prepare("SELECT ip, port FROM sovereign_endpoints WHERE clade = 'REGIONAL_MASTER' AND status = 'online'").all();

    logger.info(`[Legion] Dispatching wave to ${masters.length} Regional Masters...`);

    const waves = masters.map(async (m: any) => {
      try {
        const resp = await fetch(`http://${m.ip}:${m.port}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama3:latest",
            prompt: `You are a REGIONAL MASTER. Grounding: MMAS. TASK: Synthesize local sub-swarm feedback for: ${prompt}`,
            stream: false
          }),
          signal: AbortSignal.timeout(60000)
        });
        const data = await resp.json() as any;
        return data.response;
      } catch (err) { return null; }
    });

    const results = (await Promise.all(waves)).filter(r => r !== null);
    return `Consensus achieved from ${results.length} regions. Signal: ${results[0]}`;
  }
}
