import type { Document } from '@langchain/core/documents';
import type { EventsActivitySearchParsed } from '@sync/scene-contracts';
import type { ActivityLookupRecord } from '../ports/activity-lookup.port';
import { filterActivitiesForKnowledgeSearch } from './events-activity-search.util';

const MAX_MERGED_ACTIVITIES = 8;

export function mergeChromaActivityHints(
  matched: ActivityLookupRecord[],
  chromaDocs: Document[],
  allActivities: ActivityLookupRecord[],
  parsed: EventsActivitySearchParsed = {},
  now = new Date(),
): ActivityLookupRecord[] {
  if (!chromaDocs.length) return matched;

  const matchedCodes = new Set(matched.map((activity) => activity.code));
  const byCode = new Map(
    allActivities.map((activity) => [activity.code, activity]),
  );

  const hinted: ActivityLookupRecord[] = [...matched];

  for (const doc of chromaDocs) {
    const code = doc.metadata?.code;
    if (!code || typeof code !== 'string' || matchedCodes.has(code)) continue;

    const activity = byCode.get(code);
    if (!activity) continue;

    const [eligible] = filterActivitiesForKnowledgeSearch(
      [activity],
      parsed,
      now,
    );
    if (!eligible) continue;

    hinted.push(activity);
    matchedCodes.add(code);
    if (hinted.length >= MAX_MERGED_ACTIVITIES) break;
  }

  return hinted;
}
