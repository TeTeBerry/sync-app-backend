import {
  buddyPostMatchesSearchCriteria,
  buddyPostMatchesSearchTerms,
  buildBodySearchTermsFromParsed,
  buildSearchTermsFromParsed,
  filterBuddyPostsBySearchTerms,
  fuzzyTextMatches,
  isConfidentRuleBuddySearchParse,
  isSimpleCityOnlyBuddySearch,
  parseBuddyPostSearchQuery,
  rankBuddyPostsBySearch,
  resolveBuddyPostSearchCriteria,
  resolveBuddyPostSearchTerms,
  scoreBuddyPostSearchCriteria,
  shouldRetryBuddySearchWithLlm,
} from '@src/modules/partner/utils/buddy-post-search.util';
import type { PostRecord } from '@src/modules/partner/interfaces/post.repository.interface';

function samplePost(overrides: Partial<PostRecord> = {}): PostRecord {
  return {
    _id: 'p1',
    userId: 'u1',
    authorName: '用户',
    eventTitle: 'EDC Korea',
    body: '10.3 白天在场，喜欢 Techno，找 2 人同逛舞台',
    location: '主舞台',
    tags: ['#组队'],
    status: 'active',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    ...overrides,
  } as PostRecord;
}

describe('buddy-post-search.util', () => {
  it('matches all parsed terms against post body', () => {
    const parsed = {
      eventName: 'EDC',
      date: '10.3',
      genre: 'Techno',
      peopleCount: '2',
      extraKeywords: ['白天', '同逛舞台'],
    };
    const criteria = resolveBuddyPostSearchCriteria(
      parsed,
      '比如：喜欢 Techno，白天在场，找 2 个同逛舞台的搭子',
    );

    expect(
      buddyPostMatchesSearchCriteria(
        samplePost({ body: '10.3 EDC 白天在场，喜欢 Techno，找 2 人同逛舞台' }),
        criteria,
      ),
    ).toBe(true);
  });

  it('filters posts without changing relative order when no profile is given', () => {
    const older = samplePost({
      _id: 'older',
      createdAt: new Date('2026-09-01T10:00:00Z'),
      body: '任意内容',
    });
    const newer = samplePost({
      _id: 'newer',
      createdAt: new Date('2026-10-02T10:00:00Z'),
      body: 'Techno 组队',
    });
    const rows = [newer, older];

    const filtered = filterBuddyPostsBySearchTerms(rows, ['Techno']);
    expect(filtered.map((row) => String(row._id))).toEqual(['newer']);
  });

  it('builds search terms from parsed fields', () => {
    expect(
      buildSearchTermsFromParsed({
        eventName: 'EDC 韩国',
        date: '10.3',
        genre: 'Techno',
        peopleCount: '2',
        extraKeywords: ['白天'],
      }),
    ).toEqual(['EDC 韩国', '10.3', 'Techno', '2', '白天']);
  });

  it('falls back to tokenized raw query when parsed fields are empty', () => {
    expect(resolveBuddyPostSearchTerms({}, 'Techno 组队')).toEqual([
      'Techno',
      '组队',
    ]);
  });

  it('supports fuzzy character subsequence matching', () => {
    expect(fuzzyTextMatches('上海出发组队', '上组')).toBe(true);
  });

  it('does not match every post under the same activity event title', () => {
    const sharedEventTitle = 'EDC Thailand 2026';
    const rows = [
      samplePost({
        _id: 'match',
        eventTitle: sharedEventTitle,
        body: 'Nova 分享 EDC Thailand 现场攻略',
      }),
      samplePost({
        _id: 'miss',
        eventTitle: sharedEventTitle,
        body: '组队，12.18-12.20，上海，2 人',
      }),
    ];

    const filtered = filterBuddyPostsBySearchTerms(rows, ['EDC']);
    expect(filtered.map((row) => String(row._id))).toEqual(['match']);
  });

  it('parses natural language into search fields without LLM', () => {
    const parsed = parseBuddyPostSearchQuery(
      '10.3 EDC 韩国，喜欢 Techno，白天在场，找 2 个同逛舞台的搭子',
    );

    expect(parsed.date).toBe('10.3');
    expect(parsed.genre).toBe('Techno');
    expect(parsed.peopleCount).toBe('2');
    expect(parsed.extraKeywords).toEqual(
      expect.arrayContaining(['EDC', '韩国', '白天在场', '同逛舞台']),
    );

    const criteria = resolveBuddyPostSearchCriteria(parsed, '');
    const post = samplePost({
      eventTitle: 'EDC 韩国',
      body: '10.3 EDC 韩国 白天在场，喜欢 Techno，找 2 人同逛舞台',
    });
    expect(buddyPostMatchesSearchCriteria(post, criteria)).toBe(true);
  });

  it('matches departure city via structured field instead of body keyword 出发', () => {
    const parsed = parseBuddyPostSearchQuery('找成都出发的队');
    expect(parsed.departureCity).toBe('成都');

    const criteria = resolveBuddyPostSearchCriteria(parsed, '找成都出发的队');
    expect(criteria).toEqual({ departureCity: '成都', searchTerms: [] });
    expect(resolveBuddyPostSearchTerms(parsed, '找成都出发的队')).toEqual([
      '成都',
    ]);

    const post = samplePost({
      body: '12.12-13 两天场',
      departureCity: '成都',
    });
    expect(buddyPostMatchesSearchCriteria(post, criteria)).toBe(true);
  });

  it('matches Hangzhou departure posts when query includes 出发 suffix', () => {
    const parsed = parseBuddyPostSearchQuery('杭州出发');
    expect(parsed.departureCity).toBe('杭州');

    const criteria = resolveBuddyPostSearchCriteria(parsed, '杭州出发');
    expect(criteria).toEqual({ departureCity: '杭州', searchTerms: [] });

    const post = samplePost({
      body: '12.18-12.20，差 1 人',
      departureCity: '杭州',
      location: '杭州',
    });
    expect(buddyPostMatchesSearchCriteria(post, criteria)).toBe(true);
  });

  it('scores stronger keyword coverage higher', () => {
    const stronger = scoreBuddyPostSearchCriteria(
      samplePost({ body: 'Techno 同逛', departureCity: '成都' }),
      { departureCity: '成都', searchTerms: ['Techno', '同逛'] },
    );
    const weaker = scoreBuddyPostSearchCriteria(
      samplePost({ body: 'Techno', departureCity: '成都' }),
      { departureCity: '成都', searchTerms: ['Techno'] },
    );
    expect(stronger).toBeGreaterThan(weaker);
  });

  it('uses viewer profile as tiebreaker when keyword scores match', () => {
    const shanghai = samplePost({
      _id: 'shanghai',
      body: 'Techno 同逛舞台',
      departureCity: '上海',
    });
    const guangzhou = samplePost({
      _id: 'guangzhou',
      body: 'Techno 同逛舞台',
      departureCity: '广州',
    });

    const ranked = rankBuddyPostsBySearch(
      [guangzhou, shanghai],
      { searchTerms: ['Techno', '同逛舞台'] },
      { city: '上海', favorGenres: ['Techno'] },
    );
    expect(ranked.map((row) => String(row._id))).toEqual([
      'shanghai',
      'guangzhou',
    ]);
  });

  it('does not require 出发 in post body when only departureCity is parsed', () => {
    expect(
      buddyPostMatchesSearchTerms(
        samplePost({ body: '差 1 人', departureCity: '杭州' }),
        ['出发'],
      ),
    ).toBe(false);
    expect(
      buddyPostMatchesSearchCriteria(
        samplePost({ body: '差 1 人', departureCity: '杭州' }),
        { departureCity: '杭州', searchTerms: [] },
      ),
    ).toBe(true);
  });

  it('does not treat recruit-slot queries as confident rule parses', () => {
    const query = '上海出发，12.11-12.13，差 1 人';
    const parsed = parseBuddyPostSearchQuery(query);
    expect(parsed.departureCity).toBe('上海');
    expect(parsed.date).toBe('12.11-12.13');
    expect(parsed.peopleCount).toBe('1');
    expect(parsed.preferOpenRecruit).toBe(true);
    expect(isConfidentRuleBuddySearchParse(query, parsed)).toBe(false);
  });

  it('parses date ranges as a single date term without garbage tokens', () => {
    const parsed = parseBuddyPostSearchQuery('上海出发，12.11-12.13，差 1 人');
    const criteria = resolveBuddyPostSearchCriteria(
      parsed,
      '上海出发，12.11-12.13，差 1 人',
    );
    expect(criteria.searchTerms).not.toContain('-12');
    expect(criteria.searchTerms).not.toContain('13');
    expect(criteria.preferOpenRecruit).toBe(true);
  });

  it('ranks open recruit posts above full when preferOpenRecruit is set', () => {
    const full = samplePost({
      _id: 'full',
      body: '组队，12.11-13，上海，3人，上海 Techno 小队人齐',
      departureCity: '上海',
      recruitStatus: 'full',
    });
    const open = samplePost({
      _id: 'open',
      body: '上海出发 12.11-12.13 Techno 差 1 人',
      departureCity: '上海',
      recruitStatus: 'open',
      slotsTotal: 3,
      slotsFilled: 2,
    });

    const ranked = rankBuddyPostsBySearch(
      [full, open],
      {
        departureCity: '上海',
        searchTerms: ['12.11', '12.13'],
        preferOpenRecruit: true,
      },
      { city: '上海', favorGenres: ['Techno'] },
    );
    expect(ranked.map((row) => String(row._id))).toEqual(['open', 'full']);
  });
});

describe('buddy-post-search rule-first helpers', () => {
  it('treats city-only queries as confident rule parses', () => {
    const parsed = parseBuddyPostSearchQuery('杭州出发');
    expect(isSimpleCityOnlyBuddySearch('杭州出发', parsed)).toBe(true);
    expect(isConfidentRuleBuddySearchParse('杭州出发', parsed)).toBe(true);
  });

  it('treats short keyword queries as confident rule parses', () => {
    const parsed = parseBuddyPostSearchQuery('Techno 组队');
    expect(isConfidentRuleBuddySearchParse('Techno 组队', parsed)).toBe(true);
  });

  it('does not treat complex natural language as confident', () => {
    const query = '想找能一起逛主舞台的小伙伴';
    const parsed = parseBuddyPostSearchQuery(query);
    expect(isConfidentRuleBuddySearchParse(query, parsed)).toBe(false);
  });

  it('skips LLM retry for confident city-only zero-result searches', () => {
    const parsed = parseBuddyPostSearchQuery('杭州出发');
    expect(shouldRetryBuddySearchWithLlm('杭州出发', 'rule', 0, parsed)).toBe(
      false,
    );
  });

  it('retries LLM when confident keyword search returns zero matches', () => {
    const parsed = parseBuddyPostSearchQuery('Techno 组队');
    expect(
      shouldRetryBuddySearchWithLlm('Techno 组队', 'rule', 0, parsed),
    ).toBe(true);
  });

  it('does not retry after LLM parse was already used', () => {
    const parsed = parseBuddyPostSearchQuery('Techno 组队');
    expect(shouldRetryBuddySearchWithLlm('Techno 组队', 'llm', 0, parsed)).toBe(
      false,
    );
  });
});
