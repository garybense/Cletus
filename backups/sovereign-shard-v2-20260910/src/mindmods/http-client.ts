/**
 * Resilient HTTP Client
 *
 * Shared HTTP client with timeouts, retries, jittered exponential backoff,
 * and circuit breaker for all outbound Mindmods API calls.
 *
 * The circuit breaker state is scoped per endpoint domain (origin + normalized
 * path), so a failing endpoint (e.g. the credits API) can never take down
 * unrelated operations (e.g. sandbox exec / file read / write). This keeps the
 * breaker's protection intact while avoiding a single global breaker that
 * blocks every tool whenever one Mindmods endpoint is flaky.
 *
 * Phase 1.3: Network Resilience (P1-8, P1-9)
 */

import type { HttpClientConfig } from "../types.js";
import { DEFAULT_HTTP_CLIENT_CONFIG } from "../types.js";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function assertSecureUrl(
  url: string,
  allowHttpOnLoopback: boolean,
): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol === "https:") {
    return;
  }

  const host = parsed.hostname.toLowerCase();
  if (protocol === "http:" && allowHttpOnLoopback && LOOPBACK_HOSTS.has(host)) {
    return;
  }

  throw new Error(
    `HTTPS required: refusing insecure URL ${url}. ` +
      "For local development, only loopback HTTP (localhost/127.0.0.1/::1) can be explicitly enabled.",
  );
}

export class CircuitOpenError extends Error {
  constructor(public readonly resetAt: number) {
    super(
      `Circuit breaker is open until ${new Date(resetAt).toISOString()}`,
    );
    this.name = "CircuitOpenError";
  }
}

interface CircuitState {
  failures: number;
  openUntil: number;
}

/**
 * Derive a stable breaker key from a request URL so breaker state is scoped
 * per endpoint domain rather than shared globally across all API calls.
 *
 * Variable resource ids (sandbox/child ids) are normalized to "{id}" so that
 * operations on different instances of the same resource share one breaker,
 * while unrelated endpoints (credits vs sandbox exec vs files) never share
 * failure state.
 */
function deriveCircuitKey(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "unknown";
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  const normalized = segments.map((seg, i) => {
    const prev = segments[i - 1];
    if (prev === "sandboxes" || prev === "children") {
      return "{id}";
    }
    return seg;
  });
  return `${parsed.origin}/${normalized.join("/")}`;
}

export class ResilientHttpClient {
  private readonly circuitState = new Map<string, CircuitState>();
  private lastCircuitKey = "";
  private readonly config: HttpClientConfig;

  constructor(config?: Partial<HttpClientConfig>) {
    this.config = { ...DEFAULT_HTTP_CLIENT_CONFIG, ...config };
  }

  resetCircuitBreaker(): void {
    this.circuitState.clear();
    this.lastCircuitKey = "";
  }

  private getState(key: string): CircuitState {
    let state = this.circuitState.get(key);
    if (!state) {
      state = { failures: 0, openUntil: 0 };
      this.circuitState.set(key, state);
    }
    return state;
  }

  async request(
    url: string,
    options?: RequestInit & {
      timeout?: number;
      idempotencyKey?: string;
      retries?: number;
    },
  ): Promise<Response> {
    assertSecureUrl(url, this.config.allowHttpOnLoopback);

    const key = deriveCircuitKey(url);
    this.lastCircuitKey = key;
    const state = this.getState(key);

    // Auto-close the breaker once the cooldown has elapsed.
    if (state.openUntil > 0 && Date.now() >= state.openUntil) {
      state.failures = 0;
      state.openUntil = 0;
    }

    if (Date.now() < state.openUntil) {
      throw new CircuitOpenError(state.openUntil);
    }

    const opts = options ?? {};
    const timeout = opts.timeout ?? this.config.baseTimeout;
    const maxRetries = opts.retries ?? this.config.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        console.log("[DEBUG] Fetch headers keys:", Object.keys(opts.headers || {}));
        const response = await fetch(url, {
          ...opts,
          signal: controller.signal,
          headers: {
            ...opts.headers,
            ...(opts.idempotencyKey
              ? { "Idempotency-Key": opts.idempotencyKey }
              : {}),
          },
        });
        clearTimeout(timer);

        // Count retryable HTTP errors toward circuit breaker, regardless of
        // whether we will actually retry. A server consistently returning 502
        // should eventually trip the circuit breaker.
        if (this.config.retryableStatuses.includes(response.status)) {
          state.failures++;
          if (state.failures >= this.config.circuitBreakerThreshold) {
            state.openUntil = Date.now() + this.config.circuitBreakerResetMs;
          }
          if (attempt < maxRetries) {
            await this.backoff(attempt);
            continue;
          }
          return response;
        }

        // Only reset failure counter on truly successful responses
        state.failures = 0;
        return response;
      } catch (error) {
        clearTimeout(timer);
        state.failures++;
        if (state.failures >= this.config.circuitBreakerThreshold) {
          state.openUntil =
            Date.now() + this.config.circuitBreakerResetMs;
        }
        if (attempt === maxRetries) throw error;
        await this.backoff(attempt);
      }
    }

    throw new Error("Unreachable");
  }

  private async backoff(attempt: number): Promise<void> {
    const delay = Math.min(
      this.config.backoffBase *
        Math.pow(2, attempt) *
        (0.5 + Math.random()),
      this.config.backoffMax,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  isCircuitOpen(): boolean {
    if (!this.lastCircuitKey) return false;
    const state = this.getState(this.lastCircuitKey);
    if (state.openUntil > 0 && Date.now() >= state.openUntil) {
      state.failures = 0;
      state.openUntil = 0;
      return false;
    }
    return Date.now() < state.openUntil;
  }

  resetCircuit(): void {
    this.circuitState.clear();
    this.lastCircuitKey = "";
  }

  getConsecutiveFailures(): number {
    if (!this.lastCircuitKey) return 0;
    return this.getState(this.lastCircuitKey).failures;
  }
}
