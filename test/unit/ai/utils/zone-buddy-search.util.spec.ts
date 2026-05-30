import {
  buildBuddySearchQuery,
  buildZoneMatchEmptyReply,
  filterMatchesByBuddySearchHint,
  formatActivityCatalogDayLabels,
  inferBuddySearchHintKind,
  postTextMatchesBuddySearchHint,
  parseBuddySearchHintConstraints,
} from '@src/ai/match/zone-buddy-search.util';

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

  it('filters out posts on wrong event day or zone', () => {
    const hint = '6月13日、13号A区';
    const constraints = parseBuddySearchHintConstraints(hint, 'day_or_zone');
    expect(constraints).not.toBeNull();
    expect(
      postTextMatchesBuddySearchHint(
        '6月13日场 13号A区 内场票已出，上海出发求拼车',
        constraints!,
      ),
    ).toBe(true);
    expect(
      postTextMatchesBuddySearchHint(
        '风暴 STORM 深圳站 6月14日，B区看台，3缺1男生',
        constraints!,
      ),
    ).toBe(false);

    const matches = filterMatchesByBuddySearchHint(
      [
        { snippet: '6月13日场 13号A区 内场票' },
        { snippet: '风暴 STORM 深圳站 6月14日，B区看台' },
      ],
      hint,
      'day_or_zone',
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.snippet).toContain('13号A区');
  });

  it('builds empty reply for ambiguous day/zone', () => {
    const reply = buildZoneMatchEmptyReply(
      '风暴电音节',
      '6月13日（或 13号A区）',
      'day_or_zone',
    );
    expect(reply).toContain('活动日期或票区');
    expect(reply).toContain('你可以：告诉我内容帮你发布帖子');
    expect(reply).not.toContain('在活动详情页浏览');
  });

  it('builds empty reply with post body prompt for zone search', () => {
    const reply = buildZoneMatchEmptyReply('风暴电音节', '13号A区', 'zone');
    expect(reply).toContain('你可以：告诉我内容帮你发布帖子');
    expect(reply).not.toContain('出发城市');
  });
});
