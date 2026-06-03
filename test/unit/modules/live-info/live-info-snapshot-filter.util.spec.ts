import {
  filterLiveInfoUpdates,
  matchesCategoryFilter,
  matchesZoneFilter,
  parseCertifiedOnlyQuery,
} from '../../../../src/modules/live-info/domain/live-info-snapshot-filter.util';

describe('parseCertifiedOnlyQuery', () => {
  it('parses true variants', () => {
    expect(parseCertifiedOnlyQuery('true')).toBe(true);
    expect(parseCertifiedOnlyQuery('1')).toBe(true);
    expect(parseCertifiedOnlyQuery(' TRUE ')).toBe(true);
  });

  it('returns false for empty or other values', () => {
    expect(parseCertifiedOnlyQuery()).toBe(false);
    expect(parseCertifiedOnlyQuery('false')).toBe(false);
  });
});

describe('matchesZoneFilter', () => {
  it('allows all when filter is empty', () => {
    expect(matchesZoneFilter('stage_a')).toBe(true);
    expect(matchesZoneFilter(undefined, 'all')).toBe(true);
  });

  it('matches venue zone for legacy missing tags', () => {
    expect(matchesZoneFilter(undefined, 'venue')).toBe(true);
    expect(matchesZoneFilter('stage_a', 'venue')).toBe(false);
  });

  it('matches exact zone id', () => {
    expect(matchesZoneFilter('stage_b', 'stage_b')).toBe(true);
    expect(matchesZoneFilter('stage_a', 'stage_b')).toBe(false);
  });
});

describe('matchesCategoryFilter', () => {
  it('requires rating with category when filter set', () => {
    const ratings = [{ categoryId: 'sound_level' as const, score: 3 }];
    expect(matchesCategoryFilter(ratings, 'sound_level')).toBe(true);
    expect(matchesCategoryFilter(ratings, 'stage_view')).toBe(false);
  });
});

describe('filterLiveInfoUpdates', () => {
  const updates = [
    {
      userId: 'on-site',
      zoneTag: 'stage_a',
      ratings: [{ categoryId: 'sound_level', score: 4 }],
    },
    {
      userId: 'off-site',
      zoneTag: 'stage_b',
      ratings: [{ categoryId: 'toilet_queue', score: 3 }],
    },
    {
      userId: 'on-site',
      zoneTag: 'venue',
      ratings: [{ categoryId: 'entry_crowd', score: 2 }],
    },
  ];

  it('filters by zone, category, and certifiedOnly together', () => {
    const onSite = new Set(['on-site']);
    const result = filterLiveInfoUpdates(
      updates,
      {
        zoneTag: 'stage_a',
        categoryId: 'sound_level',
        certifiedOnly: true,
      },
      onSite,
    );
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('on-site');
  });

  it('excludes authors not on site when certifiedOnly', () => {
    const result = filterLiveInfoUpdates(
      updates,
      { certifiedOnly: true },
      new Set(['on-site']),
    );
    expect(result.map((u) => u.userId)).toEqual(['on-site', 'on-site']);
  });
});
