import { LlmService as mockLlmService } from '../../../mocks/ai-service-deps';

jest.mock('chromadb', () => require('../../../mocks/chromadb'));
jest.mock('@langchain/core/documents', () =>
  require('../../../mocks/langchain-documents'),
);
jest.mock('@langchain/core/messages', () =>
  require('../../../mocks/langchain-messages'),
);
jest.mock(
  '@langchain/community/chat_models/alibaba_tongyi',
  () => require('../../../mocks/alibaba-tongyi'),
  { virtual: true },
);
jest.mock('@src/infra/llm/llm.service', () => ({
  LlmService: mockLlmService,
}));

import { toRequestActor } from '@src/common/auth/actor-query.util';
import { AiTurnPipeline } from '@src/ai/orchestration/ai-turn.pipeline';
import { PostingTurnOrchestrator } from '@src/ai/orchestration/posting-turn.orchestrator';
import { AgentTurnHandler } from '@src/ai/orchestration/handlers/agent-turn.handler';
import { ReadOnlyTurnHandler } from '@src/ai/orchestration/handlers/read-only-turn.handler';
import { DjInfoTurnHandler } from '@src/ai/orchestration/handlers/dj-info-turn.handler';
import { LegacyTurnHandler } from '@src/ai/orchestration/handlers/legacy-turn.handler';
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
    findByCode: jest.fn().mockResolvedValue(null),
    resolveActivityByKeyword: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([
      {
        name: 'Tomorrowland Thailand 2026',
        date: '12/11-13',
        location: '芭提雅',
      },
    ]),
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
    answerFromStructured: jest.fn().mockResolvedValue({
      replyText: '阵容：Swedish House Mafia、Martin Garrix',
    }),
  };
  const itineraryService = {
    getSchedule: jest.fn().mockResolvedValue({
      eventMeta: 'Tomorrowland Thailand',
      djs: [{ id: '1', name: 'Martin Garrix' }],
      performances: [],
      schedulePublished: false,
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
    isEnabled: jest.fn().mockReturnValue(false),
    shouldRunAgentFirst: jest.fn().mockReturnValue(false),
    runTurn: jest.fn().mockResolvedValue(null),
  };

  const sseBuilder = new AiStreamEventBuilder();
  const postingTurnOrchestrator = new PostingTurnOrchestrator(
    postIntentService as never,
    buddyContext as never,
    sseBuilder,
    agenticReplyService as never,
  );
  const agentTurnHandler = new AgentTurnHandler(
    chatAgentOrchestrator as never,
    djInfoResolver as never,
    sseBuilder,
  );
  const djInfoTurnHandler = new DjInfoTurnHandler(
    djInfoService as never,
    sseBuilder,
  );
  const readOnlyTurnHandler = new ReadOnlyTurnHandler(
    djInfoService as never,
    itineraryService as never,
    activityService as never,
    sseBuilder,
  );
  const legacyTurnHandler = new LegacyTurnHandler(
    postingTurnOrchestrator,
    djInfoTurnHandler,
    agenticReplyService as never,
    sseBuilder,
    activityService as never,
  );

  const pipeline = new AiTurnPipeline(
    userProfileAgent as never,
    intentRouter as never,
    agentTurnHandler,
    readOnlyTurnHandler,
    legacyTurnHandler,
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
        snippet: '组队',
        authorName: 'A',
        eventTitle: '风暴',
      },
    });

    const result = await pipeline.runTurn(
      {
        ...baseDto,
        messages: [{ role: 'user', content: '风暴电音节 组队发帖' }],
      },
      [{ role: 'user', content: '风暴电音节 组队发帖' }],
      '风暴电音节 组队发帖',
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
    activityService.findByCode.mockResolvedValue({
      legacyId: 4,
      name: '风暴电音节 深圳站',
      date: '06/13-14',
      location: '深圳国际会展中心',
      code: 'storm',
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

  it('uses read-only fast path for lineup without agent', async () => {
    intentRouter.resolve.mockResolvedValue({
      kind: 'dj_info',
      source: 'rule',
      readOnlyFastPath: 'lineup',
    });
    chatAgentOrchestrator.isEnabled.mockReturnValue(true);
    chatAgentOrchestrator.shouldRunAgentFirst.mockReturnValue(false);

    const result = await pipeline.runTurn(
      {
        ...baseDto,
        activityLegacyId: 1,
        messages: [{ role: 'user', content: '查阵容' }],
      },
      [{ role: 'user', content: '查阵容' }],
      '查阵容',
      { version: 1, flow: 'idle' },
      'req-lineup-fast',
      'lineup-session',
    );

    expect(djInfoService.answerFromStructured).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'lineup_overview', scope: 'lineup' }),
      1,
    );
    expect(chatAgentOrchestrator.runTurn).not.toHaveBeenCalled();
    expect(result.assistantReply).toContain('阵容');
    expect(result.timings.ms_read_only).toBeDefined();
  });

  it('uses read-only fast path for schedule without agent', async () => {
    intentRouter.resolve.mockResolvedValue({
      kind: 'dj_info',
      source: 'rule',
      readOnlyFastPath: 'schedule',
    });
    chatAgentOrchestrator.isEnabled.mockReturnValue(true);
    chatAgentOrchestrator.shouldRunAgentFirst.mockReturnValue(false);

    const result = await pipeline.runTurn(
      {
        ...baseDto,
        activityLegacyId: 1,
        messages: [{ role: 'user', content: '查时间表' }],
      },
      [{ role: 'user', content: '查时间表' }],
      '查时间表',
      { version: 1, flow: 'idle' },
      'req-schedule-fast',
      'schedule-session',
    );

    expect(itineraryService.getSchedule).toHaveBeenCalledWith(1, {});
    expect(chatAgentOrchestrator.runTurn).not.toHaveBeenCalled();
    expect(result.assistantReply).toContain('Tomorrowland Thailand');
    expect(result.timings.ms_read_only).toBeDefined();
  });

  it('uses agent reply when agent is enabled', async () => {
    intentRouter.resolve.mockResolvedValue({ kind: 'dj_info', source: 'rule' });
    chatAgentOrchestrator.isEnabled.mockReturnValue(true);
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

  it('uses agent for home festival shortcut when agent is enabled', async () => {
    chatAgentOrchestrator.isEnabled.mockReturnValue(true);
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

  it('uses agent for activity brief when agent is enabled', async () => {
    chatAgentOrchestrator.isEnabled.mockReturnValue(true);
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

  it('falls back to DjInfoService when agent is off and input is DJ query', async () => {
    intentRouter.resolve.mockResolvedValue({
      kind: 'quick_reply',
      source: 'default',
    });
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
    expect(result.intent).toBe('quick_reply');
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

  it('uses read-only festival catalog path for lineup lookup question', async () => {
    chatAgentOrchestrator.isEnabled.mockReturnValue(true);
    activityService.findByCode.mockResolvedValue({
      legacyId: 5,
      name: 'EDC Thailand 2026',
      date: '12/18-20',
      location: '普吉岛 Rhythm Park',
    });
    intentRouter.resolve.mockResolvedValue({
      kind: 'quick_reply',
      source: 'rule',
      readOnlyFastPath: 'festival_catalog',
    });

    const result = await pipeline.runTurn(
      baseDto,
      [{ role: 'user', content: 'EDC Thailand 阵容官宣了吗' }],
      'EDC Thailand 阵容官宣了吗',
      { version: 1, flow: 'idle' },
      'req-edc-lineup',
      'edc-lineup-session',
    );

    expect(chatAgentOrchestrator.runTurn).not.toHaveBeenCalled();
    expect(djInfoService.answerFromChat).not.toHaveBeenCalled();
    expect(activityService.findByCode).toHaveBeenCalledWith('edc-thailand');
    expect(result.assistantReply).toContain('EDC Thailand 2026');
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'delta' }),
        expect.objectContaining({
          type: 'activity_recommendation',
          activity: expect.objectContaining({ title: 'EDC Thailand 2026' }),
        }),
      ]),
    );
  });

  it('uses read-only near-events path for unbound prep tab chip', async () => {
    chatAgentOrchestrator.isEnabled.mockReturnValue(true);
    intentRouter.resolve.mockResolvedValue({
      kind: 'quick_reply',
      source: 'rule',
      readOnlyFastPath: 'near_events',
    });

    const result = await pipeline.runTurn(
      baseDto,
      [{ role: 'user', content: '查最近活动' }],
      '查最近活动',
      { version: 1, flow: 'idle' },
      'req-near-events',
      'near-events-session',
    );

    expect(chatAgentOrchestrator.runTurn).not.toHaveBeenCalled();
    expect(activityService.findAll).toHaveBeenCalled();
    expect(result.assistantReply).toContain('这些是平台近期热门活动');
    expect(result.events[0]).toEqual(
      expect.objectContaining({ type: 'delta' }),
    );
  });

  it('uses bound activityLegacyId on event detail without home inference', async () => {
    buddyContext.resolveActivityLegacyIdFromChat.mockResolvedValue(99);
    postIntentService.tryCreatePostFromChat.mockResolvedValue(null);

    await pipeline.runTurn(
      {
        ...baseDto,
        activityLegacyId: 9,
        messages: [{ role: 'user', content: '发一条组队帖' }],
      },
      [{ role: 'user', content: '发一条组队帖' }],
      '发一条组队帖',
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
