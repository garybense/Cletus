#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2] || '.';

console.log(`Monitoring directory: ${targetDir}`);

fs.watch(targetDir, (eventType, filename) => {
  if (filename) {
    console.log(`File: ${filename} | Event: ${eventType} | Time: ${new Date().toISOString()}`);
  }
});
