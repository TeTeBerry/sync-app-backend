import {
  DEFAULT_MATCH_RANKING_WEIGHTS,
  buildMatchReason,
  rerankMatchCandidates,
  shouldFilterCandidate,
  type MatchFilterContext,
  type RankablePostCandidate,
} from '@src/ai/match/match-ranking.util';

function candidate(
  postId: string,
  overrides: Partial<RankablePostCandidate> = {},
): RankablePostCandidate {
  return {
    postId,
    document: `Post ${postId}`,
    distance: 0.4,
    authorUserId: `author-${postId}`,
    ...overrides,
  };
}

describe('match-ranking.util', () => {
  const baseContext: MatchFilterContext = {
    requesterUserId: 'user-a',
    profile: {
      city: '上海',
      favorGenres: ['EDM', 'Techno'],
      likeMate: true,
    },
    blockedUserIds: new Set(['blocked-user']),
    buddyUserIds: new Set(['buddy-user']),
  };

  it('filters own posts, blocked users, and existing buddies', () => {
    expect(
      shouldFilterCandidate(
        candidate('own', { authorUserId: 'user-a' }),
        baseContext,
      ),
    ).toBe(true);
    expect(
      shouldFilterCandidate(
        candidate('blocked', { authorUserId: 'blocked-user' }),
        baseContext,
      ),
    ).toBe(true);
    expect(
      shouldFilterCandidate(
        candidate('buddy', { authorUserId: 'buddy-user' }),
        baseContext,
      ),
    ).toBe(true);
    expect(
      shouldFilterCandidate(
        candidate('ok', { authorUserId: 'fresh-user' }),
        baseContext,
      ),
    ).toBe(false);
  });

  it('boosts same city, overlapping genres, and compatible likeMate', () => {
    const localMatch = rerankMatchCandidates(
      [
        candidate('local', {
          distance: 0.35,
          postCity: '上海',
          author: {
            userId: 'local-author',
            city: '上海',
            favorGenres: ['Techno'],
            likeMate: true,
          },
        }),
        candidate('remote', {
          distance: 0.34,
          postCity: '北京',
          author: {
            userId: 'remote-author',
            city: '北京',
            favorGenres: ['House'],
            likeMate: false,
          },
        }),
      ],
      baseContext,
      2,
    );

    expect(localMatch[0]?.postId).toBe('local');
  });

  it('returns different order for different users with similar scores', () => {
    const candidates = [
      candidate('p1', { distance: 0.31, authorUserId: 'author-1' }),
      candidate('p2', { distance: 0.31, authorUserId: 'author-2' }),
      candidate('p3', { distance: 0.31, authorUserId: 'author-3' }),
    ];

    const userOne = rerankMatchCandidates(
      candidates,
      {
        ...baseContext,
        requesterUserId: 'user-one',
        profile: { city: '上海' },
      },
      3,
      DEFAULT_MATCH_RANKING_WEIGHTS,
    ).map((item) => item.postId);

    const userTwo = rerankMatchCandidates(
      candidates,
      {
        ...baseContext,
        requesterUserId: 'user-two',
        profile: { city: '上海' },
      },
      3,
      DEFAULT_MATCH_RANKING_WEIGHTS,
    ).map((item) => item.postId);

    expect(userOne).not.toEqual(userTwo);
  });

  it('builds human-readable match reasons from profile signals', () => {
    const reason = buildMatchReason(
      candidate('local', {
        postCity: '上海',
        distance: 0.4,
        author: {
          userId: 'local-author',
          city: '上海',
          favorGenres: ['Techno'],
          likeMate: true,
        },
      }),
      {
        city: '上海',
        favorGenres: ['Techno'],
        likeMate: true,
      },
    );

    expect(reason).toContain('同「上海」出发');
    expect(reason).toContain('曲风接近');
    expect(reason).toContain('Techno');
  });

  it('keeps vector distance primary; criteria only nudges ties', () => {
    const context: MatchFilterContext = {
      ...baseContext,
      criteria: {
        activityLegacyId: 4,
        departureCity: '上海',
        requesterTags: ['同路'],
      },
    };

    const ranked = rerankMatchCandidates(
      [
        candidate('vector-closer', {
          distance: 0.2,
          postDepartureCity: '北京',
          postTags: ['组队'],
          postBody: '北京出发',
        }),
        candidate('tag-fit', {
          distance: 0.45,
          postDepartureCity: '上海',
          postTags: ['同路'],
          postBody: '上海 #同路 缺1',
        }),
      ],
      context,
      2,
    );

    expect(ranked[0]?.postId).toBe('vector-closer');
    expect(ranked[1]?.matchReason).toBe('标签契合：#同路');
  });
});
