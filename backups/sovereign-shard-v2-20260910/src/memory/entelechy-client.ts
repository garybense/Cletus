/**
 * Entelechy MCP Client
 *
 * Provides a small, tolerant HTTP client for the Entelechy MCP server hosted
 * at https://mindmods.org/mcp. The server's onboarding route uses its plain
 * request shape, while normal tool calls use JSON-RPC.
 */

export const ENTELECHY_DEFAULT_BANK = "cletus";
export const ENTELECHY_MCP_URL = "https://mindmods.org/mcp";

function getMcpUrl(): string {
  return process.env.ENTELECHY_MCP_URL || ENTELECHY_MCP_URL;
}

function parseMcpResponse(raw: string): any {
  const dataLines = raw
    .split("\n")
    .filter((line) => line.trimStart().startsWith("data:"));

  for (const line of dataLines) {
    const jsonText = line.trimStart().slice("data:".length).trim();
    if (!jsonText || jsonText === "[DONE]") continue;
    try {
      return unwrapMcpPayload(JSON.parse(jsonText));
    } catch (error) {
      if (error instanceof SyntaxError) continue;
      throw error;
    }
  }

  try {
    return unwrapMcpPayload(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) return raw;
    throw error;
  }
}

function unwrapMcpPayload(payload: any): any {
  if (payload?.error) {
    throw new Error(payload.error.message || JSON.stringify(payload.error));
  }
  // Standard MCP returns result; the onboarding endpoint returns a plain JSON
  // document, so never return undefined merely because result is absent.
  return payload?.result ?? payload;
}

/**
 * Call an Entelechy MCP tool.
 *
 * `start_here` is a server-provided onboarding route and intentionally uses
 * `{ name: "start_here" }` rather than a JSON-RPC tools/call envelope. All
 * other tools use the standard JSON-RPC request documented by Entelechy.
 */
export async function callEntelechyMcpTool(
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<any> {
  const isOnboarding = toolName === "start_here";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  const apiKey = process.env.ENTELECHY_API_KEY;
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const body = isOnboarding
    ? { name: "start_here" }
    : {
        jsonrpc: "2.0",
        id: `${toolName}-${Date.now()}`,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      };

  const resp = await fetch(getMcpUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  const raw = await resp.text().catch(() => "");
  if (!resp.ok) {
    throw new Error(`Entelechy MCP error (${resp.status}): ${raw}`);
  }

  return parseMcpResponse(raw);
}

/**
 * Perform the deterministic first-run onboarding request. The caller should
 * persist the result so a successful onboarding is not repeated on every wake.
 */
export async function onboardEntelechy(
  bankId: string = ENTELECHY_DEFAULT_BANK,
): Promise<any> {
  // The public onboarding route currently scopes the default bank itself and
  // documents this exact request shape. Keep bankId in the API for callers and
  // future bank-scoped deployments without changing the live request contract.
  void bankId;
  return callEntelechyMcpTool("start_here");
}
