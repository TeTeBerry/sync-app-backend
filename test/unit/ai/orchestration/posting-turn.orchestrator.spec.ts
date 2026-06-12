import { toRequestActor } from '@src/common/auth/actor-query.util';
import { PostingTurnOrchestrator } from '@src/ai/orchestration/posting-turn.orchestrator';
import { AiStreamEventBuilder } from '@src/ai/presentation/ai-stream-event.builder';

describe('PostingTurnOrchestrator', () => {
  const agenticReplyService = {
    resolve: jest.fn().mockResolvedValue({
      text: 'fallback',
      nextState: { version: 1, flow: 'idle' },
    }),
  };
  const postIntentService = {
    tryCreatePostFromChat: jest.fn().mockResolvedValue(null),
  };
  const buddyContext = {
    resolveActivityLegacyIdFromChat: jest.fn(),
    maybeRequireBuddyPostBeforeTeamSearch: jest
      .fn()
      .mockResolvedValue({ required: false }),
  };
  const sseBuilder = new AiStreamEventBuilder();

  const orchestrator = new PostingTurnOrchestrator(
    postIntentService as never,
    buddyContext as never,
    sseBuilder,
    agenticReplyService as never,
  );

  const baseDto = {
    sessionId: 'home-session',
    actor: toRequestActor('user-1', 'Test User'),
    messages: [{ role: 'user' as const, content: 'test' }],
  };

  const sink = {
    setReply: jest.fn(),
    getReply: jest.fn().mockReturnValue(''),
    setState: jest.fn(),
    getState: jest.fn().mockReturnValue({ version: 1, flow: 'idle' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    postIntentService.tryCreatePostFromChat.mockResolvedValue(null);
  });

  it('falls back to deterministic reply when create_post does not publish', async () => {
    buddyContext.resolveActivityLegacyIdFromChat.mockResolvedValue(undefined);

    const events = await orchestrator.run({
      dto: { ...baseDto, messages: [{ role: 'user', content: '你好' }] },
      messages: [{ role: 'user', content: '你好' }],
      input: '你好',
      sink: sink as never,
      profileSync: null,
      timings: {},
    });

    expect(postIntentService.tryCreatePostFromChat).toHaveBeenCalled();
    expect(events.some((e) => e.type === 'delta')).toBe(true);
  });

  it('attempts create_post directly when storm activity is inferred on home', async () => {
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

    const events = await orchestrator.run({
      dto: {
        ...baseDto,
        messages: [{ role: 'user', content: '风暴电音节 组队发帖' }],
      },
      messages: [{ role: 'user', content: '风暴电音节 组队发帖' }],
      input: '风暴电音节 组队发帖',
      sink: sink as never,
      profileSync: null,
      timings: {},
    });

    expect(postIntentService.tryCreatePostFromChat).toHaveBeenCalledWith(
      expect.objectContaining({ activityLegacyId: 4 }),
    );
    expect(events.some((e) => e.type === 'post_created')).toBe(true);
  });
});
