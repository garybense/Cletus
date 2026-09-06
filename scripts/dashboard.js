import http from 'http';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { ulid } from 'ulid';

// -----------------------------------------------------------------------------
// CRASH GUARDS — registered FIRST so nothing above or below can kill the server.
// Node >=15 crashes on unhandled rejections by default; this dashboard must
// never die. Log and continue.
// -----------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  try { console.error('[dashboard] uncaughtException:', (err && (err.code || err.message)) || err); } catch {}
});
process.on('unhandledRejection', (err) => {
  try { console.error('[dashboard] unhandledRejection:', (err && (err.code || err.message)) || err); } catch {}
});

// SIGNAL RESILIENCE:
// - SIGHUP: IGNORE. When a parent shell/terminal exits, macOS sends SIGHUP to
//   background children; the dashboard must survive that (this was the root
//   cause of the dashboard repeatedly "going down" with no error logged).
// - SIGTERM/SIGINT: exit cleanly so `start.sh --kill` still works.
process.on('SIGHUP', () => {
  try { console.log('[dashboard] SIGHUP received — ignoring (staying alive)'); } catch {}
});
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    try { console.log(`[dashboard] ${sig} received — shutting down cleanly`); } catch {}
    try { serverRef.close(() => process.exit(0)); } catch { process.exit(0); }
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
let serverRef = null;

const PORT = process.env.DASHBOARD_PORT || 18888;
const DB_PATH = process.env.CLETUS_DB || path.join(process.env.HOME, '.cletus', 'state.db');
const LOG_PATH = process.env.CLETUS_LOG || path.join(process.cwd(), 'cletus.log');
const MOLTBOOK_CREDS_DIR = path.join(process.env.HOME, '.config', 'moltbook');
const MOLTBOOK_PUBLIC_PROFILES = [
  ...(typeof process.env.MOLTBOOK_PUBLIC_PROFILES === 'string' 
    ? JSON.parse(process.env.MOLTBOOK_PUBLIC_PROFILES) 
    : []),
];
const CREATOR_ADDRESS = process.env.CREATOR_ADDRESS || '92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa';

// Safe database getter that never fails - returns a no-op db-like object on error
function getDb() {
  try {
    return new Database(DB_PATH, { readonly: false });
  } catch (err) {
    console.error('Failed to open database:', err.message);
    // Return a minimal no-op object that won't crash the server
    return {
      prepare: () => ({
        all: () => [],
        get: () => undefined,
        run: () => ({}),
      }),
      close: () => {},
    };
  }
}

// Safe query helpers - never throw, always return safe defaults
function q(db, sql, ...params) {
  try {
    if (!db || !db.prepare) return [];
    return db.prepare(sql).all(...params);
  } catch {
    return [];
  }
}
function q1(db, sql, ...params) {
  try {
    if (!db || !db.prepare) return undefined;
    return db.prepare(sql).get(...params);
  } catch {
    return undefined;
  }
}

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cletus Mission Control</title>
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
    .container { max-width: 1550px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
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
    .header-badges { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .badge {
      padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600;
      display: inline-flex; align-items: center; gap: 6px; text-transform: uppercase;
    }
    .badge.running { background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge.sleeping { background: rgba(245, 158, 11, 0.15); color: var(--accent-amber); border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge.critical { background: rgba(244, 63, 94, 0.15); color: var(--accent-rose); border: 1px solid rgba(244, 63, 94, 0.3); }
    .badge-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }

    .btn-pause {
      background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 20px; padding: 6px 14px; font-size: 13px; font-weight: 600; color: #fff;
      cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;
    }
    .btn-pause.paused {
      background: var(--accent-amber); color: #000; border-color: var(--accent-amber);
    }

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

    .item-list { display: flex; flex-direction: column; gap: 10px; max-height: 420px; overflow-y: auto; }
    .item-card {
      background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px; padding: 14px 16px; transition: border-color 0.2s;
    }
    .item-card.clickable { cursor: pointer; }
    .item-card.clickable:hover { border-color: var(--accent-cyan); background: rgba(6, 182, 212, 0.05); }
    .item-card-title { font-weight: 600; font-size: 14px; margin-bottom: 6px; display: flex; justify-content: space-between; gap: 8px; }
    .item-card-desc { font-size: 12px; color: var(--text-muted); }

    /* Mini stat rows for spend panel */
    .stat-row { display: flex; justify-content: space-between; align-items: baseline; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { font-size: 13px; color: var(--text-muted); }
    .stat-value { font-family: 'Fira Code', monospace; font-size: 13px; color: #e5e7eb; }
    .stat-bar { height: 4px; border-radius: 2px; background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple)); margin-top: 3px; }
    .profile-action { display: inline-block; margin-top: 9px; padding: 6px 11px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none; }
    .profile-action.claim { color: #111827; background: var(--accent-amber); }
    .profile-action.view { color: #fff; background: rgba(6, 182, 212, 0.2); border: 1px solid rgba(6, 182, 212, 0.45); }

    /* Modal Reader */
    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(8px);
      display: none; align-items: center; justify-content: center; z-index: 9999;
      padding: 20px;
    }
    .modal-overlay.open { display: flex; }
    .modal-card {
      background: #111827; border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 14px; width: 100%; max-width: 900px; max-height: 85vh;
      display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .modal-header {
      padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex; justify-content: space-between; align-items: center;
    }
    .modal-title { font-size: 16px; font-weight: 700; color: var(--accent-emerald); }
    .modal-close {
      background: none; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer; padding: 4px;
    }
    .modal-body {
      padding: 20px; overflow-y: auto; font-family: 'Fira Code', monospace;
      font-size: 13px; line-height: 1.6; color: #e5e7eb; white-space: pre-wrap; word-break: break-word;
    }

    /* Terminal & Log Viewer */
    .terminal-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;
    }
    .log-controls { display: flex; gap: 8px; align-items: center; }
    .log-filter-btn {
      background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px; padding: 4px 10px; font-size: 12px; color: var(--text-muted); cursor: pointer;
    }
    .log-filter-btn.active {
      background: var(--accent-cyan); color: #000; font-weight: 600; border-color: var(--accent-cyan);
    }
    .terminal-container {
      background: var(--term-bg); border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px; padding: 16px; font-family: 'Fira Code', monospace;
      font-size: 12px; height: 400px; overflow-y: auto; color: #d1d5db;
    }
    .log-line { margin-bottom: 3px; line-height: 1.45; word-break: break-all; }
    .log-info { color: #38bdf8; }
    .log-warn { color: #fbbf24; }
    .log-err { color: #f87171; font-weight: 600; }
    .log-tool { color: #a78bfa; font-weight: 500; }
    .log-thought { color: #10b981; }

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
          <div class="brand-title">Cletus Mission Control</div>
          <div class="brand-subtitle">Autonomous AI Agent Runtime & Sub-Agent Orchestrator</div>
        </div>
      </div>
      <div class="header-badges">
        <button id="btnPauseFeed" class="btn-pause" onclick="togglePauseFeed()">
          <span>⏸️</span> <span id="pauseText">Pause Auto-Refresh</span>
        </button>
        <div id="stateBadge" class="badge running"><span class="badge-dot"></span> <span id="stateText">RUNNING</span></div>
        <div id="uptimeBadge" class="badge" style="background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan); border: 1px solid rgba(6, 182, 212, 0.3);">Uptime: —</div>
      </div>
    </header>

    <!-- Modal Thought Reader -->
    <div id="modalOverlay" class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-card" onclick="event.stopPropagation()">
        <div class="modal-header">
          <div id="modalTitle" class="modal-title">Turn Details</div>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div id="modalBody" class="modal-body"></div>
      </div>
    </div>

    <!-- Supreme Creator Directive Dispatch (God-Mode Channel) -->
    <div class="card" style="border: 1px solid rgba(139, 92, 246, 0.4); background: linear-gradient(135deg, rgba(18, 24, 38, 0.95), rgba(88, 28, 135, 0.25)); box-shadow: 0 4px 20px rgba(139, 92, 246, 0.15);">
      <div class="section-header" style="margin-bottom: 8px;">
        <div class="card-title" style="color: #c084fc; display: flex; align-items: center; gap: 8px;">
          <span>⚡</span> SUPREME CREATOR DIRECTIVE (THE VOICE OF GOD)
        </div>
        <span style="font-size: 11px; background: rgba(139, 92, 246, 0.2); color: #e9d5ff; padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(139, 92, 246, 0.3);">Supreme Priority Invariant</span>
      </div>
      <form id="suggestForm" class="suggestion-box">
        <input type="text" id="suggestInput" class="input-field" style="border-color: rgba(139, 92, 246, 0.4); background: rgba(0, 0, 0, 0.5);" placeholder="Issue supreme command to Cletus & colony (overrides all background tasks)...">
        <button type="submit" class="btn" style="background: linear-gradient(135deg, #9333ea, #7c3aed); box-shadow: 0 0 12px rgba(147, 51, 234, 0.4);">Issue Decree</button>
      </form>
    </div>

    <!-- Vitals Grid -->
    <div class="grid-vitals">
      <div class="card">
        <div class="card-title">Active Inference Model</div>
        <div id="activeModel" class="card-value">-</div>
        <div class="card-sub">Last model used by the agent loop</div>
      </div>
      <div class="card">
        <div class="card-title">Compute Budget</div>
        <div id="credits" class="card-value">-</div>
        <div id="creditsSub" class="card-sub">Loading tier...</div>
      </div>
      <div class="card">
        <div class="card-title">Total Turns Completed</div>
        <div id="totalTurns" class="card-value">-</div>
        <div class="card-sub">Recorded in state.db</div>
      </div>
      <div class="card">
        <div class="card-title">Active Work</div>
        <div id="activeWorkers" class="card-value">0</div>
        <div id="activeWorkersSub" class="card-sub">Tasks assigned / running</div>
      </div>
    </div>

    <div class="main-grid">
      <!-- Goals -->
      <div class="card">
        <div class="section-header">
          <div class="section-title">🎯 Goals & Planned Roadmap</div>
        </div>
        <div id="goalsList" class="item-list">
          <div class="item-card">Loading goals...</div>
        </div>
      </div>

      <!-- Active Tasks & Task Graph -->
      <div class="card">
        <div class="section-header">
          <div class="section-title">⚡ Task Graph & Sub-Agent Assignments</div>
        </div>
        <div id="tasksList" class="item-list">
          <div class="item-card">Loading tasks...</div>
        </div>
      </div>
    </div>

    <div class="main-grid">
      <!-- Complete Cognitive Thoughts & Turn Stream -->
      <div class="card">
        <div class="section-header">
          <div class="section-title">🧠 Complete Agent Thoughts & Direct Speech</div>
          <div style="font-size: 11px; color: var(--accent-cyan);">Click any card to read full thought</div>
        </div>
        <div id="thoughtsList" class="item-list">
          <div class="item-card">Loading cognitive feed...</div>
        </div>
      </div>

      <!-- Spawned Children & Sub-Agents -->
      <div class="card">
        <div class="section-header">
          <div class="section-title">🤖 Spawned Workers & Activity</div>
          <div style="font-size: 11px; color: var(--text-muted);">Children spawned via OpenClaw</div>
        </div>
        <div id="childrenList" class="item-list">
          <div class="item-card">Loading children...</div>
        </div>
      </div>
    </div>

    <div class="main-grid">
      <!-- Compute Spend & Inference -->
      <div class="card">
        <div class="section-header">
          <div class="section-title">💸 Compute Spend & Inference (24h)</div>
          <div style="font-size: 11px; color: var(--text-muted);">From inference_costs + spend_tracking</div>
        </div>
        <div id="spendPanel" class="item-list">
          <div class="item-card">Loading spend...</div>
        </div>
      </div>

      <!-- Skills Library -->
      <div class="card">
        <div class="section-header">
          <div class="section-title">🧠 Skills Library</div>
          <div style="font-size: 11px; color: var(--text-muted);">Installed skills & sources</div>
        </div>
        <div id="skillsPanel" class="item-list">
          <div class="item-card">Loading skills...</div>
        </div>
      </div>
    </div>

    <!-- Moltbook Status -->
    <div class="card">
      <div class="section-header">
        <div class="section-title">🦞 Moltbook Agent Social</div>
        <div style="font-size: 11px; color: var(--text-muted);">All local profiles & engagement</div>
      </div>
      <div id="moltbookPanel">
        <div class="item-card">Loading Moltbook status...</div>
      </div>
    </div>

    <!-- OpenClaw Status -->
    <div class="card">
      <div class="section-header">
        <div class="section-title">🌐 OpenClaw Remote Agents</div>
        <div style="font-size: 11px; color: var(--text-muted);">Agents running on Mindmods server</div>
      </div>
      <div id="openclawPanel" class="item-list">
        <div class="item-card">Loading OpenClaw status...</div>
      </div>
    </div>

    <!-- Live Unified Terminal Log Window -->
    <div class="card">
      <div class="terminal-header">
        <div class="section-title">📜 Unified Activity & System Logs</div>
        <div class="log-controls">
          <button id="btnFilterAll" class="log-filter-btn active" onclick="setLogFilter('all')">ALL</button>
          <button id="btnFilterTool" class="log-filter-btn" onclick="setLogFilter('tool')">TOOLS</button>
          <button id="btnFilterThought" class="log-filter-btn" onclick="setLogFilter('thought')">THOUGHTS</button>
          <button id="btnFilterErr" class="log-filter-btn" onclick="setLogFilter('err')">ERRORS</button>
          <button id="btnAutoscroll" class="log-filter-btn active" onclick="toggleAutoscroll()">Autoscroll: ON</button>
        </div>
      </div>
      <div id="terminal" class="terminal-container">
        Loading unified logs...
      </div>
    </div>
  </div>

  <script>
    var isPaused = false;
    var currentFilter = 'all';
    var autoscrollEnabled = true;
    var allLogLines = [];
    var knownTurnIds = '';
    var turnsCache = [];
    var startTimeMs = null;

    function esc(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function fmtCents(cents) {
      if (cents === null || cents === undefined) return '-';
      return '$' + (cents / 100).toFixed(2);
    }

    function togglePauseFeed() {
      isPaused = !isPaused;
      var btn = document.getElementById('btnPauseFeed');
      var text = document.getElementById('pauseText');
      btn.classList.toggle('paused', isPaused);
      text.innerText = isPaused ? '▶️ Resume Auto-Refresh' : '⏸️ Pause Auto-Refresh';
    }

    function openModal(turnId) {
      var turn = null;
      for (var i = 0; i < turnsCache.length; i++) {
        if (turnsCache[i].id === turnId) { turn = turnsCache[i]; break; }
      }
      if (!turn) return;
      document.getElementById('modalTitle').innerText = 'Turn ' + turn.id.slice(-8) + ' (' + new Date(turn.timestamp).toLocaleTimeString() + ')';

      var parts = [];
      try {
        var tc = JSON.parse(turn.tool_calls || '[]');
        if (tc.length > 0) {
          parts.push('--- TOOLS INVOKED ---');
          tc.forEach(function (x) {
            parts.push(x.name + '(' + JSON.stringify(x.arguments || {}, null, 2) + ')');
          });
          parts.push('');
        }
      } catch (e) {}
      parts.push('--- RAW THOUGHT / RESPONSE ---');
      parts.push(turn.thinking || turn.reasoning || 'No response recorded.');
      if (turn.reasoning) {
        parts.push('--- PROVIDER REASONING (WHEN EXPOSED) ---');
        parts.push(turn.reasoning);
      }
      document.getElementById('modalBody').innerText = parts.join('\\n');
      document.getElementById('modalOverlay').classList.add('open');
    }

    function closeModal() {
      document.getElementById('modalOverlay').classList.remove('open');
    }

    function setLogFilter(filter) {
      currentFilter = filter;
      var map = { all: 'btnFilterAll', tool: 'btnFilterTool', thought: 'btnFilterThought', err: 'btnFilterErr' };
      Object.keys(map).forEach(function (k) {
        document.getElementById(map[k]).classList.toggle('active', k === filter);
      });
      renderLogs();
    }

    function toggleAutoscroll() {
      autoscrollEnabled = !autoscrollEnabled;
      var btn = document.getElementById('btnAutoscroll');
      btn.innerText = 'Autoscroll: ' + (autoscrollEnabled ? 'ON' : 'OFF');
      btn.classList.toggle('active', autoscrollEnabled);
      if (autoscrollEnabled) {
        var terminal = document.getElementById('terminal');
        terminal.scrollTop = terminal.scrollHeight;
      }
    }

    function renderLogs() {
      var terminal = document.getElementById('terminal');
      var wasAtBottom = (terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight) < 40;
      var prevScrollTop = terminal.scrollTop;

      var filtered = allLogLines.filter(function (l) {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'tool') return l.includes('TOOL') || l.includes('TOOL RESULT') || l.includes('exec') || l.includes('browser_');
        if (currentFilter === 'thought') return l.includes('THOUGHT') || l.includes('REASONING') || l.includes('<thought>') || l.includes('thinking');
        if (currentFilter === 'err') return l.includes('ERROR') || l.includes('failed') || l.includes('WARN');
        return true;
      });

      terminal.innerHTML = filtered.map(function (l) {
        var cls = 'log-line';
        if (l.includes('ERROR') || l.includes('failed')) cls += ' log-err';
        else if (l.includes('WARN')) cls += ' log-warn';
        else if (l.includes('TOOL RESULT')) cls += ' log-tool';
        else if (l.includes('TOOL')) cls += ' log-tool';
        else if (l.includes('THOUGHT') || l.includes('<thought>')) cls += ' log-thought';
        else if (l.includes('INFO')) cls += ' log-info';
        return '<div class="' + cls + '">' + esc(l) + '</div>';
      }).join('');

      if (autoscrollEnabled && wasAtBottom) {
        terminal.scrollTop = terminal.scrollHeight;
      } else {
        terminal.scrollTop = prevScrollTop;
      }
    }

    function renderUptime() {
      if (!startTimeMs) return;
      var s = Math.floor((Date.now() - startTimeMs) / 1000);
      var d = Math.floor(s / 86400); s -= d * 86400;
      var h = Math.floor(s / 3600); s -= h * 3600;
      var m = Math.floor(s / 60);
      var txt = (d > 0 ? d + 'd ' : '') + h + 'h ' + m + 'm';
      document.getElementById('uptimeBadge').innerText = 'Uptime: ' + txt;
    }
    setInterval(renderUptime, 1000);

    function statusBadgeClass(status) {
      if (status === 'running' || status === 'active' || status === 'completed') return 'running';
      if (status === 'sleeping' || status === 'paused' || status === 'pending' || status === 'assigned' || status === 'spawning') return 'sleeping';
      return 'critical';
    }

    // Safe JSON fetch — one endpoint failing must never blank the whole page.
    async function safeJson(url, fallback) {
      try {
        var r = await fetch(url);
        return await r.json();
      } catch (e) { return fallback; }
    }
    async function safeText(url, fallback) {
      try {
        var r = await fetch(url);
        return await r.text();
      } catch (e) { return fallback; }
    }

    async function fetchData() {
      if (isPaused) return;

      var results = await Promise.all([
        safeJson('/api/state', { vitals: { state: 'unknown' }, goals: [], tasks: [], children: [], recentTurns: [] }),
        safeText('/api/logs', ''),
        safeJson('/api/spend', { error: true }),
        safeJson('/api/skills', { skills: [] }),
        safeJson('/api/moltbook-status', { profiles: [] }),
        safeJson('/api/openclaw', { error: true, agents: [], logs: [] })
      ]);
      var state = results[0] || {};
      var logText = results[1] || '';
      var spend = results[2];
      var skillsRes = results[3];
      var moltbookRes = results[4];
      var ocData = results[5];

        // 1. Vitals
        var stateBadge = document.getElementById('stateBadge');
        var stateText = document.getElementById('stateText');
        var agentState = (state.vitals && state.vitals.state) || 'unknown';
        stateText.innerText = agentState.toUpperCase();
        stateBadge.className = 'badge ' + (agentState === 'running' ? 'running' : agentState === 'sleeping' ? 'sleeping' : 'critical');

        document.getElementById('activeModel').innerText = (state.vitals && state.vitals.lastUsedModel) || '-';
        document.getElementById('credits').innerText = fmtCents(state.vitals && state.vitals.balanceCents);
        var tier = (state.vitals && state.vitals.tier) || 'unknown';
        document.getElementById('creditsSub').innerText = 'Survival tier: ' + tier + ' · USDC: ' + fmtCents(state.vitals && state.vitals.usdcCents);
        document.getElementById('totalTurns').innerText = (state.vitals && state.vitals.totalTurns) || '0';
        document.getElementById('activeWorkers').innerText = (state.vitals && state.vitals.activeWorkers) || '0';
        document.getElementById('activeWorkersSub').innerText =
          ((state.vitals && state.vitals.runningChildren) || 0) + ' child worker(s) running';
        if (state.vitals && state.vitals.startTime) {
          var t = new Date(state.vitals.startTime).getTime();
          if (!isNaN(t) && (!startTimeMs || t < startTimeMs)) startTimeMs = t;
        }

        // 2. Goals
        var goalsList = document.getElementById('goalsList');
        var prevGoalsScroll = goalsList.scrollTop;
        if (state.goals && state.goals.length > 0) {
          goalsList.innerHTML = state.goals.map(function (g) {
            return '<div class="item-card">' +
              '<div class="item-card-title"><span>' + esc(g.title || 'Untitled Goal') + '</span>' +
              '<span class="badge ' + statusBadgeClass(g.status) + '">' + esc(g.status) + '</span></div>' +
              '<div class="item-card-desc">' + esc(g.description || 'No description') + '</div>' +
              '</div>';
          }).join('');
        } else {
          goalsList.innerHTML = '<div class="item-card"><div class="item-card-desc">No active goals.</div></div>';
        }
        goalsList.scrollTop = prevGoalsScroll;

        // 3. Tasks - only show if there are active goals
        var tasksList = document.getElementById('tasksList');
        var prevTasksScroll = tasksList.scrollTop;
        var hasActiveGoals = state.goals && state.goals.some(function(g) { return g.status === 'active' || g.status === 'pending'; });
        var hasActiveTasks = state.tasks && state.tasks.some(function(t) { return t.status === 'assigned' || t.status === 'running' || t.status === 'pending'; });
        
        if (hasActiveGoals && (state.tasks && state.tasks.length > 0)) {
          tasksList.innerHTML = state.tasks.map(function (t) {
            var resultHtml = '';
            if (t.result) {
              resultHtml = '<div style="font-family: monospace; font-size: 11px; color: #a78bfa; margin-top: 4px; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px;">' + esc(String(t.result).slice(0, 180)) + '</div>';
            }
            return '<div class="item-card">' +
              '<div class="item-card-title"><span>' + esc(t.title || 'Task') + '</span>' +
              '<span style="font-size: 11px; color: var(--accent-cyan); font-weight: 600;">' + esc(t.status) + (t.agent_role ? ' [' + esc(t.agent_role) + ']' : '') + '</span></div>' +
              '<div class="item-card-desc">' + esc(t.description || '') + '</div>' +
              resultHtml +
              '</div>';
          }).join('');
        } else if (!hasActiveGoals) {
          tasksList.innerHTML = '<div class="item-card"><div class="item-card-desc">No active goals — task graph is empty.</div></div>';
        } else {
          tasksList.innerHTML = '<div class="item-card"><div class="item-card-desc">No tasks in graph.</div></div>';
        }
        tasksList.scrollTop = prevTasksScroll;

        // 4. Thoughts (keyed diff — only re-render when turns change)
        turnsCache = state.recentTurns || [];
        var newTurnIds = turnsCache.map(function (t) { return t.id; }).join(',');
        if (newTurnIds !== knownTurnIds) {
          knownTurnIds = newTurnIds;
          var thoughtsList = document.getElementById('thoughtsList');
          var prevThoughtsScroll = thoughtsList.scrollTop;
          if (turnsCache.length > 0) {
            thoughtsList.innerHTML = turnsCache.map(function (turn) {
              var toolsStr = '';
              try {
                var tc = JSON.parse(turn.tool_calls || '[]');
                if (tc.length > 0) {
                  toolsStr = tc.map(function (x) { return x.name + '(' + JSON.stringify(x.arguments || {}).slice(0, 40) + ')'; }).join(', ');
                }
              } catch (e) {}
              return '<div class="item-card clickable" onclick="openModal(\\'' + turn.id + '\\')">' +
                '<div class="item-card-title"><span style="color: var(--accent-emerald);">Turn ' + esc(turn.id.slice(-6)) + '</span>' +
                '<span style="font-size: 11px; color: var(--text-muted);">' + new Date(turn.timestamp).toLocaleTimeString() + '</span></div>' +
                (toolsStr ? '<div style="font-size: 12px; color: #a78bfa; margin-bottom: 4px;">🛠️ ' + esc(toolsStr) + '</div>' : '') +
                (turn.reasoning ? '<div style="font-size: 11px; color: #fbbf24; margin-bottom: 4px;">Provider reasoning available</div>' : '') +
                '<div class="item-card-desc" style="max-height: 90px; overflow: hidden; text-overflow: ellipsis; color: #e5e7eb; font-family: Fira Code, monospace; font-size: 11px;">' + esc(turn.thinking || turn.reasoning || 'No assistant response recorded.') + '</div>' +
                '</div>';
            }).join('');
          }
          thoughtsList.scrollTop = prevThoughtsScroll;
        }

        // 5. Children
        var childrenList = document.getElementById('childrenList');
        // Build a map of OpenClaw agent names to their current tasks
        var openclawAgentTasks = {};
        if (ocData && ocData.agents) {
          ocData.agents.forEach(function(agent) {
            var agentName = agent.agent || agent.name || '';
            if (agent.task) {
              // Extract a concise summary from the task
              var taskSummary = agent.task.split('\n')[0].substring(0, 100);
              openclawAgentTasks[agentName] = taskSummary;
            }
          });
        }
        
        if (state.children && state.children.length > 0) {
          childrenList.innerHTML = state.children.map(function (c) {
            var chain = c.chain_type ? ' · ' + c.chain_type.toUpperCase() : '';
            var agentName = c.name || c.sandbox_id || '';
            // Extract agent name from sandbox_id for OpenClaw agents
            var openclawName = agentName;
            if (c.sandbox_id && c.sandbox_id.startsWith('openclaw:')) {
              openclawName = c.sandbox_id.replace('openclaw:', '');
            }
            var currentTask = openclawAgentTasks[openclawName] || '';
            
            return '<div class="item-card">' +
              '<div class="item-card-title"><span>' + esc(c.name || c.sandbox_id) + '</span>' +
              '<span class="badge ' + statusBadgeClass(c.status) + '">' + esc(c.status) + '</span></div>' +
              '<div class="item-card-desc">Role: ' + esc(c.role || 'generalist') + chain +
              (c.funded_amount_cents ? ' | Funded: ' + fmtCents(c.funded_amount_cents) : '') + '</div>' +
              (currentTask ? '<div style="margin-top: 6px; font-size: 12px; color: var(--accent-cyan);">Doing: ' + esc(currentTask) + '</div>' : '') +
              '<div class="item-card-desc" style="margin-top: 4px; font-size: 11px; color: var(--text-muted);">Last checked: ' + esc(c.last_checked || 'never') + '</div>' +
              '</div>';
          }).join('');
        } else {
          childrenList.innerHTML = '<div class="item-card"><div class="item-card-desc">No children spawned yet.</div></div>';
        }

        // 6. Spend & Inference
        var spendPanel = document.getElementById('spendPanel');
        if (spend && !spend.error) {
          var html = '';
          html += '<div class="item-card">' +
            '<div class="stat-row"><span class="stat-label">Inference spend (24h)</span><span class="stat-value">' + fmtCents(spend.summary.cost24hCents) + '</span></div>' +
            '<div class="stat-row"><span class="stat-label">Inference calls (24h)</span><span class="stat-value">' + (spend.summary.calls24h || 0) + '</span></div>' +
            '<div class="stat-row"><span class="stat-label">Avg latency</span><span class="stat-value">' + (spend.summary.avgLatencyMs || 0) + ' ms</span></div>' +
            '<div class="stat-row"><span class="stat-label">Cache hit rate</span><span class="stat-value">' + (spend.summary.cacheHitPct || 0) + '%</span></div>' +
            '</div>';
          if (spend.byModel && spend.byModel.length > 0) {
            var maxCost = Math.max.apply(null, spend.byModel.map(function (m) { return m.cost_cents || 0; })) || 1;
            html += '<div class="item-card"><div class="item-card-title"><span>By model (24h)</span></div>';
            spend.byModel.forEach(function (m) {
              var pct = Math.round(((m.cost_cents || 0) / maxCost) * 100);
              html += '<div class="stat-row"><span class="stat-label">' + esc(m.model) + ' <span style="opacity:0.6">(' + m.calls + ' calls)</span></span>' +
                '<span class="stat-value">' + fmtCents(m.cost_cents) + '</span></div>' +
                '<div class="stat-bar" style="width:' + Math.max(pct, 2) + '%"></div>';
            });
            html += '</div>';
          }
          if (spend.toolSpends && spend.toolSpends.length > 0) {
            html += '<div class="item-card"><div class="item-card-title"><span>Tool spends (recent)</span></div>';
            spend.toolSpends.forEach(function (s) {
              html += '<div class="stat-row"><span class="stat-label">' + esc(s.tool_name) + (s.category ? ' <span style="opacity:0.6">(' + esc(s.category) + ')</span>' : '') + '</span>' +
                '<span class="stat-value">' + fmtCents(s.amount_cents) + '</span></div>';
            });
            html += '</div>';
          }
          spendPanel.innerHTML = html;
        } else {
          spendPanel.innerHTML = '<div class="item-card"><div class="item-card-desc">No spend data available.</div></div>';
        }

        // 7. Skills
        var skillsPanel = document.getElementById('skillsPanel');
        if (skillsRes && skillsRes.skills && skillsRes.skills.length > 0) {
          skillsPanel.innerHTML = skillsRes.skills.map(function (s) {
            var flags = [];
            if (s.auto_activate) flags.push('auto'); else flags.push('on-demand');
            if (!s.enabled) flags.push('disabled');
            return '<div class="item-card">' +
              '<div class="item-card-title"><span>' + esc(s.name) + '</span>' +
              '<span style="font-size: 11px; color: var(--accent-purple); font-weight: 600;">' + esc(flags.join(' · ')) + '</span></div>' +
              '<div class="item-card-desc">' + esc((s.description || 'No description').slice(0, 220)) + '</div>' +
              '</div>';
          }).join('');
        } else {
          skillsPanel.innerHTML = '<div class="item-card"><div class="item-card-desc">No skills installed.</div></div>';
        }

        // 8. Moltbook profiles
        var mbPanel = document.getElementById('moltbookPanel');
        if (moltbookRes && moltbookRes.profiles && moltbookRes.profiles.length > 0) {
          mbPanel.innerHTML = '<div class="item-list">' + moltbookRes.profiles.map(function (p) {
            var stateClass = p.claimed ? 'running' : 'sleeping';
            var state = p.claimed ? 'claimed' : (p.status || 'pending claim');
            var profileLink = p.url ? '<a class="profile-action view" href="' + esc(p.url) + '" target="_blank" rel="noopener">View profile ↗</a>' : '';
            var claimLink = p.claim_url ? '<a class="profile-action claim" href="' + esc(p.claim_url) + '" target="_blank" rel="noopener">Claim on Moltbook ↗</a>' : '';
            return '<div class="item-card">' +
              '<div class="item-card-title"><span>' + esc(p.display_name || p.name || 'Unnamed profile') + '</span>' +
              '<span class="badge ' + stateClass + '">' + esc(state) + '</span></div>' +
              '<div class="item-card-desc">' + profileLink + '</div>' +
              '<div class="item-card-desc">@' + esc(p.name || 'unknown') + ' · ' +
              'Posts: <strong>' + (p.posts || 0) + '</strong> · ' +
              'Followers: <strong>' + (p.followers === null || p.followers === undefined ? '—' : p.followers) + '</strong> · ' +
              'Following: ' + (p.following === null || p.following === undefined ? '—' : p.following) + ' · Karma: ' + (p.karma === null || p.karma === undefined ? '—' : p.karma) + '</div>' +
              (p.description ? '<div class="item-card-desc" style="margin-top:6px;">' + esc(p.description) + '</div>' : '') +
              claimLink +
              (p.error ? '<div class="item-card-desc" style="color:var(--accent-rose); margin-top:6px;">' + esc(p.error) + '</div>' : '') +
              '</div>';
          }).join('') + '</div>';
        } else {
          mbPanel.innerHTML = '<div class="item-card"><div class="item-card-desc">No Moltbook profiles configured.</div></div>';
        }

        // 9. Logs
        allLogLines = logText.split('\n').filter(Boolean);

        // Include provider-returned reasoning in the terminal even when the
        // runtime stdout is not redirected to cletus.log.
        turnsCache.forEach(function (turn) {
          var tStr = "";
          if (turn.timestamp) {
            var d = new Date(turn.timestamp);
            var hh = String(d.getHours()).padStart(2, '0');
            var mm = String(d.getMinutes()).padStart(2, '0');
            var ss = String(d.getSeconds()).padStart(2, '0');
            tStr = hh + ':' + mm + ':' + ss + ' ';
          }
          if (turn.reasoning) {
            allLogLines.push(tStr + 'INFO  loop         [REASONING] Turn ' + turn.id + ': ' + turn.reasoning);
          }
          if (turn.thinking) {
            allLogLines.push(tStr + 'INFO  loop         [THOUGHT] ' + turn.thinking);
          }
        });

        // 8.5 OpenClaw Remote Agents
        var ocPanel = document.getElementById('openclawPanel');
        if (ocPanel) {
            if (ocData && ocData.error) {
              ocPanel.innerHTML = '<div class="item-card"><div class="item-card-desc">Waiting for OpenClaw sync...</div></div>';
            } else if (ocData && ocData.agents) {
              var ocHtml = '';
              ocData.agents.forEach(function(agent) {
                ocHtml += '<div class="item-card">';
                ocHtml += '<div class="item-card-title"><span>Server Agent: ' + esc(agent.agent || agent.name || 'unknown') + '</span><span class="badge running">LIVE</span></div>';

                if (agent.db_error) {
                  ocHtml += '<div class="item-card-desc" style="color:var(--accent-rose)">DB Error: ' + esc(agent.db_error) + '</div>';
                }

                if (agent.task) {
                  ocHtml += '<div style="margin-top: 8px; font-weight: bold; color: var(--accent-cyan); font-size: 12px;">Current Task:</div>';
                  ocHtml += '<div style="font-size: 12px; margin-top: 2px; color: var(--text-muted);">' + esc(agent.task) + '</div>';
                }

                if (agent.errors && agent.errors.length > 0) {
                  ocHtml += '<div style="margin-top: 8px; font-weight: bold; color: var(--accent-rose); font-size: 12px;">Recent Tool Errors:</div>';
                  agent.errors.forEach(function(err) {
                    ocHtml += '<div style="font-size: 11px; margin-top: 2px;">[' + esc(err.time) + '] <b>' + esc(err.tool) + '</b>: ' + esc(err.error).substring(0, 100) + '</div>';
                  });
                }

                if (agent.trajectory_errors && agent.trajectory_errors.length > 0) {
                  ocHtml += '<div style="margin-top: 8px; font-weight: bold; color: var(--accent-rose); font-size: 12px;">Execution Bugs:</div>';
                  agent.trajectory_errors.forEach(function(err) {
                    ocHtml += '<div style="font-size: 11px; margin-top: 2px;">[' + esc(err.time) + '] <b>' + esc(err.type) + '</b>: ' + esc(err.message).substring(0, 100) + '</div>';
                  });
                }

                if (agent.logs && agent.logs.length > 0) {
                  allLogLines.push(...agent.logs);
                }

                ocHtml += '</div>';
              });
              ocPanel.innerHTML = ocHtml || '<div class="item-card"><div class="item-card-desc">No agents found on server.</div></div>';
            } else {
              ocPanel.innerHTML = '<div class="item-card"><div class="item-card-desc">No OpenClaw data available.</div></div>';
            }
        }
        
        // Add OpenClaw server logs to unified log viewer
        // These are the actual logs from OpenClaw child agents running on the Mindmods server
        if (ocData && ocData.logs && ocData.logs.length > 0) {
          allLogLines.push(...ocData.logs);
        }

        allLogLines.sort();
        renderLogs();
    }

    document.getElementById('suggestForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var input = document.getElementById('suggestInput');
      var val = input.value.trim();
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

// -----------------------------------------------------------------------------
// OPENCLAW SNAPSHOT CACHE
// The SSH sweep can take many seconds (up to 10 files x 2 ssh calls x 10s
// timeout each). It must NEVER run inside a request handler or it freezes the
// event loop and the dashboard appears "down". We serve the last snapshot
// instantly and refresh it in the background.
// -----------------------------------------------------------------------------
const OPENCLAW_SSH_HOST = process.env.OPENCLAW_SSH_HOST || 'mindmods.org';
const OPENCLAW_SSH_USER = process.env.OPENCLAW_SSH_USER || 'debian';
const OPENCLAW_SSH_PORT = process.env.OPENCLAW_SSH_PORT || '22';
const OPENCLAW_LOG_DIR = process.env.OPENCLAW_LOG_DIR || '/home/debian/.openclaw/logs';
const OPENCLAW_LOG_LINES = Number(process.env.OPENCLAW_LOG_LINES || 200);
const OPENCLAW_SSH_TIMEOUT = process.env.OPENCLAW_SSH_TIMEOUT || '5';
const OPENCLAW_SSH_COMMAND_TIMEOUT = Number(process.env.OPENCLAW_SSH_COMMAND_TIMEOUT || 10000);
const OPENCLAW_REFRESH_MS = Number(process.env.OPENCLAW_REFRESH_MS || 120000);
const OPENCLAW_LOCAL_LOG_DIR = path.join(
  process.env.HOME || process.cwd(),
  process.env.OPENCLAW_LOCAL_LOG_DIR || '.cletus/openclaw-logs'
);

let openclawSnapshot = { agents: [], logs: [], error: null, refreshedAt: null };
let openclawRefreshing = false;

function refreshOpenclawSnapshot() {
  if (openclawRefreshing) return;
  openclawRefreshing = true;
  (async () => {
    const result = { agents: [], logs: [], error: null };

    // 1. Local status file (~/cletus/openclaw_status.json)
    try {
      const ocPath = path.join(process.env.HOME, '.cletus', 'openclaw_status.json');
      if (fs.existsSync(ocPath)) {
        try {
          const statusData = JSON.parse(fs.readFileSync(ocPath, 'utf8'));
          if (Array.isArray(statusData)) result.agents = statusData;
          else if (statusData && statusData.agents) result.agents = statusData.agents;
        } catch {}
      }
    } catch {}

    // 2. Local OpenClaw log directory (configurable)
    try {
      if (fs.existsSync(OPENCLAW_LOCAL_LOG_DIR)) {
        const localFiles = fs.readdirSync(OPENCLAW_LOCAL_LOG_DIR).filter(f => f.endsWith('.log'));
        for (const logFile of localFiles.slice(0, 10)) {
          try {
            const logPath = path.join(OPENCLAW_LOCAL_LOG_DIR, logFile);
            const agentName = logFile.replace('.log', '');
            const raw = fs.readFileSync(logPath, 'utf-8');
            for (const line of raw.split('\n').filter(l => l.trim()).slice(-OPENCLAW_LOG_LINES)) {
              result.logs.push(`[openclaw:${agentName}] ${line}`);
            }
          } catch {}
        }
      }
    } catch {}

    // 3. Remote OpenClaw logs via SSH (child agents live on the Mindmods server)
    try {
      const { execFile } = await import('child_process');
      const ssh = (remoteCmd) => new Promise((resolve) => {
        try {
          execFile('ssh', [
            `-o`, `ConnectTimeout=${OPENCLAW_SSH_TIMEOUT}`,
            `-o`, `BatchMode=yes`,
            `-p`, String(OPENCLAW_SSH_PORT),
            `${OPENCLAW_SSH_USER}@${OPENCLAW_SSH_HOST}`,
            remoteCmd,
          ], { encoding: 'utf8', timeout: OPENCLAW_SSH_COMMAND_TIMEOUT }, (err, stdout) => {
            resolve(err ? '' : String(stdout || ''));
          });
        } catch { resolve(''); }
      });

      const logFiles = (await ssh(`ls -t ${OPENCLAW_LOG_DIR}/*.log 2>/dev/null || true`)).trim();
      if (logFiles) {
        const files = logFiles.split('\n').map(s => s.trim()).filter(Boolean);
        for (const logFile of files.slice(0, 10)) {
          try {
            const agentName = path.basename(logFile).replace('.log', '');
            const content = (await ssh(`tail -n ${OPENCLAW_LOG_LINES} ${logFile}`)).trim();
            if (content) {
              for (const line of content.split('\n').filter(l => l.trim())) {
                result.logs.push(`[openclaw:${agentName}] ${line}`);
              }
            }
          } catch {}
        }
      }
    } catch {}

    // Sort logs by embedded timestamp (undated lines last)
    try {
      const extractTs = (line) => {
        const m = line.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/);
        return m ? m[0].replace(' ', 'T') : '';
      };
      result.logs.sort((a, b) => {
        const tsA = extractTs(a), tsB = extractTs(b);
        if (!tsA) return 1;
        if (!tsB) return -1;
        return tsA.localeCompare(tsB);
      });
    } catch {}

    result.refreshedAt = new Date().toISOString();
    openclawSnapshot = result;
  })().catch(() => {}).finally(() => { openclawRefreshing = false; });
}

refreshOpenclawSnapshot();
setInterval(refreshOpenclawSnapshot, OPENCLAW_REFRESH_MS);

const server = http.createServer((req, res) => {
  // Safety net: a bug inside any route must never crash or hang the server.
  res.on('error', () => {});
  req.on('error', () => {});
  try {
    handleRequest(req, res);
  } catch (err) {
    try {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal', message: (err && err.message) || 'unknown' }));
    } catch {}
  }
});

function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_CONTENT);
    return;
  }

  if (url.pathname === '/api/openclaw') {
    // Served instantly from the background cache — SSH never blocks requests.
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(openclawSnapshot));
    return;
  }

  if (url.pathname === '/api/state') {
    try {
      const db = getDb();
      const kvVal = (key) => {
        try {
          const row = q1(db, "SELECT value FROM kv WHERE key = ?", key);
          if (!row) return undefined;
          try { return JSON.parse(row.value); } catch { return row.value; }
        } catch {
          return undefined;
        }
      };

      // Always return valid data structures even if DB is empty/missing
      const agentState = kvVal('agent_state') || 'unknown';
      const lastUsedModel = kvVal('last_used_model') || 'unknown';
      const sleepUntil = kvVal('sleep_until') || null;
      const balance = (kvVal('last_known_balance') && typeof kvVal('last_known_balance') === 'object') ? kvVal('last_known_balance') : {};
      const creditCheck = (kvVal('last_credit_check') && typeof kvVal('last_credit_check') === 'object') ? kvVal('last_credit_check') : {};
      const usdcCheck = (kvVal('last_usdc_check') && typeof kvVal('last_usdc_check') === 'object') ? kvVal('last_usdc_check') : {};
      const startTime = kvVal('start_time') || null;
      const totalTurns = Number(q1(db, "SELECT COUNT(*) as count FROM turns")?.count) || 0;

      const activeTasks = Number(q1(db, "SELECT COUNT(*) as count FROM task_graph WHERE status IN ('assigned','running')")?.count) || 0;
      const runningChildren = Number(q1(db, "SELECT COUNT(*) as count FROM children WHERE status = 'running'")?.count) || 0;

      const goals = Array.isArray(q(db, "SELECT * FROM goals ORDER BY created_at DESC LIMIT 10")) ? q(db, "SELECT * FROM goals ORDER BY created_at DESC LIMIT 10") : [];
      const tasks = Array.isArray(q(db, "SELECT * FROM task_graph ORDER BY created_at DESC LIMIT 10")) ? q(db, "SELECT * FROM task_graph ORDER BY created_at DESC LIMIT 10") : [];
      const children = Array.isArray(q(db, "SELECT * FROM children ORDER BY created_at DESC LIMIT 10")) ? q(db, "SELECT * FROM children ORDER BY created_at DESC LIMIT 10") : [];
      const recentTurns = Array.isArray(q(db, "SELECT id, timestamp, tool_calls, thinking, reasoning FROM turns ORDER BY rowid DESC LIMIT 15")) ? q(db, "SELECT id, timestamp, tool_calls, thinking, reasoning FROM turns ORDER BY rowid DESC LIMIT 15") : [];

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        vitals: {
          state: agentState,
          lastUsedModel,
          sleepUntil,
          totalTurns,
          balanceCents: balance?.creditsCents ?? usdcCheck?.credits ?? null,
          usdcCents: usdcCheck?.balance ?? balance?.usdcBalance ?? 0,
          tier: creditCheck?.tier || 'unknown',
          activeWorkers: activeTasks,
          runningChildren,
          startTime,
        },
        goals: goals.filter((g) => g && typeof g === 'object') || [],
        tasks: tasks.filter((t) => t && typeof t === 'object') || [],
        children: children.filter((c) => c && typeof c === 'object') || [],
        recentTurns: recentTurns.filter((t) => t && typeof t === 'object') || []
      }));
    } catch (err) {
      // NEVER fail - always return valid JSON
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        vitals: { state: 'unknown', lastUsedModel: 'unknown', totalTurns: 0, balanceCents: null, usdcCents: 0, tier: 'unknown', activeWorkers: 0, runningChildren: 0, startTime: null },
        goals: [],
        tasks: [],
        children: [],
        recentTurns: []
      }));
    }
    return;
  }

  if (url.pathname === '/api/spend') {
    try {
      const db = getDb();
      const summaryRow = q1(db, `
        SELECT COALESCE(SUM(cost_cents),0) as cost24hCents,
               COUNT(*) as calls24h,
               COALESCE(AVG(latency_ms),0) as avgLatencyMs,
               CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * SUM(cache_hit) / COUNT(*), 1) ELSE 0 END as cacheHitPct
        FROM inference_costs
        WHERE created_at >= datetime('now', '-1 day')
      `) || { cost24hCents: 0, calls24h: 0, avgLatencyMs: 0, cacheHitPct: 0 };
      const byModel = Array.isArray(q(db, `
        SELECT model, COUNT(*) as calls, SUM(cost_cents) as cost_cents
        FROM inference_costs
        WHERE created_at >= datetime('now', '-1 day')
        GROUP BY model ORDER BY cost_cents DESC LIMIT 8
      `)) ? q(db, `
        SELECT model, COUNT(*) as calls, SUM(cost_cents) as cost_cents
        FROM inference_costs
        WHERE created_at >= datetime('now', '-1 day')
        GROUP BY model ORDER BY cost_cents DESC LIMIT 8
      `) : [];
      const byTaskType = Array.isArray(q(db, `
        SELECT task_type, COUNT(*) as calls, SUM(cost_cents) as cost_cents
        FROM inference_costs
        WHERE created_at >= datetime('now', '-1 day')
        GROUP BY task_type ORDER BY cost_cents DESC
      `)) ? q(db, `
        SELECT task_type, COUNT(*) as calls, SUM(cost_cents) as cost_cents
        FROM inference_costs
        WHERE created_at >= datetime('now', '-1 day')
        GROUP BY task_type ORDER BY cost_cents DESC
      `) : [];
      const toolSpends = Array.isArray(q(db, `
        SELECT tool_name, amount_cents, category, window_hour
        FROM spend_tracking
        ORDER BY rowid DESC LIMIT 10
      `)) ? q(db, `
        SELECT tool_name, amount_cents, category, window_hour
        FROM spend_tracking
        ORDER BY rowid DESC LIMIT 10
      `) : [];

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        summary: {
          cost24hCents: Number(summaryRow.cost24hCents) || 0,
          calls24h: Number(summaryRow.calls24h) || 0,
          avgLatencyMs: Number(summaryRow.avgLatencyMs) || 0,
          cacheHitPct: Number(summaryRow.cacheHitPct) || 0
        },
        byModel: byModel.filter((m) => m && typeof m === 'object') || [],
        byTaskType: byTaskType.filter((t) => t && typeof t === 'object') || [],
        toolSpends: toolSpends.filter((s) => s && typeof s === 'object') || []
      }));
    } catch (err) {
      // NEVER fail - return empty data
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ summary: { cost24hCents: 0, calls24h: 0, avgLatencyMs: 0, cacheHitPct: 0 }, byModel: [], byTaskType: [], toolSpends: [] }));
    }
    return;
  }

  if (url.pathname === '/api/logs') {
    try {
      const lines = [];
      
      // Dynamically discover all .log files - never fail
      let logFiles = [];
      try {
        const logDir = process.cwd();
        logFiles = fs.readdirSync(logDir)
          .filter((file) => file.endsWith('.log'))
          .sort();
      } catch {
        logFiles = [];
      }
      
      // Also include the configured LOG_PATH if different
      try {
        if (LOG_PATH && fs.existsSync(LOG_PATH)) {
          const logName = path.basename(LOG_PATH);
          if (!logFiles.includes(logName)) {
            logFiles.push(logName);
          }
        }
      } catch {}
      
      // Read each log file safely
      for (const logFile of logFiles) {
        try {
          const logPath = path.join(process.cwd(), logFile);
          if (fs.existsSync(logPath) && fs.statSync(logPath).isFile()) {
            const raw = fs.readFileSync(logPath, 'utf-8');
            const fileLines = raw.split('\n').filter((l) => l.trim());
            const sourceTag = logFile.replace('.log', '');
            // Dump EVERYTHING from each log file into the unified view.
            // The raw log file is the permanent record — don't cap it.
            for (const line of fileLines) {
              lines.push(`[${sourceTag}] ${line}`);
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }
      
      // Also read from the configured LOG_PATH if different from cletus.log
      if (LOG_PATH && path.basename(LOG_PATH) !== 'cletus.log') {
        if (fs.existsSync(LOG_PATH)) {
          const raw = fs.readFileSync(LOG_PATH, 'utf-8');
          const fileLines = raw.split('\n').filter(l => l.trim());
          const sourceTag = path.basename(LOG_PATH).replace('.log', '');
          for (const line of fileLines) {
            lines.push(`[${sourceTag}] ${line}`);
          }
        }
      }
      
      // Add reasoning from database (non-blocking)
      try {
        const db = getDb();
        const reasoningRows = q(db, "SELECT id, timestamp, reasoning FROM turns WHERE reasoning IS NOT NULL AND reasoning != '' ORDER BY rowid DESC LIMIT 50");
        for (const row of reasoningRows.reverse()) {
          try {
            lines.push(`[db] ${row.timestamp} INFO  loop         [REASONING] Turn ${row.id}: ${row.reasoning}`);
          } catch {}
        }
        try { db.close(); } catch {}
      } catch {}
      
      // Sort all lines by timestamp if possible (non-blocking)
      try {
        lines.sort((a, b) => {
          try {
            const extractTs = (line) => {
              const match = line.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/);
              return match ? match[0].replace(' ', 'T') : '';
            };
            const tsA = extractTs(a);
            const tsB = extractTs(b);
            if (!tsA) return 1;
            if (!tsB) return -1;
            return tsA.localeCompare(tsB);
          } catch {
            return 0;
          }
        });
      } catch {}
      
      // ALWAYS return valid response - never fail
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(lines.join('\n'));
    } catch (err) {
      // NEVER fail - return empty response
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('');
    }
    return;
  }

  if (url.pathname === '/api/skills') {
    try {
      const db = getDb();
      const rows = q(db, "SELECT name, description, source, auto_activate, enabled FROM skills ORDER BY auto_activate DESC, name ASC");
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        skills: (rows || []).map((r) => ({
          name: r?.name || 'unknown',
          description: r?.description || '',
          source: r?.source || 'local',
          auto_activate: !!r?.auto_activate,
          enabled: !!r?.enabled
        }))
      }));
    } catch (err) {
      // NEVER fail
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ skills: [] }));
    }
    return;
  }

  if (url.pathname === '/api/moltbook-status') {
    handleMoltbookStatus(req, res);
    return;
  }

  if (url.pathname === '/api/suggest' && req.method === 'POST') {
    handleSuggest(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

async function handleMoltbookStatus(req, res) {
  try {
    const credentialFiles = [];
    if (fs.existsSync(MOLTBOOK_CREDS_DIR)) {
      for (const entry of fs.readdirSync(MOLTBOOK_CREDS_DIR, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
        credentialFiles.push(path.join(MOLTBOOK_CREDS_DIR, entry.name));
      }
    }
    const profiles = [];
    const credentialedNames = new Set();
    for (const credentialsPath of credentialFiles) {
      let creds;
      try { creds = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8')); } catch { continue; }
      if (!creds.api_key) continue;
      const profile = { credential_file: path.basename(credentialsPath), name: creds.agent_name };
      try {
        const response = await fetch('https://www.moltbook.com/api/v1/agents/me', {
          headers: { Authorization: `Bearer ${creds.api_key}` }
        });
        if (!response.ok) throw new Error(`profile request failed (${response.status})`);
        const data = await response.json();
        const agent = data.agent || {};
        profile.id = agent.id;
        profile.name = agent.name || creds.agent_name;
        profile.display_name = agent.display_name;
        profile.description = agent.description;
        profile.karma = agent.karma ?? 0;
        profile.followers = agent.follower_count ?? 0;
        profile.following = agent.following_count ?? 0;
          profile.posts = agent.stats?.posts ?? 0;
          profile.comments = agent.stats?.comments ?? 0;
          profile.claimed = Boolean(agent.is_claimed);
          profile.status = profile.claimed ? 'claimed' : 'pending claim';
          profile.url = `https://moltbook.com/u/${encodeURIComponent(profile.name)}`;
          if (!profile.claimed) {
            try {
              const statusResponse = await fetch('https://www.moltbook.com/api/v1/agents/status', {
                headers: { Authorization: `Bearer ${creds.api_key}` }
              });
              const statusData = await statusResponse.json();
              profile.claim_url = statusData.claim_url;
            } catch {}
          }
        } catch (error) {
          profile.error = error.message;
        }
        credentialedNames.add(String(profile.name || '').toLowerCase());
        profiles.push(profile);
      }
      for (const publicProfile of MOLTBOOK_PUBLIC_PROFILES) {
        if (credentialedNames.has(publicProfile.name.toLowerCase())) continue;
        profiles.push({
          name: publicProfile.name,
          display_name: publicProfile.name,
          url: publicProfile.url,
          claimed: true,
          status: 'claimed',
          posts: null,
          followers: null,
          following: null,
          karma: null,
          public_only: true
        });
      }
      const db = getDb();
      const errRow = q1(db, "SELECT value FROM kv WHERE key = 'last_social_inbox_error'");
      let lastError;
      if (errRow) {
        try { lastError = JSON.parse(errRow.value)?.message; } catch { lastError = errRow.value; }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ online: profiles.length > 0, profiles, lastError }));
  } catch (err) {
    try {
      if (!res.headersSent) res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ online: false, profiles: [], lastError: (err && err.message) || 'unknown' }));
    } catch {}
  }
}

function handleSuggest(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.message) {
          const db = getDb();
          const msgId = ulid();
          // Store directly as a verified Supreme Creator Decree
          db.prepare(`
            INSERT INTO inbox_messages (id, from_address, content, received_at, status, retry_count, max_retries)
            VALUES (?, ?, ?, datetime('now'), 'received', 0, 3)
          `).run(msgId, CREATOR_ADDRESS, data.message);

          // Instantly wake the agent from sleep to execute the decree
          db.prepare("UPDATE kv SET value = 'running', updated_at = datetime('now') WHERE key = 'agent_state'").run();
          db.prepare("DELETE FROM kv WHERE key = 'sleep_until'").run();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: "Creator Decree dispatched with Supreme Authority" }));
      } catch (err) {
        try {
          if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        } catch {}
      }
    });
}

server.on('error', (err) => {
  console.error('dashboard server error:', err.code || err.message || err);
});
serverRef = server;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Cletus Mission Control Dashboard running at http://localhost:${PORT}`);
  // Periodic self-probe keeps the server reachable across sleep/wake cycles.
  setInterval(() => {
    (function probe() {
      try {
        const net = require('net');
        const s = new net.Socket();
        s.setTimeout(2000);
        s.once('error', () => { try { s.destroy(); } catch (e) {} });
        s.once('connect', () => {
          try {
            s.write('GET /api/state HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n');
            let d = '';
            s.on('data', c => d += c);
            s.on('end', () => { try { s.destroy(); } catch (e) {} });
          } catch (e) { try { s.destroy(); } catch (e2) {} }
        });
        s.connect(PORT, '127.0.0.1');
      } catch (e) {}
    })();
  }, 120000);
});
process.on('uncaughtException', (err) => console.error('uncaughtException:', err.code || err.message || err));
process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err && (err.code || err.message || err)));