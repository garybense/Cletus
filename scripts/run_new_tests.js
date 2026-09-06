import fs from 'fs';
import { execSync } from 'child_process';

try {
  const output = execSync('npx vitest run src/__tests__/work-queue.test.ts src/__tests__/scheduler-work-dispatch.test.ts src/__tests__/inbox-ingestion.test.ts src/__tests__/executor.test.ts src/__tests__/orchestrator-decoupling.test.ts src/__tests__/financial-gate.test.ts src/__tests__/child-result.test.ts', { encoding: 'utf-8' });
  console.log(output);
} catch (err: any) {
  console.log('STDOUT:', err.stdout);
  console.log('STDERR:', err.stderr);
}
