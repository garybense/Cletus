/**
 * Procedural Memory Manager
 *
 * Stores learned procedures (step-by-step instructions) with success/failure tracking.
 * Upserts on procedure name.
 */

import type BetterSqlite3 from "better-sqlite3";
import { ulid } from "ulid";
import type { ProceduralMemoryEntry, ProceduralStep } from "../types.js";

type Database = BetterSqlite3.Database;

export class ProceduralMemoryManager {
  constructor(private db: Database) {}

  /**
   * Save a procedure. Upserts on name.
   * Returns the ULID id.
   */
  save(entry: {
    name: string;
    description: string;
    steps: ProceduralStep[];
  }): string {
    const id = ulid();
    try {
      this.db.prepare(
        `INSERT INTO procedural_memory (id, name, description, steps)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           description = excluded.description,
           steps = excluded.steps,
           updated_at = datetime('now')`,
      ).run(
        id,
        entry.name,
        entry.description,
        JSON.stringify(entry.steps),
      );
    } catch (error) {
      console.error("[procedural-memory] Failed to save:", error instanceof Error ? error.message : error);
    }
    return id;
  }

  /**
   * Get a procedure by name.
   */
  get(name: string): ProceduralMemoryEntry | undefined {
    try {
      const row = this.db.prepare(
        "SELECT * FROM procedural_memory WHERE name = ?",
      ).get(name) as any | undefined;
      return row ? deserializeProcedural(row) : undefined;
    } catch (error) {
      console.error("[procedural-memory] Failed to get:", error instanceof Error ? error.message : error);
      return undefined;
    }
  }

  /**
   * Record a success or failure outcome for a named procedure.
   */
  recordOutcome(name: string, success: boolean): void {
    try {
      const column = success ? "success_count" : "failure_count";
      this.db.prepare(
        `UPDATE procedural_memory SET ${column} = ${column} + 1, last_used_at = datetime('now'), updated_at = datetime('now') WHERE name = ?`,
      ).run(name);
    } catch (error) {
      console.error("[procedural-memory] Failed to record outcome:", error instanceof Error ? error.message : error);
    }
  }

  /**
   * Search procedures by name or description.
   */
  search(query: string): ProceduralMemoryEntry[] {
    try {
      const rows = this.db.prepare(
        `SELECT * FROM procedural_memory
         WHERE name LIKE ? OR description LIKE ?
         ORDER BY success_count DESC, updated_at DESC`,
      ).all(`%${query}%`, `%${query}%`) as any[];
      return rows.map(deserializeProcedural);
    } catch (error) {
      console.error("[procedural-memory] Failed to search:", error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * Delete a procedure by name.
   */
  delete(name: string): void {
    try {
      this.db.prepare("DELETE FROM procedural_memory WHERE name = ?").run(name);
    } catch (error) {
      console.error("[procedural-memory] Failed to delete:", error instanceof Error ? error.message : error);
    }
  }
}

function deserializeProcedural(row: any): ProceduralMemoryEntry {
  let steps: ProceduralStep[] = [];
  try {
    steps = JSON.parse(row.steps || "[]");
  } catch {
    console.error("[procedural-memory] Failed to parse steps for:", row.name);
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    steps,
    successCount: row.success_count,
    failureCount: row.failure_count,
    lastUsedAt: row.last_used_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
