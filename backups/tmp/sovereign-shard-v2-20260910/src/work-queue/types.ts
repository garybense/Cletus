// src/work-queue/types.ts

export type WorkItemStatus = 'pending' | 'claimed' | 'completed' | 'failed' | 'expired';

export type WorkItemSource = 'creator' | 'orchestrator' | 'maintenance' | 'social' | 'child' | 'system';

export interface WorkItem {
  id: string;
  source: WorkItemSource;
  priority: number; // Higher number = higher priority
  payload: Record<string, unknown>;
  acceptance_predicate: string; // Required predicate string or JS condition/expression
  spend_bearing: boolean;
  status: WorkItemStatus;
  claimed_by?: string;
  lease_expires_at?: number;
  result?: WorkResult;
  error?: string;
  created_at: number;
  updated_at: number;
}

export interface WorkResult {
  success: boolean;
  output?: unknown;
  task_done?: boolean;
  data?: Record<string, unknown>;
  error?: string;
  timestamp: number;
}

export interface EnqueueWorkItemInput {
  source: WorkItemSource;
  priority?: number;
  payload: Record<string, unknown>;
  acceptance_predicate: string; // Required! Enqueue fails if missing or empty
  spend_bearing?: boolean;
}
