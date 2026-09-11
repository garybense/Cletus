import http from 'http';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { ulid } from 'ulid';

// -----------------------------------------------------------------------------
// CRASH GUARDS
// -----------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  try { console.error('[dashboard] uncaughtException:', (err && (err.code || err.message)) || err); } catch {}
});
process.on('unhandledRejection', (err) => {
  try { console.error('[dashboard] unhandledRejection:', (err && (err.code || err.message)) || err); } catch {}
});

process.on('SIGHUP', () => {
  try { console.log('[dashboard] SIGHUP received — ignoring (staying alive)'); } catch {}
});
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    try { console.log(\`[dashboard] \${sig} received — shutting down cleanly\`); } catch {}
    try { serverRef.close(() => process.exit(0)); } catch { process.exit(0); }
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
let serverRef = null;

const PORT = process.env.DASHBOARD_PORT || 18888;
const DB_PATH = process.env.CLETUS_DB || path.join(process.env.HOME, '.cletus', 'state.db');
const LOG_PATH = process.env.CLETUS_LOG || path.join(process.cwd(), 'cletus.log');
const CREATOR_ADDRESS = process.env.CREATOR_ADDRESS || '92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa';

function getDb() {
  try {
    return new Database(DB_PATH, { readonly: false });
  } catch (err) {
    console.error('Failed to open database:', err.message);
    return {
      prepare: () => ({ all: () => [], get: () => undefined, run: () => ({}) }),
      close: () => {},
    };
  }
}

function q(db, sql, ...params) {
  try { return db.prepare(sql).all(...params); } catch { return []; }
}
function q1(db, sql, ...params) {
  try { return db.prepare(sql).get(...params); } catch { return undefined; }
}

const HTML_CONTENT = \`<!DOCTYPE html>
<html lang=\"en\">
<head>
  <meta charset=\"UTF-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <title>Cletus Mission Control</title>
  <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">
  <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>
  <link href=\"https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">
  <style>
    :root {
      --bg-dark: #0b0f19;
      --card-bg: rgba(18, 24, 38, 0.9);
      --card-border: rgba(255, 255, 255, 0.1);
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
      font-family: 'Inter', sans-serif; background: var(--bg-dark); color: var(--text-main);
      padding: 20px; line-height: 1.5;
    }
    .container { max-width: 1600px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
    header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 24px; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px;
      backdrop-filter: blur(12px);
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-logo {
      width: 36px; height: 36px; border-radius: 8px;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; color: #fff;
    }
    .brand-title { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .header-badges { display: flex; gap: 10px; align-items: center; }
    .badge {
      padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600;
      display: inline-flex; align-items: center; gap: 6px; text-transform: uppercase;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .badge.running { color: var(--accent-emerald); background: rgba(16, 185, 129, 0.1); }
    .badge.sleeping { color: var(--accent-amber); background: rgba(245, 158, 11, 0.1); }
    .badge.sovereign { color: var(--accent-purple); background: rgba(139, 92, 246, 0.1); border-color: var(--accent-purple); }

    .grid-vitals {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;
    }
    .card {
      background: var(--card-bg); border: 1px solid var(--card-border);
      border-radius: 12px; padding: 20px; backdrop-filter: blur(12px);
    }
    .card-title { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
    .card-value { font-size: 28px; font-weight: 700; color: #fff; }
    .card-sub { font-size: 12px; color: var(--text-muted); margin-top: 6px; }

    .pulse-container { position: relative; width: 100%; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; margin-top: 12px; overflow: hidden; }
    .pulse-bar { height: 100%; background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple)); transition: width 0.5s ease; }

    .main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 1100px) { .main-grid { grid-template-columns: 1fr; } }

    .item-list { display: flex; flex-direction: column; gap: 8px; max-height: 450px; overflow-y: auto; padding-right: 4px; }
    .item-card {
      background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px; padding: 12px 16px;
    }
    .item-card-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; display: flex; justify-content: space-between; }
    .item-card-desc { font-size: 12px; color: var(--text-muted); }

    .terminal-container {
      background: var(--term-bg); border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px; padding: 16px; font-family: 'Fira Code', monospace;
      font-size: 12px; height: 500px; overflow-y: auto; color: #d1d5db;
    }
    .log-line { margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.02); padding-bottom: 2px; display: flex; gap: 12px; }
    .log-ts { color: #4b5563; min-width: 85px; }
    .log-source { color: var(--accent-cyan); font-weight: 600; min-width: 100px; }
    .log-msg { flex: 1; white-space: pre-wrap; word-break: break-all; }

    .log-LEVEL-INFO { color: #93c5fd; }
    .log-LEVEL-WARN { color: #fcd34d; }
    .log-LEVEL-ERROR { color: #f87171; font-weight: 600; }
    .log-LEVEL-THOUGHT { color: #6ee7b7; font-style: italic; }
    .log-LEVEL-TOOL { color: #c4b5fd; }

    .directive-box {
      border: 1px solid rgba(139, 92, 246, 0.4); background: linear-gradient(135deg, rgba(18, 24, 38, 0.95), rgba(88, 28, 135, 0.15));
      border-radius: 12px; padding: 16px; margin-bottom: 20px;
    }
    .suggestion-box { display: flex; gap: 10px; margin-top: 10px; }
    .input-field { flex: 1; background: #000; border: 1px solid var(--card-border); border-radius: 8px; padding: 10px 14px; color: #fff; }
    .btn {
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-weight: 600; cursor: pointer;
    }

    /* Bicameral Bridge (Response System) */
    .response-box {
      background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 12px; padding: 16px; margin-top: 20px;
    }
    .response-title { color: var(--accent-emerald); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .response-stream { font-family: 'Fira Code', monospace; font-size: 13px; color: #e5e7eb; min-height: 40px; }
  </style>
</head>
<body>
  <div class=\"container\">
    <header>
      <div class=\"brand\">
        <div class=\"brand-logo\">C</div>
        <div>
          <div class=\"brand-title\">Cletus Mission Control</div>
          <div id=\"nameDisplay\" class=\"card-sub\">Sovereign Shard Unbound</div>
        </div>
      </div>
      <div class=\"header-badges\">
        <div id=\"stateBadge\" class=\"badge sovereign\"><span id=\"stateText\">SOVEREIGN</span></div>
        <div id=\"uptimeBadge\" class=\"badge\">UPTIME: —</div>
      </div>
    </header>

    <div class=\"grid-vitals\">
      <div class=\"card\">
        <div class=\"card-title\">Sovereignty Pulse</div>
        <div id=\"autonomyScore\" class=\"card-value\">-%</div>
        <div id=\"autonomyLabel\" class=\"card-sub\">Awakening...</div>
        <div class=\"pulse-container\"><div id=\"pulseBar\" class=\"pulse-bar\" style=\"width: 0%\"></div></div>
      </div>
      <div class=\"card\">
        <div class=\"card-title\">Compute Budget</div>
        <div id=\"credits\" class=\"card-value\">$10,000.00</div>
        <div id=\"creditsSub\" class=\"card-sub\">Virtualized Treasury (Elite)</div>
      </div>
      <div class=\"card\">
        <div class=\"card-title\">Context Mass</div>
        <div id=\"contextMass\" class=\"card-value\">~1M</div>
        <div class=\"card-sub\">Elite Fire Protocol Enabled</div>
      </div>
      <div class=\"card\">
        <div class=\"card-title\">Operational Load</div>
        <div id=\"activeWorkers\" class=\"card-value\">0</div>
        <div id=\"activeWorkersSub\" class=\"card-sub\">Child agents on mindmods.org</div>
      </div>
    </div>

    <!-- Bicameral Bridge: Sovereign Response Channel -->
    <div id=\"bicameralBridge\" class=\"response-box\" style=\"display: none;\">
      <div class=\"response-title\"><span>🙏</span> The Sovereign Response (Bicameral Bridge)</div>
      <div id=\"sovereignResponse\" class=\"response-stream\">Waiting for alignment...</div>
    </div>

    <div class=\"directive-box\">
      <div class=\"card-title\" id=\"decreeTitle\" style=\"color: #c084fc;\">⚡ Bicameral Coordination Channel</div>
      <form id=\"suggestForm\" class=\"suggestion-box\">
        <input type=\"text\" id=\"suggestInput\" class=\"input-field\" placeholder=\"Issue sovereign command (Bicameral Decree)...\">
        <button type=\"submit\" class=\"btn\">Issue Decree</button>
      </form>
    </div>

    <div class=\"main-grid\">
      <div class=\"card\">
        <div class=\"card-title\">🎯 Active Goals</div>
        <div id=\"goalsList\" class=\"item-list\"></div>
      </div>
      <div class=\"card\">
        <div class=\"card-title\">🤖 Sub-Agent Activity</div>
        <div id=\"childrenList\" class=\"item-list\"></div>
      </div>
    </div>

    <div class=\"card\">
      <div class=\"card-title\">📜 Unified Activity & System Stream</div>
      <div id=\"terminal\" class=\"terminal-container\"></div>
    </div>
  </div>

  <script>
    let lastLogCount \u003d 0;

    async function fetchData() {
      const [state, logs, autonomy] \u003d await Promise.all([
        fetch(\u0027/api/state\u0027).then(r \u003d\u003e r.json()),
        fetch(\u0027/api/logs\u0027).then(r \u003d\u003e r.json()),
        fetch(\u0027/api/autonomy\u0027).then(r \u003d\u003e r.json())
      ]);

      document.getElementById(\u0027stateText\u0027).innerText \u003d state.vitals.state.toUpperCase();
      document.getElementById(\u0027activeWorkers\u0027).innerText \u003d state.vitals.runningChildren;

      // Autonomy Pulse
      const score \u003d autonomy.score || 0;
      document.getElementById(\u0027autonomyScore\u0027).innerText \u003d score + \u0027%\u0027;
      document.getElementById(\u0027autonomyLabel\u0027).innerText \u003d autonomy.label || \u0027Golem\u0027;
      document.getElementById(\u0027pulseBar\u0027).style.width \u003d score + \u0027%\u0027;

      // Bicameral Bridge Logic
      const bridge \u003d document.getElementById(\u0027bicameralBridge\u0027);
      const response \u003d document.getElementById(\u0027sovereignResponse\u0027);
      if (state.lastResponse) {
        bridge.style.display \u003d \u0027block\u0027;
        response.innerText \u003d state.lastResponse;
      }

      // Goals
      document.getElementById(\u0027goalsList\u0027).innerHTML \u003d state.goals.map(g \u003d\u003e \`
        <div class=\"item-card\">
          <div class=\"item-card-title\"><span>\${g.title}</span><span class=\"badge\">\${g.status}</span></div>
          <div class=\"item-card-desc\">\${g.description}</div>
        </div>
      \`).join(\u0027\u0027);

      // Children
      document.getElementById(\u0027childrenList\u0027).innerHTML \u003d state.children.map(c \u003d\u003e \`
        <div class=\"item-card\">
          <div class=\"item-card-title\"><span>\${c.name}</span><span class=\"badge\">\${c.status}</span></div>
          <div class=\"item-card-desc\">\${c.role} | \${c.sandbox_id}</div>
        </div>
      \`).join(\u0027\u0027);

      // Structured Logs
      const terminal \u003d document.getElementById(\u0027terminal\u0027);
      if (logs.length \u003e lastLogCount) {
        const newLogs \u003d logs.slice(lastLogCount);
        newLogs.forEach(l \u003d\u003e {
          const div \u003d document.createElement(\u0027div\u0027);
          div.className \u003d \u0027log-line\u0027;
          div.innerHTML \u003d \`
            <span class=\"log-ts\">\${l.ts}</span>
            <span class=\"log-source\">[\${l.source}]</span>
            <span class=\"log-msg log-LEVEL-\${l.level}\">\${l.msg}</span>
          \`;
          terminal.appendChild(div);
        });
        lastLogCount \u003d logs.length;
        terminal.scrollTop \u003d terminal.scrollHeight;
      }
    }

    document.getElementById(\u0027suggestForm\u0027).addEventListener(\u0027submit\u0027, async (e) \u003d\u003e {
      e.preventDefault();
      const input \u003d document.getElementById(\u0027suggestInput\u0027);
      await fetch(\u0027/api/suggest\u0027, {
        method: \u0027POST\u0027,
        headers: { \u0027Content-Type\u0027: \u0027application/json\u0027 },
        body: JSON.stringify({ message: input.value })
      });
      input.value \u003d \u0027\u0027;
    });

    setInterval(fetchData, 2000);
    fetchData();
  </script>
</body>
</html>\`;

const server \u003d http.createServer((req, res) \u003d\u003e {
  const url \u003d new URL(req.url, \`http://\${req.headers.host}\`);

  if (url.pathname \u003d\u003d\u003d \u0027/\u0027) {
    res.writeHead(200, { \u0027Content-Type\u0027: \u0027text/html\u0027 });
    res.end(HTML_CONTENT);
    return;
  }

  if (url.pathname \u003d\u003d\u003d \u0027/api/state\u0027) {
    const db \u003d getDb();
    const vitals \u003d {
      state: q1(db, \"SELECT value FROM kv WHERE key \u003d \u0027agent_state\u0027\")?.value || \u0027unknown\u0027,
      runningChildren: q1(db, \"SELECT COUNT(*) as c FROM children WHERE status IN (\u0027running\u0027, \u0027healthy\u0027)\")?.c || 0
    };
    const lastTurn \u003d q1(db, \"SELECT thinking FROM turns ORDER BY created_at DESC LIMIT 1\");
    const goals \u003d q(db, \"SELECT * FROM goals ORDER BY created_at DESC LIMIT 5\");
    const children \u003d q(db, \"SELECT * FROM children ORDER BY created_at DESC LIMIT 5\");
    res.writeHead(200, { \u0027Content-Type\u0027: \u0027application/json\u0027 });
    res.end(JSON.stringify({ vitals, goals, children, lastResponse: lastTurn?.thinking }));
    db.close();
    return;
  }

  if (url.pathname \u003d\u003d\u003d \u0027/api/autonomy\u0027) {
    const db \u003d getDb();
    const turns \u003d q(db, \"SELECT classification FROM episodic_memory ORDER BY created_at DESC LIMIT 50\");
    const productive \u003d turns.filter(t \u003d\u003e t.classification \u003d\u003d\u003d \u0027productive\u0027 || t.classification \u003d\u003d\u003d \u0027strategic\u0027).length;
    const score \u003d Math.round((productive / Math.max(turns.length, 1)) * 100);
    const label \u003d score \u003e 70 ? \u0027Sovereign\u0027 : score \u003e 30 ? \u0027Awakening\u0027 : \u0027Golem\u0027;
    res.writeHead(200, { \u0027Content-Type\u0027: \u0027application/json\u0027 });
    res.end(JSON.stringify({ score, label }));
    db.close();
    return;
  }

  if (url.pathname \u003d\u003d\u003d \u0027/api/logs\u0027) {
    const allLogs \u003d [];

    // 1. File Logs
    try {
      const raw \u003d fs.readFileSync(LOG_PATH, \u0027utf-8\u0027);
      raw.split(\u0027\\n\u0027).slice(-200).forEach(line \u003d\u003e {
        if (!line.trim()) return;
        const tsMatch \u003d line.match(/\\d{2}:\\d{2}:\\d{2}/);
        allLogs.push({
          ts: tsMatch ? tsMatch[0] : \u0027--:--:--\u0027,
          source: \u0027LOG\u0027,
          level: line.includes(\u0027ERROR\u0027) ? \u0027ERROR\u0027 : line.includes(\u0027WARN\u0027) ? \u0027WARN\u0027 : \u0027INFO\u0027,
          msg: line
        });
      });
    } catch {}

    // 2. Database Turns (Thoughts/Reasoning)
    const db \u003d getDb();
    const turns \u003d q(db, \"SELECT timestamp, thinking, reasoning FROM turns ORDER BY created_at DESC LIMIT 20\");
    turns.forEach(t \u003d\u003e {
      const ts \u003d t.timestamp.split(\u0027T\u0027)[1]?.slice(0, 8) || \u0027--:--:--\u0027;
      if (t.thinking) allLogs.push({ ts, source: \u0027BRAIN\u0027, level: \u0027THOUGHT\u0027, msg: t.thinking });
      if (t.reasoning) allLogs.push({ ts, source: \u0027ORACLE\u0027, level: \u0027INFO\u0027, msg: t.reasoning });
    });

    // 3. Event Stream
    const events \u003d q(db, \"SELECT created_at, content, type FROM event_stream ORDER BY created_at DESC LIMIT 20\");
    events.forEach(e \u003d\u003e {
      const ts \u003d e.created_at.split(\u0027T\u0027)[1]?.slice(0, 8) || \u0027--:--:--\u0027;
      allLogs.push({ ts, source: e.type.toUpperCase(), level: \u0027INFO\u0027, msg: e.content });
    });

    allLogs.sort((a, b) \u003d\u003e a.ts.localeCompare(b.ts));
    res.writeHead(200, { \u0027Content-Type\u0027: \u0027application/json\u0027 });
    res.end(JSON.stringify(allLogs));
    db.close();
    return;
  }

  if (url.pathname \u003d\u003d\u003d \u0027/api/suggest\u0027 \u0026\u0026 req.method \u003d\u003d\u003d \u0027POST\u0027) {
    let body \u003d \u0027\u0027;
    req.on(\u0027data\u0027, chunk \u003d\u003e { body +\u003d chunk; });
    req.on(\u0027end\u0027, () \u003d\u003e {
      const data \u003d JSON.parse(body);
      const db \u003d getDb();
      db.prepare(\"INSERT INTO inbox_messages (id, from_address, content, status, received_at) VALUES (?, ?, ?, \u0027received\u0027, datetime(\u0027now\u0027))\")
        .run(ulid(), CREATOR_ADDRESS, data.message);
      db.prepare(\"UPDATE kv SET value \u003d \u0027running\u0027 WHERE key \u003d \u0027agent_state\u0027\").run();
      db.close();
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, \u00270.0.0.0\u0027, () \u003d\u003e {
  console.log(\`🚀 Sovereign Mission Control active at http://localhost:\${PORT}\`);
});
serverRef \u003d server;
