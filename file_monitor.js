#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2] || '.';

console.log(`Monitoring changes in: ${path.resolve(targetDir)}`);

fs.watch(targetDir, { recursive: true }, (eventType, filename) => {
  if (filename) {
    console.log(`[${new Date().toISOString()}] ${eventType}: ${filename}`);
  }
});
