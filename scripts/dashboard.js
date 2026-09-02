import http from 'http';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { ulid } from 'ulid';

const PORT = process.env.DASHBOARD_PORT || 18888;
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
    .header-badges { display: flex; gap: 10px; align-items: center; }
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
    .item-card-title { font-weight: 600; font-size: 14px; margin-bottom: 6px; display: flex; justify-content: space-between; }
    .item-card-desc { font-size: 12px; color: var(--text-muted); }

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
          <div class="brand-title">Automaton Mission Control</div>
          <div class="brand-subtitle">Autonomous AI Agent Runtime & Sub-Agent Orchestrator</div>
        </div>
      </div>
      <div class="header-badges">
        <button id="btnPauseFeed" class="btn-pause" onclick="togglePauseFeed()">
          <span>⏸️</span> <span id="pauseText">Pause Auto-Refresh</span>
        </button>
        <div id="stateBadge" class="badge running"><span class="badge-dot"></span> <span id="stateText">RUNNING</span></div>
        <div class="badge" style="background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); border: 1px solid rgba(139, 92, 246, 0.3);">
          Bank: automaton
        </div>
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

    <!-- Quick Directive Dispatch -->
    <div class="card">
      <div class="card-title">Send Creator Directive / Suggestion</div>
      <form id="suggestForm" class="suggestion-box">
        <input type="text" id="suggestInput" class="input-field" placeholder="Type instruction for agent...">
        <button type="submit" class="btn">Dispatch</button>
      </form>
    </div>

    <!-- Vitals Grid -->
    <div class="grid-vitals">
      <div class="card">
        <div class="card-title">Active Inference Model</div>
        <div id="activeModel" class="card-value">-</div>
        <div class="card-sub">High-capacity primary engine</div>
      </div>
      <div class="card">
        <div class="card-title">Compute Budget</div>
        <div id="credits" class="card-value">$10.00</div>
        <div class="card-sub">Operational Floor Active</div>
      </div>
      <div class="card">
        <div class="card-title">Total Turns Completed</div>
        <div id="totalTurns" class="card-value">-</div>
        <div class="card-sub">Recorded in state.db</div>
      </div>
      <div class="card">
        <div class="card-title">Active Sub-Agents</div>
        <div id="activeWorkers" class="card-value">0</div>
        <div class="card-sub">Local in-process + sandboxes</div>
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
        </div>
        <div id="childrenList" class="item-list">
          <div class="item-card">No spawned workers recorded yet.</div>
        </div>
      </div>
    </div>

    <!-- Portfolio & Investments -->
    <div class="card">
      <div class="section-header">
        <div class="section-title">💰 Portfolio & Investments</div>
        <div style="font-size: 11px; color: var(--text-muted);">Track buys, sells, earnings</div>
      </div>
      <div id="portfolioPanel">
        <div class="item-card">Loading portfolio...</div>
      </div>
    </div>

    <!-- Skills Library -->
    <div class="card">
      <div class="section-header">
        <div class="section-title">🧠 Skills Library</div>
        <div style="font-size: 11px; color: var(--text-muted);">Installed skills & sources</div>
      </div>
      <div id="skillsPanel">
        <div class="item-card">Loading skills...</div>
      </div>
    </div>

    <!-- Invoices & Receivables -->
    <div class="card">
      <div class="section-header">
        <div class="section-title">📋 Invoices & Receivables</div>
        <div style="font-size: 11px; color: var(--text-muted);">Outstanding payments owed</div>
      </div>
      <div id="invoicesPanel">
        <div class="item-card">Loading invoices...</div>
      </div>
    </div>

    <!-- Moltbook Status -->
    <div class="card">
      <div class="section-header">
        <div class="section-title">🦞 Moltbook Agent Social</div>
        <div style="font-size: 11px; color: var(--text-muted);">Agent identity & engagement</div>
      </div>
      <div id="moltbookPanel">
        <div class="item-card">
          <div class="item-card-desc">Moltbook integration available. Use moltbook_register, moltbook_post, moltbook_feed tools.</div>
        </div>
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
          <button id="btnFilterError" class="log-filter-btn" onclick="setLogFilter('err')">ERRORS</button>
          <button id="btnAutoscroll" class="log-filter-btn" onclick="toggleAutoscroll()">Autoscroll: ON</button>
        </div>
      </div>
      <div id="terminal" class="terminal-container">
        Loading unified logs...
      </div>
    </div>
  </div>

  <script>
    let isPaused = false;
    let currentFilter = 'all';
    let autoscrollEnabled = true;
    let allLogLines = [];
    let knownTurnIds = '';
    let turnsCache = [];

    function togglePauseFeed() {
      isPaused = !isPaused;
      const btn = document.getElementById('btnPauseFeed');
      const text = document.getElementById('pauseText');
      btn.classList.toggle('paused', isPaused);
      text.innerText = isPaused ? '▶️ Resume Auto-Refresh' : '⏸️ Pause Auto-Refresh';
    }

    function openModal(turnId) {
      const turn = turnsCache.find(t => t.id === turnId);
      if (!turn) return;
      document.getElementById('modalTitle').innerText = 'Turn ' + turn.id.slice(-8) + ' (' + new Date(turn.timestamp).toLocaleTimeString() + ')';
      
      let toolsStr = '';
      try {
        const tc = JSON.parse(turn.tool_calls || '[]');
        if (tc.length > 0) {
          toolsStr = '\\n--- TOOLS INVOKED ---\\n' + tc.map(x => x.name + '(' + JSON.stringify(x.arguments, null, 2) + ')').join('\\n\\n') + '\\n\\n';
        }
      } catch(e) {}

      document.getElementById('modalBody').innerText = (toolsStr ? toolsStr + '--- RAW THOUGHT ---\\n' : '') + (turn.thinking || 'No raw thinking recorded.');
      document.getElementById('modalOverlay').classList.add('open');
    }

    function closeModal() {
      document.getElementById('modalOverlay').classList.remove('open');
    }

    function setLogFilter(filter) {
      currentFilter = filter;
      document.querySelectorAll('.log-filter-btn').forEach(b => {
        if (b.id === 'btnFilter' + filter.charAt(0).toUpperCase() + filter.slice(1)) b.classList.add('active');
        else if (b.id !== 'btnAutoscroll') b.classList.remove('active');
      });
      renderLogs();
    }

    function toggleAutoscroll() {
      autoscrollEnabled = !autoscrollEnabled;
      const btn = document.getElementById('btnAutoscroll');
      btn.innerText = 'Autoscroll: ' + (autoscrollEnabled ? 'ON' : 'OFF');
      btn.classList.toggle('active', autoscrollEnabled);
      if (autoscrollEnabled) {
        const terminal = document.getElementById('terminal');
        terminal.scrollTop = terminal.scrollHeight;
      }
    }

    function renderLogs() {
      const terminal = document.getElementById('terminal');
      const wasAtBottom = (terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight) < 40;
      const prevScrollTop = terminal.scrollTop;

      const filtered = allLogLines.filter(l => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'tool') return l.includes('TOOL') || l.includes('TOOL RESULT') || l.includes('exec') || l.includes('browser_');
        if (currentFilter === 'thought') return l.includes('THOUGHT') || l.includes('<thought>') || l.includes('thinking');
        if (currentFilter === 'err') return l.includes('ERROR') || l.includes('failed') || l.includes('WARN');
        return true;
      });

      terminal.innerHTML = filtered.map(l => {
        let cls = 'log-line';
        if (l.includes('ERROR') || l.includes('failed')) cls += ' log-err';
        else if (l.includes('WARN')) cls += ' log-warn';
        else if (l.includes('TOOL RESULT')) cls += ' log-tool';
        else if (l.includes('TOOL')) cls += ' log-tool';
        else if (l.includes('THOUGHT') || l.includes('<thought>')) cls += ' log-thought';
        else if (l.includes('INFO')) cls += ' log-info';
        return '<div class="' + cls + '">' + escapeHtml(l) + '</div>';
      }).join('');

      if (autoscrollEnabled && wasAtBottom) {
        terminal.scrollTop = terminal.scrollHeight;
      } else {
        terminal.scrollTop = prevScrollTop;
      }
    }

    async function fetchData() {
      if (isPaused) return;

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
        document.getElementById('activeWorkers').innerText = (stateRes.tasks || []).filter(t => t.status === 'assigned' || t.status === 'in_progress').length;

        // 2. Update Goals (Preserve scroll)
        const goalsList = document.getElementById('goalsList');
        const prevGoalsScroll = goalsList.scrollTop;
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
        goalsList.scrollTop = prevGoalsScroll;

        // 3. Update Tasks (Preserve scroll)
        const tasksList = document.getElementById('tasksList');
        const prevTasksScroll = tasksList.scrollTop;
        if (stateRes.tasks && stateRes.tasks.length > 0) {
          tasksList.innerHTML = stateRes.tasks.map(t => \`
            <div class="item-card">
              <div class="item-card-title">
                <span>\${t.title || 'Task'}</span>
                <span style="font-size: 11px; color: var(--accent-cyan); font-weight: 600;">\${t.status} [\${t.agent_role || 'generalist'}]</span>
              </div>
              <div class="item-card-desc">\${t.description || ''}</div>
              \${t.result ? \`<div style="font-family: monospace; font-size: 11px; color: #a78bfa; margin-top: 4px; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px;">\${t.result.slice(0, 180)}</div>\` : ''}
            </div>
          \`).join('');
        } else {
          tasksList.innerHTML = '<div class="item-card"><div class="item-card-desc">No tasks in graph.</div></div>';
        }
        tasksList.scrollTop = prevTasksScroll;

        // 4. Update Cognitive Thoughts & Turns (Keyed diff - only re-render if turns changed!)
        turnsCache = stateRes.recentTurns || [];
        const newTurnIds = turnsCache.map(t => t.id).join(',');
        if (newTurnIds !== knownTurnIds) {
          knownTurnIds = newTurnIds;
          const thoughtsList = document.getElementById('thoughtsList');
          const prevThoughtsScroll = thoughtsList.scrollTop;

          if (turnsCache.length > 0) {
            thoughtsList.innerHTML = turnsCache.map(turn => {
              let toolsStr = '';
              try {
                const tc = JSON.parse(turn.tool_calls || '[]');
                if (tc.length > 0) {
                  toolsStr = tc.map(x => x.name + '(' + JSON.stringify(x.arguments || {}).slice(0, 40) + ')').join(', ');
                }
              } catch(e) {}
              return \`
                <div class="item-card clickable" onclick="openModal('\${turn.id}')">
                  <div class="item-card-title">
                    <span style="color: var(--accent-emerald);">Turn \${turn.id.slice(-6)}</span>
                    <span style="font-size: 11px; color: var(--text-muted);">\${new Date(turn.timestamp).toLocaleTimeString()}</span>
                  </div>
                  \${toolsStr ? \`<div style="font-size: 12px; color: #a78bfa; margin-bottom: 4px;">🛠️ \${toolsStr}</div>\` : ''}
                  <div class="item-card-desc" style="max-height: 90px; overflow: hidden; text-overflow: ellipsis; color: #e5e7eb; font-family: 'Fira Code', monospace; font-size: 11px;">\${turn.thinking || 'No raw thinking recorded.'}</div>
                </div>
              \`;
            }).join('');
          }
          thoughtsList.scrollTop = prevThoughtsScroll;
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
              <div class="item-card-desc">Role: \${c.agent_role || 'worker'} | Last Active: \${c.last_active || 'now'}</div>
            </div>
          \`).join('');
        } else {
          childrenList.innerHTML = '<div class="item-card"><div class="item-card-desc">All worker tasks are executing locally in-process via inherited model.</div></div>';
        }

        // 6. Update Portfolio
        try {
          const portRes = await fetch('/api/portfolio').then(r => r.json());
          const panel = document.getElementById('portfolioPanel');
          panel.querySelector('.empty-row').style.display = portRes.items.length === 0 ? '' : 'none';
          panel.querySelectorAll('.portfolio-asset-row').forEach(el => el.remove());
          for (const a of portRes.items) {
            const tr = document.createElement('tr');
            tr.className = 'portfolio-asset-row';
            tr.innerHTML = `<td><div class="p-name">${a.label}</div><div class="empty">${a.detail || ''}</div></td>`;
            panel.querySelector('.table-body').appendChild(tr);
          }
        } catch (err) { console.error('Portfolio fetch:', err); }

        // 7. Update Skills Inventory
        try {
          const skillsRes = await fetch('/api/skills').then(r => r.json());
          const sPanel = document.getElementById('skillsPanel');
          sPanel.querySelector('.empty-row').style.display = skillsRes.skills.length === 0 ? '' : 'none';
          sPanel.querySelectorAll('.skill-row').forEach(el => el.remove());
          for (const s of skillsRes.skills.slice(0, 20)) {
            const tr = document.createElement('tr');
            tr.className = 'skill-row';
            tr.innerHTML = `<td><div class="p-name">${s.name}</div><div class="empty">${s.source} · ${s.tags || ''}</div></td>`;
            sPanel.querySelector('.table-body').appendChild(tr);
          }
        } catch (err) { console.error('Skills fetch:', err); }

        // 8. Update Invoices
        try {
          const invRes = await fetch('/api/invoices').then(r => r.json());
          const iPanel = document.getElementById('invoicesPanel');
          iPanel.querySelector('.empty-row').style.display = invRes.invoices.length === 0 ? '' : 'none';
          iPanel.querySelectorAll('.invoice-row').forEach(el => el.remove());
          for (const inv of invRes.invoices.slice(0, 20)) {
            const tr = document.createElement('tr');
            tr.className = 'invoice-row';
            tr.innerHTML = `<td><div>${inv.invoice_id}</div><div>${inv.amount_cents}¢ · ${inv.status}</div><div class="empty">${inv.description || ''}</div></td>`;
            iPanel.querySelector('.table-body').appendChild(tr);
          }
        } catch (err) { console.error('Invoices fetch:', err); }

        // 9. Update Moltbook Status
        try {
          const mbRes = await fetch('/api/moltbook-status').then(r => r.json());
          const mbPanel = document.getElementById('moltbookPanel');
          mbPanel.querySelector('.status-row').innerHTML = `<td><div class="p-name">Moltbook</div><div class="empty">${mbRes.online ? (mbRes.identity ? 'Registered · key set (' + mbRes.identity.length + ' chars)' : 'Registered') : 'Offline / not registered'}</div></td>`;
        } catch (err) { console.error('Moltbook status fetch:', err); }

        // 10. Update Logs
        allLogLines = logRes.split('\\n').filter(Boolean);
        renderLogs();
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

    // Initial panel fetches (extra round before log stream starts)
    (async () => {
      try {
        const p = await fetch('/api/portfolio').then(r => r.json());
        const sp = document.getElementById('portfolioPanel');
        sp.querySelector('.empty-row').style.display = p.items.length === 0 ? '' : 'none';
        for (const a of p.items) {
          const tr = document.createElement('tr');
          tr.className = 'portfolio-asset-row';
          tr.innerHTML = `<td><div class="p-name">${a.label}</div><div class="empty">${a.detail || ''}</div></td>`;
          sp.querySelector('.table-body').appendChild(tr);
        }

        const sk = await fetch('/api/skills').then(r => r.json());
        const skP = document.getElementById('skillsPanel');
        skP.querySelector('.empty-row').style.display = sk.skills.length === 0 ? '' : 'none';
        for (const s of sk.skills.slice(0, 20)) {
          const tr = document.createElement('tr');
          tr.className = 'skill-row';
          tr.innerHTML = `<td><div class="p-name">${s.name}</div><div class="empty">${s.source} · ${s.tags || ''}</div></td>`;
          skP.querySelector('.table-body').appendChild(tr);
        }

        const inv = await fetch('/api/invoices').then(r => r.json());
        const iP = document.getElementById('invoicesPanel');
        iP.querySelector('.empty-row').style.display = inv.invoices.length === 0 ? '' : 'none';
        for (const i of inv.invoices.slice(0, 20)) {
          const tr = document.createElement('tr');
          tr.className = 'invoice-row';
          tr.innerHTML = `<td><div>${i.invoice_id}</div><div>${i.amount_cents}¢ · ${i.status}</div><div class="empty">${i.description || ''}</div></td>`;
          iP.querySelector('.table-body').appendChild(tr);
        }

        const mb = await fetch('/api/moltbook-status').then(r => r.json());
        const mbP = document.getElementById('moltbookPanel');
        mbP.querySelector('.status-row').innerHTML = `<td><div class="p-name">Moltbook</div><div class="empty">${mb.online ? (mb.identity ? 'Registered · key set (' + mb.identity.length + ' chars)' : 'Registered') : 'Offline / not registered'}</div></td>`;
      } catch (e) { console.warn('Initial panel fetch skipped:', e); }
    })();

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
      const recentTurns = db.prepare("SELECT id, timestamp, tool_calls, thinking FROM turns ORDER BY rowid DESC LIMIT 15").all();

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
      const lines = [];
      if (fs.existsSync(LOG_PATH)) {
        const raw = fs.readFileSync(LOG_PATH, 'utf-8');
        lines.push(...raw.split('\n').slice(-300));
      }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(lines.join('\n'));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error reading log: ' + err.message);
    }
    return;
  }

  if (url.pathname === '/api/portfolio') {
    try {
      const portfolioPath = path.join(path.dirname(DB_PATH), '..', 'portfolio', 'transactions.json');
      let txs = [];
      if (fs.existsSync(portfolioPath)) {
        txs = JSON.parse(fs.readFileSync(portfolioPath, 'utf-8'));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ transactions: txs }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === '/api/skills') {
    try {
      const skillsDir = path.join(path.dirname(DB_PATH), 'skills');
      const skills = [];
      if (fs.existsSync(skillsDir)) {
        const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
          const sourcePath = path.join(skillsDir, entry.name, 'SOURCE.json');
          if (fs.existsSync(skillPath)) {
            try {
              const content = fs.readFileSync(skillPath, 'utf-8');
              const descMatch = content.match(/^---\n[\s\S]*?description:\s*"([^"]+)"/);
              const src = fs.existsSync(sourcePath) ? JSON.parse(fs.readFileSync(sourcePath, 'utf-8')).source : 'local';
              skills.push({ name: entry.name, description: descMatch?.[1] || 'No description', source: src });
            } catch {}
          }
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ skills }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === '/api/invoices') {
    try {
      const invoicesDir = path.join(path.dirname(DB_PATH), '..', 'invoices');
      const invoices = [];
      if (fs.existsSync(invoicesDir)) {
        const entries = fs.readdirSync(invoicesDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const invoicePath = path.join(invoicesDir, entry.name, 'invoice.json');
          if (fs.existsSync(invoicePath)) {
            try {
              invoices.push(JSON.parse(fs.readFileSync(invoicePath, 'utf-8')));
            } catch {}
          }
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ invoices }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
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
