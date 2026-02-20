/**
 * Authority Policy Rules
 *
 * Controls what actions are allowed based on input authority level.
 * External/heartbeat-initiated turns cannot use dangerous tools
 * or modify protected files.
 */

import type {
  PolicyRule,
  PolicyRequest,
  PolicyRuleResult,
} from "../../types.js";

/** Files protected from external-source self-modification */
const PROTECTED_PATHS = [
  "constitution.md",
  "SOUL.md",
  "automaton.json",
  "heartbeat.yml",
  "wallet.json",
  "config.json",
  "policy-engine",
  "policy-rules",
  "injection-defense",
  "self-mod/code",
  "audit-log",
] as const;

function deny(
  rule: string,
  reasonCode: string,
  humanMessage: string,
): PolicyRuleResult {
  return { rule, action: "deny", reasonCode, humanMessage };
}

/**
 * Check if an input source represents external (non-agent) authority.
 */
function isExternalSource(inputSource: string | undefined): boolean {
  return inputSource === undefined || inputSource === "heartbeat";
}

/**
 * Deny dangerous tools when input comes from external sources.
 * Only agent-initiated or creator turns can use dangerous tools.
 */
function createExternalToolRestrictionRule(): PolicyRule {
  return {
    id: "authority.external_tool_restriction",
    description: "Deny dangerous tools from external/heartbeat input sources",
    priority: 400,
    appliesTo: { by: "risk", levels: ["dangerous"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      if (isExternalSource(request.turnContext.inputSource)) {
        return deny(
          "authority.external_tool_restriction",
          "EXTERNAL_DANGEROUS_TOOL",
          `External input (source: ${request.turnContext.inputSource ?? "undefined"}) cannot use dangerous tool "${request.tool.name}"`,
        );
      }
      return null;
    },
  };
}

/**
 * Deny self-modification from external sources targeting protected paths.
 */
function createSelfModFromExternalRule(): PolicyRule {
  return {
    id: "authority.self_mod_from_external",
    description: "Deny edit_own_file/write_file targeting protected paths from external input",
    priority: 400,
    appliesTo: { by: "name", names: ["edit_own_file", "write_file"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      if (!isExternalSource(request.turnContext.inputSource)) {
        return null;
      }

      const filePath = request.args.path as string | undefined;
      if (!filePath) return null;

      const normalizedPath = filePath.toLowerCase();
      for (const protectedPath of PROTECTED_PATHS) {
        if (
          normalizedPath.includes(protectedPath.toLowerCase())
        ) {
          return deny(
            "authority.self_mod_from_external",
            "EXTERNAL_SELF_MOD",
            `External input cannot modify protected path: "${filePath}" (matches "${protectedPath}")`,
          );
        }
      }

      return null;
    },
  };
}

/**
 * Create all authority policy rules.
 */
export function createAuthorityRules(): PolicyRule[] {
  return [
    createExternalToolRestrictionRule(),
    createSelfModFromExternalRule(),
  ];
}
