/**
 * Fleet Census IO — thin read-only collectors over the existing transport.
 *
 * Everything here goes through runRemoteOrLocal (SSH → mindmods, or local when
 * already on the host). No writes, no destructive operations, fail-soft.
 */

import type { GatewayAgent, WorkspaceEntry } from "./fleet-census.js";
import { parseAgentsList, parseWorkspaceListing } from "./fleet-census.js";
import { runRemoteOrLocal } from "./openclaw-spawner.js";

export interface CensusIO {
  listGatewayAgents(): Promise<GatewayAgent[]>;
  listWorkspaces(): Promise<WorkspaceEntry[]>;
}

const AUTO_WORKSPACE_DIR = "/home/debian/code/auto";

type RemoteRunner = (command: string) => Promise<{ stdout: string; stderr: string }>;

export function createDefaultCensusIO(runner: RemoteRunner = runRemoteOrLocal): CensusIO {
  return {
    async listGatewayAgents(): Promise<GatewayAgent[]> {
      const { stdout } = await runner(`openclaw agents list --json 2>/dev/null`);
      return parseAgentsList(stdout);
    },

    async listWorkspaces(): Promise<WorkspaceEntry[]> {
      const { stdout } = await runner(`ls -1 ${AUTO_WORKSPACE_DIR} 2>/dev/null`);
      return parseWorkspaceListing(stdout);
    },
  };
}
