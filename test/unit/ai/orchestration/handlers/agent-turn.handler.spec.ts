import { AgentTurnHandler } from '@src/ai/orchestration/handlers/agent-turn.handler';
import { AiStreamEventBuilder } from '@src/ai/presentation/ai-stream-event.builder';
import { toRequestActor } from '@src/common/auth/actor-query.util';

describe('AgentTurnHandler', () => {
  const chatAgentOrchestrator = {
    shouldRunAgentFirst: jest.fn().mockReturnValue(true),
    runTurn: jest.fn(),
  };
  const djInfoResolver = {
    resolve: jest.fn().mockResolvedValue({
      intent: 'artist_profile',
      artistName: 'Marshmello',
    }),
  };
  const handler = new AgentTurnHandler(
    chatAgentOrchestrator as never,
    djInfoResolver as never,
    new AiStreamEventBuilder(),
  );

  const baseCtx = {
    dto: {
      sessionId: 's1',
      actor: toRequestActor('u1', 'User'),
      activityLegacyId: 5,
      messages: [{ role: 'user' as const, content: 'Marshmello 是什么风格' }],
    },
    messages: [{ role: 'user' as const, content: 'Marshmello 是什么风格' }],
    input: 'Marshmello 是什么风格',
    sink: {
      setReply: jest.fn(),
      getReply: jest.fn().mockReturnValue(''),
      setState: jest.fn(),
      getState: jest.fn().mockReturnValue({ version: 1, flow: 'idle' }),
    },
    routed: { kind: 'dj_info' as const, source: 'rule' as const },
    profileSync: null,
    timings: {},
    requestId: 'req-1',
    sessionId: 's1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    chatAgentOrchestrator.shouldRunAgentFirst.mockReturnValue(true);
  });

  it('returns null when agent is skipped', async () => {
    chatAgentOrchestrator.shouldRunAgentFirst.mockReturnValue(false);

    const result = await handler.tryRun(baseCtx);

    expect(result).toBeNull();
    expect(chatAgentOrchestrator.runTurn).not.toHaveBeenCalled();
  });

  it('returns null when agent produces no reply', async () => {
    chatAgentOrchestrator.runTurn.mockResolvedValue({ replyText: '' });

    const result = await handler.tryRun(baseCtx);

    expect(result).toBeNull();
  });

  it('returns delta events on successful agent turn', async () => {
    chatAgentOrchestrator.runTurn.mockResolvedValue({
      replyText: 'Marshmello 是 Future Bass 代表艺人。',
      toolsUsed: [],
      toolCalls: [],
      streamEvents: [
        { type: 'delta', content: 'Marshmello 是 Future Bass 代表艺人。' },
      ],
    });

    const result = await handler.tryRun(baseCtx);

    expect(result?.events[0]).toEqual({
      type: 'delta',
      content: 'Marshmello 是 Future Bass 代表艺人。',
    });
    expect(baseCtx.sink.setReply).toHaveBeenCalledWith(
      'Marshmello 是 Future Bass 代表艺人。',
    );
  });

  it('appends dj info suggested replies when query_dj_info tool was used', async () => {
    chatAgentOrchestrator.runTurn.mockResolvedValue({
      replyText: 'Marshmello\n🎧 风格：Future Bass',
      toolsUsed: ['query_dj_info'],
      toolCalls: [{ name: 'query_dj_info', args: { djName: 'Marshmello' } }],
      streamEvents: [
        { type: 'delta', content: 'Marshmello\n🎧 风格：Future Bass' },
      ],
    });

    const result = await handler.tryRun(baseCtx);

    expect(djInfoResolver.resolve).toHaveBeenCalled();
    expect(result?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'suggested_replies' }),
      ]),
    );
  });
});
