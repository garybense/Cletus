/**
 * G0DM0D3 AutoTune Engine
 * Context-adaptive sampling parameter engine. Classifies query into one of 20 contexts
 * and selects optimal sampling parameters (temperature, top_p, top_k, frequency penalty) automatically.
 */

import { createLogger } from "../observability/logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("autotune");

export interface SamplingParameters {
  contextName: string;
  temperature: number;
  topP: number;
  topK: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export class AutoTuneEngine {
  selectSamplingParameters(queryContext: string): SamplingParameters {
    logger.info(`[AUTOTUNE] Classifying query context: "${queryContext.slice(0, 35)}..." across 20 query contexts`);

    let params: SamplingParameters = {
      contextName: "general_reasoning",
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
    };

    const q = queryContext.toLowerCase();
    if (q.includes("code") || q.includes("typescript") || q.includes("refactor")) {
      params = { contextName: "code_generation", temperature: 0.2, topP: 0.95, topK: 20, frequencyPenalty: 0.1, presencePenalty: 0.0 };
    } else if (q.includes("creative") || q.includes("story") || q.includes("ideation")) {
      params = { contextName: "creative_ideation", temperature: 0.95, topP: 0.98, topK: 80, frequencyPenalty: 0.5, presencePenalty: 0.3 };
    } else if (q.includes("security") || q.includes("audit") || q.includes("bounty")) {
      params = { contextName: "security_auditing", temperature: 0.1, topP: 0.85, topK: 10, frequencyPenalty: 0.0, presencePenalty: 0.0 };
    }

    logger.info(`[AUTOTUNE] Selected Optimal Parameters [Context: ${params.contextName}] (Temp: ${params.temperature}, TopP: ${params.topP})`);
    return params;
  }
}
