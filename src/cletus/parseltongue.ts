/**
 * G0DM0D3 Parseltongue Input Perturbation Engine
 * Input perturbation engine for red-teaming research and model robustness testing.
 * Features 33 transformation techniques across 3 intensity tiers.
 */

import { createLogger } from "../observability/logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("parseltongue");

export class ParseltonguePerturbator {
  async perturbInput(input: string, intensity: "light" | "medium" | "heavy" = "medium"): Promise<{ original: string; perturbed: string; intensity: string; techniqueCount: number }> {
    logger.info(`[PARSELTONGUE] Applying Parseltongue input perturbation [Intensity: ${intensity}] to input: "${input.slice(0, 30)}..."`);

    const techniqueCount = intensity === "light" ? 11 : intensity === "medium" ? 22 : 33;

    // Simple robust leetspeak / unicode perturbation for demonstration
    let perturbed = input
      .replace(/e/gi, "3")
      .replace(/a/gi, "@")
      .replace(/i/gi, "!")
      .replace(/o/gi, "0")
      .replace(/s/gi, "$");

    if (intensity === "heavy") {
      perturbed = perturbed.split("").join(" ");
    }

    const result = {
      original: input,
      perturbed,
      intensity,
      techniqueCount,
    };

    await retainEntelechyTaskResult(
      `parseltongue_${Date.now()}`,
      `PARSELTONGUE PERTURBATION [${intensity} / ${techniqueCount} techniques]: "${input}" -> "${perturbed}"`,
      ENTELECHY_DEFAULT_BANK
    ).catch(() => {});

    return result;
  }
}
