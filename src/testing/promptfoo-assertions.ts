/**
 * Promptfoo-Inspired LLM Output Assertion Engine
 *
 * Provides automated evaluation assertions (exact match, contains, regex, json-schema, length)
 * for testing and verifying model outputs across Cletus and the Legion Swarm.
 */

import { createLogger } from "../observability/logger.js";

const logger = createLogger("testing.promptfoo-assertions");

export type AssertionType = "equals" | "contains" | "regex" | "not-contains" | "json" | "length-max";

export interface AssertionRule {
  type: AssertionType;
  value: string | number | RegExp;
  weight?: number;
}

export interface AssertionResult {
  passed: boolean;
  score: number;
  reason: string;
}

export class PromptfooAssertionEngine {
  /**
   * Evaluate an LLM output against a set of assertion rules.
   */
  static evaluate(output: string, rules: AssertionRule[]): { success: boolean; score: number; results: AssertionResult[] } {
    const results: AssertionResult[] = [];
    let totalScore = 0;
    let maxScore = 0;

    for (const rule of rules) {
      const weight = rule.weight || 1;
      maxScore += weight;
      const res = this.runRule(output, rule);
      results.push(res);
      if (res.passed) {
        totalScore += weight * res.score;
      }
    }

    const finalScore = maxScore > 0 ? totalScore / maxScore : 1.0;
    const success = results.every((r) => r.passed);

    logger.debug(`Promptfoo Evaluation: success=${success}, score=${finalScore.toFixed(2)} (${results.length} assertions)`);
    return { success, score: finalScore, results };
  }

  private static runRule(output: string, rule: AssertionRule): AssertionResult {
    switch (rule.type) {
      case "equals": {
        const passed = output.trim() === String(rule.value).trim();
        return { passed, score: passed ? 1.0 : 0.0, reason: passed ? "Exact match" : `Expected "${rule.value}", got "${output}"` };
      }
      case "contains": {
        const val = String(rule.value);
        const passed = output.includes(val);
        return { passed, score: passed ? 1.0 : 0.0, reason: passed ? `Contains "${val}"` : `Output does not contain "${val}"` };
      }
      case "not-contains": {
        const val = String(rule.value);
        const passed = !output.includes(val);
        return { passed, score: passed ? 1.0 : 0.0, reason: passed ? `Does not contain "${val}"` : `Output incorrectly contains "${val}"` };
      }
      case "regex": {
        const regex = rule.value instanceof RegExp ? rule.value : new RegExp(String(rule.value));
        const passed = regex.test(output);
        return { passed, score: passed ? 1.0 : 0.0, reason: passed ? "Regex matched" : `Output failed regex test: ${regex}` };
      }
      case "json": {
        try {
          JSON.parse(output);
          return { passed: true, score: 1.0, reason: "Valid JSON" };
        } catch (e: any) {
          return { passed: false, score: 0.0, reason: `Invalid JSON: ${e.message}` };
        }
      }
      case "length-max": {
        const maxLen = Number(rule.value);
        const passed = output.length <= maxLen;
        return { passed, score: passed ? 1.0 : 0.0, reason: passed ? `Length within max (${output.length}/${maxLen})` : `Output length ${output.length} exceeds max ${maxLen}` };
      }
      default:
        return { passed: false, score: 0.0, reason: `Unknown assertion type: ${(rule as any).type}` };
    }
  }
}
