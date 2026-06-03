import { BadRequestException, ConflictException } from '@nestjs/common';
import { toRequestActor } from '@src/common/auth/actor-query.util';
import { TICKET_PUBLISH_FORBIDDEN_MESSAGE } from '@src/ai/buddy/ticket-publish-policy.util';
import { PostWriteService } from '@src/modules/partner/application/post-write.service';
import type { IPostRepository } from '@src/modules/partner/interfaces/post.repository.interface';
import type { UserService } from '@src/modules/user/user.service';
import type { ActivityService } from '@src/modules/activity/activity.service';
import type { ChromaService } from '@src/ai/rag/chroma.service';
import type { IPostNotificationPort } from '@src/modules/partner/ports/post-notification.port';
import type { IPostModerationPort } from '@src/modules/partner/ports/post-moderation.port';

jest.mock('chromadb', () => require('../../../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () =>
  require('../../../../mocks/langchain-documents'),
);

describe('PostWriteService', () => {
  const repository = {
    create: jest.fn(),
    countByOwnerAndActivity: jest.fn(),
    findOwnerSimilarRecruitingPost: jest.fn().mockResolvedValue(null),
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
    (repository.findOwnerSimilarRecruitingPost as jest.Mock).mockResolvedValue(
      null,
    );
    service = new PostWriteService(
      repository,
      userService,
      activityService,
      chromaService,
      postNotification,
      postModeration,
    );
  });

  it('rejects similar recruiting posts in the same activity', async () => {
    (userService.resolveProfile as jest.Mock).mockResolvedValue({
      name: 'Zara Chen',
    });
    (activityService.findByLegacyId as jest.Mock).mockResolvedValue({
      legacyId: 9,
      name: '风暴电音节',
    });
    (repository.findOwnerSimilarRecruitingPost as jest.Mock).mockResolvedValue({
      _id: 'existing',
      body: '找队友，6.13-6.14，上海，1人',
      status: 'recruiting',
    });

    await expect(
      service.createPost(
        { body: '找队友 6.13-6.14 上海 1人', activityLegacyId: 9 },
        toRequestActor('demo-user', 'Zara Chen'),
        { skipRiskCheck: true },
      ),
    ).rejects.toThrow(ConflictException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects ticket resale posts before persistence', async () => {
    (userService.resolveProfile as jest.Mock).mockResolvedValue({
      name: 'Zara Chen',
    });

    await expect(
      service.createPost(
        { body: '急出票两张 VIP', activityLegacyId: 9 },
        toRequestActor('demo-user', 'Zara Chen'),
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.createPost(
        { body: '急出票两张 VIP', activityLegacyId: 9 },
        toRequestActor('demo-user', 'Zara Chen'),
      ),
    ).rejects.toThrow(TICKET_PUBLISH_FORBIDDEN_MESSAGE);

    expect(repository.create).not.toHaveBeenCalled();
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
      toRequestActor('demo-user', 'Zara Chen'),
    );

    expect(result.id).toBe('post-123');
    expect(repository.create).toHaveBeenCalled();
    expect(chromaService.syncPostEmbeddingStatus).toHaveBeenCalled();

    await new Promise((resolve) => setImmediate(resolve));
  });

  it('createPost with listedInFeed false persists and still upserts Chroma', async () => {
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
      _id: 'post-apply-only',
      userId: 'owner-1',
      body: '仅用于申请',
      eventTitle: '风暴电音节',
      tags: [],
      location: '上海',
      activityLegacyId: 9,
      status: 'recruiting',
      listedInFeed: false,
    });

    const result = await service.createPost(
      { body: '仅用于申请', activityLegacyId: 9, listedInFeed: false },
      toRequestActor('demo-user', 'Zara Chen'),
    );

    expect(result.id).toBe('post-apply-only');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ listedInFeed: false }),
    );
    expect(chromaService.syncPostEmbeddingStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: 'post-apply-only',
        status: 'recruiting',
      }),
    );
  });
});
