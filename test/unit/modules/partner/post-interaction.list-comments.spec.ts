import { BadRequestException } from '@nestjs/common';
import { PostInteractionService } from '@src/modules/partner/post-interaction.service';
import type { IPostRepository } from '@src/modules/partner/interfaces/post.repository.interface';
import type { UserService } from '@src/modules/user/user.service';
import type { IPostNotificationPort } from '@src/modules/partner/ports/post-notification.port';
import type { IPostModerationPort } from '@src/modules/partner/ports/post-moderation.port';
import type { PostRecruitmentService } from '@src/modules/recruitment/application/post-recruitment.service';
import type { ApplicationBuddyPreviewService } from '@src/modules/partner/application/application-buddy-preview.service';

describe('PostInteractionService.listComments pagination', () => {
  const repository = {
    findById: jest.fn(),
  } as unknown as IPostRepository;

  const commentModel = {
    find: jest.fn(),
  };

  const userService = {
    resolveProfileFromStoredAuthor: jest.fn().mockResolvedValue({ avatar: '' }),
  } as unknown as UserService;

  let service: PostInteractionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostInteractionService(
      repository,
      {} as never,
      {} as never,
      commentModel as never,
      { deleteMany: jest.fn() } as never,
      {} as never,
      userService,
      {
        assertCanPublish: jest.fn().mockResolvedValue(undefined),
      } as unknown as never,
      {} as unknown as ApplicationBuddyPreviewService,
      {} as unknown as IPostNotificationPort,
      {} as unknown as IPostModerationPort,
      {
        assertTextSafe: jest.fn().mockResolvedValue(undefined),
        assertTextsSafe: jest.fn().mockResolvedValue(undefined),
      } as unknown as never,
      {} as unknown as PostRecruitmentService,
      {} as unknown as never,
    );
    (repository.findById as jest.Mock).mockResolvedValue({
      _id: 'post-1',
      status: 'recruiting',
    });
  });

  function mockTopLevelFind(rows: unknown[]) {
    const chain = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(rows),
    };
    (commentModel.find as jest.Mock).mockReturnValue(chain);
    return chain;
  }

  it('returns first page with hasMore and nextCursor', async () => {
    const t0 = new Date('2025-06-01T10:00:00.000Z');
    const t1 = new Date('2025-06-01T11:00:00.000Z');
    const t2 = new Date('2025-06-01T12:00:00.000Z');
    const topLevelChain = mockTopLevelFind([
      {
        _id: 'c1',
        postId: 'post-1',
        userId: 'u1',
        authorName: 'A',
        body: '1',
        createdAt: t0,
      },
      {
        _id: 'c2',
        postId: 'post-1',
        userId: 'u2',
        authorName: 'B',
        body: '2',
        createdAt: t1,
      },
      {
        _id: 'c3',
        postId: 'post-1',
        userId: 'u3',
        authorName: 'C',
        body: '3',
        createdAt: t2,
      },
    ]);
    const replyChain = {
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    (commentModel.find as jest.Mock)
      .mockReturnValueOnce(topLevelChain)
      .mockReturnValueOnce(replyChain);

    const page = await service.listComments('post-1', { limit: 2 });

    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBeTruthy();
    expect(topLevelChain.limit).toHaveBeenCalledWith(3);
  });

  it('rejects invalid cursor', async () => {
    await expect(
      service.listComments('post-1', { cursor: 'bad-cursor' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
