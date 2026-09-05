import { execFileSync } from 'child_process';
import path from 'path';

const WORKSPACE_DIR = process.env.CLETUS_WORKSPACE || process.cwd();
try {
  console.log('Starting dashboard...');
  const result = execFileSync('node', ['scripts/dashboard.js'], {
    cwd: WORKSPACE_DIR,
    timeout: 10000,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  console.log('STDOUT:', result);
} catch (e) {
  console.log('ERROR:', e.message);
  if (e.stderr) console.log('STDERR:', e.stderr.substring(0, 2000));
  if (e.stdout) console.log('STDOUT:', e.stdout.substring(0, 500));
  console.log('KILLED:', e.killed);
  console.log('TIMEDOUT:', e.killed === true);
}
