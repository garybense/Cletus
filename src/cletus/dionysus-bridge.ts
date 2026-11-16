/**
 * Dionysus Metacognition TypeScript Bridge
 * Ingests active-inference control payloads from dionysus-metacognition controller
 * and dispatches precision-weighted free-energy policies into Cletus's execution loops.
 */

import fs from "node:fs";
import path from "node:path";
import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("dionysus-bridge");

export interface DionysusControlPayload {
  timestamp: string;
  controller: string;
  provenance: { sourceId: string; sourceDoi: string; lineage: string };
  boundary: { blanketId: string; internalState: string; externalState: string; sensoryState: string; activeState: string };
  dynamics: { basinId: string; attractorLabel: string; depth: number; width: number; stability: number; freeEnergyProxy: number; precision: number };
  controlSignal: { policy: string; actionRequired: string; confidence: number };
}

export class DionysusMetacogBridge {
  constructor(private readonly db?: BetterSqlite3.Database) {}

  async loadAndDispatchPayload(): Promise<DionysusControlPayload | null> {
    const payloadPath = path.join(process.cwd(), "src", "cletus", "dionysus-payload.json");
    if (!fs.existsSync(payloadPath)) {
      logger.warn("[DIONYSUS-BRIDGE] No dionysus-payload.json found.");
      return null;
    }

    try {
      const raw = fs.readFileSync(payloadPath, "utf-8");
      const payload: DionysusControlPayload = JSON.parse(raw);

      logger.info(`[DIONYSUS-BRIDGE] Dispatched Active-Inference Control Signal [Policy: ${payload.controlSignal.policy.toUpperCase()}] (Free Energy Proxy: ${payload.dynamics.freeEnergyProxy}, Precision: ${payload.dynamics.precision})`);

      // Retain dispatch provenance to Entelechy
      await retainEntelechyTaskResult(
        `dionysus_dispatch_${Date.now()}`,
        `DIONYSUS ACTIVE-INFERENCE DISPATCH: Policy: ${payload.controlSignal.policy}, Free Energy: ${payload.dynamics.freeEnergyProxy}, Stability: ${payload.dynamics.stability}`,
        ENTELECHY_DEFAULT_BANK
      ).catch(() => {});

      return payload;
    } catch (err: any) {
      logger.warn(`[DIONYSUS-BRIDGE] Payload dispatch error: ${err?.message}`);
      return null;
    }
  }
}
