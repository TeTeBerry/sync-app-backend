import { Document } from '@langchain/core/documents';
import { resolveFestivalBrand } from '../../../ai/rag/festival-brand.util';
import type { KnowledgeTopic } from '../../../infra/chroma/build-static-knowledge-documents.util';
import { FESTIVAL_RAG_CORPUS } from '../../../infra/chroma/data/festival-rag-corpus.data';
import type { ActivityLookupRecord } from '../ports/activity-lookup.port';

export function resolveFestivalCodeFromKnowledgeQuery(
  query: string,
): string | null {
  return resolveFestivalBrand(query.trim())?.brand.code ?? null;
}

export function buildFestivalCorpusDocs(code: string): Document[] {
  const entry = FESTIVAL_RAG_CORPUS.find((item) => item.code === code);
  if (!entry) return [];

  const docs: Document[] = [];
  const push = (content: string | undefined, topic: KnowledgeTopic) => {
    if (!content?.trim()) return;
    docs.push(
      new Document({
        pageContent: content.trim(),
        metadata: { topic, code },
      }),
    );
  };

  push(entry.lineupAnnounceHint, 'lineup_hint');
  push(entry.activityFaq, 'activity');
  push(entry.story, 'story');
  push(entry.survivalHint, 'survival');
  push(entry.disambiguation, 'activity');

  return docs;
}

export function findCatalogActivityByCode(
  code: string,
  catalogPool: ActivityLookupRecord[],
): ActivityLookupRecord | undefined {
  return catalogPool.find((activity) => activity.code === code);
}

export function resolveFestivalKnowledgeFallback(input: {
  query: string;
  catalogPool: ActivityLookupRecord[];
}): {
  docs: Document[];
  activities: ActivityLookupRecord[];
  festivalCode: string | null;
} {
  const festivalCode = resolveFestivalCodeFromKnowledgeQuery(input.query);
  if (!festivalCode) {
    return { docs: [], activities: [], festivalCode: null };
  }

  const activity = findCatalogActivityByCode(festivalCode, input.catalogPool);
  return {
    docs: buildFestivalCorpusDocs(festivalCode),
    activities: activity ? [activity] : [],
    festivalCode,
  };
}
