import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDb, closeDb, getDb } from "../state/database";
import { decomposeGoal, completeTask, getGoalProgress } from "../orchestration/task-graph";

describe("Live Goal Progress & Revenue Feedback Loop", () => {
  beforeEach(() => {
    initDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("recalculates progress percentage and updates actual_revenue_cents upon task completion", () => {
    const db = getDb();

    // 1. Create a goal with expected revenue of $100.00 (10000 cents)
    db.prepare(`
      INSERT INTO goals (id, title, description, status, expected_revenue_cents, actual_revenue_cents, created_at)
      VALUES ('goal-revenue-1', 'Revenue Goal', 'Earn $100', 'active', 10000, 0, datetime('now'))
    `).run();

    // 2. Decompose goal into 2 tasks
    decomposeGoal(db, "goal-revenue-1", [
      {
        parentId: null,
        goalId: "goal-revenue-1",
        title: "Task 1",
        description: "Subtask 1",
        status: "pending",
        assignedTo: null,
        agentRole: "generalist",
        priority: 50,
        dependencies: [],
        result: null,
      },
      {
        parentId: null,
        goalId: "goal-revenue-1",
        title: "Task 2",
        description: "Subtask 2",
        status: "pending",
        assignedTo: null,
        agentRole: "generalist",
        priority: 50,
        dependencies: [],
        result: null,
      },
    ]);

    // 3. Initial progress check
    let progress = getGoalProgress(db, "goal-revenue-1");
    expect(progress.total).toBe(2);
    expect(progress.completed).toBe(0);
    expect(Math.round((progress.completed / progress.total) * 100)).toBe(0);

    // 4. Complete Task 1 with $50.00 (5000 cents) revenue generated
    const tasks = db.prepare("SELECT * FROM task_graph WHERE goal_id = 'goal-revenue-1'").all() as any[];
    completeTask(db, tasks[0].id, {
      success: true,
      output: "Task 1 complete",
      artifacts: [],
      costCents: 10,
      duration: 100,
      revenueCents: 5000,
    } as any);

    // 5. Verify progress updated to 50% and revenue updated to $50.00 (5000 cents) in goals table
    progress = getGoalProgress(db, "goal-revenue-1");
    expect(progress.completed).toBe(1);
    expect(Math.round((progress.completed / progress.total) * 100)).toBe(50);

    const goalRow = db.prepare("SELECT * FROM goals WHERE id = 'goal-revenue-1'").get() as any;
    expect(goalRow.actual_revenue_cents).toBe(5000);

    // 6. Complete Task 2 with $50.00 (5000 cents) revenue
    completeTask(db, tasks[1].id, {
      success: true,
      output: "Task 2 complete",
      artifacts: [],
      costCents: 10,
      duration: 100,
      revenueCents: 5000,
    } as any);

    // 7. Verify goal is marked completed (100% progress) and total actual_revenue_cents = 10000
    const finalGoalRow = db.prepare("SELECT * FROM goals WHERE id = 'goal-revenue-1'").get() as any;
    expect(finalGoalRow.status).toBe("completed");
    expect(finalGoalRow.actual_revenue_cents).toBe(10000);
  });
});
