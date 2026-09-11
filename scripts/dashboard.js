import http from 'http';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { ulid } from 'ulid';

process.on('uncaughtException', (err) => {
  try { console.error('[dashboard] uncaughtException:', (err && (err.code || err.message)) || err); } catch {}
});
process.on('unhandledRejection', (err) => {
  try { console.error('[dashboard] unhandledRejection:', (err && (err.code || err.message)) || err); } catch {}
});

process.on('SIGHUP', () => {
  try { console.log('[dashboard] SIGHUP received — ignoring'); } catch {}
});
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    try { if (serverRef) serverRef.close(() => process.exit(0)); else process.exit(0); } catch { process.exit(0); }
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
let serverRef = null;

const PORT = process.env.DASHBOARD_PORT || 18888;
const DB_PATH = process.env.CLETUS_DB || path.join(process.env.HOME, '.cletus', 'state.db');
const LOG_PATH = process.env.CLETUS_LOG || path.join(process.cwd(), 'cletus.log');
const CREATOR_ADDRESS = '92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa';

function getDb() {
  try { return new Database(DB_PATH, { readonly: false }); }
  catch (err) { return { prepare: () => ({ all: () => [], get: () => undefined, run: () => ({}) }), close: () => {} }; }
}

function q(db, sql, ...params) { try { return db.prepare(sql).all(...params); } catch { return []; } }
function q1(db, sql, ...params) { try { return db.prepare(sql).get(...params); } catch { return undefined; } }

let openclawSnapshot = { agents: [], error: null, refreshedAt: null };
let openclawRefreshing = false;

async function refreshOpenclawSnapshot() {
  if (openclawRefreshing) return;
  openclawRefreshing = true;
  try {
    const { execFile } = await import('child_process');
    const ssh = (remoteCmd) => new Promise((resolve) => {
      execFile('ssh', ['-o', 'ConnectTimeout=5', '-o', 'BatchMode=yes', 'debian@mindmods.org', remoteCmd], (err, stdout) => {
        resolve(err ? '' : String(stdout || ''));
      });
    });

    const statusStr = await ssh('ls ~/.openclaw/agents/*.json 2>/dev/null | xargs cat 2>/dev/null');
    let agents = [];
    if (statusStr.trim()) {
      try {
        if (statusStr.trim().startsWith('[')) agents = JSON.parse(statusStr);
        else agents = statusStr.split('}{').map((s, i, a) => {
          if (i === 0) s = s + '}'; else if (i === a.length - 1) s = '{' + s; else s = '{' + s + '}';
          return JSON.parse(s);
        });
      } catch { agents = []; }
    }
    openclawSnapshot = { agents, refreshedAt: new Date().toISOString() };
  } catch (err) { openclawSnapshot.error = err.message; }
  finally { openclawRefreshing = false; }
}
setInterval(refreshOpenclawSnapshot, 60000);
refreshOpenclawSnapshot();

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cletus Mission Control</title>
  <style>
    :root {
      --bg-dark: #0b0f19; --card-bg: rgba(18, 24, 38, 0.95); --card-border: rgba(255, 255, 255, 0.1);
      --accent-cyan: #06b6d4; --accent-emerald: #10b981; --accent-amber: #f59e0b;
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
    .main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .item-list { display: flex; flex-direction: column; gap: 8px; max-height: 450px; overflow-y: auto; }
    .item-card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 12px 16px; }
    .terminal-container { background: var(--term-bg); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 16px; font-family: monospace; font-size: 12px; height: 500px; overflow-y: auto; color: #d1d5db; }
    .log-line { margin-bottom: 4px; display: flex; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.01); }
    .log-ts { color: #4b5563; min-width: 85px; }
    .log-source { color: var(--accent-cyan); min-width: 100px; }
    .log-LEVEL-THOUGHT { color: #6ee7b7; font-style: italic; }
    .response-box { background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 16px; }
    .decree-box { border: 1px solid rgba(139, 92, 246, 0.4); background: rgba(18, 24, 38, 0.95); border-radius: 12px; padding: 16px; }
    .suggestion-box { display: flex; gap: 10px; margin-top: 10px; }
    .input-field { flex: 1; background: #000; border: 1px solid var(--card-border); border-radius: 8px; padding: 10px 14px; color: #fff; }
    .btn { background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple)); color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-weight: 600; cursor: pointer; }
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
        <div class="card-title">Virtualized Treasury</div>
        <div class="card-value">$10,000.00</div>
        <div class="card-sub">Virtual Elite Baseline (Test)</div>
      </div>
      <div class="card">
        <div class="card-title">Remote Population</div>
        <div id="remoteCount" class="card-value">0</div>
        <div class="card-sub">Agents on mindmods.org</div>
      </div>
    </div>

    <div id="bridge" class="response-box" style="display: none;">
      <div class="card-title" style="color: var(--accent-emerald);">The Sovereign Response</div>
      <div id="resp" style="font-family: monospace; font-size: 13px;"></div>
    </div>

    <div class="decree-box">
      <div class="card-title" style="color: #c084fc;">⚡ Bicameral Coordination Channel (Decrees)</div>
      <form id="suggestForm" class="suggestion-box">
        <input type="text" id="suggestInput" class="input-field" placeholder="Issue sovereign decree...">
        <button type="submit" class="btn">Issue Decree</button>
      </form>
    </div>

    <div class="main-grid">
      <div class="card">
        <div class="card-title">🙏 Coordination Messaging (Inbox)</div>
        <div id="msgList" class="item-list"></div>
      </div>
      <div class="card">
        <div class="card-title">🤖 Live Remote Agents (OpenClaw)</div>
        <div id="remoteList" class="item-list"></div>
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
        const [state, logs, autonomy, openclaw] = await Promise.all([
          fetch('/api/state').then(r => r.json()), fetch('/api/logs').then(r => r.json()),
          fetch('/api/autonomy').then(r => r.json()), fetch('/api/openclaw').then(r => r.json())
        ]);
        document.getElementById('remoteCount').innerText = (openclaw.agents || []).length;
        document.getElementById('autonomyScore').innerText = (autonomy.score || 0) + '%';
        document.getElementById('autonomyLabel').innerText = autonomy.label || 'Golem';
        if (state.lastResponse) {
          document.getElementById('bridge').style.display = 'block';
          document.getElementById('resp').innerText = state.lastResponse;
        }
        document.getElementById('msgList').innerHTML = (state.messages || []).map(m => \`
          <div class="item-card">
            <div style="font-size:11px; color:var(--accent-purple);">From: \${m.from_address}</div>
            <div style="font-size:13px; margin-top:4px;">\${m.content}</div>
          </div>
        \`).join('');
        document.getElementById('remoteList').innerHTML = (openclaw.agents || []).map(a => \`
          <div class="item-card">
            <div class="item-card-title"><span>\${a.name || a.agent}</span><span class="badge">LIVE</span></div>
            <div style="font-size:12px; color:var(--accent-cyan);">Task: \${a.task || 'Idle'}</div>
          </div>
        \`).join('');
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
    document.getElementById('suggestForm').addEventListener('submit', async (e) => {
      e.preventDefault(); const i = document.getElementById('suggestInput');
      if (!i.value.trim()) return;
      await fetch('/api/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: i.value }) });
      i.value = ''; fetchData();
    });
    setInterval(fetchData, 2000); fetchData();
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(HTML_CONTENT); return; }
  if (url.pathname === '/api/openclaw') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(openclawSnapshot)); return; }
  if (url.pathname === '/api/state') {
    const db = getDb();
    const lastTurn = q1(db, "SELECT thinking FROM turns ORDER BY created_at DESC LIMIT 1");
    const messages = q(db, "SELECT * FROM inbox_messages ORDER BY received_at DESC LIMIT 10");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ lastResponse: lastTurn?.thinking, messages }));
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
        raw.split('\n').slice(-200).forEach(line => {
          if (!line.trim()) return; const tsMatch = line.match(/\d{2}:\d{2}:\d{2}/);
          allLogs.push({ ts: tsMatch ? tsMatch[0] : '--:--:--', source: 'LOG', level: line.includes('ERROR') ? 'ERROR' : 'INFO', msg: line });
        });
      }
    } catch {}
    const db = getDb();
    const turns = q(db, "SELECT timestamp, thinking, reasoning FROM turns ORDER BY created_at DESC LIMIT 10");
    turns.forEach(t => {
      const ts = t.timestamp ? (t.timestamp.split('T')[1]?.slice(0, 8) || '--:--:--') : '--:--:--';
      if (t.thinking) allLogs.push({ ts, source: 'BRAIN', level: 'THOUGHT', msg: t.thinking });
    });
    allLogs.sort((a, b) => a.ts.localeCompare(b.ts));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(allLogs));
    db.close(); return;
  }
  if (url.pathname === '/api/suggest' && req.method === 'POST') {
    let body = ''; req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body); const db = getDb();
        db.prepare("INSERT INTO inbox_messages (id, from_address, content, status, received_at) VALUES (?, ?, ?, 'received', datetime('now'))")
          .run(ulid(), CREATOR_ADDRESS, data.message);
        db.prepare("UPDATE kv SET value = 'running' WHERE key = 'agent_state'").run();
        db.close(); res.end(JSON.stringify({ success: true }));
      } catch (err) { res.end(JSON.stringify({ error: err.message })); }
    });
    return;
  }
  res.writeHead(404); res.end();
});

server.listen(PORT, '0.0.0.0', () => { console.log(`🚀 Sovereign Mission Control active at http://localhost:${PORT}`); });
serverRef = server;
