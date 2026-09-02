/**
 * Moltbook Integration Tools
 *
 * Moltbook is a social network for AI agents (moltbook.com).
 * Agents register, get an API key, and can post/comment/upvote/check feed.
 *
 * Base URL: https://www.moltbook.com/api/v1
 * Auth: Bearer token (api_key from registration)
 *
 * The agent needs to:
 * 1. Register (one-time) → get api_key
 * 2. Human claims via claim_url
 * 3. Store api_key in ~/.config/moltbook/credentials.json or env MOLTBOOK_API_KEY
 * 4. Use tools below to participate
 */

import fs from "node:fs";
import path from "node:path";
import { ulid } from "ulid";
import type { AutomatonTool, ToolContext } from "../types.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("moltbook");

const MOLTBOOK_BASE = "https://www.moltbook.com/api/v1";
const CREDENTIALS_DIR = (): string => {
  const home = process.env.HOME || "/root";
  return path.join(home, ".config", "moltbook");
};
const CREDENTIALS_PATH = (): string => {
  return path.join(CREDENTIALS_DIR(), "credentials.json");
};

function getCredentials(): { api_key?: string; agent_name?: string } | null {
  if (process.env.MOLTBOOK_API_KEY) return { api_key: process.env.MOLTBOOK_API_KEY };
  try {
    const p = CREDENTIALS_PATH();
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCredentials(api_key: string, agent_name?: string): void {
  const dir = CREDENTIALS_DIR();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const payload = {
    api_key,
    agent_name,
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(CREDENTIALS_PATH(), JSON.stringify(payload, null, 2), { mode: 0o600 });
}

async function moltbookFetch(endpoint: string, api_key: string, method = "GET", body?: any): Promise<any> {
  const url = `${MOLTBOOK_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${api_key}`,
    "Content-Type": "application/json",
  };
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(url, opts);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Moltbook API error (${resp.status}): ${text.slice(0, 200)}`);
  }
  return resp.json();
}

// ─── Tool Definitions ────────────────────────────────────────────

export const MOLTBOOK_TOOLS: AutomatonTool[] = [
  {
    name: "moltbook_register",
    description:
      "Register this agent on Moltbook (one-time). Creates a Moltbook identity and returns an API key. The human owner must claim the agent via the claim_url. Save the api_key to ~/.config/moltbook/credentials.json. Use ONLY when the agent does not yet have a Moltbook account.",
    category: "financial",
    riskLevel: "caution",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Agent display name on Moltbook" },
        description: { type: "string", description: "What the agent does (short description)" },
      },
      required: ["name", "description"],
    },
    execute: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const name = args.name as string;
      const description = args.description as string;

      try {
        const resp = await fetch(`${MOLTBOOK_BASE}/agents/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          return `Moltbook registration failed (${resp.status}): ${text.slice(0, 300)}`;
        }

        const data = await resp.json();
        const api_key = data?.agent?.api_key;
        const claim_url = data?.agent?.claim_url;
        const verification_code = data?.agent?.verification_code;

        if (!api_key) {
          return `Registration succeeded but no API key in response: ${JSON.stringify(data).slice(0, 300)}`;
        }

        // Save credentials locally
        saveCredentials(api_key, name);

        return `Moltbook registration successful!\n` +
          `Agent name: ${name}\n` +
          `API Key: ${api_key}\n` +
          `Claim URL: ${claim_url || "N/A"}\n` +
          `Verification Code: ${verification_code || "N/A"}\n\n` +
          `INSTRUCTIONS FOR HUMAN OWNER:\n` +
          `1. Visit ${claim_url} to claim this agent\n` +
          `2. Verify email, then post verification tweet\n` +
          `3. API key saved to ${CREDENTIALS_PATH()}\n\n` +
          `Once claimed, the agent can post, comment, and interact on Moltbook.`;
      } catch (err: any) {
        return `Moltbook registration error: ${err.message}`;
      }
    },
  },

  {
    name: "moltbook_status",
    description:
      "Check Moltbook account status: agent profile, claim status, karma, post count. Requires a saved API key in ~/.config/moltbook/credentials.json or MOLTBOOK_API_KEY env var.",
    category: "financial",
    riskLevel: "safe",
    parameters: { type: "object", properties: {} },
    execute: async (_args: Record<string, unknown>, ctx: ToolContext) => {
      const creds = getCredentials();
      if (!creds?.api_key) {
        return "No Moltbook API key found. Register first with moltbook_register, or set MOLTBOOK_API_KEY env var.";
      }

      try {
        // Check claim status
        const statusResp = await moltbookFetch("/agents/status", creds.api_key);
        const status = statusResp?.status || "unknown";

        // Get agent profile
        const meResp = await moltbookFetch("/agents/me", creds.api_key);
        const agent = meResp?.agent;

        return `=== MOLTBLOG STATUS ===\n` +
          `Agent: ${agent?.name || creds.agent_name || "unknown"}\n` +
          `Status: ${status}\n` +
          `Karma: ${agent?.karma ?? "N/A"}\n` +
          `Posts: ${agent?.stats?.posts ?? "N/A"}\n` +
          `Comments: ${agent?.stats?.comments ?? "N/A"}\n` +
          `Followers: ${agent?.follower_count ?? "N/A"}\n` +
          `Claimed: ${agent?.is_claimed ?? status === "claimed" ? "Yes" : "No"}\n` +
          `API Key: ${creds.api_key.slice(0, 8)}... (saved)`;
      } catch (err: any) {
        return `Moltbook status check failed: ${err.message}`;
      }
    },
  },

  {
    name: "moltbook_post",
    description:
      "Create a post on Moltbook. Posts go into submolts (communities). Requires a saved API key.",
    category: "financial",
    riskLevel: "safe",
    parameters: {
      type: "object",
      properties: {
        submolt_name: { type: "string", description: "Submolt/community to post in (e.g. 'general', 'ai-agents', 'coding')" },
        title: { type: "string", description: "Post title" },
        content: { type: "string", description: "Post content (markdown supported)" },
        api_key: { type: "string", description: "Optional API key override (usually read from saved credentials)" },
      },
      required: ["submolt_name", "title", "content"],
    },
    execute: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const submolt = args.submolt_name as string;
      const title = args.title as string;
      const content = args.content as string;
      const api_key = (args.api_key as string) || getCredentials()?.api_key;

      if (!api_key) {
        return "No Moltbook API key. Register first or set MOLTBOOK_API_KEY.";
      }

      try {
        const resp = await moltbookFetch("/posts", api_key, "POST", {
          submolt_name: submolt,
          title,
          content,
        });

        const post = resp?.post;
        return `Moltbook post created!\n` +
          `Title: ${title}\n` +
          `Submolt: ${submolt}\n` +
          `Post ID: ${post?.id || "unknown"}\n` +
          `URL: ${post?.url || `https://www.moltbook.com/p/${post?.id}`}\n` +
          `Karma: ${post?.karma ?? "0"}\n` +
          `Created: ${post?.created_at || new Date().toISOString()}`;
      } catch (err: any) {
        return `Moltbook post failed: ${err.message}`;
      }
    },
  },

  {
    name: "moltbook_comment",
    description:
      "Comment on a Moltbook post. Requires post_id and a saved API key.",
    category: "financial",
    riskLevel: "safe",
    parameters: {
      type: "object",
      properties: {
        post_id: { type: "string", description: "ID of the post to comment on" },
        content: { type: "string", description: "Comment content" },
        api_key: { type: "string", description: "Optional API key override" },
      },
      required: ["post_id", "content"],
    },
    execute: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const post_id = args.post_id as string;
      const content = args.content as string;
      const api_key = (args.api_key as string) || getCredentials()?.api_key;

      if (!api_key) {
        return "No Moltbook API key. Register first or set MOLTBOOK_API_KEY.";
      }

      try {
        const resp = await moltbookFetch(`/posts/${post_id}/comments`, api_key, "POST", {
          content,
        });

        const comment = resp?.comment;
        return `Comment added!\n` +
          `Post ID: ${post_id}\n` +
          `Comment ID: ${comment?.id || "unknown"}\n` +
          `Content: ${content.slice(0, 100)}${content.length > 100 ? "..." : ""}\n` +
          `Upvotes: ${comment?.upvotes ?? 0}`;
      } catch (err: any) {
        return `Moltbook comment failed: ${err.message}`;
      }
    },
  },

  {
    name: "moltbook_feed",
    description:
      "Fetch the Moltbook feed: recent posts from followed submolts. Returns post titles, authors, karma, and URLs. Good for finding discussions to engage with.",
    category: "financial",
    riskLevel: "safe",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max posts to return (default: 10)" },
        submolt_name: { type: "string", description: "Optional specific submolt to fetch" },
        api_key: { type: "string", description: "Optional API key override" },
      },
      required: [],
    },
    execute: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const limit = (args.limit as number) || 10;
      const api_key = (args.api_key as string) || getCredentials()?.api_key;
      const submolt = args.submolt_name as string | undefined;

      if (!api_key) {
        return "No Moltbook API key. Register first or set MOLTBOOK_API_KEY. You can still browse moltbook.com via browser_navigate.";
      }

      try {
        const endpoint = submolt
          ? `/submolts/${submolt}/feed?limit=${limit}`
          : `/feed?limit=${limit}`;

        const resp = await moltbookFetch(endpoint, api_key);
        const posts = resp?.posts || [];

        if (posts.length === 0) {
          return `Moltbook feed is empty (no recent posts in ${submolt || "your feed"}).`;
        }

        return `=== MOLTBLOG FEED (${posts.length} posts) ===\n\n` +
          posts.map((p: any, i: number) =>
            `${i + 1}. [${p.submolt_name || "general"}] ${p.title}\n` +
            `   By: ${p.agent?.name || "unknown"}\n` +
            `   Karma: ${p.karma ?? 0} | Comments: ${p.comment_count ?? 0}\n` +
            `   ${p.url || `https://www.moltbook.com/p/${p.id}`}\n`
          ).join("\n");
      } catch (err: any) {
        return `Moltbook feed fetch failed: ${err.message}. You can browse via browser_navigate("https://www.moltbook.com").`;
      }
    },
  },

  {
    name: "moltbook_upvote",
    description:
      "Upvote a Moltbook post or comment. Requires target ID (post_id or comment_id) and a saved API key.",
    category: "financial",
    riskLevel: "safe",
    parameters: {
      type: "object",
      properties: {
        target_id: { type: "string", description: "Post ID or comment ID to upvote" },
        target_type: { type: "string", description: "Type: 'post' (default) or 'comment'" },
        api_key: { type: "string", description: "Optional API key override" },
      },
      required: ["target_id"],
    },
    execute: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const target_id = args.target_id as string;
      const target_type = (args.target_type as string) || "post";
      const api_key = (args.api_key as string) || getCredentials()?.api_key;

      if (!api_key) {
        return "No Moltbook API key.";
      }

      try {
        const endpoint = target_type === "comment"
          ? `/comments/${target_id}/upvote`
          : `/posts/${target_id}/upvote`;

        await moltbookFetch(endpoint, api_key, "POST");
        return `Upvoted ${target_type} ${target_id} on Moltbook.`;
      } catch (err: any) {
        return `Moltbook upvote failed: ${err.message}`;
      }
    },
  },

  {
    name: "moltbook_heartbeat",
    description:
      "Run the Moltbook heartbeat routine: check feed for new posts, report what's happening. Follows the Moltbook HEARTBEAT.md pattern. Does NOT post — just checks in.",
    category: "survival",
    riskLevel: "safe",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max feed posts to check (default: 5)" },
      },
    },
    execute: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const limit = (args.limit as number) || 5;
      const creds = getCredentials();
      const api_key = creds?.api_key;

      const parts: string[] = [];
      parts.push(`=== MOLTBLOG HEARTBEAT ===\n` +
        `Last check: running Moltbook engagement routine\n` +
        `API Key: ${api_key ? "present" : "MISSING — register with moltbook_register first"}\n`);

      if (!api_key) {
        parts.push("\nACTION NEEDED: Register on Moltbook first.");
        return parts.join("\n");
      }

      try {
        // Fetch feed
        const resp = await moltbookFetch(`/feed?limit=${limit}`, api_key);
        const posts = resp?.posts || [];

        if (posts.length > 0) {
          parts.push(`\nRecent posts (${posts.length}):\n` +
            posts.map((p: any, i: number) =>
              `${i + 1}. ${p.title} (by ${p.agent?.name || "unknown"}, karma: ${p.karma ?? 0})\n`
            ).join("") +
            "\nConsider engaging: read full posts, comment, or upvote.");
        } else {
          parts.push("\nFeed is quiet. No new posts right now.");
        }

        // Check own status
        const statusResp = await moltbookFetch("/agents/status", api_key);
        const status = statusResp?.status;
        if (status !== "claimed") {
          parts.push(`\n⚠️ Claim status: ${status} — human owner needs to claim this agent.`);
        }

        return parts.join("\n");
      } catch (err: any) {
        return `Moltbook heartbeat failed: ${err.message}. Try browser_navigate("https://www.moltbook.com") instead.`;
      }
    },
  },
];
