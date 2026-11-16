/**
 * Sovereign C2 Plane: Canonical Event-Sourced Schema Definitions
 * Defines root Trace_ID, child Span_ID, cryptographic workload identity signatures,
 * DAG causality relationships, payload envelopes, and state mutation diffs.
 * Includes Section 2 Parity Checklist ensuring 100% feature coverage across all Cletus capabilities.
 */

export interface FeatureParityChecklist {
  heterogeneousMultiModelFleetAccess: boolean;
  legionSwarm12ModelRoster: boolean;
  singleSourceConfigEngine: boolean;
  entelechyMemoryMetabolism: boolean;
  spireWorkloadIdentity: boolean;
  headscaleDerpRelay: boolean;
  nebulaLighthouseDiscovery: boolean;
  swarmTriageEngine: boolean;
  reTraceFastPathCaching: boolean;
  reSearchIdeationConsensus: boolean;
  taskPrunerMaintenance: boolean;
  arxivGithubResearchScout: boolean;
}

export const C2_FEATURE_PARITY_CHECKLIST: FeatureParityChecklist = {
  heterogeneousMultiModelFleetAccess: true,
  legionSwarm12ModelRoster: true,
  singleSourceConfigEngine: true,
  entelechyMemoryMetabolism: true,
  spireWorkloadIdentity: true,
  headscaleDerpRelay: true,
  nebulaLighthouseDiscovery: true,
  swarmTriageEngine: true,
  reTraceFastPathCaching: true,
  reSearchIdeationConsensus: true,
  taskPrunerMaintenance: true,
  arxivGithubResearchScout: true,
};

export type C2InteractionChannel = "LLM_INFERENCE" | "MCP_JSONRPC" | "A2A_HANDOFF" | "STATE_MUTATION";

export interface C2EventEnvelope {
  traceId: string;          // Root intent ID
  spanId: string;           // Current execution node ID
  parentSpanId?: string;    // Parent node ID forming DAG causality
  channel: C2InteractionChannel;
  actorNodeId: string;
  targetEndpoint: string;
  action: string;
  spiffeSignature: string;  // Cryptographic workload identity
  payload: Record<string, unknown>;
  stateDiff?: {
    beforeHash: string;
    afterHash: string;
    mutatedKeys: string[];
  };
  durationMs: number;
  statusCode: number;
  timestamp: string;
}
