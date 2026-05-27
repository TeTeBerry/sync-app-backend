jest.mock('chromadb', () => require('../../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () =>
  require('../../../mocks/langchain-documents-page-content'),
);

jest.mock('@src/ai/llm/llm.service', () => ({
  LlmService: class MockLlmService {},
}));

import { MatchService } from '@src/ai/services/match.service';
import { BUDDY_RECOMMEND_LIMIT } from '@src/ai/match/buddy-match.constants';

describe('MatchService', () => {
  function buildService(deps: {
    postRepository: Record<string, unknown>;
    chromaService: Record<string, unknown>;
    matchContextService: Record<string, unknown>;
    postMatchRerankService: Record<string, unknown>;
  }) {
    return new MatchService(
      deps.postRepository as never,
      deps.chromaService as never,
      deps.matchContextService as never,
      deps.postMatchRerankService as never,
    );
  }

  it('returns Mongo-ranked matches when Chroma is empty', async () => {
    const postRepository = {
      findByActivityLegacyId: jest.fn().mockResolvedValue([
        {
          _id: 'luna',
          userId: 'demo-luna',
          status: 'recruiting',
          activityLegacyId: 4,
          body: '上海出发求拼车到深圳，2人女生',
          departureCity: '上海',
          eventTitle: '风暴电音节',
        },
        {
          _id: 'ryan',
          userId: 'demo-ryan',
          status: 'recruiting',
          activityLegacyId: 4,
          body: '广州拼车出发',
          departureCity: '广州',
          eventTitle: '风暴电音节',
        },
      ]),
    };

    const chromaService = {
      queryPostsForMatch: jest.fn().mockResolvedValue({
        matches: [],
        degraded: true,
      }),
    };

    const matchContextService = {
      buildFilterContext: jest.fn(),
      buildExcludeUserIds: jest.fn(),
      enrichCandidates: jest.fn(),
    };

    const postMatchRerankService = { rerank: jest.fn() };

    const service = buildService({
      postRepository,
      chromaService,
      matchContextService,
      postMatchRerankService,
    });

    const result = await service.search({
      criteria: {
        activityLegacyId: 4,
        activityName: '风暴电音节',
        departureCity: '上海',
        intents: ['carpool', 'team'],
        requesterBody: '上海出发求拼车',
      },
      userId: 'user-1',
      limit: BUDDY_RECOMMEND_LIMIT,
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]?.postId).toBe('luna');
    expect(result.items[0]?.matchReason).toContain('上海');
    expect(result.degraded).toBe(true);
    expect(postMatchRerankService.rerank).not.toHaveBeenCalled();
  });

  it('follows LLM rerank order over Chroma vector distance', async () => {
    const postRepository = {
      findByActivityLegacyId: jest.fn().mockResolvedValue([
        {
          _id: 'post-a',
          userId: 'user-a',
          status: 'recruiting',
          activityLegacyId: 4,
          body: '帖子A 向量更近',
          departureCity: '北京',
          eventTitle: '风暴电音节',
        },
        {
          _id: 'post-b',
          userId: 'user-b',
          status: 'recruiting',
          activityLegacyId: 4,
          body: '帖子B 向量更远',
          departureCity: '上海',
          tags: ['拼车'],
          eventTitle: '风暴电音节',
        },
      ]),
    };

    const chromaService = {
      queryPostsForMatch: jest.fn().mockResolvedValue({
        matches: [
          { postId: 'post-a', document: '帖子A 向量更近', distance: 0.1 },
          { postId: 'post-b', document: '帖子B 向量更远', distance: 0.5 },
        ],
        degraded: false,
      }),
    };

    const matchContextService = {
      buildFilterContext: jest.fn(),
      buildExcludeUserIds: jest.fn(),
      enrichCandidates: jest.fn(),
    };

    const postMatchRerankService = {
      rerank: jest.fn().mockResolvedValue(['post-b', 'post-a']),
    };

    const service = buildService({
      postRepository,
      chromaService,
      matchContextService,
      postMatchRerankService,
    });

    const result = await service.search({
      criteria: {
        activityLegacyId: 4,
        departureCity: '上海',
        requesterTags: ['拼车'],
        requesterBody: '上海 #拼车',
      },
      limit: 2,
    });

    expect(postMatchRerankService.rerank).toHaveBeenCalledWith(
      expect.stringContaining('上海 #拼车'),
      expect.arrayContaining([
        expect.objectContaining({
          postId: 'post-a',
          body: '帖子A 向量更近',
          departureCity: '北京',
        }),
        expect.objectContaining({
          postId: 'post-b',
          body: '帖子B 向量更远',
          departureCity: '上海',
          tags: ['拼车'],
        }),
      ]),
    );
    expect(result.items[0]?.postId).toBe('post-b');
    expect(result.items[0]?.matchReason).toBe('内容高度相关');
    expect(result.items[1]?.postId).toBe('post-a');
    expect(result.degraded).toBe(false);
  });

  it('marks degraded when rerank fails and falls back to Chroma order', async () => {
    const postRepository = {
      findByActivityLegacyId: jest.fn().mockResolvedValue([
        {
          _id: 'vector-first',
          userId: 'u1',
          status: 'recruiting',
          activityLegacyId: 4,
          body: 'first',
          eventTitle: '活动',
        },
        {
          _id: 'vector-second',
          userId: 'u2',
          status: 'recruiting',
          activityLegacyId: 4,
          body: 'second',
          eventTitle: '活动',
        },
      ]),
    };

    const chromaService = {
      queryPostsForMatch: jest.fn().mockResolvedValue({
        matches: [
          { postId: 'vector-first', document: 'first', distance: 0.1 },
          { postId: 'vector-second', document: 'second', distance: 0.4 },
        ],
        degraded: false,
      }),
    };

    const matchContextService = {
      buildFilterContext: jest.fn(),
      buildExcludeUserIds: jest.fn(),
      enrichCandidates: jest.fn(),
    };

    const postMatchRerankService = {
      rerank: jest.fn().mockResolvedValue(null),
    };

    const service = buildService({
      postRepository,
      chromaService,
      matchContextService,
      postMatchRerankService,
    });

    const result = await service.search({
      criteria: { activityLegacyId: 4 },
      limit: 2,
    });

    expect(result.items[0]?.postId).toBe('vector-first');
    expect(result.degraded).toBe(true);
  });

  it('excludes the requester own recruiting post from recommendations', async () => {
    const postRepository = {
      findByActivityLegacyId: jest.fn().mockResolvedValue([
        {
          _id: 'own-post',
          userId: 'user-1',
          status: 'recruiting',
          activityLegacyId: 4,
          body: '我自己的组队帖',
          departureCity: '上海',
          eventTitle: '风暴电音节',
        },
        {
          _id: 'other-post',
          userId: 'user-2',
          status: 'recruiting',
          activityLegacyId: 4,
          body: '他人组队帖',
          departureCity: '上海',
          eventTitle: '风暴电音节',
        },
      ]),
    };

    const chromaService = {
      queryPostsForMatch: jest.fn().mockResolvedValue({
        matches: [
          { postId: 'own-post', document: '我自己的组队帖', distance: 0.05 },
          { postId: 'other-post', document: '他人组队帖', distance: 0.2 },
        ],
        degraded: false,
      }),
    };

    const matchContextService = {
      buildFilterContext: jest.fn(),
      buildExcludeUserIds: jest.fn(),
      enrichCandidates: jest.fn(),
    };

    const postMatchRerankService = {
      rerank: jest.fn().mockResolvedValue(['other-post', 'own-post']),
    };

    const service = buildService({
      postRepository,
      chromaService,
      matchContextService,
      postMatchRerankService,
    });

    const result = await service.search({
      criteria: { activityLegacyId: 4, departureCity: '上海' },
      userId: 'user-1',
      authorName: 'Alice Wang',
      limit: BUDDY_RECOMMEND_LIMIT,
    });

    expect(result.items.map(item => item.postId)).not.toContain('own-post');
    expect(result.items[0]?.postId).toBe('other-post');
    expect(chromaService.queryPostsForMatch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        excludeUserIds: ['user-1'],
        profileUserId: 'user-1',
      }),
    );
  });

  it('excludes demo owner post when client userId differs from stored author id', async () => {
    const postRepository = {
      findByActivityLegacyId: jest.fn().mockResolvedValue([
        {
          _id: 'demo-post',
          userId: 'demo-zara',
          authorName: 'Zara Chen',
          status: 'recruiting',
          activityLegacyId: 4,
          body: 'Zara 自己的组队帖',
          departureCity: '上海',
          eventTitle: '风暴电音节',
        },
        {
          _id: 'other-post',
          userId: 'user-2',
          status: 'recruiting',
          activityLegacyId: 4,
          body: '他人组队帖',
          departureCity: '上海',
          eventTitle: '风暴电音节',
        },
      ]),
    };

    const chromaService = {
      queryPostsForMatch: jest.fn().mockResolvedValue({
        matches: [
          { postId: 'demo-post', document: 'Zara 自己的组队帖', distance: 0.05 },
          { postId: 'other-post', document: '他人组队帖', distance: 0.2 },
        ],
        degraded: false,
      }),
    };

    const matchContextService = {
      buildFilterContext: jest.fn().mockResolvedValue({
        requesterUserId: 'demo-zara',
        blockedUserIds: new Set<string>(),
        buddyUserIds: new Set<string>(),
      }),
      buildExcludeUserIds: jest.fn().mockReturnValue(['demo-zara']),
      enrichCandidates: jest.fn(),
    };

    const postMatchRerankService = {
      rerank: jest.fn().mockResolvedValue(['other-post', 'demo-post']),
    };

    const service = buildService({
      postRepository,
      chromaService,
      matchContextService,
      postMatchRerankService,
    });

    const result = await service.search({
      criteria: { activityLegacyId: 4, departureCity: '上海' },
      userId: 'client-session-xyz',
      authorName: 'Zara Chen',
      limit: BUDDY_RECOMMEND_LIMIT,
    });

    expect(result.items.map(item => item.postId)).not.toContain('demo-post');
    expect(result.items[0]?.postId).toBe('other-post');
    expect(chromaService.queryPostsForMatch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        excludeUserIds: ['demo-zara'],
        profileUserId: 'demo-zara',
      }),
    );
  });

  it('excludes criteria seed owner post id even when rerank prefers it', async () => {
    const postRepository = {
      findByActivityLegacyId: jest.fn().mockResolvedValue([
        {
          _id: 'seed-post',
          userId: 'user-2',
          status: 'recruiting',
          activityLegacyId: 4,
          body: '他人但用作 seed 的帖',
          departureCity: '上海',
          eventTitle: '风暴电音节',
        },
        {
          _id: 'other-post',
          userId: 'user-3',
          status: 'recruiting',
          activityLegacyId: 4,
          body: '另一条组队帖',
          departureCity: '上海',
          eventTitle: '风暴电音节',
        },
      ]),
    };

    const chromaService = {
      queryPostsForMatch: jest.fn().mockResolvedValue({
        matches: [
          { postId: 'seed-post', document: '他人但用作 seed 的帖', distance: 0.05 },
          { postId: 'other-post', document: '另一条组队帖', distance: 0.2 },
        ],
        degraded: false,
      }),
    };

    const matchContextService = {
      buildFilterContext: jest.fn(),
      buildExcludeUserIds: jest.fn(),
      enrichCandidates: jest.fn(),
    };

    const postMatchRerankService = {
      rerank: jest.fn().mockResolvedValue(['seed-post', 'other-post']),
    };

    const service = buildService({
      postRepository,
      chromaService,
      matchContextService,
      postMatchRerankService,
    });

    const result = await service.search({
      criteria: {
        activityLegacyId: 4,
        departureCity: '上海',
        excludePostIds: ['seed-post'],
      },
      userId: 'user-1',
      limit: BUDDY_RECOMMEND_LIMIT,
    });

    expect(result.items.map(item => item.postId)).not.toContain('seed-post');
    expect(result.items[0]?.postId).toBe('other-post');
  });
});
