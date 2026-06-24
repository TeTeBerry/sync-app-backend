import type { ActivityLookupRecord } from '../../../../src/modules/activity/ports/activity-lookup.port';
import {
  buildFestivalCorpusDocs,
  resolveFestivalCodeFromKnowledgeQuery,
  resolveFestivalKnowledgeFallback,
} from '../../../../src/modules/activity/utils/events-knowledge-festival-fallback.util';

describe('events-knowledge-festival-fallback.util', () => {
  const catalog: ActivityLookupRecord[] = [
    {
      legacyId: 5,
      code: 'edc-thailand',
      name: 'EDC Thailand 2026',
      alias: ['泰国edc'],
      area: '泰国',
      region: 'overseas',
      hot: false,
      attendees: 0,
      activityType: 'festival',
    },
  ];

  it('resolves Thailand EDC from lineup query', () => {
    expect(resolveFestivalCodeFromKnowledgeQuery('泰国edc阵容')).toBe(
      'edc-thailand',
    );
  });

  it('builds lineup and activity corpus docs', () => {
    const docs = buildFestivalCorpusDocs('edc-thailand');
    expect(docs.some((doc) => doc.metadata?.topic === 'lineup_hint')).toBe(
      true,
    );
    expect(docs.some((doc) => doc.pageContent.includes('普吉岛'))).toBe(true);
  });

  it('returns festival activity and docs for fallback', () => {
    const fallback = resolveFestivalKnowledgeFallback({
      query: '泰国edc阵容',
      catalogPool: catalog,
    });
    expect(fallback.festivalCode).toBe('edc-thailand');
    expect(fallback.activities[0]?.name).toBe('EDC Thailand 2026');
    expect(fallback.docs.length).toBeGreaterThan(0);
  });
});
