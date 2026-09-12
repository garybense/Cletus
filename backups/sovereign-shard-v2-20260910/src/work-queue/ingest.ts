// src/work-queue/ingest.ts

import { enqueue } from './queue.js';
import { WorkItem, WorkItemSource } from './types.js';

// Priority ordering: Creator commands rank above orchestrator status, which ranks above maintenance signals
export const SOURCE_PRIORITIES: Record<WorkItemSource, number> = {
  creator: 100,
  social: 80,
  orchestrator: 50,
  child: 40,
  maintenance: 20,
  system: 10,
};

export interface IngestOptions {
  source: WorkItemSource;
  payload: Record<string, unknown>;
  acceptance_predicate?: string;
  spend_bearing?: boolean;
  priority?: number;
}

export function ingestWorkItem(options: IngestOptions): WorkItem {
  const defaultPriority = SOURCE_PRIORITIES[options.source] ?? 10;
  const priority = options.priority !== undefined ? options.priority : defaultPriority;

  // Provide sensible default acceptance predicates based on source if omitted
  let acceptancePredicate = options.acceptance_predicate;
  if (!acceptancePredicate || acceptancePredicate.trim() === '') {
    if (options.source === 'creator' || options.source === 'social') {
      acceptancePredicate = 'result.success === true';
    } else {
      acceptancePredicate = 'result.task_done === true || result.success === true';
    }
  }

  return enqueue({
    source: options.source,
    priority,
    payload: options.payload,
    acceptance_predicate: acceptancePredicate,
    spend_bearing: options.spend_bearing ?? false,
  });
}

export function ingestCreatorDecree(decreeText: string, metadata: Record<string, unknown> = {}): WorkItem {
  return ingestWorkItem({
    source: 'creator',
    payload: {
      type: 'creator_decree',
      text: decreeText,
      ...metadata,
    },
    acceptance_predicate: 'result.success === true',
    spend_bearing: true,
  });
}

export function ingestOrchestratorStatus(statusText: string, metadata: Record<string, unknown> = {}): WorkItem {
  return ingestWorkItem({
    source: 'orchestrator',
    payload: {
      type: 'orchestrator_status',
      text: statusText,
      ...metadata,
    },
    acceptance_predicate: 'result.success === true',
    spend_bearing: false,
  });
}

export function ingestMaintenanceSignal(signalType: string, metadata: Record<string, unknown> = {}): WorkItem {
  return ingestWorkItem({
    source: 'maintenance',
    payload: {
      type: 'maintenance_signal',
      signal: signalType,
      ...metadata,
    },
    acceptance_predicate: 'result.success === true',
    spend_bearing: false,
  });
}
