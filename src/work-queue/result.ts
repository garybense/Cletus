// src/work-queue/result.ts

import { WorkItem, WorkResult } from './types';
import { complete, fail } from './queue';

export function recordWorkResult(workItemId: string, result: WorkResult): { success: boolean; item: WorkItem } {
  return complete(workItemId, result);
}

export function recordWorkError(workItemId: string, error: string): WorkItem {
  return fail(workItemId, error);
}
