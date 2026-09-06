import fs from 'fs';

const content = fs.readFileSync('src/index.ts', 'utf-8');
const lines = content.split('\n');

for (let i = 410; i < 425; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
