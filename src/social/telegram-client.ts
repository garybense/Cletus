import { createLogger } from "../observability/logger.js";
import { ResilientHttpClient } from "../mindmods/http-client.js";
const logger = createLogger("social.telegram");

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
   * Send a message to the configured creator chat.
   */
  async sendMessage(text: string): Promise<boolean> {
    if (!this.creatorChatId) {
      logger.warn("No creatorChatId configured for Telegram. Message not sent.");
      return false;
    }

    try {
      const resp = await this.httpClient.request(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.creatorChatId,
          text,
          parse_mode: "Markdown"
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
   * Poll for new messages from the creator.
   */
  async getUpdates(offset?: number): Promise<TelegramMessage[]> {
    try {
      const resp = await this.httpClient.request(`${this.baseUrl}/getUpdates`, {
        method: "POST", // Many Telegram methods work with POST and query params or body
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offset: offset || 0,
          timeout: 10
        }),
      });

      if (!resp.ok) {
        logger.error(`Telegram getUpdates failed: ${resp.status}`);
        return [];
      }

      const data = await resp.json() as any;
      if (!data.ok) return [];

      return data.result
        .filter((update: any) => update.message && update.message.text)
        .map((update: any) => ({
          id: update.update_id,
          chatId: update.message.chat.id,
          text: update.message.text,
          timestamp: update.message.date
        }));
    } catch (e) {
      logger.error(`Telegram update poll error: ${e}`);
      return [];
    }
  }
}
