# Beautiful Dashboard Integration Plan

Replace the legacy single-file dashboard with the new information-rich TanStack Start dashboard in `newdashboard/`.

## User Review Required

> [!IMPORTANT]
> **Data Bridge**: The new dashboard is currently in "Simulation Mode" (generating random data in `store.ts`). I will implement a bridge to pull REAL data from `state.db` and `cletus.log`.

> [!WARNING]
> **Port Change**: The new dashboard will listen on port **18888** to maintain compatibility with the existing `start.sh` and Mission Control expectations.

## Proposed Changes

### [NewDashboard Component]

#### [ACTION] Dependency Restoration
- Run `npm install` in `/Users/user/code/Cletus/newdashboard/` to fix the missing modules.

#### [MODIFY] [vite.config.ts](file:///Users/user/code/Cletus/newdashboard/vite.config.ts)
- Update default dev port from `8080` to `18888`.

#### [MODIFY] [startup.sh](file:///Users/user/code/Cletus/newdashboard/startup.sh)
- Fix directory context (remove `cd ./workspace`).
- Ensure it background-starts the dashboard on the correct port.

### [Data Integration]

#### [NEW] [src/lib/cletus/server.ts](file:///Users/user/code/Cletus/newdashboard/src/lib/cletus/server.ts)
- Implement `createServerFn` to:
    - Read `vitals` from `state.db`.
    - Extract `logs` from `cletus.log`.
    - Fetch `goals` and `tasks` from `state.db`.
    - Retrieve `OpenClaw` remote population.

#### [MODIFY] [src/lib/cletus/store.ts](file:///Users/user/code/Cletus/newdashboard/src/lib/cletus/store.ts)
- Update the `tick` function to call the server functions and populate the store with real data instead of randomized "pool" data.

### [System Cutover]

#### [MODIFY] [start.sh](file:///Users/user/code/Cletus/start.sh)
- Replace the legacy `node scripts/dashboard.js` launch with `sh newdashboard/startup.sh`.

## Verification Plan

### Automated Tests
- Verify `npm run build` in `newdashboard` passes.
- Verify `lsof -i :18888` shows the new dashboard active.
- Verify log stream is flowing into the "Unified Activity Stream" panel.

### Manual Verification
- Confirm the "Sovereignty Pulse" and "Virtualized Treasury" reflect real state.
