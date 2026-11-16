import fs from 'fs';
import path from 'path';
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from './dist/memory/entelechy-client.js';

async function run() {
  process.env.ENTELECHY_API_KEY = 'ek_JpOnqqLnEF-FW89Cgikjtepk-l7M7y5Bw7aE2JKh1i8';

  const summaryPath = path.join(process.cwd(), 'codebase_summary.json');
  const raw = fs.readFileSync(summaryPath, 'utf-8');
  const summary = JSON.parse(raw);

  const totalProjects = Object.keys(summary).length;
  const projectList = Object.entries(summary).map(([name, data]) =>
    `- ${name} [Stack: ${data.stack.join(', ')}, Files: ${data.files_count}]`
  ).join('\n');

  const content = `AUTONOMOUS CODEBASE AUDIT & ARCHITECTURE INJECTION REPORT:
Total Repositories Audited: ${totalProjects}
Projects Overview:
${projectList}

ARCHITECTURAL ENHANCEMENT PROPOSALS:
1. RuView / BrowserSkill: Integrate high-performance browser automation & UI verification into Cletus's testing harness.
2. SovereignShard: Integrate advanced OSINT and network reconnaissance primitives.
3. Multi-Agent LLM Company System: Adopt specialized multi-role hierarchical governance loops.
4. OpenClaw Money Maker & AI Growth Platform: Integrate automated growth loops and monetization hooks.`;

  console.log('Retaining complete codebase audit summary into Entelechy...');
  await retainEntelechyTaskResult('autonomous_codebase_audit_report_v1', content, ENTELECHY_DEFAULT_BANK);
  console.log('Successfully retained codebase audit report into Entelechy memory!');
}

run().catch(e => console.error('Error:', e));
