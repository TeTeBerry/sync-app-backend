import {
  buildBuddySearchQuery,
  buildZoneMatchEmptyReply,
  formatActivityCatalogDayLabels,
  inferBuddySearchHintKind,
} from './zone-buddy-search.util';

describe('zone-buddy-search.util', () => {
  it('formats catalog day labels', () => {
    expect(
      formatActivityCatalogDayLabels('06/13-14', '风暴电音节 深圳站'),
    ).toBe('6月13日、6月14日');
  });

  it('builds query with searchHint and activity date', () => {
    const query = buildBuddySearchQuery({
      userInput: '13号 A区 有人吗',
      searchHint: '6月13日、13号A区',
      activityDate: '06/13-14',
      activityName: '风暴电音节 深圳站',
    });
    expect(query).toContain('搭子');
    expect(query).toContain('6月13日');
    expect(query).toContain('13号A区');
  });

  it('infers hint kind from display label', () => {
    expect(inferBuddySearchHintKind('6月13日（或 13号A区）')).toBe('day_or_zone');
    expect(inferBuddySearchHintKind('6月13日')).toBe('event_day');
    expect(inferBuddySearchHintKind('13号A区')).toBe('zone');
  });

  it('builds empty reply for ambiguous day/zone', () => {
    const reply = buildZoneMatchEmptyReply(
      '风暴电音节',
      '6月13日（或 13号A区）',
      'day_or_zone',
    );
    expect(reply).toContain('活动日期或票区');
  });
});
