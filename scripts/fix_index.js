import fs from 'fs';

let content = fs.readFileSync('src/index.ts', 'utf-8');
content = content.replace('.catch((reason) =>', '.catch((reason: any) =>');
fs.writeFileSync('src/index.ts', content, 'utf-8');
console.log('Updated src/index.ts');
