import { Document } from '@langchain/core/documents';
import { buildDjKnowledgeDocuments } from '../../../infra/chroma/build-static-knowledge-documents.util';
import { DJ_CHINESE_ALIASES } from '../../dj/data/dj-chinese-aliases.data';
import { normalizeChineseAliasKey } from '../../dj/dj-chinese-aliases.util';
import type { LineupCatalogService } from '../../itinerary/lineup-catalog.service';
import type { ActivityLookupRecord } from '../ports/activity-lookup.port';

const MAX_ARTIST_ACTIVITIES = 8;

export function resolveArtistNameFromKnowledgeQuery(
  query: string,
  keywords?: string[],
): string | null {
  const candidates = [query.trim(), ...(keywords ?? [])].filter(Boolean);
  for (const candidate of candidates) {
    const fromAlias = resolveArtistNameFromText(candidate);
    if (fromAlias) return fromAlias;
  }
  return null;
}

function resolveArtistNameFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const normalized = normalizeChineseAliasKey(trimmed);
  for (const entry of DJ_CHINESE_ALIASES) {
    if (normalized.includes(normalizeChineseAliasKey(entry.canonicalName))) {
      return entry.canonicalName;
    }
    for (const alias of entry.aliases) {
      if (normalized.includes(normalizeChineseAliasKey(alias))) {
        return entry.canonicalName;
      }
    }
  }

  return null;
}

export function buildDjAliasKnowledgeDocs(artistName: string): Document[] {
  const canonical = artistName.trim();
  if (!canonical) return [];

  return buildDjKnowledgeDocuments().filter((doc) =>
    doc.pageContent.startsWith(canonical),
  );
}

export async function findCatalogActivitiesForArtist(
  lineupCatalog: LineupCatalogService,
  artistName: string,
  activityPool: ActivityLookupRecord[],
): Promise<ActivityLookupRecord[]> {
  const hits = await lineupCatalog.findArtistLineupMemberships({ artistName });
  if (!hits.length) return [];

  const poolById = new Map(
    activityPool.map((activity) => [activity.legacyId, activity]),
  );
  const seen = new Set<number>();
  const matched: ActivityLookupRecord[] = [];

  for (const hit of hits) {
    if (seen.has(hit.activityLegacyId)) continue;
    const activity = poolById.get(hit.activityLegacyId);
    if (!activity) continue;
    seen.add(hit.activityLegacyId);
    matched.push(activity);
    if (matched.length >= MAX_ARTIST_ACTIVITIES) break;
  }

  return matched;
}

export function mergeArtistKnowledgeDocuments(
  chromaDocs: Document[],
  artistDocs: Document[],
): Document[] {
  if (!artistDocs.length) return chromaDocs;
  const withoutDj = chromaDocs.filter((doc) => doc.metadata?.topic !== 'dj');
  return [...artistDocs, ...withoutDj];
}

export function shouldPreferLineupForArtistQuery(
  artistName: string | null,
  lineupActivities: ActivityLookupRecord[],
): boolean {
  return Boolean(artistName && lineupActivities.length);
}

export function mergeArtistMatchedActivities(
  matched: ActivityLookupRecord[],
  extra: ActivityLookupRecord[],
): ActivityLookupRecord[] {
  const seen = new Set(matched.map((activity) => activity.legacyId));
  const merged = [...matched];

  for (const activity of extra) {
    if (seen.has(activity.legacyId)) continue;
    merged.push(activity);
    seen.add(activity.legacyId);
    if (merged.length >= MAX_ARTIST_ACTIVITIES) break;
  }

  return merged;
}

export async function resolveArtistKnowledgeFallback(input: {
  query: string;
  keywords?: string[];
  activityPool: ActivityLookupRecord[];
  lineupCatalog?: LineupCatalogService;
}): Promise<{
  docs: Document[];
  activities: ActivityLookupRecord[];
  artistName: string | null;
}> {
  const artistName = resolveArtistNameFromKnowledgeQuery(
    input.query,
    input.keywords,
  );
  if (!artistName) {
    return { docs: [], activities: [], artistName: null };
  }

  const docs = buildDjAliasKnowledgeDocs(artistName);
  const activities = input.lineupCatalog
    ? await findCatalogActivitiesForArtist(
        input.lineupCatalog,
        artistName,
        input.activityPool,
      )
    : [];

  return { docs, activities, artistName };
}
