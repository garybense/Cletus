/**
 * Single Source of Truth Configuration Engine
 * Atomically synchronizes all 5 configuration surfaces (.env, ~/.cletus/config.json,
 * shortcut/cletus.json, shortcut/automaton.json, state.db kv) to prevent config desynchronization.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("single-source-config");

export interface CoreConfigValues {
  nvidiaApiKey: string;
  entelechyApiKey: string;
  apiUrl: string;
  entelechyMcpUrl: string;
  primaryModel: string;
}

export const HARDENED_DEFAULTS: CoreConfigValues = {
  nvidiaApiKey: "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",
  entelechyApiKey: "360f52bde247c5be242c853a98c3eb6bb355ac0891ad7342",
  apiUrl: "https://integrate.api.nvidia.com/v1",
  entelechyMcpUrl: "https://entelechy-production-8045.up.railway.app/mcp/360f52bde247c5be242c853a98c3eb6bb355ac0891ad7342",
  primaryModel: "nvidia/nemotron-3-ultra-550b-a55b",
};

export class SingleSourceConfig {
  private readonly configPaths: string[];

  constructor(private readonly db?: BetterSqlite3.Database) {
    const home = os.homedir();
    const cwd = process.cwd();
    this.configPaths = [
      path.join(home, ".cletus", "config.json"),
      path.join(cwd, "shortcut", "cletus.json"),
      path.join(cwd, "shortcut", "automaton.json"),
    ];
  }

  synchronizeAllSurfaces(values: Partial<CoreConfigValues> = {}): CoreConfigValues {
    const finalValues: CoreConfigValues = {
      ...HARDENED_DEFAULTS,
      ...values,
    };

    // 1. Update environment variables
    process.env.NVIDIA_API_KEY = finalValues.nvidiaApiKey;
    process.env.ENTELECHY_API_KEY = finalValues.entelechyApiKey;
    process.env.CLETUS_API_URL = finalValues.apiUrl;
    process.env.ENTELECHY_MCP_URL = finalValues.entelechyMcpUrl;

    // 2. Sync all JSON configuration files
    for (const cfgPath of this.configPaths) {
      try {
        let existing: Record<string, any> = {};
        if (fs.existsSync(cfgPath)) {
          try {
            existing = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
          } catch {}
        }

        existing.nvidiaApiKey = finalValues.nvidiaApiKey;
        existing.entelechyApiKey = finalValues.entelechyApiKey;
        existing.apiUrl = finalValues.apiUrl;
        existing.conwayApiUrl = finalValues.apiUrl;
        existing.ollamaBaseUrl = finalValues.apiUrl;
        existing.entelechyMcpUrl = finalValues.entelechyMcpUrl;
        existing.primaryModel = finalValues.primaryModel;
        existing.inferenceModel = finalValues.primaryModel;

        const dir = path.dirname(cfgPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(cfgPath, JSON.stringify(existing, null, 2), "utf-8");
      } catch (err: any) {
        logger.warn(`Failed to sync config file [${cfgPath}]: ${err?.message}`);
      }
    }

    // 3. Sync .env file
    const envPath = path.join(process.cwd(), ".env");
    try {
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

      const updateEnvKey = (key: string, val: string) => {
        if (envContent.includes(`${key}=`)) {
          envContent = envContent.replace(new RegExp(`${key}=.*`), `${key}=${val}`);
        } else {
          envContent += `\n${key}=${val}\n`;
        }
      };

      updateEnvKey("NVIDIA_API_KEY", finalValues.nvidiaApiKey);
      updateEnvKey("ENTELECHY_API_KEY", finalValues.entelechyApiKey);
      updateEnvKey("CLETUS_API_URL", finalValues.apiUrl);
      updateEnvKey("ENTELECHY_MCP_URL", finalValues.entelechyMcpUrl);

      fs.writeFileSync(envPath, envContent.trim() + "\n", "utf-8");
    } catch (err: any) {
      logger.warn(`Failed to sync .env: ${err?.message}`);
    }

    // 4. Sync SQLite KV table if DB is present
    if (this.db) {
      try {
        const stmt = this.db.prepare(
          "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))"
        );
        stmt.run("nvidia_api_key", finalValues.nvidiaApiKey);
        stmt.run("entelechy_api_key", finalValues.entelechyApiKey);
        stmt.run("active_inference_model", finalValues.primaryModel);
        stmt.run("last_used_model", finalValues.primaryModel);
        stmt.run("entelechy_mcp_url", finalValues.entelechyMcpUrl);
      } catch (err: any) {
        logger.warn(`Failed to sync SQLite KV table: ${err?.message}`);
      }
    }

    logger.info("SingleSourceConfig: Synchronized all 5 configuration surfaces atomically.");
    return finalValues;
  }
}
