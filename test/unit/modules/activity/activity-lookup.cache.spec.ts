import { buildActivityLookupCache } from '@src/modules/activity/activity-lookup.cache';
import type { ActivityLookupRecord } from '@src/modules/activity/ports/activity-lookup.port';

describe('activity-lookup.cache', () => {
  const records: ActivityLookupRecord[] = [
    {
      legacyId: 5,
      name: 'EDC Thailand',
      code: 'edc-thailand',
      alias: [],
    },
    {
      legacyId: 1,
      name: 'Tomorrowland',
      code: 'tomorrowland-thailand',
      alias: [],
    },
  ];

  it('sorts by legacyId and builds indexes', () => {
    const cache = buildActivityLookupCache(records);

    expect(cache.all.map((item) => item.legacyId)).toEqual([1, 5]);
    expect(cache.byLegacyId.get(1)?.name).toBe('Tomorrowland');
    expect(cache.byCode.get('edc-thailand')?.legacyId).toBe(5);
  });
});
