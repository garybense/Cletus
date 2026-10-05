# Sovereign Fleet Regulation: Hard Trim & Stability

This plan enforces a hard ceiling of **3** active child agents to ensure server stability and resource efficiency.

## User Review Required

> [!IMPORTANT]
> **Immediate Fleet Trim**: I am performing an immediate "Hard Trim" of the current fleet. 11 of the 14 currently active agents will be decommissioned, leaving only the 3 most recent/vital ones.

> [!NOTE]
> **Fleet Scaling Invariant**: The `maxLiveAgents` limit is now set to 3. Cletus will be unable to spawn new agents until the count drops below this ceiling.

## Proposed Changes

### [Fleet Regulation]

#### [ACTION] Immediate Fleet Trimming
- Execute `SovereignShard/trim_fleet.py`:
    - List all `healthy/running` agents.
    - Keep the 3 most recently spawned agents.
    - Force-delete the rest via the `openclaw` CLI and database removal.

#### [MODIFY] [fleet-lifecycle.ts](file:///Users/user/code/Cletus/src/agent/policy-rules/fleet-lifecycle.ts)
- [x] Set `maxLiveAgents: 3`.

#### [MODIFY] [child-monitor.ts](file:///Users/user/code/Cletus/src/child-monitor.ts)
- Implement `enforceFleetCeiling()`: A background check that automatically prunes the oldest healthy agents if the count exceeds `FLEET_LIMITS.maxLiveAgents`.

### [Soul & Identity]

#### [MODIFY] [SOUL.md](file:///Users/user/.cletus/SOUL.md)
- Update "Capabilities" to reflect the new resource-conscious posture: "Fleet Command: Efficient oversight of up to 3 specialized Clawbots."

## Verification Plan

### Automated Tests
- Verify that `sqlite3 state.db "SELECT count(*) FROM children WHERE status='healthy'"` returns exactly 3 after trimming.

### Manual Verification
- I will verify the deletion of agents from the OpenClaw gateway via `openclaw agents list`.
- I will confirm Cletus receives a `FLEET_FULL` denial when attempting a 4th spawn.
