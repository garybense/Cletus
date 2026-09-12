#!/bin/sh
set -eu
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# Ensure the dashboard is running on port 18888 as required by Mission Control
export DASHBOARD_PORT=18888

# Check if something is already listening on the port
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:18888/; then
  echo "Dashboard already active on 18888"
  exit 0
fi

echo "Launching New Mission Control dashboard on port 18888..."
npm run dev >> /tmp/newdashboard-startup.log 2>&1 &
