import { ReadOnlyTurnHandler } from '@src/ai/orchestration/handlers/read-only-turn.handler';
import { AiStreamEventBuilder } from '@src/ai/presentation/ai-stream-event.builder';
import { toRequestActor } from '@src/common/auth/actor-query.util';

describe('ReadOnlyTurnHandler', () => {
  const djInfoService = {
    answerFromStructured: jest.fn().mockResolvedValue({
      replyText: '🎤 TML 阵容 DJ\n· Artist A',
    }),
  };
  const itineraryService = {
    getSchedule: jest.fn().mockResolvedValue({
      eventMeta: 'Tomorrowland Thailand',
      djs: [{ id: '1', name: 'Martin Garrix' }],
      performances: [{ id: 'p1' }],
      schedulePublished: true,
    }),
  };
  const activityService = {
    findAll: jest.fn().mockResolvedValue([
      {
        name: 'Tomorrowland Thailand 2026',
        date: '12/11-13',
        location: '芭提雅',
      },
    ]),
  };
  const handler = new ReadOnlyTurnHandler(
    djInfoService as never,
    itineraryService as never,
    activityService as never,
    new AiStreamEventBuilder(),
  );

  const baseCtx = {
    dto: {
      sessionId: 's1',
      actor: toRequestActor('u1', 'User'),
      messages: [],
      activityLegacyId: 1,
    },
    messages: [],
    input: '查阵容',
    sink: {
      setReply: jest.fn(),
      getReply: jest.fn().mockReturnValue(''),
      setState: jest.fn(),
      getState: jest.fn().mockReturnValue({ version: 1, flow: 'idle' }),
    },
    routed: {
      kind: 'dj_info' as const,
      source: 'rule' as const,
      readOnlyFastPath: 'lineup' as const,
    },
    profileSync: null,
    timings: {},
    requestId: 'req-1',
    sessionId: 's1',
  };

  it('returns lineup delta without agent', async () => {
    const result = await handler.tryRun(baseCtx);

    expect(result?.events.some((event) => event.type === 'delta')).toBe(true);
    expect(djInfoService.answerFromStructured).toHaveBeenCalledWith(
      {
        intent: 'lineup_overview',
        styles: [],
        scope: 'lineup',
      },
      1,
    );
    expect(baseCtx.sink.setReply).toHaveBeenCalled();
  });

  it('returns schedule delta without agent', async () => {
    const result = await handler.tryRun({
      ...baseCtx,
      input: '查演出表',
      routed: {
        kind: 'dj_info',
        source: 'rule',
        readOnlyFastPath: 'schedule',
      },
    });

    expect(result?.events.some((event) => event.type === 'delta')).toBe(true);
    expect(itineraryService.getSchedule).toHaveBeenCalledWith(1, {});
    expect(baseCtx.sink.setReply).toHaveBeenCalledWith(
      expect.stringContaining('官方演出表已发布'),
    );
  });

  it('returns near-events delta without agent', async () => {
    const sink = {
      setReply: jest.fn(),
      getReply: jest.fn().mockReturnValue(''),
      setState: jest.fn(),
      getState: jest.fn().mockReturnValue({ version: 1, flow: 'idle' }),
    };
    const result = await handler.tryRun({
      ...baseCtx,
      dto: { ...baseCtx.dto, activityLegacyId: undefined },
      input: '查最近活动',
      sink,
      routed: {
        kind: 'quick_reply',
        source: 'rule',
        readOnlyFastPath: 'near_events',
      },
    });

    expect(result?.events.some((event) => event.type === 'delta')).toBe(true);
    expect(activityService.findAll).toHaveBeenCalled();
    expect(sink.setReply).toHaveBeenCalledWith(
      expect.stringContaining('这些是平台近期热门活动'),
    );
  });

  it('opens travel guide sheet for chip text', async () => {
    const result = await handler.tryRun({
      ...baseCtx,
      input: '生成出行攻略',
      routed: {
        kind: 'dj_info',
        source: 'rule',
        readOnlyFastPath: 'travel_guide_sheet',
      },
    });

    expect(
      result?.events.some(
        (event) =>
          event.type === 'client_action' &&
          'action' in event &&
          event.action.kind === 'open_sheet' &&
          event.action.sheet === 'travel_guide',
      ),
    ).toBe(true);
  });
});
