import fs from 'fs';

const content = fs.readFileSync('src/agent/loop.ts', 'utf-8');
const lines = content.split('\n');

console.log('Total lines:', lines.length);
for (let i = 0; i < Math.min(lines.length, 120); i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
