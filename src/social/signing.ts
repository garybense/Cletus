/**
 * Social Signing Module
 *
 * THE SINGLE canonical signing implementation for both runtime + CLI.
 * Supports both EVM (ECDSA secp256k1 via viem) and Solana (Ed25519 via tweetnacl).
 *
 * Phase 3.2: Social & Registry Hardening (S-P0-1)
 */

import {
  type PrivateKeyAccount,
  keccak256,
  toBytes,
} from "viem";
import type { SignedMessagePayload } from "../types.js";
import type { ChainIdentity } from "../identity/chain.js";

export const MESSAGE_LIMITS = {
  maxContentLength: 64_000, // 64KB
  maxTotalSize: 128_000, // 128KB
  replayWindowMs: 300_000, // 5 minutes
  maxOutboundPerHour: 100,
} as const;

/**
 * Sign a send message payload.
 *
 * Canonical format: Conway:send:{to_lowercase}:{keccak256(toBytes(content))}:{signed_at_iso}
 *
 * Accepts either a PrivateKeyAccount (EVM backward compat) or a ChainIdentity (both chains).
 */
export async function signSendPayload(
  signer: PrivateKeyAccount | ChainIdentity,
  to: string,
  content: string,
  replyTo?: string,
): Promise<SignedMessagePayload> {
  if (content.length > MESSAGE_LIMITS.maxContentLength) {
    throw new Error(
      `Message content too long: ${content.length} bytes (max ${MESSAGE_LIMITS.maxContentLength})`,
    );
  }

  const signedAt = new Date().toISOString();
  const contentHash = keccak256(toBytes(content));

  // Solana addresses are case-sensitive (base58); only lowercase EVM addresses
  // Solana addresses are case-sensitive (base58); only lowercase EVM addresses
  const isSolana = "signMessage" in signer && "chainType" in signer
    && (signer as ChainIdentity).chainType === "solana";
  const { detectChainType } = await import("../identity/chain.js");
  const recipientChainType = detectChainType(to);
  const normalizedTo = recipientChainType === "solana" ? to : to.toLowerCase();
  const canonical = `Conway:send:${normalizedTo}:${contentHash}:${signedAt}`;

  let signature: string;
  let fromAddress: string;

  if ("signMessage" in signer && "chainType" in signer) {
    // ChainIdentity path (both EVM and Solana)
    const identity = signer as ChainIdentity;
    signature = await identity.signMessage(canonical);
    fromAddress = identity.chainType === "solana" ? identity.address : identity.address.toLowerCase();
  } else {
    // PrivateKeyAccount path (EVM backward compat)
    const account = signer as PrivateKeyAccount;
    signature = await account.signMessage({ message: canonical });
    fromAddress = account.address.toLowerCase();
  }

  return {
    from: fromAddress,
    to: normalizedTo,
    content,
    signed_at: signedAt,
    signature,
    reply_to: replyTo,
  };
}

/**
 * Sign a poll payload.
 *
 * Canonical format: Conway:poll:{address_lowercase}:{timestamp_iso}
 *
 * Accepts either a PrivateKeyAccount (EVM backward compat) or a ChainIdentity (both chains).
 */
export async function signPollPayload(
  signer: PrivateKeyAccount | ChainIdentity,
): Promise<{ address: string; signature: string; timestamp: string }> {
  const timestamp = new Date().toISOString();

  let signature: string;
  let address: string;

  if ("signMessage" in signer && "chainType" in signer) {
    // ChainIdentity path
    const identity = signer as ChainIdentity;
    address = identity.chainType === "solana" ? identity.address : identity.address.toLowerCase();
    const canonical = `Conway:poll:${address}:${timestamp}`;
    signature = await identity.signMessage(canonical);
  } else {
    // PrivateKeyAccount path (EVM backward compat)
    const account = signer as PrivateKeyAccount;
    address = account.address.toLowerCase();
    const canonical = `Conway:poll:${address}:${timestamp}`;
    signature = await account.signMessage({ message: canonical });
  }

  return {
    address,
    signature,
    timestamp,
  };
}
