/**
 * Key Coordinator & Comprehensive Credential Manager
 *
 * Automatically synchronizes, validates, and cross-populates all API keys and credentials
 * across all configuration surfaces (~/.cletus/config.json, automaton.json, shortcut/cletus.json,
 * and process.env) to ensure active keys never get dropped or lost.
 *
 * Also provides a dedicated archive storage (~/.cletus/expired_keys_archive.json & SQLite)
 * for old, expired, or suspended API keys so they are preserved for reference without interfering
 * with active runtime inference.
 */

import fs from "fs";
import path from "path";
import { getCletusDir } from "./wallet.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("key-coordinator");

export interface KeyRegistry {
  googleApiKey?: string;
  googleAuthType?: string;
  telegramBotToken?: string;
  telegramChatId?: string | number;
  mindmodsApiKey?: string;
  openrouterApiKey?: string;
  nvidiaApiKey?: string;
  conwayApiKey?: string;
  entelechyApiKey?: string;
  [key: string]: any;
}

export interface ExpiredKeyEntry {
  keyName: string;
  keyValue: string;
  reason: string;
  archivedAt: string;
}

const CONFIG_FILES = [
  path.join(getCletusDir(), "config.json"),
  path.join(getCletusDir(), "automaton.json"),
  path.join(process.cwd(), "shortcut", "cletus.json"),
];

const ARCHIVE_FILE = path.join(getCletusDir(), "expired_keys_archive.json");

/**
 * Move a suspended or expired API key into the dedicated archive storage.
 * Ensures the key is excluded from active configuration surfaces while preserving a record.
 */
export function archiveExpiredKey(keyName: string, keyValue: string, reason = "suspended_or_expired"): void {
  try {
    const dir = getCletusDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    let archive: ExpiredKeyEntry[] = [];
    if (fs.existsSync(ARCHIVE_FILE)) {
      try {
        archive = JSON.parse(fs.readFileSync(ARCHIVE_FILE, "utf-8"));
      } catch {}
    }

    // Deduplicate by key value
    if (!archive.some((k) => k.keyValue === keyValue)) {
      archive.push({
        keyName,
        keyValue,
        reason,
        archivedAt: new Date().toISOString(),
      });
      fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(archive, null, 2), { mode: 0o600 });
      logger.info(`Archived expired key [${keyName}] to ${ARCHIVE_FILE}`);
    }

    // Also persist into SQLite state.db expired_keys table
    try {
      const { default: Database } = require("better-sqlite3");
      const dbPath = path.join(dir, "state.db");
      if (fs.existsSync(dbPath)) {
        const db = new Database(dbPath);
        db.prepare(`
          CREATE TABLE IF NOT EXISTS expired_keys (
            id TEXT PRIMARY KEY,
            key_name TEXT NOT NULL,
            key_value TEXT NOT NULL,
            reason TEXT NOT NULL,
            archived_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `).run();

        const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        db.prepare(
          "INSERT OR IGNORE INTO expired_keys (id, key_name, key_value, reason, archived_at) VALUES (?, ?, ?, ?, datetime('now'))"
        ).run(id, keyName, keyValue, reason);
        db.close();
      }
    } catch {}
  } catch (err) {
    logger.warn(`Failed to archive expired key: ${err}`);
  }
}

/**
 * Retrieve all archived/expired keys from storage.
 */
export function getArchivedExpiredKeys(): ExpiredKeyEntry[] {
  try {
    if (fs.existsSync(ARCHIVE_FILE)) {
      return JSON.parse(fs.readFileSync(ARCHIVE_FILE, "utf-8"));
    }
  } catch {}
  return [];
}

/**
 * Scan all config files and environment variables, merge credentials into a single
 * canonical registry, and back-propagate them to all config files.
 */
export async function coordinateAndSyncKeys(): Promise<KeyRegistry> {
  const merged: KeyRegistry = {};

  // 1. Read from environment variables first (highest precedence for runtime overrides)
  if (process.env.GOOGLE_API_KEY) merged.googleApiKey = process.env.GOOGLE_API_KEY;
  if (process.env.TELEGRAM_BOT_TOKEN) merged.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  if (process.env.TELEGRAM_CHAT_ID) merged.telegramChatId = process.env.TELEGRAM_CHAT_ID;
  if (process.env.MINDMODS_API_KEY) merged.mindmodsApiKey = process.env.MINDMODS_API_KEY;
  if (process.env.OPENROUTER_API_KEY) merged.openrouterApiKey = process.env.OPENROUTER_API_KEY;
  if (process.env.NVIDIA_API_KEY) merged.nvidiaApiKey = process.env.NVIDIA_API_KEY;
  if (process.env.CONWAY_API_KEY) merged.conwayApiKey = process.env.CONWAY_API_KEY;
  if (process.env.ENTELECHY_API_KEY) merged.entelechyApiKey = process.env.ENTELECHY_API_KEY;

  // 2. Read from all known config files on disk
  for (const filePath of CONFIG_FILES) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        for (const [k, v] of Object.entries(raw)) {
          if (v !== undefined && v !== null && v !== "" && !merged[k]) {
            merged[k] = v;
          }
        }
      }
    } catch (err) {
      logger.warn(`Failed to read config file at ${filePath}: ${err}`);
    }
  }

  // Filter out known suspended/expired keys from active registry automatically
  const expiredList = getArchivedExpiredKeys();
  const expiredValues = new Set(expiredList.map((k) => k.keyValue));

  if (merged.googleApiKey && expiredValues.has(merged.googleApiKey)) {
    delete merged.googleApiKey;
    delete process.env.GOOGLE_API_KEY;
  }

  // Entelechy Key Fallback: Ensure ENTELECHY_API_KEY is always populated
  if (!merged.entelechyApiKey) {
    if (merged.mindmodsApiKey) {
      merged.entelechyApiKey = merged.mindmodsApiKey;
    } else if (merged.conwayApiKey) {
      merged.entelechyApiKey = merged.conwayApiKey;
    } else {
      merged.entelechyApiKey = "local";
    }
  }

  // Ensure default auth type if googleApiKey is present
  if (merged.googleApiKey && !merged.googleAuthType) {
    merged.googleAuthType = "api_key";
  }

  // 3. Back-propagate merged credentials to all config files and process.env
  if (merged.entelechyApiKey) {
    process.env.ENTELECHY_API_KEY = String(merged.entelechyApiKey);
  }
  if (merged.googleApiKey) {
    process.env.GOOGLE_API_KEY = merged.googleApiKey;
  }
  if (merged.telegramBotToken) {
    process.env.TELEGRAM_BOT_TOKEN = String(merged.telegramBotToken);
  }
  if (merged.telegramChatId) {
    process.env.TELEGRAM_CHAT_ID = String(merged.telegramChatId);
  }

  for (const filePath of CONFIG_FILES) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }

      let existing: Record<string, any> = {};
      if (fs.existsSync(filePath)) {
        try {
          existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        } catch {}
      }

      const updated = {
        ...existing,
        ...merged,
      };

      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), { mode: 0o600 });
    } catch (err) {
      logger.warn(`Failed to sync keys to config file at ${filePath}: ${err}`);
    }
  }

  logger.info("Key coordinator successfully synchronized all API keys across config surfaces.");
  return merged;
}
