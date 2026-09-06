import fs from 'fs';

const content = fs.readFileSync('src/index.ts', 'utf-8');
console.log(content.slice(0, 2000));
