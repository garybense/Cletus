import fs from 'fs';

const content = fs.readFileSync('src/heartbeat/tasks.ts', 'utf-8');
console.log(content);
