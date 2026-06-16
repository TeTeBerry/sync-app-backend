import { PostSearchService } from '@src/modules/partner/application/post-search.service';
import type { PostRecord } from '@src/modules/partner/interfaces/post.repository.interface';

describe('PostSearchService', () => {
  const repository = {
    findByActivityLegacyId: jest.fn(),
  };
  const parseService = {
    parse: jest.fn(),
  };
  const postQuery = {
    mapEventDetailPosts: jest.fn(),
  };

  let service: PostSearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostSearchService(
      repository as never,
      parseService as never,
      postQuery as never,
    );
  });

  it('filters public posts by parsed terms and preserves publish order', async () => {
    const older = {
      _id: 'older',
      body: 'Techno 白天',
      createdAt: new Date('2026-09-01T10:00:00Z'),
    } as PostRecord;
    const newer = {
      _id: 'newer',
      body: 'Techno 同逛舞台',
      createdAt: new Date('2026-10-02T10:00:00Z'),
    } as PostRecord;
    const unrelated = {
      _id: 'other',
      body: 'House only',
      createdAt: new Date('2026-10-03T10:00:00Z'),
    } as PostRecord;

    repository.findByActivityLegacyId.mockResolvedValue([
      newer,
      older,
      unrelated,
    ]);
    parseService.parse.mockResolvedValue({
      genre: 'Techno',
      extraKeywords: ['同逛舞台'],
    });
    postQuery.mapEventDetailPosts.mockImplementation(
      async (rows: PostRecord[]) =>
        rows.map((row) => ({ id: String(row._id), body: row.body })),
    );

    const result = await service.searchByNaturalLanguage(
      '喜欢 Techno，同逛舞台',
      4,
      { resolvedUserId: 'viewer' } as never,
    );

    expect(result.parsed.searchTerms).toEqual(['Techno', '同逛舞台']);
    expect(result.totalScanned).toBe(3);
    expect(result.totalMatched).toBe(1);
    expect(result.items).toEqual([{ id: 'newer', body: 'Techno 同逛舞台' }]);
    expect(postQuery.mapEventDetailPosts).toHaveBeenCalledWith(
      [newer],
      expect.anything(),
    );
  });
});
