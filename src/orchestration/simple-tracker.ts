import { ulid } from "ulid";
import type {
  AutomatonDatabase,
  AutomatonIdentity,
  ChildStatus,
  ConwayClient,
} from "../types.js";
import type { AgentTracker, FundingProtocol } from "./types.js";

const IDLE_STATUSES = new Set<ChildStatus>(["running", "healthy"]);

export class SimpleAgentTracker implements AgentTracker {
  constructor(private readonly db: AutomatonDatabase) {}

  getIdle(): { address: string; name: string; role: string; status: string }[] {
    const assignedRows = this.db.raw.prepare(
      `SELECT DISTINCT assigned_to AS address
       FROM task_graph
       WHERE assigned_to IS NOT NULL
         AND status IN ('assigned', 'running')`,
    ).all() as { address: string }[];

    const assignedAddresses = new Set(
      assignedRows
        .map((row) => row.address)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    );

    const children = this.db.raw.prepare(
      `SELECT id, name, address, status, COALESCE(role, 'generalist') AS role
       FROM children
       WHERE status IN ('running', 'healthy')`,
    ).all() as { id: string; name: string; address: string; status: string; role: string }[];

    return children
      .filter((child) => IDLE_STATUSES.has(child.status as ChildStatus) && !assignedAddresses.has(child.address))
      .map((child) => ({
        address: child.address,
        name: child.name,
        role: child.role,
        status: child.status,
      }));
  }

  getBestForTask(_role: string): { address: string; name: string } | null {
    const idle = this.getIdle();
    if (idle.length === 0) {
      return null;
    }

    return {
      address: idle[0].address,
      name: idle[0].name,
    };
  }

  updateStatus(address: string, status: string): void {
    const child = this.db.getChildren().find((entry) => entry.address === address);
    if (!child) {
      return;
    }

    this.db.updateChildStatus(child.id, status as ChildStatus);
  }

  register(agent: { address: string; name: string; role: string; sandboxId: string }): void {
    this.db.insertChild({
      id: ulid(),
      name: agent.name,
      address: agent.address as `0x${string}`,
      sandboxId: agent.sandboxId,
      genesisPrompt: `Role: ${agent.role}`,
      creatorMessage: "registered by orchestrator",
      fundedAmountCents: 0,
      status: "running",
      createdAt: new Date().toISOString(),
    });
  }
}

export class SimpleFundingProtocol implements FundingProtocol {
  constructor(
    private readonly conway: ConwayClient,
    private readonly identity: AutomatonIdentity,
  ) {}

  async fundChild(childAddress: string, amountCents: number): Promise<{ success: boolean }> {
    const transferAmount = Math.max(0, Math.floor(amountCents));
    if (transferAmount === 0) {
      return { success: true };
    }

    try {
      const result = await this.conway.transferCredits(
        childAddress,
        transferAmount,
        "Task funding from orchestrator",
      );

      return { success: isTransferSuccessful(result.status) };
    } catch {
      return { success: false };
    }
  }

  async recallCredits(childAddress: string): Promise<{ success: boolean; amountCents: number }> {
    const balance = await this.getBalance(childAddress);
    const amountCents = Math.max(0, Math.floor(balance));

    if (amountCents === 0) {
      return { success: true, amountCents: 0 };
    }

    try {
      const result = await this.conway.transferCredits(
        this.identity.address,
        amountCents,
        `Recall credits from ${childAddress}`,
      );

      return {
        success: isTransferSuccessful(result.status),
        amountCents: result.amountCents ?? amountCents,
      };
    } catch {
      return { success: false, amountCents: 0 };
    }
  }

  async getBalance(_childAddress: string): Promise<number> {
    return this.conway.getCreditsBalance();
  }
}

function isTransferSuccessful(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized.length > 0
    && !normalized.includes("fail")
    && !normalized.includes("error")
    && !normalized.includes("reject");
}
