#!/usr/bin/env bash
# ==============================================================================
# Cletus & Mission Control Unified Launcher
# Starts the sovereign agent loop alongside the real-time web dashboard.
# ==============================================================================

set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

RESET_STATE=false
NEW_ARGS=()
for arg in "$@"; do
  if [ "$arg" == "--reset" ]; then
    RESET_STATE=true
  elif [ "$arg" == "--kill" ] || [ "$arg" == "--stop" ]; then
    echo "⚠️ --kill flag detected. Shutting down Cletus and Dashboard..."
    EXISTING_PIDS=$(lsof -ti :"$DASHBOARD_PORT" 2>/dev/null || true)
    if [ -n "$EXISTING_PIDS" ]; then
      while read -r pid; do [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null || true; done <<< "$EXISTING_PIDS"
    fi
    pkill -f "node dist/index.js" || true
    pkill -f "scripts/dashboard.js" || true
    echo "Processes stopped."
    exit 0
  else
    NEW_ARGS+=("$arg")
  fi
done

if [ "$RESET_STATE" = true ]; then
  echo "⚠️ --reset flag detected. Skipping database wipe as requested. Use --kill to stop processes."
fi

DASHBOARD_PORT="${DASHBOARD_PORT:-18888}"

# Resolve log path: env var takes precedence, then workspace-relative, then HOME
if [ -n "$CLETUS_LOG" ]; then
  LOG_FILE="$CLETUS_LOG"
elif [ -n "$CLETUS_LOG_DIR" ]; then
  LOG_FILE="$CLETUS_LOG_DIR/cletus.log"
else
  LOG_FILE="$REPO_DIR/cletus.log"
fi

echo "======================================================================"
echo " 🤖 STARTING CLETUS MISSION CONTROL & AGENT RUNTIME"
echo " Workspace: $REPO_DIR"
echo " Dashboard: http://localhost:$DASHBOARD_PORT"
echo " Log file:  $LOG_FILE"
echo "======================================================================"

# 1. Clean up any stale dashboard listener on the designated port
EXISTING_PIDS=$(lsof -ti :"$DASHBOARD_PORT" 2>/dev/null || true)
if [ -n "$EXISTING_PIDS" ]; then
  echo "Stopping previous dashboard listener(s) on port $DASHBOARD_PORT (PIDs: $(echo "$EXISTING_PIDS" | tr '\n' ' '))..."
  while read -r pid; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done <<EOF
$EXISTING_PIDS
EOF
  for _ in 1 2 3 4 5; do
    STILL_RUNNING=false
    while read -r pid; do
      if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then STILL_RUNNING=true; fi
    done <<EOF
$EXISTING_PIDS
EOF
    [ "$STILL_RUNNING" = false ] && break
    sleep 1
  done
  while read -r pid; do
    [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null || true
  done <<EOF
$EXISTING_PIDS
EOF
fi

# 2. Launch Mission Control Dashboard under a supervisor loop.
#    If the dashboard process ever exits (crash, OOM kill, etc.), it is
#    restarted automatically after a short backoff. The supervisor itself is a
#    child of this shell, so it dies cleanly with the script via the trap.
echo "Launching Mission Control dashboard on port $DASHBOARD_PORT..."
(
  while true; do
    node scripts/dashboard.js >> dashboard.log 2>&1
    echo "[supervisor] dashboard exited ($?), restarting in 2s... ($(date '+%H:%M:%S'))" >> dashboard.log
    sleep 2
  done
) &
DASHBOARD_PID=$!

cleanup() {
  echo ""
  echo "Shutting down Cletus & Dashboard..."
  # Kill the supervisor AND any dashboard it spawned.
  pkill -P "$DASHBOARD_PID" 2>/dev/null || true
  kill "$DASHBOARD_PID" 2>/dev/null || true
  pkill -f "scripts/dashboard.js" 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "Dashboard running at http://localhost:$DASHBOARD_PORT"
echo "Starting Cletus Agent Loop..."
echo "----------------------------------------------------------------------"

# 3. Launch the main Cletus runtime — stdout+stderr -> cletus.log
#    so the dashboard's /api/logs can read all raw logs.
#    With no explicit CLI command, start the actual agent loop. `dist/index.js`
#    otherwise defaults to printing help and exiting, leaving only the dashboard
#    alive with a frozen last-known turn count.
RUNTIME_ARGS=("${NEW_ARGS[@]}")
if [ "${#RUNTIME_ARGS[@]}" -eq 0 ]; then
  RUNTIME_ARGS+=("--run")
fi

if [ -f "dist/index.js" ]; then
  node dist/index.js "${RUNTIME_ARGS[@]}" >> "$LOG_FILE" 2>&1
else
  pnpm dev "${RUNTIME_ARGS[@]}" >> "$LOG_FILE" 2>&1
fi
