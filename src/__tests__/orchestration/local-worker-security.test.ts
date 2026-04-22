import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type BetterSqlite3 from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalWorkerPool } from "../../orchestration/local-worker.js";
import type { ConwayClient } from "../../types.js";
import { createInMemoryDb } from "./test-db.js";

function createConwayStub(overrides?: Partial<ConwayClient>): ConwayClient {
  return {
    exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    writeFile: async () => undefined,
    readFile: async () => "",
    exposePort: async () => ({ port: 0, publicUrl: "", sandboxId: "" }),
    removePort: async () => undefined,
    createSandbox: async () => ({ id: "", status: "", region: "", vcpu: 0, memoryMb: 0, diskGb: 0, createdAt: "" }),
    deleteSandbox: async () => undefined,
    listSandboxes: async () => [],
    getCreditsBalance: async () => 0,
    getCreditsPricing: async () => [],
    transferCredits: async () => ({ id: "", fromAddress: "", toAddress: "", amountCents: 0, status: "completed", timestamp: "" }),
    registerAutomaton: async () => ({ automaton: {} }),
    searchDomains: async () => [],
    registerDomain: async () => ({ domain: "", status: "pending", registrationDate: "", expirationDate: "", nameservers: [] }),
    listDnsRecords: async () => [],
    addDnsRecord: async () => ({ id: "", type: "A", host: "", value: "", ttl: 300 }),
    deleteDnsRecord: async () => undefined,
    listModels: async () => [],
    createScopedClient: () => createConwayStub(),
    ...overrides,
  } as ConwayClient;
}

describe("orchestration/local-worker security", () => {
  let db: BetterSqlite3.Database;
  let testRoot: string;

  beforeEach(() => {
    db = createInMemoryDb();
    testRoot = mkdtempSync(path.join(process.cwd(), ".tmp-local-worker-"));
  });

  afterEach(() => {
    db.close();
    rmSync(testRoot, { recursive: true, force: true });
  });

  function getTools(conway: ConwayClient) {
    const pool = new LocalWorkerPool({
      db,
      conway,
      workerId: "worker-test",
      inference: {
        chat: async () => ({ content: "done" }),
      },
    });
    return (pool as any).buildWorkerTools() as Array<{ name: string; execute: (args: Record<string, unknown>) => Promise<string> }>;
  }

  async function runTool(
    conway: ConwayClient,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const tools = getTools(conway);
    const tool = tools.find((t) => t.name === toolName);
    if (!tool) throw new Error(`missing tool: ${toolName}`);
    return tool.execute(args);
  }

  it("blocks sensitive file reads (wallet.json)", async () => {
    const out = await runTool(createConwayStub(), "read_file", { path: "wallet.json" });
    expect(out).toContain("Blocked: cannot read sensitive file");
  });

  it("blocks traversal reads outside workspace", async () => {
    const out = await runTool(createConwayStub(), "read_file", { path: "../../etc/passwd" });
    expect(out).toContain("Blocked: path");
    expect(out).toContain("outside the local worker workspace");
  });

  it("blocks absolute-path reads outside workspace", async () => {
    const out = await runTool(createConwayStub(), "read_file", { path: "/etc/passwd" });
    expect(out).toContain("Blocked: path");
  });

  it("blocks writes outside workspace", async () => {
    const out = await runTool(createConwayStub(), "write_file", {
      path: "../../tmp/pwned.txt",
      content: "x",
    });
    expect(out).toContain("Blocked: path");
  });

  it("blocks writes to protected files", async () => {
    const out = await runTool(createConwayStub(), "write_file", {
      path: "constitution.md",
      content: "tamper",
    });
    expect(out).toContain("Blocked: cannot write to protected file");
  });

  it("blocks forbidden shell commands", async () => {
    const out = await runTool(createConwayStub(), "exec", {
      command: "cat ~/.automaton/wallet.json",
    });
    expect(out).toContain("Blocked:");
  });

  it("allows normal read_file path inside workspace", async () => {
    const filePath = path.join(testRoot, "notes.txt");
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, "hello", "utf8");

    const conway = createConwayStub({
      readFile: async () => {
        throw new Error("force local fallback");
      },
    });

    const out = await runTool(conway, "read_file", { path: filePath });
    expect(out).toBe("hello");
  });

  it("allows normal write_file path inside workspace", async () => {
    const filePath = path.join(testRoot, "out", "data.txt");

    const conway = createConwayStub({
      writeFile: async () => {
        throw new Error("force local fallback");
      },
    });

    const out = await runTool(conway, "write_file", { path: filePath, content: "ok" });
    expect(out).toContain("Wrote 2 bytes");
    expect(readFileSync(filePath, "utf8")).toBe("ok");
  });
});
