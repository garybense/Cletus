const fs = require('fs');
const path = require('path');

/**
 * File System Monitor
 * Monitors a directory for changes.
 */
class FSMonitor {
  constructor(dirPath) {
    this.dirPath = dirPath;
  }

  watch() {
    console.log(`Monitoring directory: ${this.dirPath}`);
    fs.watch(this.dirPath, (eventType, filename) => {
      if (filename) {
        console.log(`File change detected: ${filename} (event: ${eventType})`);
      }
    });
  }
}

const monitor = new FSMonitor('./');
monitor.watch();
