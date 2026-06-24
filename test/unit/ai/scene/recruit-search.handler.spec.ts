import { BadRequestException } from '@nestjs/common';
import { RecruitSearchSceneHandler } from '../../../../src/ai/scene/handlers/recruit-search.handler';
import type { PostService } from '../../../../src/modules/partner/post.service';
import type { UserService } from '../../../../src/modules/user/user.service';

describe('RecruitSearchSceneHandler', () => {
  const postService = {
    searchPostsByNaturalLanguage: jest.fn(),
  };
  const userService = {
    resolveProfile: jest.fn(),
  };
  const handler = new RecruitSearchSceneHandler(
    postService as unknown as PostService,
    userService as unknown as UserService,
  );
  const actor = { resolvedUserId: 'user-1' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    userService.resolveProfile.mockResolvedValue(null);
  });

  it('maps search result to insight_line and reorder_posts effects', async () => {
    postService.searchPostsByNaturalLanguage.mockResolvedValue({
      parsed: {
        departureCity: '上海',
        searchTerms: ['上海出发'],
      },
      items: [
        { id: 'post-1', name: 'A', location: '上海', tags: [], avatar: '' },
      ],
      totalMatched: 1,
      totalScanned: 10,
    });

    const response = await handler.run(
      {
        scene: 'recruit_search',
        input: '上海出发',
        activityLegacyId: 8,
        context: { applyPreferenceRank: false },
      },
      actor,
    );

    expect(response.effects).toEqual([
      {
        type: 'insight_line',
        text: '上海出发',
        variant: 'parsed',
        aiGenerated: false,
      },
      {
        type: 'reorder_posts',
        postIds: ['post-1'],
        items: [
          { id: 'post-1', name: 'A', location: '上海', tags: [], avatar: '' },
        ],
        totalMatched: 1,
        totalScanned: 10,
        parsed: {
          departureCity: '上海',
          searchTerms: ['上海出发'],
        },
      },
    ]);
  });

  it('adds preference insight when profile has signals', async () => {
    postService.searchPostsByNaturalLanguage.mockResolvedValue({
      parsed: { searchTerms: [] },
      items: [],
      totalMatched: 0,
      totalScanned: 0,
    });
    userService.resolveProfile.mockResolvedValue({
      city: '上海',
      favorGenres: ['Techno', 'House', 'Trance'],
      budgetLevel: 'medium',
    });

    const response = await handler.run(
      {
        scene: 'recruit_search',
        input: 'techno',
        activityLegacyId: 8,
      },
      actor,
    );

    const preference = response.effects.find(
      (effect) =>
        effect.type === 'insight_line' && effect.variant === 'preference',
    );
    expect(preference).toEqual({
      type: 'insight_line',
      text: '上海 · Techno、House等3种 · 舒适',
      variant: 'preference',
      aiGenerated: false,
    });
  });

  it('requires input and activityLegacyId', async () => {
    await expect(
      handler.run({ scene: 'recruit_search', activityLegacyId: 8 }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      handler.run({ scene: 'recruit_search', input: 'test' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
