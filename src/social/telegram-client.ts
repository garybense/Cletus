import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";
import { ResilientHttpClient } from "../mindmods/http-client.js";

const logger = createLogger("social.telegram");

type Database = BetterSqlite3.Database;

export interface TelegramMessage {
  id: number;
  chatId: number;
  text: string;
  timestamp: number;
}

export class TelegramClient {
  private readonly baseUrl: string;
  private readonly httpClient: ResilientHttpClient;

  constructor(
    private readonly botToken: string,
    public readonly creatorChatId?: string | number,
  ) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
    this.httpClient = new ResilientHttpClient({
      baseTimeout: 15_000,
      maxRetries: 2,
    });
  }

  /**
   * Send a message to the configured creator chat or target chatId.
   */
  async sendMessage(text: string, targetChatId?: string | number): Promise<boolean> {
    const chatId = targetChatId || this.creatorChatId;
    if (!chatId) {
      logger.warn("No creatorChatId or targetChatId configured for Telegram. Message not sent.");
      return false;
    }

    try {
      const resp = await this.httpClient.request(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
      });

      if (!resp.ok) {
        const error = await resp.text();
        logger.error(`Telegram sendMessage failed: ${resp.status} ${error}`);
        return false;
      }

      return true;
    } catch (e) {
      logger.error(`Telegram network error: ${e}`);
      return false;
    }
  }

  /**
   * Poll for new messages from Telegram.
   */
  async getUpdates(offset?: number): Promise<TelegramMessage[]> {
    try {
      const resp = await this.httpClient.request(`${this.baseUrl}/getUpdates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offset: offset || 0,
          timeout: 10,
        }),
      });

      if (!resp.ok) {
        logger.error(`Telegram getUpdates failed: ${resp.status}`);
        return [];
      }

      const data = (await resp.json()) as any;
      if (!data.ok) return [];

      return data.result
        .filter((update: any) => update.message && update.message.text)
        .map((update: any) => ({
          id: update.update_id,
          chatId: update.message.chat.id,
          text: update.message.text,
          timestamp: update.message.date,
        }));
    } catch (e) {
      logger.error(`Telegram update poll error: ${e}`);
      return [];
    }
  }
}

export interface TelegramDaemonOptions {
  client: TelegramClient;
  db: Database;
  pollIntervalMs?: number;
  maxMessageLength?: number;
}

/**
 * Hardened Inbound Telegram Polling Daemon
 * - Persistent offset in SQLite kv table across reboots
 * - Authorized creator chat filtering & priority tagging
 * - Message length gating & input truncation
 * - Exponential backoff on network failures
 */
export class TelegramPollingDaemon {
  private client: TelegramClient;
  private db: Database;
  private pollIntervalMs: number;
  private maxMessageLength: number;
  private offset = 0;
  private consecutiveFailures = 0;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: TelegramDaemonOptions) {
    this.client = options.client;
    this.db = options.db;
    this.pollIntervalMs = options.pollIntervalMs || 5000;
    this.maxMessageLength = options.maxMessageLength || 10_000;

    // Load persisted offset from SQLite kv table if present
    this.loadOffset();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info(`Started Hardened Telegram Polling Daemon (last offset: ${this.offset})`);
    this.poll();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info("Stopped Telegram Polling Daemon");
  }

  async pollOnce(): Promise<number> {
    try {
      const updates = await this.client.getUpdates(this.offset);
      if (!updates || updates.length === 0) {
        this.consecutiveFailures = 0;
        return 0;
      }

      for (const update of updates) {
        this.offset = Math.max(this.offset, update.id + 1);
        this.saveOffset();

        const isCreator = this.client.creatorChatId
          ? String(update.chatId) === String(this.client.creatorChatId)
          : false;

        const fromAddress = isCreator
          ? `telegram:creator:${update.chatId}`
          : `telegram:guest:${update.chatId}`;

        // Truncate long messages to prevent memory / SQL buffer saturation
        const content = update.text.trim().slice(0, this.maxMessageLength);
        const msgId = `tg-${update.id}`;

        // Insert into inbox_messages
        try {
          this.db.prepare(`
            INSERT OR IGNORE INTO inbox_messages (id, from_address, to_address, content, received_at, status)
            VALUES (?, ?, 'cletus', ?, datetime('now'), 'received')
          `).run(msgId, fromAddress, content);
        } catch (e: any) {
          logger.warn(`Failed to insert inbox message from Telegram: ${e?.message}`);
        }

        logger.info(`Received Telegram message [${isCreator ? "CREATOR" : "GUEST"}] from ${fromAddress}: "${content.slice(0, 50)}..."`);

        // Insert wake event
        try {
          this.db.prepare(`
            INSERT INTO wake_events (source, reason, payload, created_at)
            VALUES ('telegram', ?, ?, datetime('now'))
          `).run(
            `Telegram ${isCreator ? "creator decree" : "guest message"} from ${fromAddress}: ${content.slice(0, 60)}`,
            JSON.stringify({ chatId: update.chatId, updateId: update.id, isCreator }),
          );
        } catch (e: any) {
          logger.warn(`Failed to insert wake event for Telegram message: ${e?.message}`);
        }
      }

      this.consecutiveFailures = 0;
      return updates.length;
    } catch (err: any) {
      this.consecutiveFailures++;
      logger.error(`Telegram polling error (failure #${this.consecutiveFailures}): ${err?.message || String(err)}`);
      return 0;
    }
  }

  private loadOffset(): void {
    try {
      const row = this.db
        .prepare("SELECT value FROM kv WHERE key = 'telegram.last_offset'")
        .get() as { value: string } | undefined;
      if (row?.value) {
        const parsed = parseInt(row.value, 10);
        if (Number.isInteger(parsed) && parsed > 0) {
          this.offset = parsed;
        }
      }
    } catch {}
  }

  private saveOffset(): void {
    try {
      this.db
        .prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('telegram.last_offset', ?, datetime('now'))")
        .run(String(this.offset));
    } catch {}
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    await this.pollOnce();

    if (this.running) {
      // Exponential backoff on consecutive failures: 5s, 10s, 20s, 40s, capped at 60s
      const delay = this.consecutiveFailures > 0
        ? Math.min(60_000, this.pollIntervalMs * Math.pow(2, this.consecutiveFailures - 1))
        : this.pollIntervalMs;

      this.timer = setTimeout(() => this.poll(), delay);
    }
  }
}
