import { afterEach, describe, expect, it, vi } from "vitest";
import {
  callEntelechyMcpTool,
  onboardEntelechy,
} from "../../memory/entelechy-client.js";

describe("Entelechy MCP client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ENTELECHY_MCP_URL;
    delete process.env.ENTELECHY_API_KEY;
  });

  it("uses the documented plain JSON onboarding request", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        message: "Welcome",
        status: "Connected",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await onboardEntelechy();

    expect(result).toEqual({ message: "Welcome", status: "Connected" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.method).toBe("POST");
    expect(JSON.parse(request.body as string)).toEqual({ name: "start_here" });
  });

  it("unwraps standard JSON-RPC tool responses", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: "recall-1",
        result: { content: [{ type: "text", text: "memory" }] },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(callEntelechyMcpTool("recall", { query: "task history" }))
      .resolves.toEqual({ content: [{ type: "text", text: "memory" }] });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "recall",
        arguments: { query: "task history" },
      },
    });
  });

  it("supports the configured endpoint and bearer token", async () => {
    process.env.ENTELECHY_MCP_URL = "https://example.test/mcp";
    process.env.ENTELECHY_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await callEntelechyMcpTool("list_banks");

    expect(fetchMock.mock.calls[0][0]).toBe("https://example.test/mcp");
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(request.headers).get("Authorization")).toBe("Bearer test-key");
  });

  it("surfaces MCP errors instead of returning an empty result", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "unauthorized" } }), { status: 200 }),
    ));

    await expect(callEntelechyMcpTool("recall", { query: "x" }))
      .rejects.toThrow("unauthorized");
  });
});
