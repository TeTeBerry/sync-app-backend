jest.mock('chromadb', () => require('../../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () =>
  require('../../../mocks/langchain-documents-page-content'),
);

jest.mock('@src/ai/agents', () => ({
  MatchAgent: jest.fn(),
  UserProfileAgent: jest.fn(),
}));

import { toRequestActor } from '@src/common/auth/actor-query.util';
import { MatchPostsFromChatUseCase } from '@src/ai/buddy/match-posts.use-case';
import type { UserProfileSyncResult } from '@src/ai/agents/user-profile.agent';

describe('MatchPostsFromChatUseCase profile dedupe', () => {
  const profileSync: UserProfileSyncResult = {
    profile: { city: '上海', favorGenres: ['Techno'] },
    weights: {
      city: 0.18,
      genreOverlap: 0.14,
      likeMateCompatible: 0.1,
      profileVector: 0.2,
      personalization: 0.04,
    },
    updated: false,
  };

  it('does not re-sync profile when profileSync is already provided', async () => {
    const syncProfileFromChat = jest.fn();
    const match = jest.fn().mockResolvedValue({ items: [], degraded: false });
    const resolveActivity = jest.fn().mockResolvedValue({
      legacyId: 9,
      name: '风暴电音节',
      code: 'storm',
      date: '06/13-14',
    });

    const useCase = new MatchPostsFromChatUseCase(
      { match } as never,
      { syncProfileFromChat } as never,
      {
        isMatchExistingPostsIntent: () => true,
        resolveActivity,
        buildRecommendedPostCards: jest.fn(),
      } as never,
      {
        assertCanMatch: jest.fn().mockResolvedValue(undefined),
        consumeIfMatched: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    await useCase.execute({
      messages: [{ role: 'user', content: '帮我看看有没有类似的组队帖' }],
      input: '帮我看看有没有类似的组队帖',
      activityLegacyId: 9,
      actor: toRequestActor('user-1'),
      fromIntentRouter: true,
      profileSync,
    });

    expect(syncProfileFromChat).not.toHaveBeenCalled();
    expect(match).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: profileSync.profile,
        rankingWeights: profileSync.weights,
      }),
    );
  });

  it('skips profile LLM for activity shortcut chips from intent router', async () => {
    const syncProfileFromChat = jest.fn();
    const match = jest.fn().mockResolvedValue({ items: [], degraded: false });
    const resolveActivity = jest.fn().mockResolvedValue({
      legacyId: 9,
      name: '风暴电音节',
      code: 'storm',
      date: '06/13-14',
    });

    const useCase = new MatchPostsFromChatUseCase(
      { match } as never,
      { syncProfileFromChat } as never,
      {
        isMatchExistingPostsIntent: () => false,
        resolveActivity,
        buildRecommendedPostCards: jest.fn().mockResolvedValue([]),
        filterMatchesForShortcutTag: jest.fn().mockResolvedValue([]),
      } as never,
      {
        assertCanMatch: jest.fn().mockResolvedValue(undefined),
        consumeIfMatched: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    await useCase.execute({
      messages: [{ role: 'user', content: '组队队友' }],
      input: '组队队友',
      activityLegacyId: 9,
      actor: toRequestActor('user-1'),
      fromIntentRouter: true,
    });

    expect(syncProfileFromChat).not.toHaveBeenCalled();
    expect(match).toHaveBeenCalled();
  });
});
