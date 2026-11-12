/**
 * Full-Inventory Legion Swarm Engine
 *
 * Dynamically auto-discovers EVERY available model across our cluster
 * and instantiates a dedicated child agent for each model simultaneously.
 */

import type BetterSqlite3 from "better-sqlite3";
import { ModelRegistry } from "../inference/registry.js";
import { createLogger } from "../observability/logger.js";
import type { ModelEntry } from "../types.js";

const logger = createLogger("orchestration.legion-swarm");

export interface LegionSwarmAgent {
  id: string;
  modelId: string;
  provider: string;
  displayName: string;
  role: string;
}

export class LegionSwarmEngine {
  private registry: ModelRegistry;

  constructor(db: BetterSqlite3.Database) {
    this.registry = new ModelRegistry(db);
  }

  /**
   * Discover all functional models currently registered across the cluster
   * and build the full-inventory swarm agent roster.
   */
  discoverSwarmRoster(): LegionSwarmAgent[] {
    const availableModels = this.registry.getAvailable();
    logger.info(`Legion Swarm: auto-discovered ${availableModels.length} available models across cluster.`);

    return availableModels.map((model, idx) => ({
      id: `legion-agent-${idx + 1}-${model.modelId.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
      modelId: model.modelId,
      provider: model.provider,
      displayName: model.displayName,
      role: assignSwarmRole(model),
    }));
  }
}

/**
 * Assign specialized cognitive roles to each model based on capability heuristics.
 */
function assignSwarmRole(model: ModelEntry): string {
  const id = model.modelId.toLowerCase();
  if (id.includes("671b") || id.includes("r1") || id.includes("opus")) {
    return "supreme-commander";
  }
  if (id.includes("coder") || id.includes("codestral") || id.includes("code")) {
    return "lead-engineer";
  }
  if (id.includes("70b") || id.includes("72b") || id.includes("gemma2")) {
    return "adversarial-auditor";
  }
  if (id.includes("135m") || id.includes("0.5b") || id.includes("1.5b")) {
    return "rapid-triage";
  }
  return "scout-specialist";
}
