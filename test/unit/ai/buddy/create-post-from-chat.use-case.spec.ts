jest.mock('chromadb', () => require('../../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () =>
  require('../../../mocks/langchain-documents'),
);

jest.mock('@langchain/core/messages', () =>
  require('../../../mocks/langchain-messages'),
);

jest.mock('@langchain/community/chat_models/alibaba_tongyi', () =>
  require('../../../mocks/alibaba-tongyi'),
);

import { toRequestActor } from '@src/common/auth/actor-query.util';
import { CreatePostFromChatUseCase } from '@src/ai/buddy/create-post-from-chat.use-case';
import { SELF_POST_COLLECT_BODY_MARKER } from '@src/ai/gate/recommend-gate.util';

describe('CreatePostFromChatUseCase self-post custom body', () => {
  const activity = {
    legacyId: 9,
    name: '风暴电音节',
    code: 'storm',
    date: '06/13-14',
  };

  const baseParams = {
    actor: toRequestActor('user-1', 'Test User'),
    activityLegacyId: 9,
    conversationState: { version: 1, flow: 'idle' as const },
    onStateChange: jest.fn(),
  };

  const gateMessages = [{ role: 'user' as const, content: '组队队友' }];

  function createUseCase(overrides?: {
    existingPost?: { id: string; body: string; eventTitle?: string } | null;
    buildPostBody?: jest.Mock;
    textParseResult?: Record<string, unknown>;
    createPost?: jest.Mock;
  }) {
    const buildPostBody =
      overrides?.buildPostBody ??
      jest
        .fn()
        .mockImplementation(
          async ({
            parsedBody,
            input,
          }: {
            parsedBody?: string;
            input: string;
          }) => parsedBody?.trim() || input.trim(),
        );
    const createPost =
      overrides?.createPost ?? jest.fn().mockResolvedValue({ id: 'post-new' });

    return new CreatePostFromChatUseCase(
      {
        parse: jest
          .fn()
          .mockResolvedValue(overrides?.textParseResult ?? { ready: false }),
      } as never,
      { parse: jest.fn() } as never,
      {
        assess: jest.fn().mockResolvedValue({ publishable: true }),
        assessImage: jest.fn(),
      } as never,
      { notifyPostRejected: jest.fn() } as never,
      {
        findOwnerRecruitingPostForActivity: jest
          .fn()
          .mockResolvedValue(overrides?.existingPost ?? null),
        createPost,
      } as never,
      {
        shouldAttemptPostCreation: () => true,
        resolveActivity: jest.fn().mockResolvedValue(activity),
        buildPostBody,
        buildRecommendedPostCards: jest
          .fn()
          .mockImplementation(
            async (matches: Array<{ postId: string; snippet: string }>) =>
              matches.map((match) => ({
                postId: match.postId,
                snippet: match.snippet,
                authorName: 'Test User',
                eventTitle: activity.name ?? '活动',
                activityLegacyId: activity.legacyId,
              })),
          ),
        buildRejectionReply: jest.fn(),
        resolveTags: jest.fn().mockReturnValue([]),
      } as never,
      {
        assertCanPublish: jest.fn().mockResolvedValue(undefined),
        recordTicketPolicyViolation: jest.fn(),
        recordPublishRiskViolation: jest.fn(),
      } as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks for custom body when user declines recommendations', async () => {
    const useCase = createUseCase();
    const onStateChange = jest.fn();

    const result = await useCase.execute({
      ...baseParams,
      messages: [...gateMessages, { role: 'user', content: '没有合适的' }],
      input: '没有合适的',
      onStateChange,
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'rejected',
        replyText: '想发什么直接说，我帮你发～',
      }),
    );
    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ flow: 'collect_post_body' }),
    );
  });

  it('publishes immediately when user sends custom body after decline', async () => {
    const buildPostBody = jest
      .fn()
      .mockImplementation(
        async ({ parsedBody }: { parsedBody?: string }) =>
          parsedBody?.trim() ?? '',
      );
    const useCase = createUseCase({ buildPostBody });
    const onStateChange = jest.fn();
    const customBody = '13号A区求组队，3人从上海出发';

    const result = await useCase.execute({
      ...baseParams,
      conversationState: {
        version: 1,
        flow: 'collect_post_body',
        publishDraft: { activityLegacyId: 9 },
      },
      messages: [
        ...gateMessages,
        { role: 'user', content: '没有合适的' },
        {
          role: 'assistant',
          content: `${SELF_POST_COLLECT_BODY_MARKER}\n请描述需求`,
        },
        { role: 'user', content: customBody },
      ],
      input: customBody,
      onStateChange,
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'created',
        postId: 'post-new',
        replyText: expect.stringContaining('已为你发布'),
      }),
    );
    expect(buildPostBody).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedBody: customBody,
        input: customBody,
      }),
    );
  });

  it('publishes informal short reply verbatim', async () => {
    const informalBody = '13号 dd 一个女生';
    const buildPostBody = jest
      .fn()
      .mockImplementation(
        async ({ parsedBody }: { parsedBody?: string }) =>
          parsedBody?.trim() ?? '',
      );
    const useCase = createUseCase({ buildPostBody });
    const onStateChange = jest.fn();

    const result = await useCase.execute({
      ...baseParams,
      conversationState: {
        version: 1,
        flow: 'collect_post_body',
        publishDraft: { activityLegacyId: 9 },
      },
      messages: [
        ...gateMessages,
        { role: 'user', content: '没有合适的' },
        {
          role: 'assistant',
          content: `${SELF_POST_COLLECT_BODY_MARKER}\n请描述需求`,
        },
        { role: 'user', content: informalBody },
      ],
      input: informalBody,
      onStateChange,
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'created',
        postId: 'post-new',
      }),
    );
  });

  it('returns existing_post when user chose self-post but already has a recruiting post', async () => {
    const useCase = createUseCase({
      existingPost: {
        id: 'existing-1',
        body: '已有组队帖',
        eventTitle: '风暴电音节',
      },
    });
    const onStateChange = jest.fn();

    const result = await useCase.execute({
      ...baseParams,
      messages: [...gateMessages, { role: 'user', content: '没有合适的' }],
      input: '没有合适的',
      onStateChange,
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'existing_post',
        postId: 'existing-1',
      }),
    );
  });

  it('uses conversation city for post location, not parsed zone from body', async () => {
    const createPost = jest.fn().mockResolvedValue({ id: 'post-new' });
    const customBody = '13号 A区 dd';
    const buildPostBody = jest
      .fn()
      .mockImplementation(
        async ({ parsedBody }: { parsedBody?: string }) =>
          parsedBody?.trim() ?? '',
      );
    const useCase = createUseCase({
      buildPostBody,
      createPost,
      textParseResult: { ready: false, location: 'A区' },
    });
    const onStateChange = jest.fn();

    await useCase.execute({
      ...baseParams,
      conversationState: {
        version: 1,
        flow: 'collect_post_body',
        publishDraft: { activityLegacyId: 9 },
      },
      messages: [
        ...gateMessages,
        { role: 'user', content: '上海' },
        { role: 'user', content: '没有合适的' },
        {
          role: 'assistant',
          content: `${SELF_POST_COLLECT_BODY_MARKER}\n请描述需求`,
        },
        { role: 'user', content: customBody },
      ],
      input: customBody,
      onStateChange,
    });

    expect(createPost).toHaveBeenCalledWith(
      expect.objectContaining({
        body: customBody,
        location: '上海',
        departureCity: '上海',
      }),
      expect.objectContaining({
        clientUserId: 'user-1',
        displayName: 'Test User',
      }),
      { skipRiskCheck: true },
    );
  });

  it('omits location from dto when no conversation city so profile fallback applies', async () => {
    const createPost = jest.fn().mockResolvedValue({ id: 'post-new' });
    const customBody = '13号 A区 dd';
    const buildPostBody = jest
      .fn()
      .mockImplementation(
        async ({ parsedBody }: { parsedBody?: string }) =>
          parsedBody?.trim() ?? '',
      );
    const useCase = createUseCase({
      buildPostBody,
      createPost,
      textParseResult: { ready: false, location: 'A区' },
    });
    const onStateChange = jest.fn();

    await useCase.execute({
      ...baseParams,
      conversationState: {
        version: 1,
        flow: 'collect_post_body',
        publishDraft: { activityLegacyId: 9 },
      },
      messages: [
        ...gateMessages,
        { role: 'user', content: '没有合适的' },
        {
          role: 'assistant',
          content: `${SELF_POST_COLLECT_BODY_MARKER}\n请描述需求`,
        },
        { role: 'user', content: customBody },
      ],
      input: customBody,
      onStateChange,
    });

    const dto = createPost.mock.calls[0][0];
    expect(dto.body).toBe(customBody);
    expect(dto.location).toBeUndefined();
    expect(dto.departureCity).toBeUndefined();
  });

  it('asks to collect body instead of structured clarify when user wants to repost', async () => {
    const useCase = createUseCase({
      existingPost: {
        id: 'existing-1',
        body: '已有组队帖',
        eventTitle: '风暴电音节',
      },
    });
    const onStateChange = jest.fn();

    const result = await useCase.execute({
      ...baseParams,
      conversationState: { version: 1, flow: 'idle' },
      messages: [
        { role: 'user', content: '组队队友' },
        { role: 'user', content: '重新发贴' },
      ],
      input: '重新发贴',
      onStateChange,
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'rejected',
        replyText: '想发什么直接说，我帮你发～',
      }),
    );
    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ flow: 'collect_post_body' }),
    );
  });

  it('publishes cpdd verbatim after repost flow', async () => {
    const buildPostBody = jest
      .fn()
      .mockImplementation(
        async ({ parsedBody }: { parsedBody?: string }) =>
          parsedBody?.trim() ?? '',
      );
    const useCase = createUseCase({ buildPostBody });
    const onStateChange = jest.fn();

    const result = await useCase.execute({
      ...baseParams,
      conversationState: {
        version: 1,
        flow: 'collect_post_body',
        publishDraft: { activityLegacyId: 9, fromSelfPost: true },
      },
      messages: [
        { role: 'user', content: '组队队友' },
        { role: 'user', content: '重新发贴' },
        {
          role: 'assistant',
          content: `${SELF_POST_COLLECT_BODY_MARKER}\n请描述需求`,
        },
        { role: 'user', content: 'cpdd' },
      ],
      input: 'cpdd',
      onStateChange,
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'created',
        postId: 'post-new',
      }),
    );
    expect(buildPostBody).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedBody: 'cpdd',
        input: 'cpdd',
      }),
    );
  });

  it('publishes cpdd when stuck in clarify_buddy state', async () => {
    const buildPostBody = jest
      .fn()
      .mockImplementation(
        async ({ parsedBody }: { parsedBody?: string }) =>
          parsedBody?.trim() ?? '',
      );
    const useCase = createUseCase({ buildPostBody });
    const onStateChange = jest.fn();

    const result = await useCase.execute({
      ...baseParams,
      conversationState: { version: 1, flow: 'clarify_buddy' },
      messages: [
        { role: 'user', content: '组队队友' },
        { role: 'user', content: '重新发贴' },
        { role: 'assistant', content: '计划哪天出发/到场？' },
        { role: 'user', content: 'cpdd' },
      ],
      input: 'cpdd',
      onStateChange,
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'created',
        postId: 'post-new',
      }),
    );
  });
});
