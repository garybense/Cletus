import { execFileSync } from 'child_process';
import http from 'http';
import path from 'path';

const WORKSPACE_DIR = process.env.CLETUS_WORKSPACE || process.cwd();

// Start dashboard in background
const child = execFileSync('node', ['scripts/dashboard.js'], {
  cwd: WORKSPACE_DIR,
  stdio: ['pipe', 'pipe', 'pipe'],
  timeout: 15000,
});

// Give it a moment
await new Promise(r => setTimeout(r, 1500));

// Try to connect
const start = Date.now();
try {
  const resp = await new Promise((resolve, reject) => {
    const req = http.get('http://localhost:18888/api/state', { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('connection timeout')));
  });
  console.log('RESPONSE:', resp.status, resp.body.substring(0, 300));
} catch (e) {
  console.log('CONNECT ERROR:', e.message);
}

// Kill dashboard
try { child.kill('SIGTERM'); } catch {}
console.log('Done');
