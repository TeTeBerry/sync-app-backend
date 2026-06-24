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
  activity({
    legacyId: 11,
    name: 'Ultra Japan 2026',
    code: 'ultra-japan',
    date: '09/19-20',
    location: '日本·东京 台场',
    area: '日本',
    region: 'overseas',
    alias: ['ultra japan'],
  }),
  activity({
    legacyId: 5,
    name: 'WDF Japan 2026',
    code: 'wdf-japan',
    date: '07/04-05',
    location: '日本',
    area: '日本',
    region: 'overseas',
    alias: ['wdf japan'],
  }),
  activity({
    legacyId: 2,
    name: 'Tomorrowland Belgium 2026',
    code: 'tomorrowland',
    date: '07/18-20',
    location: '比利时',
    area: '比利时',
    region: 'overseas',
    alias: ['tomorrowland'],
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
    expect(matched.map((item) => item.code)).toEqual([
      'tomorrowland',
      'ultra-europe',
    ]);
  });

  it('filters July activities for month-only query without inferring year', () => {
    const parsed = parseEventsActivitySearchQuery('7月');
    expect(parsed).toEqual(
      expect.objectContaining({
        month: 7,
        intent: 'discover',
      }),
    );
    expect(parsed.year).toBeUndefined();

    const matched = filterActivitiesByParsedSearch(
      SAMPLE_ACTIVITIES,
      parsed,
      '7月',
    );
    expect(matched.map((item) => item.code)).toEqual([
      'tomorrowland',
      'ultra-europe',
      'wdf-japan',
    ]);
  });

  it('requires month and region for 9月亚洲电音节', () => {
    const parsed = parseEventsActivitySearchQuery('9月亚洲电音节');
    expect(parsed).toEqual(
      expect.objectContaining({
        month: 9,
        region: 'asia',
      }),
    );
    expect(parsed.keywords).toBeUndefined();

    const matched = filterActivitiesByParsedSearch(
      SAMPLE_ACTIVITIES,
      parsed,
      '9月亚洲电音节',
    );
    expect(matched.map((item) => item.code)).toEqual(['ultra-japan']);
  });

  it('formats parsed summary without generic query noise', () => {
    expect(
      formatEventsActivitySearchParsedSummary(
        parseEventsActivitySearchQuery('9月亚洲电音节'),
      ),
    ).toBe('亚洲 · 9月');
  });

  it('detects compare intent from vs queries', () => {
    expect(parseEventsActivitySearchQuery('storm vs ultra europe').intent).toBe(
      'compare',
    );
  });

  it('matches Thailand EDC when lineup is in the query', () => {
    const activities = [
      activity({
        legacyId: 5,
        name: 'EDC Thailand 2026',
        code: 'edc-thailand',
        date: '12/18-20',
        location: '普吉岛 Rhythm Park',
        area: '泰国',
        region: 'overseas',
        alias: ['edc thailand', 'edc泰国', '泰国edc', 'edc 泰国'],
      }),
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
    ];

    const matched = filterActivitiesByParsedSearch(
      activities,
      parseEventsActivitySearchQuery('泰国edc阵容'),
      '泰国edc阵容',
    );

    expect(matched.map((item) => item.code)).toEqual(['edc-thailand']);
  });
});
