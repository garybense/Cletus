import http from 'http';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { ulid } from 'ulid';

const PORT = process.env.DASHBOARD_PORT || 18080;
const DB_PATH = '/Users/user/.automaton/state.db';
const LOG_PATH = '/Users/user/code/automaton/automaton.log';

function getDb() {
  return new Database(DB_PATH, { readonly: false });
}

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Automaton Mission Control</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0b0f19;
      --card-bg: rgba(18, 24, 38, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent-cyan: #06b6d4;
      --accent-emerald: #10b981;
      --accent-amber: #f59e0b;
      --accent-rose: #f43f5e;
      --accent-purple: #8b5cf6;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --term-bg: #030712;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-dark);
      color: var(--text-main);
      padding: 20px;
      line-height: 1.5;
    }
    .container { max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
    header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 24px; background: var(--card-bg);
      border: 1px solid var(--card-border); border-radius: 12px;
      backdrop-filter: blur(12px);
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-logo {
      width: 36px; height: 36px; border-radius: 8px;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 18px; color: #fff;
    }
    .brand-title { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .brand-subtitle { font-size: 12px; color: var(--text-muted); }
    .header-badges { display: flex; gap: 10px; align-items: center; }
    .badge {
      padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600;
      display: inline-flex; align-items: center; gap: 6px; text-transform: uppercase;
    }
    .badge.running { background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge.sleeping { background: rgba(245, 158, 11, 0.15); color: var(--accent-amber); border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge.critical { background: rgba(244, 63, 94, 0.15); color: var(--accent-rose); border: 1px solid rgba(244, 63, 94, 0.3); }
    .badge-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }

    .grid-vitals {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;
    }
    .card {
      background: var(--card-bg); border: 1px solid var(--card-border);
      border-radius: 12px; padding: 18px 22px; backdrop-filter: blur(12px);
    }
    .card-title { font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .card-value { font-size: 24px; font-weight: 700; color: #fff; }
    .card-sub { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

    .main-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
    }
    @media (max-width: 1024px) {
      .main-grid { grid-template-columns: 1fr; }
    }

    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .section-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px; }

    .item-list { display: flex; flex-direction: column; gap: 10px; max-height: 380px; overflow-y: auto; }
    .item-card {
      background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px; padding: 12px 16px;
    }
    .item-card-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; display: flex; justify-content: space-between; }
    .item-card-desc { font-size: 12px; color: var(--text-muted); }

    .terminal-container {
      background: var(--term-bg); border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px; padding: 16px; font-family: 'Fira Code', monospace;
      font-size: 12px; height: 350px; overflow-y: auto; color: #d1d5db;
    }
    .log-line { margin-bottom: 4px; line-height: 1.4; word-break: break-word; }
    .log-info { color: #38bdf8; }
    .log-warn { color: #fbbf24; }
    .log-err { color: #f87171; font-weight: 600; }
    .log-tool { color: #a78bfa; }

    .suggestion-box {
      display: flex; gap: 10px; margin-top: 10px;
    }
    .input-field {
      flex: 1; background: rgba(0, 0, 0, 0.3); border: 1px solid var(--card-border);
      border-radius: 8px; padding: 10px 14px; color: #fff; font-size: 14px; outline: none;
    }
    .input-field:focus { border-color: var(--accent-cyan); }
    .btn {
      background: linear-gradient(135deg, var(--accent-cyan), #0284c7);
      color: #fff; border: none; border-radius: 8px; padding: 10px 20px;
      font-weight: 600; font-size: 14px; cursor: pointer; transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="brand-logo">A</div>
        <div>
          <div class="brand-title">Automaton Mission Control</div>
          <div class="brand-subtitle">Autonomous AI Agent Runtime Dashboard</div>
        </div>
      </div>
      <div class="header-badges">
        <div id="stateBadge" class="badge running"><span class="badge-dot"></span> <span id="stateText">RUNNING</span></div>
        <div class="badge" style="background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); border: 1px solid rgba(139, 92, 246, 0.3);">
          Bank: automaton
        </div>
      </div>
    </header>

    <!-- Quick Directive Dispatch -->
    <div class="card">
      <div class="card-title">Send Creator Directive / Suggestion</div>
      <form id="suggestForm" class="suggestion-box">
        <input type="text" id="suggestInput" class="input-field" placeholder="Type instruction or guidance for the agent (e.g. 'Explore Algora bounty #12 and use Puppeteer to inspect requirements')...">
        <button type="submit" class="btn">Dispatch</button>
      </form>
    </div>

    <!-- Vitals Grid -->
    <div class="grid-vitals">
      <div class="card">
        <div class="card-title">Active Inference Model</div>
        <div id="activeModel" class="card-value">-</div>
        <div class="card-sub">Automatic failover queue active</div>
      </div>
      <div class="card">
        <div class="card-title">Compute Credits / Operational Floor</div>
        <div id="credits" class="card-value">$10.00</div>
        <div class="card-sub">Solana + Conway Live Wallet</div>
      </div>
      <div class="card">
        <div class="card-title">Total Turns Completed</div>
        <div id="totalTurns" class="card-value">-</div>
        <div class="card-sub">Recorded in SQLite state.db</div>
      </div>
      <div class="card">
        <div class="card-title">Active Sub-Agents / Workers</div>
        <div id="activeWorkers" class="card-value">0</div>
        <div class="card-sub">Local in-process & sandbox children</div>
      </div>
    </div>

    <div class="main-grid">
      <!-- Goals & What Automaton is Working On -->
      <div class="card">
        <div class="section-header">
          <div class="section-title">🎯 Goals & Planned Work</div>
        </div>
        <div id="goalsList" class="item-list">
          <div class="item-card">Loading goals...</div>
        </div>
      </div>

      <!-- Active Tasks & Task Graph -->
      <div class="card">
        <div class="section-header">
          <div class="section-title">⚡ Current Tasks (Task Graph)</div>
        </div>
        <div id="tasksList" class="item-list">
          <div class="item-card">Loading tasks...</div>
        </div>
      </div>
    </div>

    <div class="main-grid">
      <!-- Recent Turns & Tool Activity -->
      <div class="card">
        <div class="section-header">
          <div class="section-title">🧠 Recent Agent Turns & Tool Activity</div>
        </div>
        <div id="turnsList" class="item-list">
          <div class="item-card">Loading turns...</div>
        </div>
      </div>

      <!-- Spawned Children & Subagents -->
      <div class="card">
        <div class="section-header">
          <div class="section-title">🤖 Spawned Agents & Sub-Workers</div>
        </div>
        <div id="childrenList" class="item-list">
          <div class="item-card">No sub-agents currently spawned.</div>
        </div>
      </div>
    </div>

    <!-- Live Terminal Log Window -->
    <div class="card">
      <div class="section-header">
        <div class="section-title">📜 Live Automaton Log Tail (automaton.log)</div>
        <div style="font-size: 12px; color: var(--text-muted);">Auto-refreshing every 2s</div>
      </div>
      <div id="terminal" class="terminal-container">
        Loading live logs...
      </div>
    </div>
  </div>

  <script>
    async function fetchData() {
      try {
        const [stateRes, logRes] = await Promise.all([
          fetch('/api/state').then(r => r.json()),
          fetch('/api/logs').then(r => r.text())
        ]);

        // 1. Update Vitals
        const stateBadge = document.getElementById('stateBadge');
        const stateText = document.getElementById('stateText');
        const state = stateRes.vitals.state || 'unknown';
        stateText.innerText = state.toUpperCase();
        stateBadge.className = 'badge ' + (state === 'running' ? 'running' : state === 'sleeping' ? 'sleeping' : 'critical');

        document.getElementById('activeModel').innerText = stateRes.vitals.lastUsedModel || 'gemini-3.6-flash';
        document.getElementById('credits').innerText = '$10.00';
        document.getElementById('totalTurns').innerText = stateRes.vitals.totalTurns || '0';
        document.getElementById('activeWorkers').innerText = (stateRes.children || []).length;

        // 2. Update Goals
        const goalsList = document.getElementById('goalsList');
        if (stateRes.goals && stateRes.goals.length > 0) {
          goalsList.innerHTML = stateRes.goals.map(g => \`
            <div class="item-card">
              <div class="item-card-title">
                <span>\${g.title || 'Untitled Goal'}</span>
                <span class="badge \${g.status === 'active' ? 'running' : 'sleeping'}">\${g.status}</span>
              </div>
              <div class="item-card-desc">\${g.description || 'No description'}</div>
            </div>
          \`).join('');
        } else {
          goalsList.innerHTML = '<div class="item-card"><div class="item-card-desc">No active goals.</div></div>';
        }

        // 3. Update Tasks
        const tasksList = document.getElementById('tasksList');
        if (stateRes.tasks && stateRes.tasks.length > 0) {
          tasksList.innerHTML = stateRes.tasks.map(t => \`
            <div class="item-card">
              <div class="item-card-title">
                <span>\${t.title || 'Task'}</span>
                <span style="font-size: 11px; color: var(--accent-cyan);">\${t.status} (\${t.agent_role || 'generalist'})</span>
              </div>
              <div class="item-card-desc">\${t.description || ''}</div>
              \${t.result ? \`<div style="font-family: monospace; font-size: 11px; color: #a78bfa; margin-top: 4px;">\${t.result.slice(0, 120)}...</div>\` : ''}
            </div>
          \`).join('');
        } else {
          tasksList.innerHTML = '<div class="item-card"><div class="item-card-desc">No pending tasks in task graph.</div></div>';
        }

        // 4. Update Recent Turns
        const turnsList = document.getElementById('turnsList');
        if (stateRes.recentTurns && stateRes.recentTurns.length > 0) {
          turnsList.innerHTML = stateRes.recentTurns.map(turn => {
            let toolsStr = 'None';
            try {
              const tc = JSON.parse(turn.tool_calls || '[]');
              if (tc.length > 0) {
                toolsStr = tc.map(x => x.name).join(', ');
              }
            } catch(e) {}
            return \`
              <div class="item-card">
                <div class="item-card-title">
                  <span>Turn \${turn.id.slice(-6)}</span>
                  <span style="font-size: 11px; color: var(--text-muted);">\${new Date(turn.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style="font-size: 12px; color: #38bdf8;">Tools: \${toolsStr}</div>
                <div class="item-card-desc" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">\${(turn.thinking || '').slice(0, 150)}</div>
              </div>
            \`;
          }).join('');
        }

        // 5. Update Children
        const childrenList = document.getElementById('childrenList');
        if (stateRes.children && stateRes.children.length > 0) {
          childrenList.innerHTML = stateRes.children.map(c => \`
            <div class="item-card">
              <div class="item-card-title">
                <span>\${c.address || c.sandbox_id}</span>
                <span class="badge running">\${c.status}</span>
              </div>
              <div class="item-card-desc">Role: \${c.agent_role || 'worker'}</div>
            </div>
          \`).join('');
        } else {
          childrenList.innerHTML = '<div class="item-card"><div class="item-card-desc">No sub-agents currently spawned.</div></div>';
        }

        // 6. Update Terminal Logs
        const terminal = document.getElementById('terminal');
        const lines = logRes.split('\\n').filter(Boolean);
        terminal.innerHTML = lines.map(l => {
          let cls = 'log-line';
          if (l.includes('ERROR') || l.includes('failed')) cls += ' log-err';
          else if (l.includes('WARN')) cls += ' log-warn';
          else if (l.includes('TOOL')) cls += ' log-tool';
          else if (l.includes('INFO')) cls += ' log-info';
          return \`<div class="\${cls}">\${escapeHtml(l)}</div>\`;
        }).join('');
        terminal.scrollTop = terminal.scrollHeight;
      } catch (err) {
        console.error('Fetch error:', err);
      }
    }

    function escapeHtml(text) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    document.getElementById('suggestForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('suggestInput');
      const val = input.value.trim();
      if (!val) return;
      input.value = '';
      await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: val })
      });
      fetchData();
    });

    fetchData();
    setInterval(fetchData, 2000);
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_CONTENT);
    return;
  }

  if (url.pathname === '/api/state') {
    try {
      const db = getDb();
      const agentState = db.prepare("SELECT value FROM kv WHERE key = 'agent_state'").get()?.value || 'unknown';
      const lastUsedModel = db.prepare("SELECT value FROM kv WHERE key = 'last_used_model'").get()?.value || 'gemini-3.6-flash';
      const sleepUntil = db.prepare("SELECT value FROM kv WHERE key = 'sleep_until'").get()?.value;
      const totalTurns = db.prepare("SELECT COUNT(*) as count FROM turns").get()?.count || 0;

      const goals = db.prepare("SELECT * FROM goals ORDER BY created_at DESC LIMIT 10").all();
      const tasks = db.prepare("SELECT * FROM task_graph ORDER BY created_at DESC LIMIT 10").all();
      const children = db.prepare("SELECT * FROM children ORDER BY created_at DESC LIMIT 10").all();
      const recentTurns = db.prepare("SELECT id, timestamp, tool_calls, thinking FROM turns ORDER BY rowid DESC LIMIT 10").all();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        vitals: {
          state: agentState,
          lastUsedModel,
          sleepUntil,
          totalTurns
        },
        goals,
        tasks,
        children,
        recentTurns
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === '/api/logs') {
    try {
      if (fs.existsSync(LOG_PATH)) {
        const raw = fs.readFileSync(LOG_PATH, 'utf-8');
        const lines = raw.split('\n').slice(-150).join('\n');
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(lines);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('No log file found.');
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error reading log: ' + err.message);
    }
    return;
  }

  if (url.pathname === '/api/suggest' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.message) {
          const db = getDb();
          const msgId = ulid();
          const creatorAddress = '92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa';
          db.prepare(`
            INSERT INTO inbox_messages (id, from_address, content, received_at, status, retry_count, max_retries)
            VALUES (?, ?, ?, datetime('now'), 'received', 0, 3)
          `).run(msgId, creatorAddress, `[CREATOR DIRECTIVE]: ${data.message}`);
          db.prepare("UPDATE kv SET value = 'running', updated_at = datetime('now') WHERE key = 'agent_state'").run();
          db.prepare("DELETE FROM kv WHERE key = 'sleep_until'").run();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Automaton Mission Control Dashboard running at http://localhost:${PORT}`);
});
