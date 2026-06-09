import { DjInfoTurnHandler } from '@src/ai/orchestration/handlers/dj-info-turn.handler';
import { AiStreamEventBuilder } from '@src/ai/presentation/ai-sse.builder';
import { toRequestActor } from '@src/common/auth/actor-query.util';

describe('DjInfoTurnHandler', () => {
  const djInfoService = {
    answerFromChat: jest.fn().mockResolvedValue({
      replyText: 'Marshmello\n🎧 风格：Future Bass',
      suggestedReplies: ['Marshmello 近期演出'],
    }),
  };
  const handler = new DjInfoTurnHandler(
    djInfoService as never,
    new AiStreamEventBuilder(),
  );

  it('supports dj_info routed intent', () => {
    expect(
      handler.supports({
        routed: { kind: 'dj_info', source: 'rule' },
      } as never),
    ).toBe(true);
  });

  it('returns delta and suggested replies', async () => {
    const sink = {
      setReply: jest.fn(),
      getReply: jest.fn(),
      setState: jest.fn(),
      getState: jest.fn().mockReturnValue({ version: 1, flow: 'idle' }),
    };

    const events = await handler.run({
      dto: {
        sessionId: 's1',
        actor: toRequestActor('u1', 'User'),
        activityLegacyId: 5,
        messages: [{ role: 'user', content: 'Marshmello 是什么风格' }],
      },
      messages: [{ role: 'user', content: 'Marshmello 是什么风格' }],
      input: 'Marshmello 是什么风格',
      sink: sink as never,
      routed: { kind: 'dj_info', source: 'rule' },
      profileSync: null,
      timings: {},
      requestId: 'r1',
      sessionId: 's1',
    });

    expect(djInfoService.answerFromChat).toHaveBeenCalled();
    expect(events[0]).toEqual({
      type: 'delta',
      content: 'Marshmello\n🎧 风格：Future Bass',
    });
    expect(events).toEqual(
      expect.arrayContaining([
        { type: 'suggested_replies', replies: ['Marshmello 近期演出'] },
      ]),
    );
  });
});
