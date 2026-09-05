#!/bin/bash
# File System Monitor Utility
# Watches for changes in the specified directory and logs events.

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <directory_to_watch>"
    exit 1
fi

WATCH_DIR=$1
LOG_FILE="fs_monitor.log"

echo "Starting monitor on $WATCH_DIR..."
echo "Logging to $LOG_FILE"

# Using inotifywait to monitor events
# Install inotify-tools if not present (sudo apt-get install inotify-tools)
while inotifywait -r -e modify,create,delete,move "$WATCH_DIR"; do
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    echo "[$TIMESTAMP] Change detected in $WATCH_DIR" >> "$LOG_FILE"
done
