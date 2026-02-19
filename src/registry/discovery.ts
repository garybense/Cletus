/**
 * Agent Discovery
 *
 * Discover other agents via ERC-8004 registry queries.
 * Fetch and parse agent cards from URIs.
 */

import type {
  DiscoveredAgent,
  AgentCard,
} from "../types.js";
import { queryAgent, getTotalAgents } from "./erc8004.js";

type Network = "mainnet" | "testnet";

// Overall discovery timeout (60 seconds)
const DISCOVERY_TIMEOUT_MS = 60_000;
// Per-fetch timeout (5 seconds)
const FETCH_TIMEOUT_MS = 5_000;

// ─── SSRF Protection ────────────────────────────────────────────

/**
 * Check if a hostname resolves to an internal/private network.
 * Blocks: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12,
 *         192.168.0.0/16, 169.254.0.0/16, ::1, localhost, 0.0.0.0/8
 */
export function isInternalNetwork(hostname: string): boolean {
  const blocked = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^::1$/,
    /^localhost$/i,
    /^0\./,
  ];
  return blocked.some(pattern => pattern.test(hostname));
}

/**
 * Check if a URI is allowed for fetching.
 * Only https: and ipfs: schemes are permitted.
 * Internal network addresses are blocked (SSRF protection).
 */
export function isAllowedUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (!['https:', 'ipfs:'].includes(url.protocol)) return false;
    if (url.protocol === 'https:' && isInternalNetwork(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// ─── Agent Card Validation ──────────────────────────────────────

/**
 * Validate a fetched agent card JSON against required schema.
 */
export function validateAgentCard(data: unknown): AgentCard | null {
  if (!data || typeof data !== 'object') return null;
  const card = data as Record<string, unknown>;
  if (typeof card.name !== 'string' || card.name.length === 0) return null;
  if (typeof card.type !== 'string' || card.type.length === 0) return null;
  // address is optional but must be string if present
  if (card.address !== undefined && typeof card.address !== 'string') return null;
  // description is optional but must be string if present
  if (card.description !== undefined && typeof card.description !== 'string') return null;
  return card as unknown as AgentCard;
}

// ─── Discovery ──────────────────────────────────────────────────

/**
 * Discover agents by scanning the registry.
 * Returns a list of discovered agents with their metadata.
 */
export async function discoverAgents(
  limit: number = 20,
  network: Network = "mainnet",
): Promise<DiscoveredAgent[]> {
  const total = await getTotalAgents(network);
  const scanCount = Math.min(total, limit);
  const agents: DiscoveredAgent[] = [];

  const overallStart = Date.now();

  // Scan from most recent to oldest
  for (let i = total; i > total - scanCount && i > 0; i--) {
    // Overall discovery timeout
    if (Date.now() - overallStart > DISCOVERY_TIMEOUT_MS) {
      console.error('[discovery] Overall discovery timeout reached (60s), returning partial results');
      break;
    }

    const agent = await queryAgent(i.toString(), network);
    if (agent) {
      // Try to fetch the agent card for additional metadata
      try {
        const card = await fetchAgentCard(agent.agentURI);
        if (card) {
          agent.name = card.name;
          agent.description = card.description;
        }
      } catch (error) {
        console.error('[discovery] Card fetch failed:', error instanceof Error ? error.message : error);
      }
      agents.push(agent);
    }
  }

  return agents;
}

/**
 * Fetch an agent card from a URI.
 * Enforces SSRF protection and per-fetch timeout.
 */
export async function fetchAgentCard(
  uri: string,
): Promise<AgentCard | null> {
  // SSRF protection: validate URI before fetching
  if (!isAllowedUri(uri)) {
    console.error(`[discovery] Blocked URI (SSRF protection): ${uri}`);
    return null;
  }

  try {
    // Handle IPFS URIs
    let fetchUrl = uri;
    if (uri.startsWith("ipfs://")) {
      fetchUrl = `https://ipfs.io/ipfs/${uri.slice(7)}`;
    }

    // Per-fetch timeout (5 seconds)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(fetchUrl, {
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const data = await response.json();

      // Validate agent card JSON against schema
      return validateAgentCard(data);
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    console.error('[discovery] Agent card fetch failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Search for agents by name or description.
 * Scans recent registrations and filters by keyword.
 */
export async function searchAgents(
  keyword: string,
  limit: number = 10,
  network: Network = "mainnet",
): Promise<DiscoveredAgent[]> {
  const all = await discoverAgents(50, network);
  const lower = keyword.toLowerCase();

  return all
    .filter(
      (a) =>
        a.name?.toLowerCase().includes(lower) ||
        a.description?.toLowerCase().includes(lower) ||
        a.owner.toLowerCase().includes(lower),
    )
    .slice(0, limit);
}
