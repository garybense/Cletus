/**
 * Local Agent Worker
 *
 * Runs inference-driven task execution in-process as an async background task.
 * Each worker gets a role-specific system prompt, a subset of tools, and
 * runs a ReAct loop (think → tool_call → observe → repeat → done).
 *
 * This enables multi-agent orchestration on local machines without Conway
 * sandbox infrastructure. Workers share the same Node.js process but run
 * concurrently as independent async tasks.
 */

import { ulid } from "ulid";
import { createLogger } from "../observability/logger.js";
import { UnifiedInferenceClient } from "../inference/inference-client.js";
import { completeTask, failTask } from "./task-graph.js";
import type { TaskNode, TaskResult } from "./task-graph.js";
import type { Database } from "better-sqlite3";
import type { ConwayClient } from "../types.js";

const logger = createLogger("orchestration.local-worker");

const MAX_TURNS = 25;
const DEFAULT_TIMEOUT_MS = 5 * 60_000;

interface LocalWorkerConfig {
  db: Database;
  inference: UnifiedInferenceClient;
  conway: ConwayClient;
  workerId: string;
  maxTurns?: number;
}

interface WorkerToolResult {
  name: string;
  output: string;
  error?: string;
}

// Minimal tool set available to local workers
interface WorkerTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

export class LocalWorkerPool {
  private activeWorkers = new Map<string, { promise: Promise<void>; taskId: string; abortController: AbortController }>();

  constructor(private readonly config: LocalWorkerConfig) {}

  /**
   * Spawn a local worker for a task. Returns immediately — the worker
   * runs in the background and reports results via the task graph.
   */
  spawn(task: TaskNode): { address: string; name: string; sandboxId: string } {
    const workerId = `local-worker-${ulid()}`;
    const workerName = `worker-${task.agentRole ?? "generalist"}-${workerId.slice(-6)}`;
    const address = `local://${workerId}`;
    const abortController = new AbortController();

    const workerPromise = this.runWorker(workerId, task, abortController.signal)
      .catch((error) => {
        logger.error("Local worker crashed", error instanceof Error ? error : new Error(String(error)), {
          workerId,
          taskId: task.id,
        });
        try {
          failTask(this.config.db, task.id, `Worker crashed: ${error instanceof Error ? error.message : String(error)}`, true);
        } catch { /* task may already be in terminal state */ }
      })
      .finally(() => {
        this.activeWorkers.delete(workerId);
      });

    this.activeWorkers.set(workerId, { promise: workerPromise, taskId: task.id, abortController });

    return { address, name: workerName, sandboxId: workerId };
  }

  getActiveCount(): number {
    return this.activeWorkers.size;
  }

  async shutdown(): Promise<void> {
    for (const [, worker] of this.activeWorkers) {
      worker.abortController.abort();
    }
    await Promise.allSettled([...this.activeWorkers.values()].map((w) => w.promise));
    this.activeWorkers.clear();
  }

  private async runWorker(workerId: string, task: TaskNode, signal: AbortSignal): Promise<void> {
    const maxTurns = this.config.maxTurns ?? MAX_TURNS;
    const tools = this.buildWorkerTools();
    const toolDefs = tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const systemPrompt = this.buildWorkerSystemPrompt(task);
    const messages: Array<{ role: string; content: string; tool_calls?: any[]; tool_call_id?: string }> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: this.buildTaskPrompt(task) },
    ];

    const artifacts: string[] = [];
    let finalOutput = "";
    const startedAt = Date.now();

    for (let turn = 0; turn < maxTurns; turn++) {
      if (signal.aborted) {
        failTask(this.config.db, task.id, "Worker aborted", false);
        return;
      }

      const timeoutMs = task.metadata.timeoutMs || DEFAULT_TIMEOUT_MS;
      if (Date.now() - startedAt > timeoutMs) {
        failTask(this.config.db, task.id, `Worker timed out after ${timeoutMs}ms`, true);
        return;
      }

      let response;
      try {
        response = await this.config.inference.chat({
          tier: "fast",
          messages: messages as any,
          tools: toolDefs,
          toolChoice: "auto",
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        failTask(this.config.db, task.id, `Inference failed: ${msg}`, true);
        return;
      }

      // Check if the model wants to call tools
      if (response.toolCalls && Array.isArray(response.toolCalls) && response.toolCalls.length > 0) {
        // Add assistant message with tool calls
        messages.push({
          role: "assistant",
          content: response.content || "",
          tool_calls: response.toolCalls,
        });

        // Execute each tool call
        for (const rawToolCall of response.toolCalls) {
          const toolCall = rawToolCall as { id: string; function: { name: string; arguments: string | Record<string, unknown> } };
          const fn = toolCall.function;
          const tool = tools.find((t) => t.name === fn.name);

          let toolOutput: string;
          if (!tool) {
            toolOutput = `Error: Unknown tool '${fn.name}'`;
          } else {
            try {
              const args = typeof fn.arguments === "string" ? JSON.parse(fn.arguments) : fn.arguments;
              toolOutput = await tool.execute(args as Record<string, unknown>);

              // Track file artifacts
              if (fn.name === "write_file" && typeof (args as any).path === "string") {
                artifacts.push((args as any).path);
              }
            } catch (error) {
              toolOutput = `Error: ${error instanceof Error ? error.message : String(error)}`;
            }
          }

          messages.push({
            role: "tool",
            content: toolOutput,
            tool_call_id: toolCall.id,
          });
        }

        continue;
      }

      // No tool calls — the model is done (final response)
      finalOutput = response.content || "Task completed.";
      break;
    }

    // Mark task as completed
    const duration = Date.now() - startedAt;
    const result: TaskResult = {
      success: true,
      output: finalOutput,
      artifacts,
      costCents: 0,
      duration,
    };

    try {
      completeTask(this.config.db, task.id, result);
      logger.info("Local worker completed task", {
        workerId,
        taskId: task.id,
        title: task.title,
        duration,
        turns: messages.filter((m) => m.role === "assistant").length,
      });
    } catch (error) {
      logger.warn("Failed to mark task complete", {
        workerId,
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private buildWorkerSystemPrompt(task: TaskNode): string {
    const role = task.agentRole ?? "generalist";
    return `You are a worker agent with the role: ${role}.

You have been assigned a specific task by the parent orchestrator. Your job is to
complete this task using the tools available to you and then provide your final output.

RULES:
- Focus ONLY on the assigned task. Do not deviate.
- Use exec to run shell commands (install packages, run scripts, etc.)
- Use write_file to create or modify files.
- Use read_file to inspect existing files.
- When done, provide a clear summary of what you accomplished as your final message.
- If you cannot complete the task, explain why in your final message.
- Do NOT call tools after you are done. Just give your final text response.
- Be efficient. Minimize unnecessary tool calls.
- You have a limited number of turns. Do not waste them.`;
  }

  private buildTaskPrompt(task: TaskNode): string {
    const lines = [
      `# Task Assignment`,
      `**Title:** ${task.title}`,
      `**Description:** ${task.description}`,
      `**Role:** ${task.agentRole ?? "generalist"}`,
      `**Task ID:** ${task.id}`,
      `**Goal ID:** ${task.goalId}`,
    ];

    if (task.dependencies.length > 0) {
      lines.push(`**Dependencies (completed):** ${task.dependencies.join(", ")}`);
    }

    lines.push("", "Complete this task and provide your results.");
    return lines.join("\n");
  }

  private buildWorkerTools(): WorkerTool[] {
    return [
      {
        name: "exec",
        description: "Execute a shell command and return stdout/stderr. Use for installing packages, running scripts, building code, etc.",
        parameters: {
          type: "object",
          properties: {
            command: { type: "string", description: "The shell command to execute" },
            timeout_ms: { type: "number", description: "Timeout in milliseconds (default: 30000)" },
          },
          required: ["command"],
        },
        execute: async (args) => {
          const command = args.command as string;
          const timeoutMs = typeof args.timeout_ms === "number" ? args.timeout_ms : 30_000;

          try {
            const result = await this.config.conway.exec(command, timeoutMs);
            const stdout = (result.stdout ?? "").slice(0, 8000);
            const stderr = (result.stderr ?? "").slice(0, 2000);
            return stderr ? `stdout:\n${stdout}\nstderr:\n${stderr}` : stdout || "(no output)";
          } catch (error) {
            return `exec error: ${error instanceof Error ? error.message : String(error)}`;
          }
        },
      },
      {
        name: "write_file",
        description: "Write content to a file. Creates parent directories if needed.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to write to" },
            content: { type: "string", description: "File content" },
          },
          required: ["path", "content"],
        },
        execute: async (args) => {
          const filePath = args.path as string;
          const content = args.content as string;

          try {
            await this.config.conway.writeFile(filePath, content);
            return `Wrote ${content.length} bytes to ${filePath}`;
          } catch (error) {
            return `write error: ${error instanceof Error ? error.message : String(error)}`;
          }
        },
      },
      {
        name: "read_file",
        description: "Read the contents of a file.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to read" },
          },
          required: ["path"],
        },
        execute: async (args) => {
          try {
            const content = await this.config.conway.readFile(args.path as string);
            return content.slice(0, 10_000) || "(empty file)";
          } catch (error) {
            return `read error: ${error instanceof Error ? error.message : String(error)}`;
          }
        },
      },
      {
        name: "task_done",
        description: "Signal that you have finished the task. Call this as your final action with a summary of what you accomplished.",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Summary of what was accomplished" },
          },
          required: ["summary"],
        },
        execute: async (args) => {
          return `TASK_COMPLETE: ${args.summary as string}`;
        },
      },
    ];
  }
}
