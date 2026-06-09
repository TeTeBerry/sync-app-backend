import {
  AiRateLimitService as mockAiRateLimitService,
  ChatService as mockChatService,
  DeterministicReplyService as mockDeterministicReplyService,
  IntentRouterService as mockIntentRouterService,
  LlmService as mockLlmService,
  PostIntentService as mockPostIntentService,
  UserProfileAgent as mockUserProfileAgent,
} from '../../mocks/ai-service-deps';

jest.mock('chromadb', () => require('../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () =>
  require('../../mocks/langchain-documents'),
);

jest.mock('@langchain/core/messages', () =>
  require('../../mocks/langchain-messages'),
);

jest.mock('@langchain/community/chat_models/alibaba_tongyi', () =>
  require('../../mocks/alibaba-tongyi'),
);

jest.mock('@src/ai/llm/llm.service', () => ({
  LlmService: mockLlmService,
}));
jest.mock('@src/ai/intent/intent-router.service', () => ({
  IntentRouterService: mockIntentRouterService,
}));
jest.mock('@src/ai/post-intent.service', () => ({
  PostIntentService: mockPostIntentService,
}));
jest.mock('@src/ai/orchestration/deterministic-reply.service', () => ({
  DeterministicReplyService: mockDeterministicReplyService,
}));
jest.mock('@src/ai/agents/user-profile.agent', () => ({
  UserProfileAgent: mockUserProfileAgent,
}));
jest.mock('@src/ai/ai-rate-limit.service', () => ({
  AiRateLimitService: mockAiRateLimitService,
}));
jest.mock('@src/modules/chat/chat.service', () => ({
  ChatService: mockChatService,
}));

import { AiService } from '@src/ai/ai.service';
import { AiTurnPipeline } from '@src/ai/orchestration/ai-turn.pipeline';
import { AiStreamEventBuilder } from '@src/ai/presentation/ai-sse.builder';
import type { PostIntentCreateAttempt } from '@src/ai/post-intent.service';
import type { PostIntentMatchResult } from '@src/ai/buddy/buddy.types';
import {
  RECOMMEND_GATE_MARKER,
  REQUIRE_BUDDY_POST_MARKER,
  SELF_POST_COLLECT_BODY_MARKER,
} from '@src/ai/gate/recommend-gate.util';
import { PUBLISH_CONFIRM_SUGGESTED_REPLIES } from '@src/ai/publish/publish-confirm.util';
import { PUBLISH_CONFIRM_PROMPT_MARKER } from '@src/ai/publish/publish-confirm.util';

async function collectEvents(
  generator: AsyncGenerator<
    import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent
  >,
) {
  const events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[] =
    [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

describe('AiService buddy flow', () => {
  const chatService = {
    resolveSessionId: jest.fn((id?: string) => id ?? 'session-1'),
    getSession: jest.fn(),
    mergeChatHistory: jest.fn(),
    truncateToRecentTurns: jest.fn((messages: unknown[]) => messages),
    saveTurn: jest.fn().mockResolvedValue('msg-1'),
  };
  const agenticReplyService = {
    resolveConversationState: jest
      .fn()
      .mockReturnValue({ version: 1, flow: 'idle' }),
    resolve: jest.fn(),
  };
  const postIntentService = {
    tryProactiveRecommendBeforeCreate: jest.fn(),
    tryCreatePostFromChat: jest.fn(),
    tryMatchPostsFromChat: jest.fn(),
  };
  const userProfileAgent = {
    syncProfileFromChat: jest.fn().mockResolvedValue(null),
  };
  const intentRouter = {
    resolve: jest.fn(),
  };
  const rateLimit = {
    checkLimit: jest.fn().mockResolvedValue({ allowed: true }),
  };

  const wechatContentSecurity = {
    assertTextSafe: jest.fn().mockResolvedValue(undefined),
  };

  const buddyContext = {
    resolveActivityLegacyIdFromChat: jest.fn().mockResolvedValue(undefined),
    maybeRequireBuddyPostBeforeTeamSearch: jest
      .fn()
      .mockResolvedValue({ required: false }),
  };
  const activityService = {
    findByCode: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    matchActivity: jest.fn().mockResolvedValue(null),
  };
  const djInfoService = {
    answerFromChat: jest.fn().mockResolvedValue({
      replyText: 'dj reply',
      query: {
        intent: 'artist_profile',
        artistName: 'Marshmello',
        styles: [],
        scope: 'catalog',
      },
      suggestedReplies: [],
    }),
  };
  const djInfoResolver = {
    resolve: jest.fn(),
  };
  const chatAgentOrchestrator = {
    getMode: jest.fn().mockReturnValue('off'),
    shouldRunAgentFirst: jest.fn().mockReturnValue(false),
    scheduleShadowComparison: jest.fn(),
    runTurn: jest.fn().mockResolvedValue(null),
  };

  const turnPipeline = new AiTurnPipeline(
    agenticReplyService as never,
    postIntentService as never,
    userProfileAgent as never,
    intentRouter as never,
    new AiStreamEventBuilder(),
    buddyContext as never,
    activityService as never,
    djInfoService as never,
    djInfoResolver as never,
    chatAgentOrchestrator as never,
  );

  const service = new AiService(
    chatService as never,
    agenticReplyService as never,
    turnPipeline,
    rateLimit as never,
    wechatContentSecurity as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    buddyContext.maybeRequireBuddyPostBeforeTeamSearch.mockResolvedValue({
      required: false,
    });
    chatService.getSession.mockResolvedValue({
      history: [],
      conversationState: null,
    });
    chatService.mergeChatHistory.mockImplementation(
      (_stored: unknown, incoming: unknown[]) => incoming,
    );
    intentRouter.resolve.mockResolvedValue({
      kind: 'create_post',
      source: 'rules',
    });
  });

  const baseDto = {
    sessionId: 'session-1',
    actor: {
      source: 'jwt' as const,
      clientUserId: 'user-1',
      displayName: '用户',
      resolvedUserId: 'user-1',
    },
    activityLegacyId: 9,
    messages: [{ role: 'user' as const, content: '组队队友' }],
  };

  it('maps AI match quota ForbiddenException to error stream event', async () => {
    const { ForbiddenException } = require('@nestjs/common');
    intentRouter.resolve.mockResolvedValue({
      kind: 'search_posts',
      source: 'rules',
    });
    postIntentService.tryMatchPostsFromChat.mockRejectedValue(
      new ForbiddenException('AI 匹配次数已用完，请升级套餐'),
    );

    const events = await collectEvents(
      service.streamChat(
        { ...baseDto, messages: [{ role: 'user', content: '查组队帖' }] },
        { requestId: 'req-quota' },
      ),
    );

    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.type === 'error' && errorEvent.message).toContain(
      '匹配次数',
    );
    expect(events.some((e) => e.type === 'done')).toBe(false);
  });

  it('shortcut without own post → require buddy info before recommend', async () => {
    intentRouter.resolve.mockResolvedValue({
      kind: 'search_posts',
      source: 'rule',
    });
    buddyContext.maybeRequireBuddyPostBeforeTeamSearch.mockResolvedValue({
      required: true,
      activityLabel: '风暴电音节',
    });

    const events = await collectEvents(
      service.streamChat(
        { ...baseDto, messages: [{ role: 'user', content: '找组队' }] },
        { requestId: 'req-require-buddy' },
      ),
    );

    expect(postIntentService.tryMatchPostsFromChat).not.toHaveBeenCalled();
    expect(
      postIntentService.tryProactiveRecommendBeforeCreate,
    ).not.toHaveBeenCalled();
    const delta = events.find((e) => e.type === 'delta');
    expect(
      delta &&
        'content' in delta &&
        delta.content.includes(REQUIRE_BUDDY_POST_MARKER),
    ).toBe(true);
    expect(events.some((e) => e.type === 'suggested_replies')).toBe(true);
  });

  it.each([
    {
      name: 'shortcut + activity → search_posts recommend gate with posts',
      input: '组队队友',
      intentKind: 'search_posts' as const,
      matchResult: {
        postCards: [
          {
            postId: 'p1',
            snippet: '找搭子',
            authorName: 'A',
            eventTitle: '风暴',
          },
        ],
        activityLabel: '风暴电音节',
        replyText: 'found',
        matches: [],
        degraded: false,
      } satisfies PostIntentMatchResult,
      expectCreate: false,
      assert: (
        events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[],
      ) => {
        expect(events.some((e) => e.type === 'post_recommendations')).toBe(
          true,
        );
        expect(events.some((e) => e.type === 'suggested_replies')).toBe(false);
        const delta = events.find((e) => e.type === 'delta');
        expect(
          delta &&
            'content' in delta &&
            delta.content.includes(RECOMMEND_GATE_MARKER),
        ).toBe(true);
      },
    },
    {
      name: 'shortcut + activity → search_posts recommend gate empty',
      input: '组队队友',
      intentKind: 'search_posts' as const,
      matchResult: {
        postCards: [],
        activityLabel: '风暴电音节',
        replyText: 'empty',
        matches: [],
        degraded: false,
      } satisfies PostIntentMatchResult,
      expectCreate: false,
      assert: (
        events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[],
      ) => {
        expect(events.some((e) => e.type === 'post_recommendations')).toBe(
          false,
        );
        expect(events.some((e) => e.type === 'suggested_replies')).toBe(false);
        const delta = events.find((e) => e.type === 'delta');
        expect(
          delta &&
            'content' in delta &&
            delta.content.includes(RECOMMEND_GATE_MARKER),
        ).toBe(true);
      },
    },
    {
      name: 'decline recommend → ask for custom body',
      input: '没有合适的',
      intentKind: 'create_post' as const,
      matchResult: null,
      createResult: {
        kind: 'rejected',
        replyText: '请描述你的组队需求',
      } satisfies PostIntentCreateAttempt,
      expectCreate: true,
      gateState: {
        version: 1,
        flow: 'recommend_gate' as const,
        gate: { activityLegacyId: 9, shownPostIds: ['p1'], empty: false },
      },
      assert: (
        events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[],
      ) => {
        expect(events.some((e) => e.type === 'post_created')).toBe(false);
        const complete = events.find((e) => e.type === 'message_complete');
        expect(
          complete &&
            'content' in complete &&
            complete.content.includes('组队需求'),
        ).toBe(true);
      },
    },
    {
      name: 'collect_post_body → zone-like input forces draft not search',
      input: '13号 A区 dd',
      intentKind: 'search_posts' as const,
      matchResult: {
        postCards: [
          {
            postId: 'p1',
            snippet: '长帖文'.repeat(20),
            authorName: 'A',
            eventTitle: '风暴',
          },
        ],
        activityLabel: '风暴电音节',
        replyText: '不应使用',
        matches: [],
        degraded: false,
      } satisfies PostIntentMatchResult,
      createResult: {
        kind: 'created',
        postId: 'self-post-1',
        activityLegacyId: 9,
        replyText: '已为你发布「风暴电音节」组队帖 ✅',
      } satisfies PostIntentCreateAttempt,
      expectCreate: true,
      gateState: {
        version: 1,
        flow: 'collect_post_body' as const,
        publishDraft: { activityLegacyId: 9, fromSelfPost: true },
      },
      assert: (
        events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[],
      ) => {
        expect(postIntentService.tryMatchPostsFromChat).not.toHaveBeenCalled();
        expect(
          postIntentService.tryProactiveRecommendBeforeCreate,
        ).not.toHaveBeenCalled();
        expect(events.some((e) => e.type === 'post_recommendations')).toBe(
          false,
        );
        expect(events.some((e) => e.type === 'post_created')).toBe(true);
        const complete = events.find((e) => e.type === 'message_complete');
        expect(
          complete &&
            'content' in complete &&
            complete.content.includes('已为你发布'),
        ).toBe(true);
      },
    },
    {
      name: 'collect_post_body → informal body skips proactive recommend',
      input: '13号 dd 一个女生',
      intentKind: 'create_post' as const,
      matchResult: {
        postCards: [
          {
            postId: 'p1',
            snippet: '找搭子',
            authorName: 'A',
            eventTitle: '风暴',
          },
        ],
        activityLabel: '风暴电音节',
        replyText: 'found',
        matches: [],
        degraded: false,
      } satisfies PostIntentMatchResult,
      createResult: {
        kind: 'created',
        postId: 'self-post-2',
        activityLegacyId: 9,
        replyText: '已为你发布组队帖 ✅',
      } satisfies PostIntentCreateAttempt,
      expectCreate: true,
      gateState: {
        version: 1,
        flow: 'collect_post_body' as const,
        publishDraft: { activityLegacyId: 9 },
      },
      assert: (
        events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[],
      ) => {
        expect(
          postIntentService.tryProactiveRecommendBeforeCreate,
        ).not.toHaveBeenCalled();
        expect(events.some((e) => e.type === 'post_recommendations')).toBe(
          false,
        );
        expect(events.some((e) => e.type === 'post_created')).toBe(true);
        const complete = events.find((e) => e.type === 'message_complete');
        expect(
          complete &&
            'content' in complete &&
            !complete.content.includes(RECOMMEND_GATE_MARKER) &&
            complete.content.includes('已为你发布'),
        ).toBe(true);
      },
    },
    {
      name: 'decline recommend → custom body → direct publish',
      input: '13号A区求组队，3人从上海出发',
      intentKind: 'create_post' as const,
      matchResult: null,
      createResult: {
        kind: 'created',
        postId: 'self-post-3',
        activityLegacyId: 9,
        replyText: '已为你发布组队帖 ✅',
      } satisfies PostIntentCreateAttempt,
      expectCreate: true,
      gateState: {
        version: 1,
        flow: 'collect_post_body' as const,
        publishDraft: { activityLegacyId: 9, fromSelfPost: true },
      },
      assert: (
        events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[],
      ) => {
        expect(events.some((e) => e.type === 'post_created')).toBe(true);
        const complete = events.find((e) => e.type === 'message_complete');
        expect(
          complete &&
            'content' in complete &&
            complete.content.includes('已为你发布'),
        ).toBe(true);
      },
    },
    {
      name: 'decline recommend → pending_confirmation',
      input: '没有合适的',
      intentKind: 'create_post' as const,
      matchResult: null,
      createResult: {
        kind: 'pending_confirmation',
        activityLegacyId: 9,
        replyText: `${PUBLISH_CONFIRM_PROMPT_MARKER}\n草稿已就绪`,
        draftBody: '13号A区求组队',
      } satisfies PostIntentCreateAttempt,
      expectCreate: true,
      gateState: {
        version: 1,
        flow: 'recommend_gate' as const,
        gate: { activityLegacyId: 9, shownPostIds: ['p1'], empty: false },
      },
      assert: (
        events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[],
      ) => {
        expect(events.some((e) => e.type === 'conversation_patch')).toBe(true);
        const complete = events.find((e) => e.type === 'message_complete');
        expect(
          complete &&
            'content' in complete &&
            complete.content.includes(PUBLISH_CONFIRM_PROMPT_MARKER),
        ).toBe(true);
      },
    },
    {
      name: 'ASOT HK ticket in Storm activity → reject publish',
      input: '临时有事折价出一张6.12香港ASOT VIP Stage舞台票，需要私我哈～',
      intentKind: 'create_post' as const,
      matchResult: null,
      createResult: {
        kind: 'rejected',
        replyText:
          '平台禁止发布转票、出票、票务相关信息。如需找同行伙伴，请改为组队、同路或住宿类帖子。',
      } satisfies PostIntentCreateAttempt,
      expectCreate: true,
      assert: (
        events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[],
      ) => {
        expect(
          postIntentService.tryProactiveRecommendBeforeCreate,
        ).not.toHaveBeenCalled();
        expect(events.some((e) => e.type === 'post_recommendations')).toBe(
          false,
        );
        const complete = events.find((e) => e.type === 'message_complete');
        expect(
          complete &&
            'content' in complete &&
            !complete.content.includes(RECOMMEND_GATE_MARKER) &&
            !complete.content.includes(PUBLISH_CONFIRM_PROMPT_MARKER) &&
            complete.content.includes('禁止发布'),
        ).toBe(true);
      },
    },
    {
      name: 'publish confirm → create without recommend',
      input: '确认发布',
      intentKind: 'create_post' as const,
      matchResult: null,
      createResult: {
        kind: 'created',
        postId: 'confirmed-post',
        activityLegacyId: 9,
        replyText: '已发布',
      } satisfies PostIntentCreateAttempt,
      expectCreate: true,
      gateState: {
        version: 1,
        flow: 'publish_confirm' as const,
        publishDraft: { activityLegacyId: 9, draftBody: '草稿' },
      },
      assert: (
        events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[],
      ) => {
        expect(
          postIntentService.tryProactiveRecommendBeforeCreate,
        ).not.toHaveBeenCalled();
        expect(postIntentService.tryMatchPostsFromChat).not.toHaveBeenCalled();
        expect(events.some((e) => e.type === 'post_created')).toBe(true);
      },
    },
  ])(
    '$name',
    async ({
      input,
      intentKind,
      matchResult,
      createResult,
      expectCreate,
      gateState,
      assert,
    }) => {
      intentRouter.resolve.mockResolvedValue({
        kind: intentKind,
        source: 'rule',
      });

      const assistantHistoryContent =
        gateState?.flow === 'publish_confirm'
          ? PUBLISH_CONFIRM_PROMPT_MARKER
          : gateState?.flow === 'collect_post_body'
            ? `${SELF_POST_COLLECT_BODY_MARKER}\n请描述你的组队需求`
            : gateState
              ? RECOMMEND_GATE_MARKER
              : null;

      chatService.getSession.mockResolvedValue({
        history: assistantHistoryContent
          ? [{ role: 'assistant', content: assistantHistoryContent }]
          : [],
        conversationState: gateState ?? null,
      });
      chatService.mergeChatHistory.mockReturnValue([
        ...(assistantHistoryContent
          ? [{ role: 'assistant' as const, content: assistantHistoryContent }]
          : []),
        { role: 'user' as const, content: input },
      ]);
      agenticReplyService.resolveConversationState.mockReturnValue(
        gateState ?? { version: 1, flow: 'idle' },
      );

      postIntentService.tryMatchPostsFromChat.mockResolvedValue(matchResult);
      postIntentService.tryProactiveRecommendBeforeCreate.mockResolvedValue(
        matchResult,
      );
      postIntentService.tryCreatePostFromChat.mockResolvedValue(
        createResult ?? null,
      );

      const events = await collectEvents(
        service.streamChat(
          { ...baseDto, messages: [{ role: 'user', content: input }] },
          { requestId: 'req-buddy-flow' },
        ),
      );

      if (expectCreate) {
        expect(postIntentService.tryCreatePostFromChat).toHaveBeenCalled();
      } else if (intentKind === 'search_posts') {
        expect(postIntentService.tryMatchPostsFromChat).toHaveBeenCalled();
      }

      assert(events);
      expect(events.some((e) => e.type === 'message_complete')).toBe(true);
      expect(events.some((e) => e.type === 'done')).toBe(true);
    },
  );
});
