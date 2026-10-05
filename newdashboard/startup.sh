#!/bin/sh
set -eu
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# Ensure the dashboard is running on port 18888 as required by Mission Control
export DASHBOARD_PORT=18888

# Kill anything on the port first
EXISTING_PID=$(lsof -ti :18888 2>/dev/null || echo "")
if [ -n "$EXISTING_PID" ]; then
  echo "Clearing port 18888 (PID: $EXISTING_PID)..."
  kill -9 $EXISTING_PID 2>/dev/null || true
  sleep 1
fi

echo "Launching New Mission Control dashboard on port 18888..."
npm run dev >> /tmp/newdashboard-startup.log 2>&1 &
