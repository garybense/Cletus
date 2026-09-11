#!/bin/bash
# Monitor the hi server and restart if necessary

SERVER_PORT=18083
SERVER_URL="http://localhost:${SERVER_PORT}"
SERVER_SCRIPT="/Users/user/hi_server.py"
LOG_FILE="/Users/user/hi_server.monitor.log"

check_server() {
    response=$(curl -s --max-time 5 "${SERVER_URL}" 2>/dev/null)
    if [ "$response" = "hi" ]; then
        return 0
    else
        return 1
    fi
}

start_server() {
    echo "$(date): Starting hi server" >> "${LOG_FILE}"
    nohup python3 "${SERVER_SCRIPT}" > "${SERVER_SCRIPT}.log" 2>&1 &
    sleep 2
}

while true; do
    if ! check_server; then
        echo "$(date): Server not responding, restarting..." >> "${LOG_FILE}"
        pkill -f "hi_server.py"
        start_server
    fi
    sleep 60
done