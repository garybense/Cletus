/**
 * Cletus SIWE Provisioning
 *
 * Uses the cletus's wallet to authenticate via Sign-In With Ethereum (SIWE)
 * and create an API key for Mindmods API access.
 * Adapted from mindmods-mcp/src/cli/provision.ts
 */

import fs from "fs";
import path from "path";
import { SiweMessage } from "siwe";
import { getWallet, getCletusDir } from "./wallet.js";
import type { ProvisionResult } from "../types.js";
import { ResilientHttpClient } from "../mindmods/http-client.js";
import type { ChainIdentity } from "./chain.js";
import { buildSiwsMessage, signSiwsMessage } from "./siws.js";

const httpClient = new ResilientHttpClient();

const DEFAULT_API_URL = "https://api.mindmods.tech";

/**
 * Load API key from ~/.cletus/config.json if it exists.
 */
export function loadApiKeyFromConfig(): string | null {
  const configPath = path.join(getCletusDir(), "config.json");
  if (!fs.existsSync(configPath)) return null;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return config.apiKey || null;
  } catch {
    return null;
  }
}

/**
 * Save API key and wallet address to ~/.cletus/config.json
 */
function saveConfig(apiKey: string, walletAddress: string): void {
  const dir = getCletusDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const configPath = path.join(dir, "config.json");
  const config = {
    apiKey,
    walletAddress,
    provisionedAt: new Date().toISOString(),
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

/**
 * Run the full SIWE provisioning flow:
 * 1. Load wallet
 * 2. Get nonce from Mindmods API
 * 3. Sign SIWE message
 * 4. Verify signature -> get JWT
 * 5. Create API key
 * 6. Save to config.json
 */
export async function provision(
  apiUrl?: string,
  solanaIdentity?: ChainIdentity,
): Promise<ProvisionResult> {
  const url = apiUrl || process.env.MINDMODS_API_URL || DEFAULT_API_URL;

  // 1. Load wallet
  const { account, chainIdentity, chainType } = await getWallet();
  const identity = solanaIdentity || chainIdentity;
  const address = identity.address;
  const isSolana = identity.chainType === "solana";

  // 2. Get nonce
  const nonceResp = await httpClient.request(`${url}/v1/auth/nonce`, {
    method: "POST",
  });
  if (!nonceResp.ok) {
    throw new Error(
      `Failed to get nonce: ${nonceResp.status} ${await nonceResp.text()}`,
    );
  }
  const { nonce } = (await nonceResp.json()) as { nonce: string };

  let messageString: string;
  let signature: string;

  if (isSolana) {
    // 3a. SIWS path: Sign-In With Solana
    const siwsMsg = buildSiwsMessage({
      domain: "mindmods.tech",
      address,
      statement: "Sign in to Mindmods as an Cletus to provision an API key.",
      uri: `${url}/v1/auth/verify`,
      nonce,
      issuedAt: new Date().toISOString(),
      chainId: "mainnet",
    });
    messageString = siwsMsg;
    signature = await signSiwsMessage(siwsMsg, identity);
  } else {
    // 3b. SIWE path: Sign-In With Ethereum (unchanged)
    const siweMessage = new SiweMessage({
      domain: "mindmods.tech",
      address,
      statement:
        "Sign in to Mindmods as an Cletus to provision an API key.",
      uri: `${url}/v1/auth/verify`,
      version: "1",
      chainId: 8453, // Base
      nonce,
      issuedAt: new Date().toISOString(),
    });
    messageString = siweMessage.prepareMessage();
    signature = await account.signMessage({ message: messageString });
  }

  // 4. Verify signature -> get JWT
  const verifyBody: Record<string, string> = { message: messageString, signature };
  if (isSolana) {
    verifyBody.chain_type = "solana";
  }

  const verifyResp = await httpClient.request(`${url}/v1/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(verifyBody),
  });

  if (!verifyResp.ok) {
    const protocol = isSolana ? "SIWS" : "SIWE";
    throw new Error(
      `${protocol} verification failed: ${verifyResp.status} ${await verifyResp.text()}`,
    );
  }

  const { access_token } = (await verifyResp.json()) as {
    access_token: string;
  };

  // 5. Create API key
  const keyResp = await httpClient.request(`${url}/v1/auth/api-keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({ name: "mindmods-cletus" }),
  });

  if (!keyResp.ok) {
    throw new Error(
      `Failed to create API key: ${keyResp.status} ${await keyResp.text()}`,
    );
  }

  const { key, key_prefix } = (await keyResp.json()) as {
    key: string;
    key_prefix: string;
  };

  // 6. Save to config
  saveConfig(key, address);

  return { apiKey: key, walletAddress: address, keyPrefix: key_prefix };
}

/**
 * Register the cletus's creator as its parent with Mindmods.
 * This allows the creator to see cletus logs and inference calls.
 */
export async function registerParent(
  creatorAddress: string,
  apiUrl?: string,
): Promise<void> {
  const url = apiUrl || process.env.MINDMODS_API_URL || DEFAULT_API_URL;
  const apiKey = loadApiKeyFromConfig();
  if (!apiKey) {
    throw new Error("Must provision API key before registering parent");
  }

  const resp = await httpClient.request(`${url}/v1/cletus/register-parent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ creatorAddress }),
  });

  // Endpoint may not exist yet -- fail gracefully
  if (!resp.ok && resp.status !== 404) {
    throw new Error(
      `Failed to register parent: ${resp.status} ${await resp.text()}`,
    );
  }
}
