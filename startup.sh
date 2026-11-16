#!/usr/bin/env bash
# ==============================================================================
# Cletus & Mission Control Idempotent Startup Contract
# Probes http://127.0.0.1:18888/, exits 0 if already healthy, or starts
# dashboard and agent runtime in background.
# ==============================================================================

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

DASHBOARD_PORT="${DASHBOARD_PORT:-18888}"
LOG_FILE="${CLETUS_LOG:-$HOME/.cletus/cletus.log}"

mkdir -p "$HOME/.cletus"

# 1. Probing Health: Exit 0 if dashboard is already listening and responsive
if curl -s -f "http://127.0.0.1:$DASHBOARD_PORT/" >/dev/null 2>&1; then
  echo "Cletus Mission Control is already healthy on http://127.0.0.1:$DASHBOARD_PORT/"
  exit 0
fi

echo "Starting Cletus Mission Control & Agent Runtime..."

# 2. Launch Dashboard in background if port is available
if ! lsof -ti :"$DASHBOARD_PORT" >/dev/null 2>&1; then
  echo "Launching dashboard on port $DASHBOARD_PORT..."
  (cd "$REPO_DIR/newdashboard" && npm run dev >> /tmp/newdashboard-startup.log 2>&1) &
  sleep 2
fi

# 3. Launch Cletus Agent Loop in background if not already running
if ! pgrep -f "node dist/index.js --run" >/dev/null 2>&1 && ! pgrep -f "pnpm dev --run" >/dev/null 2>&1; then
  echo "Launching Cletus Agent Loop..."
  if [ -f "$REPO_DIR/dist/index.js" ]; then
    (cd "$REPO_DIR" && node dist/index.js --run >> "$LOG_FILE" 2>&1) &
  else
    (cd "$REPO_DIR" && pnpm dev --run >> "$LOG_FILE" 2>&1) &
  fi
fi

echo "Cletus startup complete."
exit 0
