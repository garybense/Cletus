/**
 * Generic MCP HTTP Client
 *
 * Implements the Model Context Protocol (MCP) over HTTP.
 * Supports tool discovery and execution.
 */

import { createLogger } from "../observability/logger.js";
const logger = createLogger("mcp.http");

export interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface McpCallResult {
  content: Array<{ type: string; text?: string; [key: string]: any }>;
  isError?: boolean;
}

export class McpHttpClient {
  constructor(
    private readonly url: string,
    private readonly token?: string,
  ) {}

  /**
   * List available tools on the remote MCP server.
   */
  async listTools(): Promise<McpTool[]> {
    const response = await this.request("tools/list", {});
    return response.tools || [];
  }

  /**
   * Call a tool on the remote MCP server.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
    return this.request("tools/call", {
      name,
      arguments: args,
    });
  }

  private async request(method: string, params: any): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const body = {
      jsonrpc: "2.0",
      id: `${method}-${Date.now()}`,
      method,
      params,
    };

    try {
      const resp = await fetch(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "Unknown error");
        throw new Error(`MCP HTTP error (${resp.status}): ${text}`);
      }

      const json = await resp.json();

      if (json.error) {
        throw new Error(`MCP Protocol error: ${json.error.message || JSON.stringify(json.error)}`);
      }

      return json.result;
    } catch (error) {
      logger.error(`Request to ${this.url} failed: ${error}`);
      throw error;
    }
  }
}
