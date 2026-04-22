import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BaseHarness } from "../../agent/harnesses/base-harness.js";
import type { HarnessContext, HarnessTool } from "../../agent/harness-types.js";
import type { TaskNode, TaskResult } from "../../orchestration/task-graph.js";
import { AgentWorkspace } from "../../orchestration/workspace.js";
import { createInMemoryDb } from "../orchestration/test-db.js";
import { createTestConfig, createTestIdentity, MockConwayClient } from "../mocks.js";

class TestHarness extends BaseHarness {
  readonly id = "test";
  readonly description = "test harness";

  buildSystemPrompt(): string {
    return "system prompt";
  }

  getToolDefs(): HarnessTool[] {
    return [
      {
        name: "ping",
        description: "ping",
        parameters: { type: "object", properties: {} },
        execute: async () => "pong",
      },
      {
        name: "task_done",
        description: "done",
        parameters: {
          type: "object",
          properties: { summary: { type: "string" }, success: { type: "boolean" } },
          required: ["summary"],
        },
        execute: async (args) => `TASK_COMPLETE:${args.summary as string}`,
      },
    ];
  }
}

describe("agent/BaseHarness integration", () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  function createTask(): TaskNode {
    return {
      id: "task-1",
      parentId: null,
      goalId: "goal-1",
      title: "Run test harness",
      description: "Use tools and finish",
      status: "assigned",
      assignedTo: "local://worker",
      agentRole: "generalist",
      priority: 50,
      dependencies: [],
      result: null,
      metadata: {
        estimatedCostCents: 5,
        actualCostCents: 0,
        maxRetries: 0,
        retryCount: 0,
        timeoutMs: 5_000,
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
      },
    };
  }

  function createContext(): HarnessContext {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "base-harness-"));
    const workspace = new AgentWorkspace("goal-1", path.join(tempDir, "workspace"));
    const db = createInMemoryDb();
    return {
      workspaceRoot: workspace.basePath,
      allowedEditRoot: tempDir,
      workspace,
      identity: createTestIdentity(),
      config: createTestConfig(),
      db,
      conway: new MockConwayClient(),
      inference: {
        chat: async () => ({
          content: "",
          toolCalls: [
            {
              id: "call-1",
              type: "function",
              function: { name: "ping", arguments: "{}" },
            },
            {
              id: "call-2",
              type: "function",
              function: { name: "task_done", arguments: JSON.stringify({ summary: "finished", success: true }) },
            },
          ],
        }),
      },
      budget: {
        maxTurns: 3,
        maxCostCents: 50,
        timeoutMs: 5_000,
        turnsUsed: 0,
        costUsedCents: 0,
        startedAt: 0,
      },
      wisdom: { conventions: [], successes: [], failures: [], gotchas: [] },
      abortSignal: new AbortController().signal,
      goalId: "goal-1",
    };
  }

  it("executes tool calls and returns a TaskResult on task_done", async () => {
    const harness = new TestHarness();
    const task = createTask();
    const context = createContext();
    await harness.initialize(task, context);
    const result = await harness.execute();
    expect(result.success).toBe(true);
    expect(result.output).toBe("finished");
    expect(context.budget.turnsUsed).toBe(1);
    (context.db as any).close?.();
  });

  it("fails immediately when the turn budget is already exhausted", async () => {
    const harness = new TestHarness();
    const task = createTask();
    const context = createContext();
    context.budget.maxTurns = 0;
    await harness.initialize(task, context);
    await expect(harness.execute()).rejects.toThrow(/Budget exhausted: reached max turns/);
    (context.db as any).close?.();
  });
});
