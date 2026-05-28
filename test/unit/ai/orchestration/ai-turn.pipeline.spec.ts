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

import { AiTurnPipeline } from '@src/ai/orchestration/ai-turn.pipeline';
import { AiSseBuilder } from '@src/ai/presentation/ai-sse.builder';
import { RECOMMEND_GATE_MARKER } from '@src/ai/gate/recommend-gate.util';

describe('AiTurnPipeline homepage activity gating', () => {
  const agenticReplyService = {
    resolve: jest.fn().mockResolvedValue({ text: 'fallback', nextState: { version: 1, flow: 'idle' } }),
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
    resolve: jest.fn().mockResolvedValue({ kind: 'create_post', source: 'rule' }),
  };
  const buddyContext = {
    resolveActivityLegacyIdFromChat: jest.fn(),
  };

  const pipeline = new AiTurnPipeline(
    agenticReplyService as never,
    postIntentService as never,
    userProfileAgent as never,
    intentRouter as never,
    new AiSseBuilder(),
    buddyContext as never,
  );

  const baseDto = {
    sessionId: 'home-session',
    userId: 'user-1',
    messages: [{ role: 'user' as const, content: 'test' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
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

    expect(postIntentService.tryProactiveRecommendBeforeCreate).not.toHaveBeenCalled();
  });

  it('runs proactive recommend on home when storm activity is inferred', async () => {
    buddyContext.resolveActivityLegacyIdFromChat.mockResolvedValue(4);
    postIntentService.tryProactiveRecommendBeforeCreate.mockResolvedValue({
      postCards: [{ postId: 'p1', snippet: '找搭子', authorName: 'A', eventTitle: '风暴' }],
      activityLabel: '风暴电音节',
      replyText: 'found',
      matches: [],
      degraded: false,
    });

    const result = await pipeline.runTurn(
      {
        ...baseDto,
        messages: [{ role: 'user', content: '风暴电音节 找队友' }],
      },
      [{ role: 'user', content: '风暴电音节 找队友' }],
      '风暴电音节 找队友',
      { version: 1, flow: 'idle' },
      'req-home-storm',
      'home-session',
    );

    expect(postIntentService.tryProactiveRecommendBeforeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ activityLegacyId: 4 }),
    );
    expect(result.events.some(e => e.type === 'post_recommendations')).toBe(true);
    expect(
      result.events.some(
        e =>
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

    expect(postIntentService.tryProactiveRecommendBeforeCreate).not.toHaveBeenCalled();
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
    expect(postIntentService.tryProactiveRecommendBeforeCreate).not.toHaveBeenCalled();
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
    expect(postIntentService.tryProactiveRecommendBeforeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ activityLegacyId: 9 }),
    );
  });
});
