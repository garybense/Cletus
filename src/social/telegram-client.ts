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
    private readonly creatorChatId?: string | number,
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
}

/**
 * Continuous Inbound Telegram Polling Daemon
 * Receives messages, inserts them into inbox_messages, and issues wake events.
 */
export class TelegramPollingDaemon {
  private client: TelegramClient;
  private db: Database;
  private pollIntervalMs: number;
  private offset = 0;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: TelegramDaemonOptions) {
    this.client = options.client;
    this.db = options.db;
    this.pollIntervalMs = options.pollIntervalMs || 5000;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info("Started Telegram Inbound Polling Daemon");
    this.poll();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info("Stopped Telegram Inbound Polling Daemon");
  }

  async pollOnce(): Promise<number> {
    try {
      const updates = await this.client.getUpdates(this.offset);
      if (!updates || updates.length === 0) return 0;

      for (const update of updates) {
        this.offset = Math.max(this.offset, update.id + 1);

        const fromAddress = `telegram:${update.chatId}`;
        const content = update.text.trim();
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

        logger.info(`Received Telegram message from ${fromAddress}: "${content.slice(0, 50)}..."`);

        // Insert wake event
        try {
          this.db.prepare(`
            INSERT INTO wake_events (source, reason, payload, created_at)
            VALUES ('telegram', ?, ?, datetime('now'))
          `).run(
            `Telegram decree from ${fromAddress}: ${content.slice(0, 60)}`,
            JSON.stringify({ chatId: update.chatId, updateId: update.id }),
          );
        } catch (e: any) {
          logger.warn(`Failed to insert wake event for Telegram message: ${e?.message}`);
        }
      }

      return updates.length;
    } catch (err: any) {
      logger.error(`Telegram polling error: ${err?.message || String(err)}`);
      return 0;
    }
  }

  private async poll(): Promise<void> {
    if (!this.running) return;
    await this.pollOnce();
    if (this.running) {
      this.timer = setTimeout(() => this.poll(), this.pollIntervalMs);
    }
  }
}
