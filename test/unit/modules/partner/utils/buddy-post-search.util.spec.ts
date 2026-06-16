import {
  buddyPostMatchesSearchTerms,
  buildSearchTermsFromParsed,
  filterBuddyPostsBySearchTerms,
  fuzzyTextMatches,
  resolveBuddyPostSearchTerms,
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
    contentTypes: ['team'],
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

    expect(buddyPostMatchesSearchTerms(samplePost(), terms)).toBe(true);
  });

  it('filters posts without changing createdAt order', () => {
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
});
