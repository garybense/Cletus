/**
 * LLMFit-Inspired Hardware VRAM & Throughput Estimation Engine
 *
 * Implements hardware sizing formulas, quantization memory estimation (Q8_0 to Q2_K),
 * MoE active parameter scaling, and memory-bandwidth bound throughput calculations
 * inspired by LLMFit (llmfit-core).
 */

import { createLogger } from "../observability/logger.js";

const logger = createLogger("inference.llmfit-estimator");

export type QuantType = "Q8_0" | "Q6_K" | "Q5_K_M" | "Q4_K_M" | "Q3_K_M" | "Q2_K";

/** Bytes per parameter for quantization levels */
const QUANT_BYTES_PER_PARAM: Record<QuantType, number> = {
  Q8_0: 1.0,
  Q6_K: 0.75,
  Q5_K_M: 0.65,
  Q4_K_M: 0.55,
  Q3_K_M: 0.45,
  Q2_K: 0.35,
};

export interface ModelFitnessReport {
  modelId: string;
  totalParamsB: number;
  activeParamsB: number;
  quant: QuantType;
  vramRequiredGb: number;
  ramRequiredGb: number;
  estimatedTokPerSec: number;
  fitVerdict: "Perfect" | "Good" | "Marginal" | "TooTight";
}

export class LLMFitEstimator {
  /**
   * Estimate VRAM requirement, memory footprint, and expected decode throughput (tok/sec).
   */
  static estimateFitness(
    modelId: string,
    paramsB: number,
    activeParamsB: number = paramsB,
    vramAvailableGb: number = 24.0,
    gpuBandwidthGbps: number = 1008.0, // e.g. RTX 4090 / H100 default
    quant: QuantType = "Q4_K_M"
  ): ModelFitnessReport {
    const bytesPerParam = QUANT_BYTES_PER_PARAM[quant] || 0.55;

    // VRAM calculation: active_params * bytes_per_param * 1.15 (KV cache & activation overhead)
    const rawVramGb = (paramsB * bytesPerParam * 1.15);
    const activeVramGb = (activeParamsB * bytesPerParam * 1.15);
    const vramRequiredGb = Number(rawVramGb.toFixed(2));

    // System RAM requirement (CPU fallback path): params * bytes_per_param * 1.25 overhead
    const ramRequiredGb = Number((paramsB * bytesPerParam * 1.25).toFixed(2));

    // Throughput estimation (memory bandwidth bound): (bandwidth_GB_s / active_vram_GB) * efficiency (0.55)
    const efficiency = 0.55;
    const estimatedTokPerSec = activeVramGb > 0 ? Number(((gpuBandwidthGbps / activeVramGb) * efficiency).toFixed(1)) : 0;

    // Fit verdict based on utilization
    const utilization = vramRequiredGb / vramAvailableGb;
    let fitVerdict: "Perfect" | "Good" | "Marginal" | "TooTight" = "Perfect";
    if (utilization > 0.98) {
      fitVerdict = "TooTight";
    } else if (utilization > 0.85) {
      fitVerdict = "Marginal";
    } else if (utilization > 0.60) {
      fitVerdict = "Good";
    }

    logger.debug(`LLMFit Estimate for ${modelId} (${quant}): VRAM=${vramRequiredGb}GB, est=${estimatedTokPerSec} tok/s, verdict=${fitVerdict}`);

    return {
      modelId,
      totalParamsB: paramsB,
      activeParamsB,
      quant,
      vramRequiredGb,
      ramRequiredGb,
      estimatedTokPerSec,
      fitVerdict,
    };
  }

  /**
   * Parse active parameter count for MoE models (DeepSeek-R1 671B -> 37B active, Mixtral 8x7B -> 12.9B active).
   */
  static parseActiveParams(modelId: string): { totalB: number; activeB: number } {
    const lower = modelId.toLowerCase();
    if (lower.includes("671b") || lower.includes("r1")) return { totalB: 671, activeB: 37 };
    if (lower.includes("8x7b") || lower.includes("mixtral")) return { totalB: 46.7, activeB: 12.9 };
    if (lower.includes("70b") || lower.includes("72b")) return { totalB: 70, activeB: 70 };
    if (lower.includes("30b") || lower.includes("32b")) return { totalB: 30, activeB: 30 };
    if (lower.includes("14b") || lower.includes("13b")) return { totalB: 14, activeB: 14 };
    if (lower.includes("8b") || lower.includes("7b")) return { totalB: 8, activeB: 8 };
    if (lower.includes("1.5b") || lower.includes("1b")) return { totalB: 1.5, activeB: 1.5 };
    if (lower.includes("135m")) return { totalB: 0.135, activeB: 0.135 };
    return { totalB: 7, activeB: 7 };
  }
}
