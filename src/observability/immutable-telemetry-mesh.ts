/**
 * Immutable Telemetry Mesh Engine
 * Cryptographically chains every system telemetry event (sha256(prevHash + payload))
 * into an append-only, un-tamperable state ledger backed by SQLite & Entelechy.
 */

import crypto from "node:crypto";
import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "./logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("immutable-telemetry-mesh");

export interface TelemetryBlock {
  index: number;
  blockId: string;
  previousHash: string;
  hash: string;
  eventType: string;
  actor: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export class ImmutableTelemetryMeshEngine {
  private genesisHash = "0000000000000000000000000000000000000000000000000000000000000000";

  constructor(private readonly db: BetterSqlite3.Database) {
    this.initMeshSchema();
  }

  private initMeshSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS immutable_telemetry_mesh (
        block_index INTEGER PRIMARY KEY AUTOINCREMENT,
        block_id TEXT UNIQUE NOT NULL,
        previous_hash TEXT NOT NULL,
        hash TEXT NOT NULL,
        event_type TEXT NOT NULL,
        actor TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async appendTelemetryBlock(eventType: string, actor: string, payload: Record<string, unknown>): Promise<TelemetryBlock> {
    const lastRow = this.db.prepare(`
      SELECT block_index, hash FROM immutable_telemetry_mesh ORDER BY block_index DESC LIMIT 1
    `).get() as { block_index: number; hash: string } | undefined;

    const index = (lastRow?.block_index || 0) + 1;
    const previousHash = lastRow?.hash || this.genesisHash;
    const blockId = `block_${index}_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const rawData = `${index}:${previousHash}:${eventType}:${actor}:${JSON.stringify(payload)}:${timestamp}`;
    const hash = crypto.createHash("sha256").update(rawData).digest("hex");

    const block: TelemetryBlock = {
      index,
      blockId,
      previousHash,
      hash,
      eventType,
      actor,
      payload,
      timestamp,
    };

    try {
      this.db.prepare(`
        INSERT INTO immutable_telemetry_mesh (block_index, block_id, previous_hash, hash, event_type, actor, payload, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(index, blockId, previousHash, hash, eventType, actor, JSON.stringify(payload), timestamp);

      logger.info(`[IMMUTABLE-MESH] Appended Telemetry Block #${index} [Hash: ${hash.slice(0, 12)}...]`);

      // Anchor block to Entelechy long-term memory
      await retainEntelechyTaskResult(
        `telemetry_block_${index}`,
        `IMMUTABLE BLOCK #${index} [${eventType}]: Hash ${hash.slice(0, 16)} | Actor: ${actor}`,
        ENTELECHY_DEFAULT_BANK
      ).catch(() => {});
    } catch (err: any) {
      logger.warn(`[IMMUTABLE-MESH] Block append failed: ${err?.message}`);
    }

    return block;
  }

  verifyMeshIntegrity(): { intact: boolean; verifiedBlocks: number; error?: string } {
    try {
      const blocks = this.db.prepare(`
        SELECT block_index, previous_hash, hash, event_type, actor, payload, timestamp
        FROM immutable_telemetry_mesh
        ORDER BY block_index ASC
      `).all() as any[];

      if (blocks.length === 0) {
        return { intact: true, verifiedBlocks: 0 };
      }

      let expectedPrevHash = this.genesisHash;

      for (const b of blocks) {
        if (b.previous_hash !== expectedPrevHash) {
          return { intact: false, verifiedBlocks: b.block_index, error: `Broken prev_hash chain at Block #${b.block_index}` };
        }

        const rawData = `${b.block_index}:${b.previous_hash}:${b.event_type}:${b.actor}:${b.payload}:${b.timestamp}`;
        const calculatedHash = crypto.createHash("sha256").update(rawData).digest("hex");

        if (calculatedHash !== b.hash) {
          return { intact: false, verifiedBlocks: b.block_index, error: `Tampered hash at Block #${b.block_index}` };
        }

        expectedPrevHash = b.hash;
      }

      logger.info(`[IMMUTABLE-MESH] Verified cryptographic integrity across ${blocks.length} telemetry block(s). Status: INTACT.`);
      return { intact: true, verifiedBlocks: blocks.length };
    } catch (err: any) {
      return { intact: false, verifiedBlocks: 0, error: err?.message };
    }
  }
}
