jest.mock('chromadb', () => require('../../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () =>
  require('../../../mocks/langchain-documents-page-content'),
);

jest.mock('@src/ai/agents', () => ({
  MatchAgent: jest.fn(),
  UserProfileAgent: jest.fn(),
}));

import { ForbiddenException } from '@nestjs/common';
import { toRequestActor } from '@src/common/auth/actor-query.util';
import { MatchPostsFromChatUseCase } from '@src/ai/buddy/match-posts.use-case';
import { AiMatchQuotaService } from '@src/ai/ai-match-quota.service';
import type { UserProfileSyncResult } from '@src/ai/agents/user-profile.agent';

function buildUseCase(deps: {
  assertCanMatch?: jest.Mock;
  consumeIfMatched?: jest.Mock;
  matchItems?: Array<{ postId: string; snippet: string; matchReason?: string }>;
  postCards?: Array<{ postId: string; snippet: string }>;
}) {
  const assertCanMatch =
    deps.assertCanMatch ?? jest.fn().mockResolvedValue(undefined);
  const consumeIfMatched =
    deps.consumeIfMatched ?? jest.fn().mockResolvedValue(undefined);
  const match = jest.fn().mockResolvedValue({
    items: deps.matchItems ?? [],
    degraded: false,
  });
  const buildRecommendedPostCards = jest
    .fn()
    .mockResolvedValue(deps.postCards ?? []);

  const useCase = new MatchPostsFromChatUseCase(
    { match } as never,
    { syncProfileFromChat: jest.fn() } as never,
    {
      isMatchExistingPostsIntent: () => true,
      resolveActivity: jest.fn().mockResolvedValue({
        legacyId: 9,
        name: '风暴电音节',
        code: 'storm',
      }),
      resolveOwnerPostForMatch: jest.fn().mockResolvedValue(null),
      buildRecommendedPostCards,
    } as never,
    { assertCanMatch, consumeIfMatched } as unknown as AiMatchQuotaService,
  );

  return {
    useCase,
    assertCanMatch,
    consumeIfMatched,
    match,
    buildRecommendedPostCards,
  };
}

const profileSync: UserProfileSyncResult = {
  profile: { city: '上海' },
  weights: {
    city: 0.18,
    genreOverlap: 0.14,
    likeMateCompatible: 0.1,
    profileVector: 0.2,
    personalization: 0.04,
  },
  updated: false,
};

describe('MatchPostsFromChatUseCase quota', () => {
  const actorUser1 = toRequestActor('user-1');
  const actorZara = toRequestActor('user-1', 'Zara');

  it('pre-checks quota before matchAgent.match', async () => {
    const { useCase, assertCanMatch, match } = buildUseCase({});

    await useCase.execute({
      messages: [{ role: 'user', content: '查组队帖' }],
      input: '查组队帖',
      activityLegacyId: 9,
      actor: actorUser1,
      fromIntentRouter: true,
      profileSync,
    });

    expect(assertCanMatch).toHaveBeenCalledWith(actorUser1, 9);
    expect(match).toHaveBeenCalled();
  });

  it('throws when quota pre-check fails', async () => {
    const { useCase, match } = buildUseCase({
      assertCanMatch: jest
        .fn()
        .mockRejectedValue(new ForbiddenException('AI match quota exhausted')),
    });

    await expect(
      useCase.execute({
        messages: [{ role: 'user', content: '查组队帖' }],
        input: '查组队帖',
        activityLegacyId: 9,
        actor: actorUser1,
        fromIntentRouter: true,
        profileSync,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(match).not.toHaveBeenCalled();
  });

  it('consumes quota only when postCards.length > 0', async () => {
    const { useCase, consumeIfMatched } = buildUseCase({
      matchItems: [{ postId: 'p1', snippet: '找队友' }],
      postCards: [{ postId: 'p1', snippet: '找队友' }],
    });

    await useCase.execute({
      messages: [{ role: 'user', content: '查组队帖' }],
      input: '查组队帖',
      activityLegacyId: 9,
      actor: actorZara,
      fromIntentRouter: true,
      profileSync,
    });

    expect(consumeIfMatched).toHaveBeenCalledWith(actorZara, 9, 1);
  });

  it('does not consume when match returns empty postCards', async () => {
    const { useCase, consumeIfMatched } = buildUseCase({
      matchItems: [],
      postCards: [],
    });

    await useCase.execute({
      messages: [{ role: 'user', content: '查组队帖' }],
      input: '查组队帖',
      activityLegacyId: 9,
      actor: toRequestActor('user-1'),
      fromIntentRouter: true,
      profileSync,
    });

    expect(consumeIfMatched).not.toHaveBeenCalled();
  });
});
