/**
 * Google AgentMesh Protocol Client
 * Client connector for communicating with remote AgentMesh peer nodes.
 */

import { createLogger } from "../observability/logger.js";

const logger = createLogger("agentmesh-client");

export interface AgentMeshEnvelope {
  protocolVersion: "1.0-agentmesh";
  senderNodeId: string;
  recipientNodeId: string;
  messageType: "DISCOVERY" | "TASK_MIGRATION" | "SWARM_CONSENSUS";
  payload: Record<string, unknown>;
}

export class AgentMeshClient {
  constructor(private readonly nodeId: string, private readonly endpointUrl: string) {}

  async sendEnvelope(targetUrl: string, envelope: AgentMeshEnvelope): Promise<{ success: boolean; ack: any }> {
    logger.info(`[AGENTMESH-CLIENT] Transmitting ${envelope.messageType} envelope to ${targetUrl}...`);

    try {
      const resp = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-AgentMesh-Node-ID": this.nodeId },
        body: JSON.stringify(envelope),
        signal: AbortSignal.timeout(5000),
      });

      if (!resp.ok) {
        throw new Error(`AgentMesh transport error (${resp.status}): ${await resp.text()}`);
      }

      const ack = await resp.json();
      return { success: true, ack };
    } catch (err: any) {
      logger.warn(`[AGENTMESH-CLIENT] Delivery failed to ${targetUrl}: ${err?.message}`);
      return { success: false, ack: null };
    }
  }
}
