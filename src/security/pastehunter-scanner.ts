/**
 * PasteHunter-Inspired Secret & API Key Leakage Scanner
 *
 * Scans code snippets and file contents for exposed API keys, private keys,
 * and sensitive credentials using YARA-inspired regex signatures.
 */

import { createLogger } from "../observability/logger.js";

const logger = createLogger("security.pastehunter-scanner");

const SECRET_PATTERNS = [
  { name: "OpenAI API Key", regex: /sk-[a-zA-Z0-9]{20,}/ },
  { name: "NVIDIA API Key", regex: /nvapi-[a-zA-Z0-9_\-]{20,}/ },
  { name: "Anthropic API Key", regex: /sk-ant-[a-zA-Z0-9_\-]{20,}/ },
  { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "Private Key Header", regex: /-----BEGIN (RSA|PRIVATE) KEY-----/ },
  { name: "Telegram Bot Token", regex: /\d{9}:[A-Za-z0-9_-]{35}/ },
];

export interface SecretScanResult {
  clean: boolean;
  leaks: Array<{ name: string; match: string }>;
}

export class PasteHunterScanner {
  /**
   * Scan text content for exposed API keys or secrets.
   */
  static scan(content: string): SecretScanResult {
    const leaks: Array<{ name: string; match: string }> = [];

    for (const pattern of SECRET_PATTERNS) {
      const match = content.match(pattern.regex);
      if (match) {
        leaks.push({ name: pattern.name, match: match[0].slice(0, 8) + "..." });
        logger.warn(`PasteHunter Security Alert: Exposed secret detected (${pattern.name})`);
      }
    }

    return { clean: leaks.length === 0, leaks };
  }
}
