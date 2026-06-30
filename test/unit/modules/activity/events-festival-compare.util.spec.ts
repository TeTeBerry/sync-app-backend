import {
  buildFestivalCompareKnowledgeCard,
  isCompareQuery,
  resolveCompareActivities,
} from '../../../../src/modules/activity/utils/events-festival-compare.util';
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

const CATALOG: ActivityLookupRecord[] = [
  activity({
    legacyId: 1,
    name: 'STORM 深圳',
    code: 'storm',
    date: '2026-06-13',
    location: '深圳国际会展中心',
    area: '深圳',
    region: 'domestic',
    alias: ['风暴', 'storm'],
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
    legacyId: 10,
    name: 'Tomorrowland Thailand 2026',
    code: 'tomorrowland',
    date: '12/11-13',
    location: '芭提雅 Wisdom Valley',
    area: '泰国',
    region: 'overseas',
    alias: ['tomorrowland thailand', 'tml', 'tml泰国', '泰国tml'],
  }),
];

describe('events-festival-compare.util', () => {
  it('detects compare queries', () => {
    expect(isCompareQuery('EDC vs Storm')).toBe(true);
    expect(isCompareQuery('风暴和 Ultra 哪个好')).toBe(true);
    expect(isCompareQuery('7月亚洲')).toBe(false);
  });

  it('resolves two festivals from vs query', () => {
    const pair = resolveCompareActivities('storm vs ultra europe', CATALOG, []);

    expect(pair.map((item) => item.code)).toEqual(['storm', 'ultra-europe']);
  });

  it('resolves geo-prefixed brand tokens like 韩国edc vs 泰国tml', () => {
    const pair = resolveCompareActivities('韩国edc vs 泰国tml', CATALOG, []);

    expect(pair.map((item) => item.code)).toEqual([
      'edc-korea',
      'tomorrowland',
    ]);
  });

  it('builds compare card for 韩国edc vs 泰国tml', () => {
    const card = buildFestivalCompareKnowledgeCard({
      query: '韩国edc vs 泰国tml',
      parsed: { intent: 'compare' },
      activities: CATALOG.filter((item) =>
        ['edc-korea', 'tomorrowland'].includes(item.code),
      ),
      allActivities: CATALOG,
      locale: 'zh-CN',
    });

    expect(card?.title).toBe('电音节对比');
    expect(card?.compare?.leftName).toContain('EDC Korea');
    expect(card?.compare?.rightName).toContain('Tomorrowland Thailand');
  });

  it('builds structured compare card with five rows', () => {
    const card = buildFestivalCompareKnowledgeCard({
      query: 'storm vs ultra europe',
      parsed: { intent: 'compare' },
      activities: CATALOG.slice(0, 2),
      allActivities: CATALOG,
      locale: 'zh-CN',
    });

    expect(card?.title).toBe('电音节对比');
    expect(card?.compare?.rows).toHaveLength(5);
    expect(card?.compare?.rows.map((row) => row.label)).toEqual([
      '地点',
      '档期',
      '曲风气质',
      '预算档',
      '签证/证件',
    ]);
    expect(card?.compare?.leftName).toContain('STORM');
    expect(card?.aiGenerated).toBe(false);
  });

  it('returns null when fewer than two activities resolve', () => {
    const card = buildFestivalCompareKnowledgeCard({
      query: '对比',
      parsed: { intent: 'compare' },
      activities: [CATALOG[0]],
      allActivities: [CATALOG[0]],
      locale: 'zh-CN',
    });

    expect(card).toBeNull();
  });
});
