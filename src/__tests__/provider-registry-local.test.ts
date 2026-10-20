import { describe, it, expect } from "vitest";
import { validateProviderSetup, ProviderConfig, ModelTier } from "../inference/provider-registry.js";

describe("Local-First Provider Registry", () => {
  it("does not report missing cloud provider warnings when running in local/standalone mode", () => {
    const localProviders: ProviderConfig[] = [
      {
        id: "local",
        name: "Local Ollama",
        baseUrl: "http://localhost:11434/v1",
        apiKeyEnvVar: "OLLAMA_API_KEY",
        models: [],
        maxRequestsPerMinute: 120,
        maxTokensPerMinute: 100000,
        priority: 1,
        enabled: true,
      },
    ];

    const tierDefaults: Record<ModelTier, any> = {
      reasoning: { preferredProvider: "local", fallbackOrder: ["local"] },
      fast: { preferredProvider: "local", fallbackOrder: ["local"] },
      cheap: { preferredProvider: "local", fallbackOrder: ["local"] },
    };

    const issues = validateProviderSetup(localProviders, tierDefaults, false);
    expect(issues.filter((i) => i.includes("unknown provider"))).toHaveLength(0);
  });
});
