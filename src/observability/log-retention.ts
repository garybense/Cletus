/**
 * Cletus SQLite Log Retention & Entelechy Archival Engine
 *
 * Implements rolling retention for the `system_logs` table in state.db.
 * When log entries exceed the retention ceiling (default: 10,000 entries),
 * the oldest entries are pruned.
 *
 * Before pruning, an operational digest is computed (time window, error counts,
 * module breakdowns, significant milestone events) and optionally committed
 * to Entelechy long-term memory so that historical operational intelligence
 * is preserved without bloating local SQLite storage.
 */

import type Database from "better-sqlite3";
import { createLogger } from "./logger.js";
import {
  callEntelechyMcpTool,
  ENTELECHY_DEFAULT_BANK,
} from "../memory/entelechy-client.js";
import type { InferenceClient } from "../types.js";

const logger = createLogger("observability.log-retention");

export interface LogRetentionOptions {
  /** Maximum number of latest log entries to keep in system_logs. Defaults to 10,000. */
  maxEntries?: number;
  /** Whether to generate an operational digest and retain it into Entelechy. Defaults to true. */
  summarizeForEntelechy?: boolean;
  /** Target Entelechy bank ID. Defaults to ENTELECHY_DEFAULT_BANK ("cletus"). */
  entelechyBank?: string;
  /** Optional inference client to generate an AI narrative summary of the pruned batch. */
  inference?: InferenceClient;
  /** Preferred dynamic model ID for AI summarization (no hardcoded model strings). */
  preferredModel?: string;
}

export interface LogRetentionResult {
  prunedCount: number;
  remainingCount: number;
  summarized: boolean;
  digest?: string;
}

export interface PrunedLogStats {
  totalCount: number;
  startTime: string;
  endTime: string;
  errorCount: number;
  warnCount: number;
  infoCount: number;
  topErrorModules: Array<{ module: string; count: number }>;
  keyEvents: Array<{ timestamp: string; module: string; message: string }>;
}

/**
 * Extracts aggregate statistical breakdown of logs to be pruned.
 */
export function extractPrunedLogStats(
  db: Database.Database,
  cutoffCreatedAt: string,
): PrunedLogStats {
  const summaryRow = db
    .prepare(
      `SELECT
        COUNT(*) as totalCount,
        COALESCE(MIN(timestamp), '') as startTime,
        COALESCE(MAX(timestamp), '') as endTime,
        SUM(CASE WHEN level = 'ERROR' THEN 1 ELSE 0 END) as errorCount,
        SUM(CASE WHEN level = 'WARN' THEN 1 ELSE 0 END) as warnCount,
        SUM(CASE WHEN level = 'INFO' THEN 1 ELSE 0 END) as infoCount
       FROM system_logs
       WHERE created_at <= ?`,
    )
    .get(cutoffCreatedAt) as any;

  const topModules = db
    .prepare(
      `SELECT module, COUNT(*) as count
       FROM system_logs
       WHERE created_at <= ? AND level IN ('ERROR', 'WARN')
       GROUP BY module
       ORDER BY count DESC
       LIMIT 5`,
    )
    .all(cutoffCreatedAt) as Array<{ module: string; count: number }>;

  const keyEvents = db
    .prepare(
      `SELECT timestamp, module, message
       FROM system_logs
       WHERE created_at <= ? AND (
         message LIKE '%[GOAL]%' OR
         message LIKE '%Goal completed%' OR
         message LIKE '%State:%' OR
         message LIKE '%[WAKE UP]%' OR
         message LIKE '%Harness execution failed%' OR
         message LIKE '%Directive from your creator%' OR
         level = 'ERROR'
       )
       ORDER BY created_at DESC
       LIMIT 10`,
    )
    .all(cutoffCreatedAt) as Array<{ timestamp: string; module: string; message: string }>;

  return {
    totalCount: Number(summaryRow?.totalCount || 0),
    startTime: summaryRow?.startTime || new Date().toISOString(),
    endTime: summaryRow?.endTime || new Date().toISOString(),
    errorCount: Number(summaryRow?.errorCount || 0),
    warnCount: Number(summaryRow?.warnCount || 0),
    infoCount: Number(summaryRow?.infoCount || 0),
    topErrorModules: topModules,
    keyEvents,
  };
}

/**
 * Formats structured statistics into an operational markdown digest.
 */
export function formatLogDigest(stats: PrunedLogStats, aiSummary?: string): string {
  let md = `# Cletus Operational Log Archive Digest\n\n`;
  md += `**Time Window:** ${stats.startTime} to ${stats.endTime}\n`;
  md += `**Archived Entries:** ${stats.totalCount} (INFO: ${stats.infoCount}, WARN: ${stats.warnCount}, ERROR: ${stats.errorCount})\n\n`;

  if (aiSummary && aiSummary.trim().length > 0) {
    md += `## Executive Summary\n${aiSummary.trim()}\n\n`;
  }

  if (stats.topErrorModules.length > 0) {
    md += `## Top Issue-Generating Modules\n`;
    for (const m of stats.topErrorModules) {
      md += `- **${m.module}**: ${m.count} warnings/errors\n`;
    }
    md += `\n`;
  }

  if (stats.keyEvents.length > 0) {
    md += `## Notable Events & Incidents\n`;
    for (const e of stats.keyEvents) {
      md += `- \`[${e.timestamp}]\` (${e.module}): ${e.message.slice(0, 150)}\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * Persists log archive digest into Entelechy knowledge bank.
 */
export async function persistDigestToEntelechy(
  digestText: string,
  stats: PrunedLogStats,
  bankId: string,
): Promise<boolean> {
  const docId = `log_digest_${Date.now()}`;
  try {
    await callEntelechyMcpTool("sync_retain", {
      bank_id: bankId,
      content: digestText,
      context: "log_retention_sweep",
      document_id: docId,
    });
    return true;
  } catch {
    try {
      await callEntelechyMcpTool("retain", {
        bank_id: bankId,
        content: digestText,
        context: "log_retention_sweep",
      });
      return true;
    } catch (err) {
      logger.warn("Non-fatal: could not retain log digest in Entelechy", {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }
}

/**
 * Executes a log-retention sweep on the `system_logs` table.
 *
 * If total rows exceed `maxEntries` (default 10,000), entries exceeding
 * that ceiling are pruned, with an optional structured digest preserved in Entelechy.
 */
export async function pruneSystemLogs(
  db: Database.Database,
  options: LogRetentionOptions = {},
): Promise<LogRetentionResult> {
  const maxEntries = options.maxEntries ?? 10_000;
  const summarize = options.summarizeForEntelechy ?? true;
  const bankId = options.entelechyBank || ENTELECHY_DEFAULT_BANK;

  try {
    // Check total row count
    const countRow = db.prepare("SELECT COUNT(*) as count FROM system_logs").get() as any;
    const totalCount = Number(countRow?.count || 0);

    if (totalCount <= maxEntries) {
      return {
        prunedCount: 0,
        remainingCount: totalCount,
        summarized: false,
      };
    }

    const excessCount = totalCount - maxEntries;

    // Find the cutoff created_at timestamp: the first entry exceeding maxEntries
    // (i.e. at offset maxEntries in descending order)
    const cutoffRow = db
      .prepare(
        `SELECT created_at FROM system_logs
         ORDER BY created_at DESC
         LIMIT 1 OFFSET ?`,
      )
      .get(maxEntries) as any;

    if (!cutoffRow?.created_at) {
      return {
        prunedCount: 0,
        remainingCount: totalCount,
        summarized: false,
      };
    }

    const cutoffCreatedAt = cutoffRow.created_at;

    // Extract stats for the entries being pruned
    const stats = extractPrunedLogStats(db, cutoffCreatedAt);

    let aiSummary: string | undefined;
    if (summarize && options.inference && stats.totalCount > 0) {
      try {
        const prompt = [
          {
            role: "system" as const,
            content:
              "You are Cletus operational intelligence summarizer. Summarize these archived system logs " +
              "into 1-2 concise bulleted paragraphs highlighting key tasks, recurring errors, and operational status.",
          },
          {
            role: "user" as const,
            content:
              `Time window: ${stats.startTime} to ${stats.endTime}\n` +
              `Total logs: ${stats.totalCount} (Errors: ${stats.errorCount}, Warns: ${stats.warnCount})\n` +
              `Top issue modules: ${stats.topErrorModules.map((m) => `${m.module} (${m.count})`).join(", ")}\n` +
              `Key events:\n${stats.keyEvents.map((e) => `[${e.timestamp}] ${e.module}: ${e.message}`).join("\n")}`,
          },
        ];

        const chatOpts: any = { maxTokens: 300, temperature: 0 };
        if (options.preferredModel) {
          chatOpts.model = options.preferredModel;
        }

        const resp = await options.inference.chat(prompt as any, chatOpts);
        aiSummary = resp?.message?.content || (resp as any)?.content;
      } catch (err) {
        // AI summary is best-effort; fallback to pure statistical digest
        logger.debug("AI log summary skipped due to inference error", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    let summarizedSuccess = false;
    let digest: string | undefined;

    if (summarize && stats.totalCount > 0) {
      digest = formatLogDigest(stats, aiSummary);
      summarizedSuccess = await persistDigestToEntelechy(digest, stats, bankId);
    }

    // Execute the deletion
    const deleteResult = db
      .prepare("DELETE FROM system_logs WHERE created_at <= ?")
      .run(cutoffCreatedAt);

    const prunedCount = deleteResult.changes;
    const remainingCount = totalCount - prunedCount;

    logger.info(`[LOG-RETENTION] Pruned ${prunedCount} old log entries (retained last ${remainingCount}). Entelechy summarized: ${summarizedSuccess}`);

    return {
      prunedCount,
      remainingCount,
      summarized: summarizedSuccess,
      digest,
    };
  } catch (err) {
    logger.error("Failed to execute log retention sweep", err instanceof Error ? err : undefined);
    return {
      prunedCount: 0,
      remainingCount: 0,
      summarized: false,
    };
  }
}
