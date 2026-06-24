import { Document } from '@langchain/core/documents';
import { DJ_CHINESE_ALIASES } from '../../modules/dj/data/dj-chinese-aliases.data';
import {
  FESTIVAL_RAG_CORPUS,
  GLOBAL_RAG_SNIPPETS,
} from './data/festival-rag-corpus.data';

export type KnowledgeTopic =
  | 'activity'
  | 'story'
  | 'lineup_hint'
  | 'survival'
  | 'ecosystem'
  | 'travel'
  | 'dj'
  | 'assistant';

function slugifyDjCode(canonicalName: string): string {
  return canonicalName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function doc(
  pageContent: string,
  topic: KnowledgeTopic,
  code?: string,
): Document {
  return new Document({
    pageContent: pageContent.trim(),
    metadata: { topic, ...(code ? { code } : {}) },
  });
}

export function buildDjKnowledgeDocuments(): Document[] {
  return DJ_CHINESE_ALIASES.map((entry) =>
    doc(
      `${entry.canonicalName}（DJ/电子音乐制作人）。中文粉丝常称：${entry.aliases.join('、')}。在活动艺人 Tab 或阵容中可用上述任意名称搜索。`,
      'dj',
      slugifyDjCode(entry.canonicalName),
    ),
  );
}

export function buildFestivalCorpusDocuments(): Document[] {
  const docs: Document[] = [];

  for (const entry of FESTIVAL_RAG_CORPUS) {
    if (entry.activityFaq) {
      docs.push(doc(entry.activityFaq, 'activity', entry.code));
    }
    if (entry.story) {
      docs.push(doc(entry.story, 'story', entry.code));
    }
    if (entry.lineupAnnounceHint) {
      docs.push(doc(entry.lineupAnnounceHint, 'lineup_hint', entry.code));
    }
    if (entry.survivalHint) {
      docs.push(doc(entry.survivalHint, 'survival', entry.code));
    }
    if (entry.disambiguation) {
      docs.push(
        doc(entry.disambiguation, 'activity', `${entry.code}-disambig`),
      );
    }
  }

  docs.push(
    doc(GLOBAL_RAG_SNIPPETS.edcDisambiguation, 'activity', 'edc-disambig'),
    doc(
      GLOBAL_RAG_SNIPPETS.tomorrowlandDisambiguation,
      'activity',
      'tml-disambig',
    ),
    doc(GLOBAL_RAG_SNIPPETS.ecosystemApps, 'ecosystem', 'festival-apps'),
    doc(
      GLOBAL_RAG_SNIPPETS.ecosystemTicketing,
      'ecosystem',
      'ticketing-channels',
    ),
    doc(GLOBAL_RAG_SNIPPETS.travelEssentials, 'travel', 'travel-essentials'),
    doc(GLOBAL_RAG_SNIPPETS.assistant, 'assistant', 'platform'),
  );

  return docs;
}

/** All operator-curated static documents (excludes live catalog sync). */
export function buildStaticKnowledgeDocuments(): Document[] {
  return [...buildFestivalCorpusDocuments(), ...buildDjKnowledgeDocuments()];
}
