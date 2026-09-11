#!/bin/bash
# Monitor script for hi_server.py
LOG_FILE="/Users/user/code/Cletus/hi_server_monitor.log"
SERVER_LOG="/Users/user/code/Cletus/hi_server.log"
SERVER_PID_FILE="/Users/user/code/Cletus/hi_server.pid"

log() {
    echo "$(date): $1" >> "$LOG_FILE"
}

start_server() {
    if [ -f "$SERVER_PID_FILE" ]; then
        PID=$(cat "$SERVER_PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            log "Server already running with PID $PID"
            return
        else
            log "Stale PID file found, removing"
            rm "$SERVER_PID_FILE"
        fi
    fi
    
    log "Starting hi_server.py"
    nohup python3 /Users/user/code/Cletus/hi_server.py > "$SERVER_LOG" 2>&1 &
    echo $! > "$SERVER_PID_FILE"
    log "Server started with PID $!"
}

while true; do
    start_server
    sleep 30
    # Check if server is still running
    if [ -f "$SERVER_PID_FILE" ]; then
        PID=$(cat "$SERVER_PID_FILE")
        if ! ps -p $PID > /dev/null 2>&1; then
            log "Server died, restarting..."
        fi
    else
        log "No PID file, starting server..."
    fi
done