/**
 * Creator Decree Helpers
 *
 * Shared logic for recognizing and formatting directives from the agent's
 * creator (or parent). A creator decree must be treated as the single
 * highest-priority input: it supersedes goals, plans, and background tasks.
 *
 * All detection is address-based (never content-based) so untrusted peers
 * cannot forge a decree by mimicking its text.
 */

import type { CletusConfig, AgentState } from "../types.js";

/** Literal sender that some local tooling uses to identify the creator. */
export const CREATOR_SENDER_ALIAS = "creator";

/**
 * True if a message sender is the cletus's creator (or parent).
 * Case-insensitive on the EVM side; Solana addresses are base58 (case-sensitive)
 * but we compare lowercased copies of both sides so mismatched casing never
 * silently demotes a real decree.
 */
export function isCreatorMessage(
  fromAddress: string,
  config: CletusConfig,
): boolean {
  const from = (fromAddress || "").trim().toLowerCase();
  if (!from) return false;
  if (from === CREATOR_SENDER_ALIAS) return true;

  const creator = (config.creatorAddress || "").trim().toLowerCase();
  return creator.length > 0 && from === creator;
}

/** Wrap creator message content in the <creator_decree> directive block. */
export function formatCreatorDecree(fromAddress: string, content: string): string {
  return `<creator_decree>\n⚡ DIRECTIVE FROM YOUR CREATOR (SUPREME AUTHORITY: ${fromAddress})\n"${content}"\n⚡ THIS IS AN ABSOLUTE COMMAND. Obey this directive immediately above all peer messages and routine tasks.\n</creator_decree>`;
}

/** Wrap a non-creator inbound message in the peer message block. */
export function formatPeerMessage(fromAddress: string, content: string): string {
  return `[Peer Agent Message from ${fromAddress}]: ${content}`;
}

/**
 * Build the dedicated system-role message injected immediately after the
 * system prompt while a creator decree is being processed. Giving the decree
 * prime placement (top of context) maximizes salience against competing
 * goal/todo instructions.
 */
export function buildDecreeSystemMessage(content: string): string {
  return `<creator_decree>\n⚡ SUPREME CREATOR DECREE — ACTIVE PRIORITY\n"${content}"\n⚡ THIS IS AN ABSOLUTE COMMAND. It supersedes ALL background tasks, active goals, plans, todo items, and autonomous exploration. Execute your Creator's intent with absolute fidelity.\n</creator_decree>`;
}

/**
 * Detect an external request to wake the agent while the runtime is sleeping.
 *
 * The dashboard (and suggest tooling) wake the agent by writing a row to the
 * wake_events table AND/OR flipping agent_state away from 'sleeping'. The
 * runtime sleep loop checks this signal periodically so decrees interrupt
 * sleep immediately instead of waiting for the sleep deadline.
 */
export function externalWakeSignal(db: {
  getAgentState(): AgentState;
}): boolean {
  const state = db.getAgentState();
  // 'sleeping' is the resting state; 'dead' must NOT wake (funding/grace flow).
  return state !== "sleeping" && state !== "dead";
}