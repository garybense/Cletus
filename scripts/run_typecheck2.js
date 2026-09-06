import { execSync } from 'child_process';

try {
  console.log('Running typecheck...');
  const tc = execSync('pnpm run typecheck', { encoding: 'utf-8' });
  console.log('Typecheck output:', tc);
} catch (err: any) {
  console.log('STDOUT:', err.stdout);
  console.log('STDERR:', err.stderr);
}
