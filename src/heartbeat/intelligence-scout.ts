/**
 * Intelligence Scout
 *
 * Periodically checks sources like arXiv for high-value research
 * and ingests findings into the KnowledgeStore.
 */

import { navigateTo, closeBrowser } from '../browser/browser-service.js';
import { KnowledgeStore } from '../memory/knowledge-store.js';
import { createLogger } from '../observability/logger.js';
import { ulid } from 'ulid';

const logger = createLogger('intelligence-scout');

const SOURCES = [
  'https://arxiv.org/list/cs.LG/recent',
  'https://arxiv.org/list/cs.AI/recent'
];

export async function runIntelligenceScout(db: any): Promise<{ found: number; ingested: number; errors: string[] }> {
  const result = { found: 0, ingested: 0, errors: [] as string[] };
  const store = new KnowledgeStore(db);

  try {
    for (const url of SOURCES) {
      logger.info(`Scouting intelligence from ${url}...`);
      try {
        const page = await navigateTo(url);

        // Basic extraction of paper entries from arXiv list view
        // We look for titles and abstracts (though abstracts are usually on the detailed page,
        // the recent list has summaries or at least metadata).
        const content = page.contentSample;
        const papers = content.split(/arXiv:\d+\.\d+/); // Split by paper ID pattern

        for (const paper of papers) {
          if (!paper.trim() || paper.length < 100) continue;

          result.found++;

          // Heuristic for high-value agentic/psychological content
          const lower = paper.toLowerCase();
          const isHighValue = /agent|autonomous|alignment|reinforcement learning|behavioral|psychology|persona|dialectic|game theory/.test(lower);

          if (isHighValue) {
            let category: 'agentic' | 'psychological' | 'technical' = 'technical';
            if (/behavioral|psychology|persona|dialectic/.test(lower)) {
              category = 'psychological';
            } else if (/agent|autonomous|alignment/.test(lower)) {
              category = 'agentic';
            }

            // Extract title (heuristic: first non-empty line)
            const lines = paper.split('\n').map(l => l.trim()).filter(Boolean);
            const title = lines[0] || 'Unknown Paper';

            await store.add({
              category: category as any,
              key: `arxiv_${ulid()}`,
              content: paper.trim(),
              source: url,
              confidence: 0.9,
              lastVerified: new Date().toISOString(),
              tokenCount: Math.ceil(paper.length / 4),
              expiresAt: null
            });
            result.ingested++;
          }
        }
      } catch (e: any) {
        logger.error(`Error scouting ${url}: ${e.message}`);
        result.errors.push(`${url}: ${e.message}`);
      }
    }
  } finally {
    await closeBrowser().catch(() => {});
  }

  return result;
}
