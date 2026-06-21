import {
  buddyPostMatchesSearchTerms,
  buildSearchTermsFromParsed,
  filterBuddyPostsBySearchTerms,
  fuzzyTextMatches,
  parseBuddyPostSearchQuery,
  rankBuddyPostsBySearch,
  resolveBuddyPostSearchTerms,
  scoreBuddyPostKeywordMatch,
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
    const terms = resolveBuddyPostSearchTerms(
      {
        eventName: 'EDC',
        date: '10.3',
        genre: 'Techno',
        peopleCount: '2',
        extraKeywords: ['白天', '同逛舞台'],
      },
      '比如：喜欢 Techno，白天在场，找 2 个同逛舞台的搭子',
    );

    expect(
      buddyPostMatchesSearchTerms(
        samplePost({ body: '10.3 EDC 白天在场，喜欢 Techno，找 2 人同逛舞台' }),
        terms,
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

    const terms = resolveBuddyPostSearchTerms(parsed, '');
    const post = samplePost({
      eventTitle: 'EDC 韩国',
      body: '10.3 EDC 韩国 白天在场，喜欢 Techno，找 2 人同逛舞台',
    });
    expect(buddyPostMatchesSearchTerms(post, terms)).toBe(true);
  });

  it('strips buddy-search boilerplate for departure city queries', () => {
    const terms = resolveBuddyPostSearchTerms(
      parseBuddyPostSearchQuery('找成都出发的队'),
      '找成都出发的队',
    );
    expect(terms).toEqual(['成都出发']);

    const post = samplePost({
      body: '成都出发，12.12-13 两天场',
      departureCity: '成都',
    });
    expect(buddyPostMatchesSearchTerms(post, terms)).toBe(true);
  });

  it('scores stronger keyword coverage higher', () => {
    const stronger = scoreBuddyPostKeywordMatch(
      samplePost({ body: '成都出发 Techno', departureCity: '成都' }),
      ['成都', '出发', 'Techno'],
    );
    const weaker = scoreBuddyPostKeywordMatch(
      samplePost({ body: '成都 Techno', departureCity: '成都' }),
      ['成都', 'Techno'],
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
      ['Techno', '同逛舞台'],
      { city: '上海', favorGenres: ['Techno'] },
    );
    expect(ranked.map((row) => String(row._id))).toEqual([
      'shanghai',
      'guangzhou',
    ]);
  });
});
