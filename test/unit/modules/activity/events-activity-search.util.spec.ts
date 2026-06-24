import {
  filterActivitiesByParsedSearch,
  formatEventsActivitySearchParsedSummary,
  parseEventsActivitySearchQuery,
} from '../../../../src/modules/activity/utils/events-activity-search.util';
import type { ActivityLookupRecord } from '../../../../src/modules/activity/ports/activity-lookup.port';

function activity(
  partial: Partial<ActivityLookupRecord> &
    Pick<ActivityLookupRecord, 'legacyId' | 'name' | 'code'>,
): ActivityLookupRecord {
  return {
    alias: [],
    hot: false,
    attendees: 0,
    activityType: 'festival',
    ...partial,
  } as ActivityLookupRecord;
}

const SAMPLE_ACTIVITIES: ActivityLookupRecord[] = [
  activity({
    legacyId: 8,
    name: 'EDC Korea 2026',
    code: 'edc-korea',
    date: '2026-10-03',
    location: '韩国仁川',
    area: '韩国',
    region: 'overseas',
    alias: ['edc korea', '韩国edc'],
  }),
  activity({
    legacyId: 3,
    name: 'Ultra Europe 2026',
    code: 'ultra-europe',
    date: '2026-07-11',
    location: '克罗地亚斯普利特',
    area: '克罗地亚',
    region: 'overseas',
    alias: ['ultra europe'],
  }),
  activity({
    legacyId: 1,
    name: 'STORM 深圳',
    code: 'storm',
    date: '2026-06-13',
    location: '深圳',
    area: '深圳',
    region: 'domestic',
    alias: ['风暴', 'storm'],
  }),
];

describe('events-activity-search.util', () => {
  it('parses month, region and genre from natural language', () => {
    expect(parseEventsActivitySearchQuery('7月欧洲 techno')).toEqual(
      expect.objectContaining({
        month: 7,
        region: 'europe',
        genre: 'Techno',
        intent: 'discover',
      }),
    );
  });

  it('detects recruit intent', () => {
    expect(parseEventsActivitySearchQuery('上海出发差1人')).toMatchObject({
      intent: 'recruit',
    });
  });

  it('detects ecosystem intent', () => {
    expect(parseEventsActivitySearchQuery('电音节小程序')).toMatchObject({
      intent: 'ecosystem',
    });
  });

  it('filters activities by parsed criteria', () => {
    const matched = filterActivitiesByParsedSearch(
      SAMPLE_ACTIVITIES,
      parseEventsActivitySearchQuery('7月欧洲'),
      '7月欧洲',
    );
    expect(matched.map((item) => item.code)).toEqual(['ultra-europe']);
  });

  it('formats parsed summary', () => {
    expect(
      formatEventsActivitySearchParsedSummary(
        parseEventsActivitySearchQuery('泰国 10月'),
      ),
    ).toBe('泰国 · 10月');
  });
});
