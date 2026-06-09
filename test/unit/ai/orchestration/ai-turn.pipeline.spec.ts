import { LlmService as mockLlmService } from '../../../mocks/ai-service-deps';

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
jest.mock('@src/ai/llm/llm.service', () => ({
  LlmService: mockLlmService,
}));

import { toRequestActor } from '@src/common/auth/actor-query.util';
import { AiTurnPipeline } from '@src/ai/orchestration/ai-turn.pipeline';
import { PostingTurnOrchestrator } from '@src/ai/orchestration/posting-turn.orchestrator';
import { AgentFirstTurnHandler } from '@src/ai/orchestration/handlers/agent-first-turn.handler';
import { DjInfoTurnHandler } from '@src/ai/orchestration/handlers/dj-info-turn.handler';
import { TurnHandlerRegistry } from '@src/ai/orchestration/handlers/turn-handler.registry';
import { AiStreamEventBuilder } from '@src/ai/presentation/ai-sse.builder';
import {
  RECOMMEND_GATE_MARKER,
  REQUIRE_BUDDY_POST_MARKER,
} from '@src/ai/gate/recommend-gate.util';

describe('AiTurnPipeline homepage activity gating', () => {
  const agenticReplyService = {
    resolve: jest.fn().mockResolvedValue({
      text: 'fallback',
      nextState: { version: 1, flow: 'idle' },
    }),
  };
  const postIntentService = {
    tryProactiveRecommendBeforeCreate: jest.fn(),
    tryCreatePostFromChat: jest.fn().mockResolvedValue(null),
    tryMatchPostsFromChat: jest.fn(),
  };
  const userProfileAgent = {
    syncProfileFromChat: jest.fn().mockResolvedValue(null),
  };
  const intentRouter = {
    resolve: jest
      .fn()
      .mockResolvedValue({ kind: 'create_post', source: 'rule' }),
  };
  const buddyContext = {
    resolveActivityLegacyIdFromChat: jest.fn(),
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
      suggestedReplies: ['Marshmello 近期演出', '找类似风格的 DJ'],
    }),
  };
  const djInfoResolver = {
    resolve: jest.fn().mockResolvedValue({
      intent: 'artist_profile',
      artistName: 'Marshmello',
      styles: [],
      scope: 'catalog',
    }),
  };
  const chatAgentOrchestrator = {
    getMode: jest.fn().mockReturnValue('off'),
    shouldRunAgentFirst: jest.fn().mockReturnValue(false),
    scheduleShadowComparison: jest.fn(),
    runTurn: jest.fn().mockResolvedValue(null),
  };

  const sseBuilder = new AiStreamEventBuilder();
  const postingTurnOrchestrator = new PostingTurnOrchestrator(
    postIntentService as never,
    buddyContext as never,
    sseBuilder,
    agenticReplyService as never,
  );
  const agentFirstTurnHandler = new AgentFirstTurnHandler(
    chatAgentOrchestrator as never,
    djInfoResolver as never,
    sseBuilder,
  );
  const turnHandlerRegistry = new TurnHandlerRegistry(
    new DjInfoTurnHandler(djInfoService as never, sseBuilder),
  );

  const pipeline = new AiTurnPipeline(
    agenticReplyService as never,
    postIntentService as never,
    userProfileAgent as never,
    intentRouter as never,
    sseBuilder,
    buddyContext as never,
    activityService as never,
    agentFirstTurnHandler,
    turnHandlerRegistry,
    postingTurnOrchestrator,
  );

  const baseDto = {
    sessionId: 'home-session',
    actor: toRequestActor('user-1', 'Test User'),
    messages: [{ role: 'user' as const, content: 'test' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    intentRouter.resolve.mockResolvedValue({
      kind: 'create_post',
      source: 'rule',
    });
    postIntentService.tryMatchPostsFromChat.mockResolvedValue(null);
    postIntentService.tryProactiveRecommendBeforeCreate.mockResolvedValue(null);
    buddyContext.maybeRequireBuddyPostBeforeTeamSearch.mockResolvedValue({
      required: false,
    });
    chatAgentOrchestrator.getMode.mockReturnValue('off');
    chatAgentOrchestrator.shouldRunAgentFirst.mockReturnValue(false);
    chatAgentOrchestrator.runTurn.mockResolvedValue(null);
  });

  it('skips proactive recommend on home when no activity is inferred', async () => {
    buddyContext.resolveActivityLegacyIdFromChat.mockResolvedValue(undefined);

    await pipeline.runTurn(
      { ...baseDto, messages: [{ role: 'user', content: '你好 想交个朋友' }] },
      [{ role: 'user', content: '你好 想交个朋友' }],
      '你好 想交个朋友',
      { version: 1, flow: 'idle' },
      'req-home-vague',
      'home-session',
    );

    expect(
      postIntentService.tryProactiveRecommendBeforeCreate,
    ).not.toHaveBeenCalled();
  });

  it('runs proactive recommend on home when storm activity is inferred', async () => {
    buddyContext.resolveActivityLegacyIdFromChat.mockResolvedValue(4);
    postIntentService.tryProactiveRecommendBeforeCreate.mockResolvedValue({
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
    });

    const result = await pipeline.runTurn(
      {
        ...baseDto,
        messages: [{ role: 'user', content: '风暴电音节 找组队' }],
      },
      [{ role: 'user', content: '风暴电音节 找组队' }],
      '风暴电音节 找组队',
      { version: 1, flow: 'idle' },
      'req-home-storm',
      'home-session',
    );

    expect(
      postIntentService.tryProactiveRecommendBeforeCreate,
    ).toHaveBeenCalledWith(expect.objectContaining({ activityLegacyId: 4 }));
    expect(result.events.some((e) => e.type === 'post_recommendations')).toBe(
      true,
    );
    expect(
      result.events.some(
        (e) =>
          e.type === 'delta' &&
          'content' in e &&
          e.content.includes(RECOMMEND_GATE_MARKER),
      ),
    ).toBe(true);
  });

  it('skips proactive recommend for ticket resale even if activity was inferred', async () => {
    buddyContext.resolveActivityLegacyIdFromChat.mockResolvedValue(4);

    await pipeline.runTurn(
      {
        ...baseDto,
        messages: [
          {
            role: 'user',
            content:
              '临时有事折价出一张6.12香港ASOT VIP Stage舞台票，需要私我哈～',
          },
        ],
      },
      [
        {
          role: 'user',
          content:
            '临时有事折价出一张6.12香港ASOT VIP Stage舞台票，需要私我哈～',
        },
      ],
      '临时有事折价出一张6.12香港ASOT VIP Stage舞台票，需要私我哈～',
      { version: 1, flow: 'idle' },
      'req-home-asot-ticket-inferred',
      'home-session',
    );

    expect(
      postIntentService.tryProactiveRecommendBeforeCreate,
    ).not.toHaveBeenCalled();
  });

  it('skips proactive recommend on home for ASOT ticket without catalog match', async () => {
    buddyContext.resolveActivityLegacyIdFromChat.mockResolvedValue(undefined);

    await pipeline.runTurn(
      {
        ...baseDto,
        messages: [
          {
            role: 'user',
            content:
              '临时有事折价出一张6.12香港ASOT VIP Stage舞台票，需要私我哈～',
          },
        ],
      },
      [
        {
          role: 'user',
          content:
            '临时有事折价出一张6.12香港ASOT VIP Stage舞台票，需要私我哈～',
        },
      ],
      '临时有事折价出一张6.12香港ASOT VIP Stage舞台票，需要私我哈～',
      { version: 1, flow: 'idle' },
      'req-home-asot-ticket',
      'home-session',
    );

    expect(buddyContext.resolveActivityLegacyIdFromChat).toHaveBeenCalled();
    expect(
      postIntentService.tryProactiveRecommendBeforeCreate,
    ).not.toHaveBeenCalled();
  });

  it('requires buddy post before shortcut search_posts when user has no recruiting post', async () => {
    intentRouter.resolve.mockResolvedValue({
      kind: 'search_posts',
      source: 'rule',
    });
    buddyContext.maybeRequireBuddyPostBeforeTeamSearch.mockResolvedValue({
      required: true,
      activityLabel: '风暴电音节',
    });

    const result = await pipeline.runTurn(
      {
        ...baseDto,
        activityLegacyId: 9,
        messages: [{ role: 'user', content: '找拼房' }],
      },
      [{ role: 'user', content: '找拼房' }],
      '找拼房',
      { version: 1, flow: 'idle' },
      'req-require-buddy-shortcut',
      'scoped-session',
    );

    expect(postIntentService.tryMatchPostsFromChat).not.toHaveBeenCalled();
    expect(result.conversationState.flow).toBe('collect_post_body');
    expect(result.assistantReply).toContain(REQUIRE_BUDDY_POST_MARKER);
  });

  it('enters collect_post_body when search_posts finds no matches on event detail', async () => {
    intentRouter.resolve.mockResolvedValue({
      kind: 'search_posts',
      source: 'rule',
    });
    postIntentService.tryMatchPostsFromChat.mockResolvedValue({
      matches: [],
      postCards: [],
      activityLabel: '风暴电音节',
      degraded: false,
      replyText:
        '暂未在「风暴电音节」找到相近的组队帖。\n\n你可以：告诉我内容帮你发布帖子',
    });

    const result = await pipeline.runTurn(
      {
        ...baseDto,
        activityLegacyId: 9,
        messages: [{ role: 'user', content: '看看有没有组队帖' }],
      },
      [{ role: 'user', content: '看看有没有组队帖' }],
      '看看有没有组队帖',
      { version: 1, flow: 'idle' },
      'req-search-empty',
      'scoped-session',
    );

    expect(result.conversationState.flow).toBe('collect_post_body');
    expect(result.conversationState.publishDraft?.activityLegacyId).toBe(9);
    expect(result.conversationState.publishDraft?.fromSelfPost).toBe(true);
    expect(result.events.some((e) => e.type === 'conversation_patch')).toBe(
      true,
    );
  });

  it('emits activity card when user confirms festival enter by name', async () => {
    intentRouter.resolve.mockResolvedValue({
      kind: 'activity_enter',
      source: 'rule',
    });
    activityService.findByCode.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        legacyId: 4,
        name: '风暴电音节 深圳站',
        date: '06/13-14',
        location: '深圳国际会展中心',
        code: 'storm',
      }),
    });

    const messages = [
      {
        role: 'assistant' as const,
        content: '阵容\n想进入哪个活动？',
      },
      { role: 'user' as const, content: '风暴电音节' },
    ];

    const result = await pipeline.runTurn(
      { ...baseDto, messages },
      messages,
      '风暴电音节',
      { version: 1, flow: 'idle' },
      'req-activity-enter',
      'home-session',
    );

    expect(
      result.events.some((e) => e.type === 'activity_recommendation'),
    ).toBe(true);
    const cardEvent = result.events.find(
      (e) => e.type === 'activity_recommendation',
    );
    expect(
      cardEvent && 'activity' in cardEvent && cardEvent.activity,
    ).toMatchObject({
      activityLegacyId: 4,
      title: '风暴电音节 深圳站',
    });
    expect(result.assistantReply).toContain('点下方卡片');
  });

  it('uses agent reply when AI_AGENT_MODE=on', async () => {
    chatAgentOrchestrator.getMode.mockReturnValue('on');
    chatAgentOrchestrator.shouldRunAgentFirst.mockReturnValue(true);
    chatAgentOrchestrator.runTurn.mockResolvedValue({
      replyText: 'Agent 回复：Marshmello 是 Future Bass',
      toolsUsed: ['query_dj_info'],
      toolCalls: [
        {
          name: 'query_dj_info',
          args: {
            intent: 'artist_profile',
            artistName: 'Marshmello',
          },
        },
      ],
      steps: 2,
    });

    const result = await pipeline.runTurn(
      {
        ...baseDto,
        activityLegacyId: 5,
        messages: [{ role: 'user', content: 'Marshmello 是什么风格' }],
      },
      [{ role: 'user', content: 'Marshmello 是什么风格' }],
      'Marshmello 是什么风格',
      { version: 1, flow: 'idle' },
      'req-agent-on',
      'agent-on-session',
    );

    expect(chatAgentOrchestrator.runTurn).toHaveBeenCalled();
    expect(djInfoService.answerFromChat).not.toHaveBeenCalled();
    expect(result.assistantReply).toContain('Agent 回复');
  });

  it('uses agent for home festival shortcut when AI_AGENT_MODE=on', async () => {
    chatAgentOrchestrator.getMode.mockReturnValue('on');
    chatAgentOrchestrator.shouldRunAgentFirst.mockReturnValue(true);
    chatAgentOrchestrator.runTurn.mockResolvedValue({
      replyText: '风暴电音节 2025 深圳站…',
      toolsUsed: ['get_festival_info'],
      toolCalls: [
        { name: 'get_festival_info', args: { festivalName: '风暴电音节' } },
      ],
      steps: 2,
    });
    intentRouter.resolve.mockResolvedValue({
      kind: 'quick_reply',
      source: 'rule',
    });

    const result = await pipeline.runTurn(
      baseDto,
      [{ role: 'user', content: '风暴电音节' }],
      '风暴电音节',
      { version: 1, flow: 'idle' },
      'req-festival-agent',
      'festival-session',
    );

    expect(chatAgentOrchestrator.runTurn).toHaveBeenCalled();
    expect(agenticReplyService.resolve).not.toHaveBeenCalled();
    expect(result.assistantReply).toContain('风暴电音节');
  });

  it('uses agent for activity brief when AI_AGENT_MODE=on', async () => {
    chatAgentOrchestrator.getMode.mockReturnValue('on');
    chatAgentOrchestrator.shouldRunAgentFirst.mockReturnValue(true);
    chatAgentOrchestrator.runTurn.mockResolvedValue({
      replyText: '🎧 风暴电音节\n📅 档期：06/13-14',
      toolsUsed: ['get_activity_brief'],
      toolCalls: [{ name: 'get_activity_brief', args: {} }],
      steps: 2,
    });
    intentRouter.resolve.mockResolvedValue({
      kind: 'quick_reply',
      source: 'rule',
    });

    const result = await pipeline.runTurn(
      {
        ...baseDto,
        activityLegacyId: 5,
        messages: [{ role: 'user', content: '这场几点开始' }],
      },
      [{ role: 'user', content: '这场几点开始' }],
      '这场几点开始',
      { version: 1, flow: 'idle' },
      'req-brief-agent',
      'brief-session',
    );

    expect(chatAgentOrchestrator.runTurn).toHaveBeenCalled();
    expect(agenticReplyService.resolve).not.toHaveBeenCalled();
    expect(result.assistantReply).toContain('风暴电音节');
  });

  it('routes dj_info intent to DjInfoService', async () => {
    intentRouter.resolve.mockResolvedValue({ kind: 'dj_info', source: 'rule' });
    djInfoService.answerFromChat.mockResolvedValue({
      replyText: 'Marshmello\n🎧 风格：Future Bass',
      query: {
        intent: 'artist_profile',
        artistName: 'Marshmello',
        styles: [],
        scope: 'catalog',
      },
      suggestedReplies: ['Marshmello 近期演出', '找类似风格的 DJ'],
    });

    const result = await pipeline.runTurn(
      {
        ...baseDto,
        activityLegacyId: 5,
        messages: [{ role: 'user', content: 'Marshmello 是什么风格' }],
      },
      [{ role: 'user', content: 'Marshmello 是什么风格' }],
      'Marshmello 是什么风格',
      { version: 1, flow: 'idle' },
      'req-dj-info',
      'dj-session',
    );

    expect(djInfoService.answerFromChat).toHaveBeenCalledWith(
      'Marshmello 是什么风格',
      5,
      { messages: [{ role: 'user', content: 'Marshmello 是什么风格' }] },
    );
    expect(result.intent).toBe('dj_info');
    expect(result.assistantReply).toContain('Marshmello');
    expect(result.events[0]).toEqual({
      type: 'delta',
      content: 'Marshmello\n🎧 风格：Future Bass',
    });
    expect(result.events).toEqual(
      expect.arrayContaining([
        {
          type: 'suggested_replies',
          replies: ['Marshmello 近期演出', '找类似风格的 DJ'],
        },
      ]),
    );
  });

  it('uses bound activityLegacyId on event detail without home inference', async () => {
    buddyContext.resolveActivityLegacyIdFromChat.mockResolvedValue(99);
    postIntentService.tryProactiveRecommendBeforeCreate.mockResolvedValue(null);

    await pipeline.runTurn(
      {
        ...baseDto,
        activityLegacyId: 9,
        messages: [{ role: 'user', content: '找搭子' }],
      },
      [{ role: 'user', content: '找搭子' }],
      '找搭子',
      { version: 1, flow: 'idle' },
      'req-scoped',
      'scoped-session',
    );

    expect(buddyContext.resolveActivityLegacyIdFromChat).not.toHaveBeenCalled();
    expect(
      postIntentService.tryProactiveRecommendBeforeCreate,
    ).toHaveBeenCalledWith(expect.objectContaining({ activityLegacyId: 9 }));
  });
});
