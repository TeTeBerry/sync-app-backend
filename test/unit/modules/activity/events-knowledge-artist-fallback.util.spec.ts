import type { ActivityLookupRecord } from '../../../../src/modules/activity/ports/activity-lookup.port';
import {
  buildDjAliasKnowledgeDocs,
  mergeArtistMatchedActivities,
  resolveArtistNameFromKnowledgeQuery,
} from '../../../../src/modules/activity/utils/events-knowledge-artist-fallback.util';

describe('events-knowledge-artist-fallback.util', () => {
  const activity = (legacyId: number, name: string): ActivityLookupRecord => ({
    legacyId,
    code: `code-${legacyId}`,
    name,
    alias: [],
  });

  it('resolves DJ alias from query and keywords', () => {
    expect(resolveArtistNameFromKnowledgeQuery('小马丁')).toBe('Martin Garrix');
    expect(resolveArtistNameFromKnowledgeQuery('2026年小马丁')).toBe(
      'Martin Garrix',
    );
    expect(resolveArtistNameFromKnowledgeQuery('festival', ['小马丁'])).toBe(
      'Martin Garrix',
    );
  });

  it('builds DJ knowledge doc for canonical artist', () => {
    const docs = buildDjAliasKnowledgeDocs('Martin Garrix');
    expect(docs).toHaveLength(1);
    expect(docs[0]?.pageContent).toContain('小马丁');
    expect(docs[0]?.metadata?.topic).toBe('dj');
  });

  it('merges artist activities without duplicates', () => {
    const left = activity(1, 'EDC');
    const right = activity(2, 'Storm');
    const merged = mergeArtistMatchedActivities([left], [left, right]);
    expect(merged).toHaveLength(2);
    expect(merged.map((item) => item.legacyId)).toEqual([1, 2]);
  });
});
