import fs from 'fs';

const files = [
  'src/__tests__/work-queue.test.ts',
  'src/__tests__/scheduler-work-dispatch.test.ts',
  'src/__tests__/inbox-ingestion.test.ts',
  'src/__tests__/executor.test.ts',
  'src/__tests__/orchestrator-decoupling.test.ts',
  'src/__tests__/financial-gate.test.ts',
  'src/__tests__/child-result.test.ts',
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let text = fs.readFileSync(file, 'utf-8');
  text = text.replace(/from '(\.\.|\.)\/work-queue\/types'/g, "from '$1/work-queue/types.js'");
  text = text.replace(/from '(\.\.|\.)\/work-queue\/queue'/g, "from '$1/work-queue/queue.js'");
  text = text.replace(/from '(\.\.|\.)\/work-queue\/ingest'/g, "from '$1/work-queue/ingest.js'");
  text = text.replace(/from '(\.\.|\.)\/work-queue\/executor'/g, "from '$1/work-queue/executor.js'");
  text = text.replace(/from '(\.\.|\.)\/state\/database'/g, "from '$1/state/database.js'");
  text = text.replace(/from '(\.\.|\.)\/heartbeat\/scheduler'/g, "from '$1/heartbeat/scheduler.js'");
  text = text.replace(/from '(\.\.|\.)\/heartbeat\/tasks'/g, "from '$1/heartbeat/tasks.js'");
  text = text.replace(/from '(\.\.|\.)\/replication\/result-envelope'/g, "from '$1/replication/result-envelope.js'");
  text = text.replace(/from '(\.\.|\.)\/agent\/loop'/g, "from '$1/agent/loop.js'");
  fs.writeFileSync(file, text, 'utf-8');
}
console.log('Fixed test file relative imports');
