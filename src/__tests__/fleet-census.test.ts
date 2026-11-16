/**
 * Fleet Census Tests
 *
 * Covers the read-only reconciliation layer built after the 2026-09-13 census:
 * 493 registry rows vs 13 host workspaces vs 2 gateway agents. The reconciler
 * must classify phantom/duplicate/confirmed children and rank destroy
 * candidates without any I/O, and the collectors must fail soft.
 */

import { describe, it, expect } from "vitest";
import {
  agentNameFromChild,
  parseAgentsList,
  parseWorkspaceListing,
  rankDestroyCandidates,
  reconcileCensus,
  registryChildrenFromDb,
  gatherFleetCensus,
  type GatewayAgent,
  type RegistryChild,
  type WorkspaceEntry,
} from "../replication/fleet-census.js";

function reg(
  id: string,
  name: string,
  status = "stopped",
  sandboxId?: string,
): RegistryChild {
  const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return {
    id,
    name,
    status,
    sandboxId: sandboxId ?? `openclaw:${slug}`,
    createdAt: "2026-09-10T00:00:00.000Z",
  };
}

describe("agentNameFromChild", () => {
  it("prefers the openclaw sandbox prefix", () => {
    expect(
      agentNameFromChild(reg("1", "Bounty Hunter", "healthy", "openclaw:bounty-hunter")),
    ).toBe("bounty-hunter");
  });

  it("falls back to the spawn-time slug", () => {
    expect(agentNameFromChild(reg("2", "Bounty Hunter"))).toBe("bounty-hunter");
  });

  it("returns a slug even for punctuation-only names", () => {
    expect(agentNameFromChild({ id: "3", name: "###", status: "stopped", sandboxId: null, createdAt: "" })).toBe("---");
  });
});

describe("reconcileCensus", () => {
  const gateway: GatewayAgent[] = [
    { id: "main", workspace: "/home/debian/.openclaw/workspace" },
    { id: "mudge-recon" },
    { id: "bounty-hunter-1" },
  ];
  const workspaces: WorkspaceEntry[] = [
    { name: "bounty-hunter-1" },
    { name: "greeter-child" },
  ];

  it("classifies confirmed / workspace_only / phantom", () => {
    const census = reconcileCensus(
      [
        reg("a1", "main", "healthy", "openclaw:main"),
        reg("a2", "bounty-hunter-1", "healthy", "openclaw:bounty-hunter-1"),
        reg("a3", "greeter-child", "healthy", "openclaw:greeter-child"),
        reg("a4", "ghost-agent", "healthy", "openclaw:ghost-agent"),
      ],
      gateway,
      workspaces,
    );

    const byId = new Map(census.children.map((c) => [c.id, c]));
    expect(byId.get("a1")?.reconcile).toBe("phantom"); // gateway yes, workspace no
    expect(byId.get("a2")?.reconcile).toBe("confirmed");
    expect(byId.get("a3")?.reconcile).toBe("workspace_only");
    expect(byId.get("a4")?.reconcile).toBe("phantom");

    expect(census.summary).toMatchObject({
      registered: 4,
      confirmed: 1,
      workspaceOnly: 1,
      phantom: 2,
      gatewayAgents: 3,
      workspaces: 2,
      duplicates: 0,
    });
  });

  it("flags duplicate names across the whole registry", () => {
    const census = reconcileCensus(
      [
        reg("d1", "bounty-hunter-1", "stopped", "openclaw:bounty-hunter-1"),
        reg("d2", "bounty-hunter-1", "stopped", "openclaw:bounty-hunter-1"),
      ],
      gateway,
      workspaces,
    );
    for (const child of census.children) {
      expect(child.nameCount).toBe(2);
    }
    expect(census.summary.duplicates).toBe(1);
  });
});

describe("rankDestroyCandidates", () => {
  it("ranks phantoms before duplicates before workspace_only", () => {
    const census = reconcileCensus(
      [
        reg("w1", "greeter-child", "healthy", "openclaw:greeter-child"),
        reg("p1", "ghost", "stopped", "openclaw:ghost"),
        reg("d1", "bounty-hunter-2", "stopped", "openclaw:bounty-hunter-2"),
        reg("d2", "bounty-hunter-2", "stopped", "openclaw:bounty-hunter-2"),
      ],
      [{ id: "main" }],
      [{ name: "greeter-child" }, { name: "bounty-hunter-2" }],
    );

    const ranks = census.candidates.map((c) => c.rank);
    expect(ranks).toEqual([1, 2, 2, 3]);
    expect(census.candidates[0].id).toBe("p1");
    expect(census.candidates.every((c) => !c.protected)).toBe(true);
  });

  it("never proposes protected or confirmed agents", () => {
    const census = reconcileCensus(
      [
        reg("m1", "main", "healthy", "openclaw:main"),
        reg("mr", "mudge-recon", "healthy", "openclaw:mudge-recon"),
        reg("ok", "bounty-hunter-1", "healthy", "openclaw:bounty-hunter-1"),
        reg("bad", "ghost", "stopped", "openclaw:ghost"),
      ],
      [{ id: "main" }, { id: "mudge-recon" }, { id: "bounty-hunter-1" }],
      [{ name: "bounty-hunter-1" }, { name: "main" }, { name: "mudge-recon" }],
    );

    const ids = census.candidates.map((c) => c.id);
    expect(ids).toEqual(["bad"]);
    expect(census.candidates[0].reasons.join(" ")).toContain("phantom");
  });

  it("notes stale healthy status as supporting evidence", () => {
    const census = reconcileCensus(
      [reg("s1", "ghost", "healthy", "openclaw:ghost")],
      [],
      [],
    );
    expect(census.candidates[0].reasons.some((r) => r.includes("stale"))).toBe(true);
  });
});

describe("parsers", () => {
  it("parses `openclaw agents list --json` output", () => {
    const stdout = `[
      {"id":"main","name":"main","model":"nvidia/nemotron-3-super-120b-a12b","workspace":"/home/debian/.openclaw/workspace"},
      {"id":"mudge-recon","name":"mudge-recon"}
    ]`;
    const agents = parseAgentsList(stdout);
    expect(agents).toHaveLength(2);
    expect(agents[0]).toMatchObject({ id: "main", model: "nvidia/nemotron-3-super-120b-a12b" });
  });

  it("tolerates non-JSON agent output", () => {
    expect(parseAgentsList("openclaw: command not found")).toEqual([]);
  });

  it("parses workspace listings and drops paths", () => {
    expect(parseWorkspaceListing("bounty-hunter-1\ngreeter-child\n/home/debian\n")).toEqual([
      { name: "bounty-hunter-1" },
      { name: "greeter-child" },
    ]);
  });
});

describe("registryChildrenFromDb", () => {
  it("maps the camelCase ChildCletus rows to the census view", () => {
    const rows = [
      { id: "x1", name: "Main", status: "healthy", sandboxId: "openclaw:main", createdAt: "t1" },
      { id: "x2", name: "Ghost", status: "stopped", sandboxId: undefined, createdAt: "t2" },
    ] as never[];
    const view = registryChildrenFromDb({ getChildren: () => rows } as never);
    expect(view).toEqual([
      { id: "x1", name: "Main", status: "healthy", sandboxId: "openclaw:main", createdAt: "t1" },
      { id: "x2", name: "Ghost", status: "stopped", sandboxId: null, createdAt: "t2" },
    ]);
  });
});

describe("gatherFleetCensus", () => {
  it("degrades to registry-only when collectors fail (conservative)", async () => {
    const census = await gatherFleetCensus([reg("g1", "phantom-kid")], {
      listGatewayAgents: async () => {
        throw new Error("ssh timeout");
      },
      listWorkspaces: async () => {
        throw new Error("ssh timeout");
      },
    });

    expect(census.summary.gatewayAgents).toBe(0);
    expect(census.summary.phantom).toBe(1);
    expect(census.candidates[0]?.reconcile).toBe("phantom");
  });

  it("combines live collector output", async () => {
    const census = await gatherFleetCensus(
      [reg("l1", "bounty-hunter-1", "healthy", "openclaw:bounty-hunter-1")],
      {
        listGatewayAgents: async () => [{ id: "main" }, { id: "bounty-hunter-1" }],
        listWorkspaces: async () => [{ name: "bounty-hunter-1" }],
      },
    );
    expect(census.summary.confirmed).toBe(1);
    expect(census.candidates).toHaveLength(0);
  });
});
