/**
 * Endpoint hardening tests
 *
 * Covers the failure mode that took Cletus down: a plain-HTTP remote inference
 * endpoint (1) slipping past the HTTPS guard, (2) being baked in as a code
 * default, and (3) bad provider config failing every candidate with the same
 * opaque error instead of one clear startup message.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { validateInferenceEndpoints } from "../config.js";
import { validateProviderSetup } from "../inference/provider-registry.js";
import type { ProviderConfig } from "../inference/provider-registry.js";
import { createInferenceClient } from "../mindmods/inference.js";

const baseConfig: any = {
  mindmodsApiUrl: "https://mindmods.org",
  allowInsecureRemoteHttp: false,
};

function provider(overrides: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: "p1",
    name: "P1",
    baseUrl: "https://example.com/v1",
    apiKeyEnvVar: "P1_KEY",
    models: [],
    maxRequestsPerMinute: 10,
    maxTokensPerMinute: 1000,
    priority: 1,
    enabled: true,
    ...overrides,
  } as ProviderConfig;
}

const tierDefaults: any = {
  reasoning: { preferredProvider: "p1", fallbackOrder: [] },
  fast: { preferredProvider: "p1", fallbackOrder: [] },
  cheap: { preferredProvider: "p1", fallbackOrder: [] },
};

afterEach(() => {
  delete process.env.CLETUS_ALLOW_INSECURE_REMOTE_HTTP;
  vi.restoreAllMocks();
});

describe("validateInferenceEndpoints", () => {
  it("keeps https endpoints", () => {
    const result = validateInferenceEndpoints({
      ...baseConfig,
      ollamaBaseUrl: "https://ollama.example.com:11434/v1",
    });
    expect(result.issues).toHaveLength(0);
    expect(result.ollamaBaseUrl).toBe("https://ollama.example.com:11434/v1");
  });

  it("keeps loopback http (local dev)", () => {
    const result = validateInferenceEndpoints({
      ...baseConfig,
      ollamaBaseUrl: "http://localhost:11434/v1",
    });
    expect(result.issues).toHaveLength(0);
    expect(result.ollamaBaseUrl).toBe("http://localhost:11434/v1");
  });

  it("refuses plain-http remote endpoints by default, with one clear message", () => {
    const result = validateInferenceEndpoints({
      ...baseConfig,
      ollamaBaseUrl: "http://45.32.114.54:11434/v1",
    });
    expect(result.ollamaBaseUrl).toBeUndefined();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain("ollamaBaseUrl");
    expect(result.issues[0]).toContain("allowInsecureRemoteHttp");
  });

  it("keeps plain-http remote endpoints when explicitly opted in, flagged loudly", () => {
    const result = validateInferenceEndpoints({
      ...baseConfig,
      allowInsecureRemoteHttp: true,
      ollamaBaseUrl: "http://45.32.114.54:11434/v1",
    });
    expect(result.ollamaBaseUrl).toBe("http://45.32.114.54:11434/v1");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain("PLAIN HTTP");
  });

  it("drops unparseable endpoints instead of failing every request", () => {
    const result = validateInferenceEndpoints({
      ...baseConfig,
      ollamaBaseUrl: "not a url",
    });
    expect(result.ollamaBaseUrl).toBeUndefined();
    expect(result.issues[0]).toContain("not a valid URL");
  });
});

describe("validateProviderSetup", () => {
  it("disables remote plain-HTTP providers unless opted in", () => {
    const providers = [provider({ id: "ollama-x", baseUrl: "http://203.0.113.9:11434/v1" })];
    const issues = validateProviderSetup(providers, tierDefaults, false);
    expect(providers[0].enabled).toBe(false);
    expect(issues.some((i) => i.includes("ollama-x") && i.includes("disabled"))).toBe(true);
  });

  it("keeps remote plain-HTTP providers when opted in, with a warning", () => {
    const providers = [provider({ id: "ollama-x", baseUrl: "http://203.0.113.9:11434/v1" })];
    const issues = validateProviderSetup(providers, tierDefaults, true);
    expect(providers[0].enabled).toBe(true);
    expect(issues.some((i) => i.includes("PLAIN HTTP"))).toBe(true);
  });

  it("keeps loopback http providers enabled", () => {
    const providers = [provider({ id: "ollama-local", baseUrl: "http://127.0.0.1:11434/v1" })];
    validateProviderSetup(providers, tierDefaults, false);
    expect(providers[0].enabled).toBe(true);
  });

  it("disables providers with unparseable baseUrls", () => {
    const providers = [provider({ id: "broken", baseUrl: "nope" })];
    const issues = validateProviderSetup(providers, tierDefaults, false);
    expect(providers[0].enabled).toBe(false);
    expect(issues.some((i) => i.includes("not a valid URL"))).toBe(true);
  });

  it("flags tier defaults that reference unknown providers", () => {
    const providers = [provider({ id: "p1" })];
    const defaults: any = {
      reasoning: { preferredProvider: "ghost", fallbackOrder: ["p1", "also-ghost"] },
      fast: { preferredProvider: "p1", fallbackOrder: [] },
      cheap: { preferredProvider: "p1", fallbackOrder: [] },
    };
    const issues = validateProviderSetup(providers, defaults, false);
    expect(issues.filter((i) => i.includes("ghost"))).toHaveLength(2);
  });
});

describe("inference client ollama endpoint", () => {
  it("fails with one clear error when ollama is selected without a base URL", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const client = createInferenceClient({
      apiUrl: "https://mindmods.org/v1",
      apiKey: "",
      defaultModel: "llama3.2:3b",
      maxTokens: 100,
      getModelProvider: () => "ollama",
    });

    await expect(client.chat([{ role: "user", content: "hi" }])).rejects.toThrow(
      /no Ollama base URL is configured/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
