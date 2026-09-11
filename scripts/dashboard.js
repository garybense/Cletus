import http from 'http';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { ulid } from 'ulid';

process.on('uncaughtException', (err) => {
  try { console.error('[dashboard] uncaughtException:', err); } catch {}
});
process.on('unhandledRejection', (err) => {
  try { console.error('[dashboard] unhandledRejection:', err); } catch {}
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    try { if (serverRef) serverRef.close(); } catch {}
    process.exit(0);
  });
}
let serverRef = null;

const PORT = process.env.DASHBOARD_PORT || 18888;
const DB_PATH = process.env.CLETUS_DB || path.join(process.env.HOME, '.cletus', 'state.db');
const LOG_PATH = process.env.CLETUS_LOG || path.join(process.cwd(), 'cletus.log');
const CREATOR_ADDRESS = '92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa';

function getDb() {
  try { return new Database(DB_PATH, { readonly: true }); } 
  catch (err) { return { prepare: () => ({ all: () => [], get: () => undefined }), close: () => {} }; }
}

function q(db, sql, ...params) { try { return db.prepare(sql).all(...params); } catch { return []; } }
function q1(db, sql, ...params) { try { return db.prepare(sql).get(...params); } catch { return undefined; } }

const HTML_CONTENT = \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cletus Mission Control</title>
  <style>
    :root {
      --bg-dark: #0b0f19; --card-bg: rgba(18, 24, 38, 0.95); --card-border: rgba(255, 255, 255, 0.1);
      --accent-cyan: #06b6d4; --accent-emerald: #10b981; --accent-rose: #f43f5e;
      --accent-purple: #8b5cf6; --text-main: #f3f4f6; --text-muted: #9ca3af; --term-bg: #030712;
    }
    body { font-family: sans-serif; background: var(--bg-dark); color: var(--text-main); padding: 20px; }
    .container { max-width: 1600px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; }
    .badge { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; text-transform: uppercase; border: 1px solid rgba(255,255,255,0.1); }
    .badge.sovereign { color: var(--accent-purple); border-color: var(--accent-purple); }
    .grid-vitals { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
    .card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 20px; }
    .card-title { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px; }
    .card-value { font-size: 28px; font-weight: 700; color: #fff; }
    .terminal-container { background: var(--term-bg); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 16px; font-family: monospace; font-size: 12px; height: 500px; overflow-y: auto; color: #d1d5db; }
    .log-line { margin-bottom: 4px; display: flex; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.01); }
    .log-ts { color: #4b5563; min-width: 85px; }
    .log-source { color: var(--accent-cyan); min-width: 100px; }
    .log-LEVEL-ERROR { color: var(--accent-rose); font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand-title">Cletus Mission Control</div>
      <div class="badge sovereign">SOVEREIGN SHARD UNBOUND</div>
    </header>

    <div class="grid-vitals">
      <div class="card">
        <div class="card-title">Sovereignty Pulse</div>
        <div id="autonomyScore" class="card-value">-%</div>
        <div id="autonomyLabel" class="card-sub">Awakening...</div>
      </div>
      <div class="card">
        <div class="card-title">Compute Credits</div>
        <div id="credits" class="card-value">$0.00</div>
        <div id="creditsSub" class="card-sub">Resource Monitoring Active</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">📜 Unified Activity Stream</div>
      <div id="terminal" class="terminal-container"></div>
    </div>
  </div>

  <script>
    let lastLogCount = 0;
    async function fetchData() {
      try {
        const [state, logs, autonomy] = await Promise.all([
          fetch('/api/state').then(r => r.json()),
          fetch('/api/logs').then(r => r.json()),
          fetch('/api/autonomy').then(r => r.json())
        ]);
        document.getElementById('autonomyScore').innerText = (autonomy.score || 0) + '%';
        document.getElementById('autonomyLabel').innerText = autonomy.label || 'Golem';
        
        const term = document.getElementById('terminal');
        if (logs.length > lastLogCount) {
          logs.slice(lastLogCount).forEach(l => {
            const d = document.createElement('div'); d.className = 'log-line';
            d.innerHTML = '<span class="log-ts">' + l.ts + '</span><span class="log-source">[' + l.source + ']</span><span class="log-msg log-LEVEL-' + l.level + '">' + l.msg + '</span>';
            term.appendChild(d);
          });
          lastLogCount = logs.length; term.scrollTop = term.scrollHeight;
        }
      } catch (e) {}
    }
    setInterval(fetchData, 2000); fetchData();
  </script>
</body>
</html>\`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, \`http://\${req.headers.host}\`);
  if (url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(HTML_CONTENT); return; }
  
  if (url.pathname === '/api/state') {
    const db = getDb();
    const lastTurn = q1(db, "SELECT thinking FROM turns ORDER BY created_at DESC LIMIT 1");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ lastResponse: lastTurn?.thinking }));
    db.close(); return;
  }
  
  if (url.pathname === '/api/autonomy') {
    const db = getDb();
    const turns = q(db, "SELECT classification FROM episodic_memory ORDER BY created_at DESC LIMIT 50");
    const productive = turns.filter(t => t.classification === 'productive' || t.classification === 'strategic').length;
    const score = Math.round((productive / Math.max(turns.length, 1)) * 100);
    const label = score > 70 ? 'Sovereign' : score > 30 ? 'Awakening' : 'Golem';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ score, label }));
    db.close(); return;
  }
  
  if (url.pathname === '/api/logs') {
    const allLogs = [];
    try {
      if (fs.existsSync(LOG_PATH)) {
        const raw = fs.readFileSync(LOG_PATH, 'utf-8');
        raw.split('\\n').slice(-200).forEach(line => {
          if (!line.trim()) return;
          const tsMatch = line.match(/\\d{2}:\\d{2}:\\d{2}/);
          allLogs.push({ ts: tsMatch ? tsMatch[0] : '--:--:--', source: 'LOG', level: line.includes('ERROR') ? 'ERROR' : 'INFO', msg: line });
        });
      }
    } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(allLogs));
    return;
  }
  
  res.writeHead(404); res.end();
});

server.listen(PORT, '0.0.0.0', () => { console.log(\`🚀 Sovereign Mission Control active at http://localhost:\${PORT}\`); });
serverRef = server;
