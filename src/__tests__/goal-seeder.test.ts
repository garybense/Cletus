import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initDb, closeDb, getDb } from "../state/database";
import { seedDefaultGoals, DEFAULT_MISSION_GOALS } from "../orchestration/goal-seeder";
import { Orchestrator } from "../orchestration/orchestrator";
import { getActiveGoals } from "../state/database";

describe("Autonomous Goal Seeder", () => {
  beforeEach(() => {
    initDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("seeds default mission goals when goals table has no active goals", () => {
    const db = getDb();

    // Verify 0 active goals initially
    expect(getActiveGoals(db)).toHaveLength(0);

    // Call seedDefaultGoals
    const seeded = seedDefaultGoals(db);
    expect(seeded.length).toBe(DEFAULT_MISSION_GOALS.length);

    // Verify active goals in state.db
    const active = getActiveGoals(db);
    expect(active.length).toBe(DEFAULT_MISSION_GOALS.length);
    expect(active[0].title).toBe("Scout & Execute High-Utility Bounties");
  });

  it("does not re-seed when active goals already exist", () => {
    const db = getDb();

    // Seed once
    seedDefaultGoals(db);
    expect(getActiveGoals(db)).toHaveLength(DEFAULT_MISSION_GOALS.length);

    // Seed again — should return empty array and maintain original count
    const secondSeed = seedDefaultGoals(db);
    expect(secondSeed).toHaveLength(0);
    expect(getActiveGoals(db)).toHaveLength(DEFAULT_MISSION_GOALS.length);
  });

  it("orchestrator automatically triggers goal seeder when idle with 0 active goals", async () => {
    const db = getDb();
    expect(getActiveGoals(db)).toHaveLength(0);

    const mockAgentTracker: any = {
      getIdle: () => [{ address: "0xparent", name: "parent", role: "generalist" }],
      getBestForTask: () => ({ address: "0xparent", name: "parent" }),
      updateStatus: vi.fn(),
    };

    const orchestrator = new Orchestrator({
      db,
      agentTracker: mockAgentTracker,
      funding: { fundChild: vi.fn() } as any,
      messaging: { processInbox: vi.fn().mockResolvedValue([]) } as any,
      inference: {} as any,
      identity: { address: "0xparent" } as any,
      config: {},
    });

    // Run tick while idle with 0 goals
    const tickResult = await orchestrator.tick();

    // Should automatically seed default goals and transition from idle -> classifying
    expect(tickResult.phase).toBe("classifying");

    const activeGoals = getActiveGoals(db);
    expect(activeGoals.length).toBeGreaterThan(0);
    expect(activeGoals[0].title).toBe("Scout & Execute High-Utility Bounties");
  });
});
