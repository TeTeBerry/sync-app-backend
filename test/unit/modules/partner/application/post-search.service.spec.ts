import { PostSearchService } from '@src/modules/partner/application/post-search.service';
import type { PostRecord } from '@src/modules/partner/interfaces/post.repository.interface';

describe('PostSearchService', () => {
  const repository = {
    findByActivityLegacyIdPage: jest.fn(),
  };
  const parseService = {
    parse: jest.fn(),
    tryLlmParse: jest.fn(),
  };
  const postQuery = {
    mapEventDetailPosts: jest.fn(),
  };
  const userService = {
    resolveProfile: jest.fn().mockResolvedValue(null),
  };

  let service: PostSearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostSearchService(
      repository as never,
      parseService as never,
      postQuery as never,
      userService as never,
    );
  });

  it('filters and ranks posts by keyword relevance, then user preference', async () => {
    const weakerKeyword = {
      _id: 'weak',
      body: 'Techno 组队',
      departureCity: '广州',
      createdAt: new Date('2026-10-03T10:00:00Z'),
    } as PostRecord;
    const strongerKeyword = {
      _id: 'strong',
      body: 'Techno 同逛舞台 白天',
      departureCity: '上海',
      createdAt: new Date('2026-09-01T10:00:00Z'),
    } as PostRecord;
    const unrelated = {
      _id: 'other',
      body: 'House only',
      createdAt: new Date('2026-10-04T10:00:00Z'),
    } as PostRecord;

    repository.findByActivityLegacyIdPage.mockResolvedValue([
      weakerKeyword,
      strongerKeyword,
      unrelated,
    ]);
    parseService.parse.mockResolvedValue({
      parsed: {
        genre: 'Techno',
        extraKeywords: ['同逛舞台'],
      },
      source: 'llm',
    });
    userService.resolveProfile.mockResolvedValue({
      city: '上海',
      favorGenres: ['Techno'],
    });
    postQuery.mapEventDetailPosts.mockImplementation(
      async (rows: PostRecord[]) =>
        rows.map((row) => ({ id: String(row._id), body: row.body })),
    );

    const result = await service.searchByNaturalLanguage(
      '喜欢 Techno，同逛舞台',
      4,
      { resolvedUserId: 'viewer', clientUserId: 'viewer' } as never,
    );

    expect(result.parsed.searchTerms).toEqual(['Techno', '同逛舞台']);
    expect(result.totalScanned).toBe(3);
    expect(result.totalMatched).toBe(1);
    expect(result.items).toEqual([
      { id: 'strong', body: 'Techno 同逛舞台 白天' },
    ]);
  });

  it('uses preference as tiebreaker when keyword scores are equal', async () => {
    const shanghai = {
      _id: 'shanghai',
      body: 'Techno 同逛舞台',
      departureCity: '上海',
      createdAt: new Date('2026-09-01T10:00:00Z'),
    } as PostRecord;
    const guangzhou = {
      _id: 'guangzhou',
      body: 'Techno 同逛舞台',
      departureCity: '广州',
      createdAt: new Date('2026-10-03T10:00:00Z'),
    } as PostRecord;

    repository.findByActivityLegacyIdPage.mockResolvedValue([
      guangzhou,
      shanghai,
    ]);
    parseService.parse.mockResolvedValue({
      parsed: {
        genre: 'Techno',
        extraKeywords: ['同逛舞台'],
      },
      source: 'llm',
    });
    userService.resolveProfile.mockResolvedValue({
      city: '上海',
      favorGenres: ['Techno'],
    });
    postQuery.mapEventDetailPosts.mockImplementation(
      async (rows: PostRecord[]) =>
        rows.map((row) => ({ id: String(row._id), body: row.body })),
    );

    const result = await service.searchByNaturalLanguage('Techno 同逛舞台', 4, {
      resolvedUserId: 'viewer',
      clientUserId: 'viewer',
    } as never);

    expect(result.items.map((item) => item.id)).toEqual([
      'shanghai',
      'guangzhou',
    ]);
  });

  it('retries LLM when confident rule parse returns zero matches', async () => {
    const post = {
      _id: 'hangzhou',
      body: '12.18-12.20，差 1 人',
      departureCity: '杭州',
      createdAt: new Date('2026-10-03T10:00:00Z'),
    } as PostRecord;

    repository.findByActivityLegacyIdPage.mockResolvedValue([post]);
    parseService.parse.mockResolvedValue({
      parsed: { extraKeywords: ['Techno', '组队'] },
      source: 'rule',
    });
    parseService.tryLlmParse.mockResolvedValue({
      departureCity: '杭州',
    });
    postQuery.mapEventDetailPosts.mockImplementation(
      async (rows: PostRecord[]) =>
        rows.map((row) => ({ id: String(row._id), body: row.body })),
    );

    const result = await service.searchByNaturalLanguage('Techno 组队', 4, {
      resolvedUserId: 'viewer',
      clientUserId: 'viewer',
    } as never);

    expect(parseService.tryLlmParse).toHaveBeenCalledWith('Techno 组队');
    expect(result.totalMatched).toBe(1);
    expect(result.items[0]?.id).toBe('hangzhou');
  });
});
