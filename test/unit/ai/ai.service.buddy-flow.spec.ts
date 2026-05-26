jest.mock('chromadb', () => require('../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () => require('../../mocks/langchain-documents'));

jest.mock('@langchain/core/messages', () => require('../../mocks/langchain-messages'));

jest.mock('@langchain/community/chat_models/alibaba_tongyi', () => require('../../mocks/alibaba-tongyi'));

jest.mock('@src/ai/llm/llm.service', () => ({
  LlmService: require('../../mocks/ai-service-deps').LlmService,
}));
jest.mock('@src/ai/intent/intent-router.service', () => ({
  IntentRouterService: require('../../mocks/ai-service-deps').IntentRouterService,
}));
jest.mock('@src/ai/post-intent.service', () => ({
  PostIntentService: require('../../mocks/ai-service-deps').PostIntentService,
}));
jest.mock('@src/ai/orchestration/deterministic-reply.service', () => ({
  DeterministicReplyService: require('../../mocks/ai-service-deps').DeterministicReplyService,
}));
jest.mock('@src/ai/agents/user-profile.agent', () => ({
  UserProfileAgent: require('../../mocks/ai-service-deps').UserProfileAgent,
}));
jest.mock('@src/ai/ai-rate-limit.service', () => ({
  AiRateLimitService: require('../../mocks/ai-service-deps').AiRateLimitService,
}));
jest.mock('@src/modules/chat/chat.service', () => ({
  ChatService: require('../../mocks/ai-service-deps').ChatService,
}));

import { AiService } from '@src/ai/ai.service';
import { AiTurnPipeline } from '@src/ai/orchestration/ai-turn.pipeline';
import { AiSseBuilder } from '@src/ai/presentation/ai-sse.builder';
import type { PostIntentCreateAttempt } from '@src/ai/post-intent.service';
import type { PostIntentMatchResult } from '@src/ai/buddy/buddy.types';
import { RECOMMEND_GATE_MARKER } from '@src/ai/gate/recommend-gate.util';
import { PUBLISH_CONFIRM_PROMPT_MARKER } from '@src/ai/publish/publish-confirm.util';

async function collectEvents(
  generator: AsyncGenerator<import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent>,
) {
  const events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[] = [];
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
    saveTurn: jest.fn().mockResolvedValue('msg-1'),
  };
  const agenticReplyService = {
    resolveConversationState: jest.fn().mockReturnValue({ version: 1, flow: 'idle' }),
    resolve: jest.fn(),
  };
  const postIntentService = {
    tryProactiveRecommendBeforeCreate: jest.fn(),
    tryCreatePostFromChat: jest.fn(),
    tryMatchPostsFromChat: jest.fn(),
    tryGenerateBuddyCopy: jest.fn(),
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

  const turnPipeline = new AiTurnPipeline(
    agenticReplyService as never,
    postIntentService as never,
    userProfileAgent as never,
    intentRouter as never,
    new AiSseBuilder(),
  );

  const service = new AiService(
    chatService as never,
    agenticReplyService as never,
    turnPipeline,
    rateLimit as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    chatService.getSession.mockResolvedValue({ history: [], conversationState: null });
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
    userId: 'user-1',
    activityLegacyId: 9,
    messages: [{ role: 'user' as const, content: '组队队友' }],
  };

  it.each([
    {
      name: 'shortcut + activity → recommend gate with posts',
      input: '组队队友',
      recommendResult: {
        postCards: [{ postId: 'p1', snippet: '找搭子', authorName: 'A', eventTitle: '风暴' }],
        activityLabel: '风暴电音节',
        replyText: 'found',
        matches: [],
        degraded: false,
      } satisfies PostIntentMatchResult,
      expectCreate: false,
      assert: (events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[]) => {
        expect(events.some(e => e.type === 'post_recommendations')).toBe(true);
        expect(events.some(e => e.type === 'suggested_replies')).toBe(true);
        const delta = events.find(e => e.type === 'delta');
        expect(delta && 'content' in delta && delta.content.includes(RECOMMEND_GATE_MARKER)).toBe(
          true,
        );
      },
    },
    {
      name: 'shortcut + activity → recommend gate empty',
      input: '组队队友',
      recommendResult: {
        postCards: [],
        activityLabel: '风暴电音节',
        replyText: 'empty',
        matches: [],
        degraded: false,
      } satisfies PostIntentMatchResult,
      expectCreate: false,
      assert: (events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[]) => {
        expect(events.some(e => e.type === 'post_recommendations')).toBe(false);
        expect(events.some(e => e.type === 'suggested_replies')).toBe(true);
        const delta = events.find(e => e.type === 'delta');
        expect(delta && 'content' in delta && delta.content.includes(RECOMMEND_GATE_MARKER)).toBe(
          true,
        );
      },
    },
    {
      name: 'decline recommend → create post',
      input: '自己发帖',
      recommendResult: null,
      createResult: {
        kind: 'created',
        postId: 'new-post',
        activityLegacyId: 9,
        replyText: '已发布',
      } satisfies PostIntentCreateAttempt,
      expectCreate: true,
      gateState: {
        version: 1,
        flow: 'recommend_gate' as const,
        gate: { activityLegacyId: 9, shownPostIds: ['p1'], empty: false },
      },
      assert: (events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[]) => {
        expect(events.some(e => e.type === 'post_created')).toBe(true);
      },
    },
    {
      name: 'decline recommend → pending_confirmation',
      input: '自己发帖',
      recommendResult: null,
      createResult: {
        kind: 'pending_confirmation',
        activityLegacyId: 9,
        replyText: `${PUBLISH_CONFIRM_PROMPT_MARKER}\n草稿已就绪`,
        draftBody: '13号A区求组队',
        copyVariants: [],
      } satisfies PostIntentCreateAttempt,
      expectCreate: true,
      gateState: {
        version: 1,
        flow: 'recommend_gate' as const,
        gate: { activityLegacyId: 9, shownPostIds: ['p1'], empty: false },
      },
      assert: (events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[]) => {
        expect(events.some(e => e.type === 'conversation_patch')).toBe(true);
        const complete = events.find(e => e.type === 'message_complete');
        expect(
          complete &&
            'content' in complete &&
            complete.content.includes(PUBLISH_CONFIRM_PROMPT_MARKER),
        ).toBe(true);
      },
    },
    {
      name: 'publish confirm → create without recommend',
      input: '确认发布',
      recommendResult: null,
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
      assert: (events: import('@src/ai/presentation/ai-stream-event.view').AiStreamEvent[]) => {
        expect(postIntentService.tryProactiveRecommendBeforeCreate).not.toHaveBeenCalled();
        expect(events.some(e => e.type === 'post_created')).toBe(true);
      },
    },
  ])(
    '$name',
    async ({ input, recommendResult, createResult, expectCreate, gateState, assert }) => {
      chatService.getSession.mockResolvedValue({
        history: gateState
          ? [
              {
                role: 'assistant',
                content:
                  gateState.flow === 'publish_confirm'
                    ? PUBLISH_CONFIRM_PROMPT_MARKER
                    : RECOMMEND_GATE_MARKER,
              },
            ]
          : [],
        conversationState: gateState ?? null,
      });
      chatService.mergeChatHistory.mockReturnValue([
        ...(gateState
          ? [
              {
                role: 'assistant' as const,
                content:
                  gateState.flow === 'publish_confirm'
                    ? PUBLISH_CONFIRM_PROMPT_MARKER
                    : RECOMMEND_GATE_MARKER,
              },
            ]
          : []),
        { role: 'user' as const, content: input },
      ]);
      agenticReplyService.resolveConversationState.mockReturnValue(
        gateState ?? { version: 1, flow: 'idle' },
      );

      postIntentService.tryProactiveRecommendBeforeCreate.mockResolvedValue(recommendResult);
      postIntentService.tryCreatePostFromChat.mockResolvedValue(createResult ?? null);

      const events = await collectEvents(
        service.streamChat(
          { ...baseDto, messages: [{ role: 'user', content: input }] },
          { requestId: 'req-buddy-flow' },
        ),
      );

      if (expectCreate) {
        expect(postIntentService.tryCreatePostFromChat).toHaveBeenCalled();
      } else if (!gateState || gateState.flow === 'recommend_gate') {
        if (recommendResult != null) {
          expect(postIntentService.tryProactiveRecommendBeforeCreate).toHaveBeenCalled();
        }
      }

      assert(events);
      expect(events.some(e => e.type === 'message_complete')).toBe(true);
      expect(events.some(e => e.type === 'done')).toBe(true);
    },
  );
});
