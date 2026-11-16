/**
 * Gateway Activity Tests
 *
 * Covers the parsers and fail-soft collection in gateway-activity.ts:
 *  - NDJSON log parsing (log/notice/meta lines, level mapping, truncation)
 *  - session aggregation per agent (count, newest label/model wins)
 *  - workspace tail section parsing
 *  - gatherGatewayActivity degrades section-by-section when SSH fails
 */

import { describe, it, expect } from "vitest";
import {
  parseGatewayLogs,
  parseFileLogNdjson,
  parseGatewaySessions,
  parseWorkspaceTails,
  gatherGatewayActivity,
  buildWorkspaceTailCommand,
  buildFileLogTailCommand,
  GATEWAY_LOG_KV,
  GATEWAY_SESSIONS_KV,
  FILE_LOG_DIR,
} from "../replication/gateway-activity.js";

describe("parseGatewayLogs", () => {
  it("parses NDJSON log lines and skips meta/notice", () => {
    const stdout = [
      '{"type":"meta","file":"/tmp/openclaw/x.log","cursor":1,"size":2}',
      '{"type":"log","time":"2026-09-15T05:09:44.361+00:00","level":"info","subsystem":"plugins","message":"integrated ok"}',
      '{"type":"log","time":"2026-09-15T05:09:45.000+00:00","level":"error","message":"boom"}',
      '{"type":"notice","message":"Log tail truncated (increase --limit)."}',
      "not json at all",
    ].join("\n");

    const { lines, truncated } = parseGatewayLogs(stdout);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ level: "info", subsystem: "plugins", message: "integrated ok" });
    // No subsystem on line 2 → defaults to "gateway"
    expect(lines[1]).toMatchObject({ level: "error", subsystem: "gateway", message: "boom" });
    expect(truncated).toBe(true);
  });

  it("maps unknown levels to info", () => {
    const { lines } = parseGatewayLogs(
      '{"type":"log","time":"t","level":"trace","message":"quiet"}',
    );
    expect(lines[0]?.level).toBe("info");
  });

  it("returns empty on garbage input", () => {
    expect(parseGatewayLogs("")).toEqual({ lines: [], truncated: false });
  });
});

describe("parseFileLogNdjson", () => {
  it("parses /tmp/openclaw file-log NDJSON: level from _meta, subsystem from name field", () => {
    const stdout = [
      '{"0":"{\\"subsystem\\":\\"gateway/ws\\"}","1":"\\u21c4 res \u2713 plugins.list 78ms","_meta":{"logLevelId":3,"logLevelName":"INFO","name":"{\\"subsystem\\":\\"gateway/ws\\"}"},"time":"2026-09-15T06:57:31.539+00:00","message":"\\u21c4 res \u2713 plugins.list 78ms"}',
      '{"0":"{\\"subsystem\\":\\"main\\"}","1":"tool call failed","2":{"kind":"agent","label":"OpenClaw agent database main"},"_meta":{"logLevelId":2,"logLevelName":"WARN","name":"{\\"subsystem\\":\\"main\\"}"},"time":"2026-09-15T06:58:00.000+00:00","message":"tool call failed"}',
      '{"_meta":{"logLevelId":1,"logLevelName":"ERROR","name":"{\\"subsystem\\":\\"state\\"}"},"time":"2026-09-15T06:59:00.000+00:00","message":"database integrity verification FAILED"}',
      'not json',
      '{"type":"notice","message":"should be skipped"}',
    ].join("\n");

    const lines = parseFileLogNdjson(stdout);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ level: "info", subsystem: "gateway/ws" });
    expect(lines[0]?.message).toContain("plugins.list");
    expect(lines[1]).toMatchObject({ level: "warn", subsystem: "main", message: "tool call failed" });
    expect(lines[2]).toMatchObject({ level: "error", subsystem: "state" });
  });

  it("rebuilds the message from numbered detail fields when top-level message is absent", () => {
    const stdout =
      '{"1":"agent crash","2":{"kind":"state","label":"OpenClaw state database"},"_meta":{"logLevelName":"INFO","name":"{\\"subsystem\\":\\"state\\"}"},"time":"t"}';
    const lines = parseFileLogNdjson(stdout);
    expect(lines[0]?.message).toBe("agent crash — OpenClaw state database");
  });

  it("returns empty on garbage", () => {
    expect(parseFileLogNdjson("")).toEqual([]);
    expect(parseFileLogNdjson("garbage\nlines")).toEqual([]);
  });
});

describe("parseGatewaySessions", () => {
  it("aggregates sessions per agent with the newest label winning", () => {
    const stdout = JSON.stringify({
      sessions: [
        { agentId: "main", label: "older task", updatedAt: 100, ageMs: 9000, model: "m1" },
        { agentId: "main", label: "newer task", updatedAt: 200, ageMs: 100, model: "m2" },
        { agentId: "mudge-recon", label: "recon sweep", updatedAt: 50, ageMs: 500, model: "m3" },
      ],
    });
    const agg = parseGatewaySessions(stdout);
    expect(agg).toHaveLength(2);
    const main = agg.find((a) => a.agentId === "main")!;
    expect(main.sessionCount).toBe(2);
    expect(main.lastLabel).toBe("newer task");
    expect(main.model).toBe("m2");
    expect(main.lastUpdatedAt).toBe(200);
  });

  it("tolerates missing/odd fields (agentless sessions land in 'unknown')", () => {
    const agg = parseGatewaySessions('{"sessions":[{"agentId":"x"},{"label":"no agent"}]}');
    expect(agg).toHaveLength(2);
    expect(agg.find((a) => a.agentId === "x")?.sessionCount).toBe(1);
    expect(agg.find((a) => a.agentId === "unknown")?.sessionCount).toBe(1);
  });

  it("returns empty on garbage", () => {
    expect(parseGatewaySessions("nope")).toEqual([]);
  });
});

describe("parseWorkspaceTails", () => {
  it("buckets the flat find output by workspace, keeping the 3 newest files", () => {
    const now = Date.now() / 1000;
    const stdout = [
      `${(now - 60).toFixed(3)} /home/debian/code/auto/bounty-hunter-1/memory/notes.md`,
      `${(now - 3600).toFixed(3)} /home/debian/code/auto/bounty-hunter-1/AGENTS.md`,
      `${(now - 30).toFixed(3)} /home/debian/code/auto/bounty-hunter-2/run.log`,
      `echo garbage line`,
      `${(now - 10).toFixed(3)} /etc/passwd`, // outside /code/auto — ignored
    ].join("\n");

    const tails = parseWorkspaceTails(stdout);
    expect(tails).toHaveLength(2);
    const b1 = tails.find((w) => w.name === "bounty-hunter-1");
    expect(b1?.recent).toHaveLength(2);
    expect(b1?.recent[0]).toMatchObject({ file: "notes.md" });
    expect(b1?.recent[0]?.ageMs).toBeGreaterThan(55_000);
    expect(b1?.recent[0]?.ageMs).toBeLessThan(120_000);
    expect(tails.find((w) => w.name === "bounty-hunter-2")?.recent[0]?.file).toBe("run.log");
  });

  it("returns empty on garbage", () => {
    expect(parseWorkspaceTails("")).toEqual([]);
    expect(parseWorkspaceTails("no matches here\n")).toEqual([]);
  });
});

describe("gatherGatewayActivity", () => {
  it("prefers the OpenClaw API: RPC lines win and the file log is never read", async () => {
    const rpcLines = [
      '{"type":"log","time":"2026-09-15T05:00:00.000+00:00","level":"warn","subsystem":"plugins","message":"shared line"}',
      '{"type":"log","time":"2026-09-15T05:10:00.000+00:00","level":"info","message":"rpc only"}',
    ].join("\n");
    const calls: string[] = [];
    const activity = await gatherGatewayActivity(async (cmd: string) => {
      calls.push(cmd);
      if (cmd.includes("openclaw logs")) return { stdout: rpcLines, stderr: "" };
      if (cmd.includes("openclaw sessions")) {
        return {
          stdout: JSON.stringify({ sessions: [{ agentId: "main", label: "alive", updatedAt: 5, ageMs: 1, model: "m" }] }),
          stderr: "",
        };
      }
      return { stdout: "1700000000.000 /home/debian/code/auto/ws1/AGENTS.md\n", stderr: "" };
    });

    // API-first: the RPC lines are used as-is and the file log is never read.
    expect(activity.logSource).toBe("rpc");
    expect(activity.log).toHaveLength(2);
    expect(activity.log[0]).toMatchObject({ level: "warn", subsystem: "plugins", message: "shared line" });
    expect(calls.some((c) => c.includes("/tmp/openclaw"))).toBe(false);
    expect(activity.errors).toEqual([]);
  });

  it("falls back to the SSH file log only when the RPC yields nothing", async () => {
    // Built with JSON.stringify so the embedded `name` JSON carries correct
    // escaped quotes — hand-escaping backslashes here has bitten us twice.
    const fileNdjson = [
      {
        _meta: { logLevelName: "INFO", name: '{"subsystem":"plugins"}' },
        time: "2026-09-15T05:00:00.000+00:00",
        message: "shared line",
      },
      {
        _meta: { logLevelName: "ERROR", name: '{"subsystem":"gateway/ws"}' },
        time: "2026-09-15T04:55:00.000+00:00",
        message: "file only",
      },
    ]
      .map((o) => JSON.stringify(o))
      .join("\n");
    const activity = await gatherGatewayActivity(async (cmd: string) => {
      if (cmd.includes("openclaw logs")) return { stdout: "", stderr: "rpc sick" };
      if (cmd.includes("/tmp/openclaw")) return { stdout: fileNdjson, stderr: "" };
      if (cmd.includes("openclaw sessions")) {
        return {
          stdout: JSON.stringify({ sessions: [{ agentId: "main", label: "alive", updatedAt: 5, ageMs: 1, model: "m" }] }),
          stderr: "",
        };
      }
      return { stdout: "1700000000.000 /home/debian/code/auto/ws1/AGENTS.md\n", stderr: "" };
    });

    expect(activity.logSource).toBe("file");
    expect(activity.log).toHaveLength(2);
    expect(activity.log[0]).toMatchObject({ level: "error", message: "file only" });
    expect(activity.errors.some((e) => e.startsWith("logs:"))).toBe(true);
  });

  it("degrades per-section when runners fail, never throws", async () => {
    const activity = await gatherGatewayActivity(async (cmd: string) => {
      if (cmd.includes("/tmp/openclaw")) throw new Error("ssh down");
      if (cmd.includes("openclaw logs")) throw new Error("ssh down");
      if (cmd.includes("openclaw sessions")) {
        return {
          stdout: JSON.stringify({ sessions: [{ agentId: "main", label: "alive", updatedAt: 5, ageMs: 1, model: "m" }] }),
          stderr: "",
        };
      }
      // workspace activity sweep succeeds (flat find output)
      return {
        stdout: "1700000000.000 /home/debian/code/auto/ws1/AGENTS.md\n",
        stderr: "",
      };
    });

    expect(activity.logSource).toBe("none");
    expect(activity.log).toEqual([]);
    expect(activity.errors.some((e) => e.startsWith("file logs"))).toBe(true);
    expect(activity.errors.some((e) => e.startsWith("logs"))).toBe(true);
    expect(activity.sessions).toHaveLength(1);
    expect(activity.workspaces).toHaveLength(1);
  });

  it("builds an mtime sweep command covering every workspace (transport-safe: no $(), no double quotes)", () => {
    const cmd = buildWorkspaceTailCommand();
    expect(cmd).toContain("find /home/debian/code/auto");
    expect(cmd).toContain("-printf");
    expect(cmd).toContain("sort -rn");
    expect(cmd).not.toContain("$(");
    expect(cmd).not.toContain('"');
  });

  it("builds a file-log tail command over /tmp/openclaw (no $(), no double quotes)", () => {
    const cmd = buildFileLogTailCommand();
    expect(cmd).toContain(`tail -qn`);
    expect(cmd).toContain(`${FILE_LOG_DIR}/openclaw-*.log`);
    expect(cmd).not.toContain("$(");
    expect(cmd).not.toContain('"');
  });
});

describe("KV keys", () => {
  it("uses stable KV key names", () => {
    expect(GATEWAY_LOG_KV).toBe("gateway_log");
    expect(GATEWAY_SESSIONS_KV).toBe("gateway_sessions");
    expect(FILE_LOG_DIR).toBe("/tmp/openclaw");
  });
});
