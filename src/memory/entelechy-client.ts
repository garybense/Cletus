/**
 * Entelechy MCP Client
 *
 * Provides typed interface and SSE JSON-RPC transport to Entelechy MCP server
 * hosted at https://mindmods.org/mcp.
 */

export const ENTELECHY_DEFAULT_BANK = "cletus";
export const ENTELECHY_MCP_URL = "https://mindmods.org/mcp";

export async function callEntelechyMcpTool(
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<any> {
  const resp = await fetch(ENTELECHY_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Entelechy MCP error (${resp.status}): ${errText}`);
  }

  const raw = await resp.text();

  // Extract from SSE event stream (data: {...})
  const lines = raw.split("\n");
  for (const line of lines) {
    if (line.startsWith("data:")) {
      const jsonStr = line.slice(5).trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.error) {
          throw new Error(parsed.error.message || JSON.stringify(parsed.error));
        }
        return parsed.result;
      } catch (e: any) {
        if (!e.message.includes("Unexpected token")) throw e;
      }
    }
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed.error) {
      throw new Error(parsed.error.message || JSON.stringify(parsed.error));
    }
    return parsed.result;
  } catch {
    return raw;
  }
}
