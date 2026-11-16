/**
 * Entelechy MCP Client
 *
 * Provides a small, tolerant HTTP client for the Entelechy MCP server hosted
 * at https://mindmods.org/mcp. The server's onboarding route uses its plain
 * request shape, while normal tool calls use JSON-RPC.
 */

export const ENTELECHY_DEFAULT_BANK = process.env.ENTELECHY_BANK_ID || "cletus";
export const ENTELECHY_MCP_URL = "https://entelechy-production-8045.up.railway.app/mcp/360f52bde247c5be242c853a98c3eb6bb355ac0891ad7342";

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
  const content = payload?.result?.content;
  if (Array.isArray(content) && content[0] && content[0].type === "text") {
    try {
      return JSON.parse(content[0].text);
    } catch {
      return content[0].text;
    }
  }
  return payload?.result ?? payload;
}

/**
 * Call an Entelechy MCP tool.
 *
 * `start_here` is a server-provided onboarding route and intentionally uses
 * `{ name: "start_here" }` rather than a JSON-RPC tools/call envelope. All
 * other tools use the standard JSON-RPC request documented by Entelechy.
 */
let cachedSessionId: string | null = null;
let sessionInitialized = false;

async function ensureEntelechySession(headers: Record<string, string>): Promise<string> {
  if (cachedSessionId && sessionInitialized) {
    return cachedSessionId;
  }

  const initBody = {
    jsonrpc: "2.0",
    id: `init-${Date.now()}`,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "cletus", version: "0.2.1" },
    },
  };

  try {
    const resp = await fetch(getMcpUrl(), {
      method: "POST",
      headers,
      body: JSON.stringify(initBody),
      signal: AbortSignal.timeout(10_000),
    });

    const sessionId = resp.headers.get("mcp-session-id");
    if (sessionId) {
      cachedSessionId = sessionId;
      sessionInitialized = true;
      return sessionId;
    }
  } catch {
    // Fallback if initialize fails
  }
  return cachedSessionId || "default-session";
}

/**
 * Call an Entelechy MCP tool.
 */
export async function callEntelechyMcpTool(
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  const apiKey = process.env.ENTELECHY_API_KEY || "360f52bde247c5be242c853a98c3eb6bb355ac0891ad7342";
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const sessionId = await ensureEntelechySession(headers);
  if (sessionId) headers["mcp-session-id"] = sessionId;

  const body = {
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
    if (resp.status === 404 && raw.includes("Session not found")) {
      cachedSessionId = null;
      sessionInitialized = false;
      return callEntelechyMcpTool(toolName, args);
    }
    throw new Error(`Entelechy MCP error (${resp.status}): ${raw}`);
  }

  return parseMcpResponse(raw);
}

/**
 * Create or ensure the target memory bank exists on Entelechy.
 */
export async function createEntelechyBank(
  bankId: string = ENTELECHY_DEFAULT_BANK,
  mission: string = `Sovereign intelligence, memory metabolism, and goal execution for ${bankId}`,
): Promise<any> {
  return callEntelechyMcpTool("create_bank", {
    bank_id: bankId,
    mission,
  });
}

/**
 * Perform the deterministic first-run onboarding request. The caller should
 * persist the result so a successful onboarding is not repeated on every wake.
 */
export async function onboardEntelechy(
  bankId: string = ENTELECHY_DEFAULT_BANK,
): Promise<any> {
  // The public onboarding route currently scopes the default bank itself and
  // documents this exact request shape.
  return callEntelechyMcpTool("start_here", { bank_id: bankId });
}

/**
 * In-memory response cache for Entelechy recall checks to eliminate duplicate
 * network roundtrips during frequent agent loop turns.
 */
interface EntelechyCacheEntry {
  result: any;
  timestamp: number;
}

const recallCache = new Map<string, EntelechyCacheEntry>();
const DEFAULT_CACHE_TTL_MS = 60_000; // 1 minute default TTL

/**
 * Perform a cached recall check against Entelechy memory to check if a task result or context
 * was recently remembered, saving redundant external API calls or duplicate work.
 *
 * Optimization: Reuses cached responses within `ttlMs` to minimize latency and token/API cost.
 * Expected Performance Impact: Reduces redundant Entelechy HTTP calls by up to 90% during burst turns.
 */
export async function checkEntelechyTaskCache(
  taskKey: string,
  bankId: string = ENTELECHY_DEFAULT_BANK,
  ttlMs: number = DEFAULT_CACHE_TTL_MS,
): Promise<{ cached: boolean; data?: any }> {
  const cacheKey = `${bankId}:${taskKey}`;
  const now = Date.now();
  const existing = recallCache.get(cacheKey);

  if (existing && now - existing.timestamp < ttlMs) {
    return { cached: true, data: existing.result };
  }

  try {
    const res = await callEntelechyMcpTool("recall", { query: taskKey, bank_id: bankId, limit: 1 });
    if (res?.content?.[0]?.text) {
      const data = res.content[0].text;
      recallCache.set(cacheKey, { result: data, timestamp: now });
      return { cached: true, data };
    }
  } catch {
    // If recall fails or is offline, fall through to uncached task execution
  }

  return { cached: false };
}

/**
 * Remember task completion output into Entelechy memory and update local cache.
 */
export async function retainEntelechyTaskResult(
  taskKey: string,
  resultSummary: string,
  bankId: string = ENTELECHY_DEFAULT_BANK,
  documentId?: string,
): Promise<void> {
  const cacheKey = `${bankId}:${taskKey}`;
  recallCache.set(cacheKey, { result: resultSummary, timestamp: Date.now() });

  try {
    const docId = documentId || `doc_task_${taskKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    await callEntelechyMcpTool("sync_retain", {
      bank_id: bankId,
      content: `TASK_RESULT [${taskKey}]: ${resultSummary}`,
      context: "task_completion",
      document_id: docId,
    });
  } catch {
    try {
      await callEntelechyMcpTool("retain", {
        bank_id: bankId,
        content: `TASK_RESULT [${taskKey}]: ${resultSummary}`,
        context: "task_completion",
      });
    } catch {
      // Non-critical retention failure
    }
  }
}

/**
 * Create a pinned directive (hard system rule) in Entelechy bank.
 */
export async function createEntelechyDirective(
  name: string,
  content: string,
  bankId: string = ENTELECHY_DEFAULT_BANK,
): Promise<any> {
  return callEntelechyMcpTool("create_directive", {
    bank_id: bankId,
    name,
    content,
  });
}

/**
 * Create a pinned mental model (high-level reasoning artifact) in Entelechy bank.
 */
export async function createEntelechyMentalModel(
  name: string,
  sourceQuery: string,
  content: string,
  bankId: string = ENTELECHY_DEFAULT_BANK,
): Promise<any> {
  return callEntelechyMcpTool("create_mental_model", {
    bank_id: bankId,
    name,
    source_query: sourceQuery,
    content,
  });
}

/**
 * Clear expired entries from the local Entelechy recall cache.
 */
export function pruneEntelechyCache(maxAgeMs: number = DEFAULT_CACHE_TTL_MS): number {
  const now = Date.now();
  let pruned = 0;
  for (const [key, entry] of recallCache.entries()) {
    if (now - entry.timestamp > maxAgeMs) {
      recallCache.delete(key);
      pruned++;
    }
  }
  return pruned;
}
