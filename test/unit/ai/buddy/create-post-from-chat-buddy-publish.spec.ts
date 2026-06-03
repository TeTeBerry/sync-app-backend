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

import { toRequestActor } from '@src/common/auth/actor-query.util';
import { CreatePostFromChatUseCase } from '@src/ai/buddy/create-post-from-chat.use-case';

/** WS 聊天发帖：解析就绪后直接发布（与前端表单 REST 路径并列） */
const accountRiskMock = {
  assertCanPublish: jest.fn().mockResolvedValue(undefined),
  recordTicketPolicyViolation: jest.fn(),
  recordPublishRiskViolation: jest.fn(),
};

describe('CreatePostFromChatUseCase buddy publish (WS chat)', () => {
  const activity = {
    legacyId: 9,
    name: '风暴电音节',
    code: 'storm',
    date: '06/13-14',
  };

  it('creates post when find-buddy thread has activity and llm ready', async () => {
    const createPost = jest.fn().mockResolvedValue({ id: 'post-ws-1' });
    const buildPostBody = jest
      .fn()
      .mockResolvedValue('6.13-6.14 上海 2人 拼房');

    const useCase = new CreatePostFromChatUseCase(
      {
        parse: jest.fn().mockResolvedValue({
          ready: true,
          body: '6.13-6.14 上海 2人 拼房',
          tags: ['#拼房'],
        }),
      } as never,
      { parse: jest.fn() } as never,
      {
        assess: jest.fn().mockResolvedValue({ publishable: true }),
      } as never,
      { notifyPostRejected: jest.fn() } as never,
      {
        createPost,
        findOwnerRecruitingPostForActivity: jest.fn().mockResolvedValue(null),
      } as never,
      {
        shouldAttemptPostCreation: jest.fn().mockReturnValue(true),
        resolveActivity: jest.fn().mockResolvedValue(activity),
        buildPostBody,
        resolveTags: jest.fn().mockReturnValue(['#拼房']),
        buildRecommendedPostCards: jest.fn().mockResolvedValue([
          {
            postId: 'post-ws-1',
            snippet: '6.13-6.14 上海 2人 拼房',
            authorName: 'Test User',
            eventTitle: '风暴电音节',
          },
        ]),
        buildRejectionReply: jest.fn(),
      } as never,
      accountRiskMock as never,
    );

    const result = await useCase.execute({
      messages: [
        { role: 'user', content: '组队队友' },
        { role: 'user', content: '6.13-6.14 上海 2人 拼房' },
      ],
      input: '6.13-6.14 上海 2人 拼房',
      actor: toRequestActor('user-1', 'Test User'),
      activityLegacyId: 9,
      conversationState: { version: 1, flow: 'idle' },
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'created',
        postId: 'post-ws-1',
      }),
    );
    expect(createPost).toHaveBeenCalledWith(
      expect.objectContaining({
        activityLegacyId: 9,
        tags: expect.arrayContaining(['#拼房']),
      }),
      expect.anything(),
      { skipRiskCheck: true },
    );
  });

  it('returns rejected when risk blocks publish', async () => {
    const createPost = jest.fn();
    const notifyPostRejected = jest.fn();

    const useCase = new CreatePostFromChatUseCase(
      {
        parse: jest.fn().mockResolvedValue({ ready: true, body: '违规内容' }),
      } as never,
      { parse: jest.fn() } as never,
      {
        assess: jest.fn().mockResolvedValue({
          publishable: false,
          reason: '违规',
        }),
      } as never,
      { notifyPostRejected } as never,
      {
        createPost,
        findOwnerRecruitingPostForActivity: jest.fn().mockResolvedValue(null),
      } as never,
      {
        shouldAttemptPostCreation: jest.fn().mockReturnValue(true),
        resolveActivity: jest.fn().mockResolvedValue(activity),
        buildPostBody: jest.fn().mockResolvedValue('违规内容'),
        resolveTags: jest.fn().mockReturnValue([]),
        buildRecommendedPostCards: jest.fn(),
        buildRejectionReply: jest.fn().mockReturnValue('无法发布'),
      } as never,
      accountRiskMock as never,
    );

    const result = await useCase.execute({
      messages: [{ role: 'user', content: '找搭子' }],
      input: '找搭子',
      actor: toRequestActor('user-1', 'Test User'),
      activityLegacyId: 9,
      conversationState: { version: 1, flow: 'idle' },
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'rejected',
        replyText: '无法发布',
      }),
    );
    expect(createPost).not.toHaveBeenCalled();
    expect(notifyPostRejected).toHaveBeenCalled();
  });
});
