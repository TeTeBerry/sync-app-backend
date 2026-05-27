import { PostWriteService } from '@src/modules/post/application/post-write.service';
import type { IPostRepository } from '@src/modules/post/interfaces/post.repository.interface';
import type { UserService } from '@src/modules/user/user.service';
import type { ActivityService } from '@src/modules/activity/activity.service';
import type { ChromaService } from '@src/ai/rag/chroma.service';
import type { IPostNotificationPort } from '@src/modules/post/ports/post-notification.port';
import type { IPostModerationPort } from '@src/modules/post/ports/post-moderation.port';

jest.mock('chromadb', () => require('../../../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () => require('../../../../mocks/langchain-documents'));

describe('PostWriteService', () => {
  const repository = {
    create: jest.fn(),
    countByOwnerAndActivity: jest.fn(),
  } as unknown as IPostRepository;

  const userService = {
    resolveProfile: jest.fn(),
  } as unknown as UserService;

  const activityService = {
    findByLegacyId: jest.fn(),
  } as unknown as ActivityService;

  const chromaService = {
    syncPostEmbeddingStatus: jest.fn(),
  } as unknown as ChromaService;

  const postNotification = {
    notifyPostHidden: jest.fn(),
  } as unknown as IPostNotificationPort;

  const postModeration = {
    assessPost: jest.fn(),
  } as unknown as IPostModerationPort;

  let service: PostWriteService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostWriteService(
      repository,
      userService,
      activityService,
      chromaService,
      postNotification,
      postModeration,
    );
  });

  it('createPost succeeds when Chroma upsert fails asynchronously', async () => {
    (userService.resolveProfile as jest.Mock).mockResolvedValue({
      name: 'Zara Chen',
      handle: '@zara',
      avatar: 'avatar.png',
      location: '上海',
    });
    (activityService.findByLegacyId as jest.Mock).mockResolvedValue({
      legacyId: 9,
      name: '风暴电音节',
      code: 'storm',
      location: '上海',
    });
    (postModeration.assessPost as jest.Mock).mockResolvedValue({
      publishable: true,
    });
    (repository.countByOwnerAndActivity as jest.Mock).mockResolvedValue(0);
    (repository.create as jest.Mock).mockResolvedValue({
      _id: 'post-123',
      userId: 'owner-1',
      body: '13号A区求组队',
      eventTitle: '风暴电音节',
      tags: [],
      location: '上海',
      activityLegacyId: 9,
      status: 'recruiting',
    });
    (chromaService.syncPostEmbeddingStatus as jest.Mock).mockRejectedValue(
      new Error('chroma down'),
    );

    const result = await service.createPost(
      { body: '13号A区求组队', activityLegacyId: 9 },
      'demo-user',
      'Zara Chen',
    );

    expect(result.id).toBe('post-123');
    expect(repository.create).toHaveBeenCalled();
    expect(chromaService.syncPostEmbeddingStatus).toHaveBeenCalled();

    await new Promise(resolve => setImmediate(resolve));
  });
});
