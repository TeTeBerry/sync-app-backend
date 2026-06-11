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
jest.mock('@src/infra/llm/llm.service', () => ({
  LlmService: mockLlmService,
}));

import { toRequestActor } from '@src/common/auth/actor-query.util';
import { AiTurnPipeline } from '@src/ai/orchestration/ai-turn.pipeline';
import { PostingTurnOrchestrator } from '@src/ai/orchestration/posting-turn.orchestrator';
import { AgentFirstTurnHandler } from '@src/ai/orchestration/handlers/agent-first-turn.handler';
import { DjInfoTurnHandler } from '@src/ai/orchestration/handlers/dj-info-turn.handler';
import { AiStreamEventBuilder } from '@src/ai/presentation/ai-stream-event.builder';
import { REQUIRE_BUDDY_POST_MARKER } from '@src/ai/publish/buddy-post-flow.util';

describe('AiTurnPipeline homepage activity gating', () => {
  const agenticReplyService = {
    resolve: jest.fn().mockResolvedValue({
      text: 'fallback',
      nextState: { version: 1, flow: 'idle' },
    }),
  };
  const postIntentService = {
    tryCreatePostFromChat: jest.fn().mockResolvedValue(null),
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
    resolveActivityByKeyword: jest.fn().mockResolvedValue(null),
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
  const djInfoTurnHandler = new DjInfoTurnHandler(
    djInfoService as never,
    sseBuilder,
  );

  const pipeline = new AiTurnPipeline(
    agenticReplyService as never,
    postIntentService as never,
    userProfileAgent as never,
    intentRouter as never,
    sseBuilder,
    activityService as never,
    agentFirstTurnHandler,
    djInfoTurnHandler,
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
    buddyContext.maybeRequireBuddyPostBeforeTeamSearch.mockResolvedValue({
      required: false,
    });
    chatAgentOrchestrator.getMode.mockReturnValue('off');
    chatAgentOrchestrator.shouldRunAgentFirst.mockReturnValue(false);
    chatAgentOrchestrator.runTurn.mockResolvedValue(null);
  });

  it('attempts create_post on home when storm activity is inferred', async () => {
    buddyContext.resolveActivityLegacyIdFromChat.mockResolvedValue(4);
    postIntentService.tryCreatePostFromChat.mockResolvedValue({
      kind: 'created',
      replyText: '已发布',
      postCard: {
        postId: 'p1',
        snippet: '找搭子',
        authorName: 'A',
        eventTitle: '风暴',
      },
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

    expect(postIntentService.tryCreatePostFromChat).toHaveBeenCalledWith(
      expect.objectContaining({ activityLegacyId: 4 }),
    );
    expect(result.events.some((e) => e.type === 'post_created')).toBe(true);
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
    postIntentService.tryCreatePostFromChat.mockResolvedValue(null);

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
    expect(postIntentService.tryCreatePostFromChat).toHaveBeenCalledWith(
      expect.objectContaining({ activityLegacyId: 9 }),
    );
  });
});
