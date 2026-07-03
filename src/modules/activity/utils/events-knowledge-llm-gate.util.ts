import type { EventsActivitySearchParsed } from '@sync/scene-contracts';
import type { Document } from '@langchain/core/documents';
import { resolveFestivalBrand } from '../../../ai/rag/festival-brand.util';
import type { ActivityLookupRecord } from '../ports/activity-lookup.port';

const QUESTION_PATTERN =
  /[？?]|哪些|什么|怎么|如何|推荐|有没有|吗$|哪个好|区别|适合|值得/;
const LINEUP_LOOKUP_PATTERN = /阵容|lineup|timetable|官宣|谁演/i;

function countStructuredDimensions(parsed: EventsActivitySearchParsed): number {
  let count = 0;
  if (parsed.month != null) count += 1;
  if (parsed.year != null) count += 1;
  if (parsed.region) count += 1;
  if (parsed.area) count += 1;
  if (parsed.genre) count += 1;
  if (parsed.keywords?.length) count += 1;
  return count;
}

function isSimpleFilterQuery(
  query: string,
  parsed: EventsActivitySearchParsed,
  matchedActivities: ActivityLookupRecord[],
): boolean {
  if (QUESTION_PATTERN.test(query)) return false;
  if (parsed.intent === 'compare') return false;

  const dimensions = countStructuredDimensions(parsed);
  if (dimensions === 0) return false;

  if (
    dimensions === 1 &&
    (parsed.month != null || parsed.region || parsed.area)
  ) {
    return matchedActivities.length > 0;
  }

  if (
    dimensions <= 2 &&
    matchedActivities.length > 0 &&
    matchedActivities.length <= 4 &&
    !parsed.genre
  ) {
    return true;
  }

  return false;
}

function isFestivalLineupLookup(
  query: string,
  matchedActivities: ActivityLookupRecord[],
): boolean {
  if (!LINEUP_LOOKUP_PATTERN.test(query)) return false;
  if (!matchedActivities.length) return false;
  return Boolean(resolveFestivalBrand(query.trim()));
}

export function shouldUseLlmKnowledgeCard(input: {
  query: string;
  parsed: EventsActivitySearchParsed;
  matchedActivities: ActivityLookupRecord[];
  chromaDocs: Document[];
}): boolean {
  const { query, parsed, matchedActivities, chromaDocs } = input;

  if (parsed.intent === 'compare') return false;

  if (isFestivalLineupLookup(query, matchedActivities)) {
    return false;
  }

  if (isSimpleFilterQuery(query, parsed, matchedActivities)) {
    return false;
  }

  if (parsed.intent === 'travel' || parsed.intent === 'ecosystem') {
    return true;
  }

  if (QUESTION_PATTERN.test(query)) {
    return true;
  }

  if (countStructuredDimensions(parsed) >= 2) {
    return true;
  }

  if (matchedActivities.length > 4) {
    return true;
  }

  if (chromaDocs.length > 0 && matchedActivities.length === 0) {
    return true;
  }

  return false;
}

export function shouldUseLlmCompareIntro(
  parsed: EventsActivitySearchParsed,
  query: string,
): boolean {
  if (parsed.intent !== 'compare') return false;
  return QUESTION_PATTERN.test(query) || query.trim().length >= 10;
}
