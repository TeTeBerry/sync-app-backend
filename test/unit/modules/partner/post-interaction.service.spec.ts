import { BadRequestException, ForbiddenException } from '@nestjs/common';

jest.mock('chromadb', () => require('../../../mocks/chromadb'));

jest.mock(
  '@langchain/core/documents',
  () => require('../../../mocks/langchain-documents'),
);

import { PostInteractionService } from '@src/modules/partner/post-interaction.service';
import type { IPostRepository } from '@src/modules/partner/interfaces/post.repository.interface';
import type { UserService } from '@src/modules/user/user.service';
import type { IPostNotificationPort } from '@src/modules/partner/ports/post-notification.port';
import type { IPostModerationPort } from '@src/modules/partner/ports/post-moderation.port';
import type { PostRecruitmentService } from '@src/modules/recruitment/application/post-recruitment.service';

describe('PostInteractionService.addComment', () => {
  const repository = {
    findById: jest.fn(),
    incrementCounter: jest.fn(),
  } as unknown as IPostRepository;

  const commentModel = {
    findById: jest.fn(),
    create: jest.fn(),
  };

  function mockParentComment(parent: {
    _id: string;
    postId: string;
    userId: string;
    authorName: string;
  }) {
    (commentModel.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(parent),
    });
  }

  const userService = {
    resolveProfile: jest.fn(),
  } as unknown as UserService;

  const postModeration = {
    assessComment: jest.fn().mockResolvedValue({ publishable: true }),
  } as unknown as IPostModerationPort;

  const postNotification = {
    notifyComment: jest.fn(),
    notifyCommentReply: jest.fn(),
  } as unknown as IPostNotificationPort;

  const postRecruitmentService = {} as unknown as PostRecruitmentService;

  let service: PostInteractionService;

  const zaraPost = {
    _id: 'post-1',
    userId: 'demo-zara',
    authorName: 'Zara Chen',
    status: 'recruiting',
    comments: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostInteractionService(
      repository,
      {} as never,
      {} as never,
      commentModel as never,
      {} as never,
      userService,
      postNotification,
      postModeration,
      postRecruitmentService,
    );
    (repository.findById as jest.Mock).mockResolvedValue(zaraPost);
    (repository.incrementCounter as jest.Mock).mockResolvedValue({
      ...zaraPost,
      comments: 1,
    });
    (commentModel.create as jest.Mock).mockResolvedValue({ _id: 'new-comment' });
  });

  it('rejects reply from non-post-author', async () => {
    mockParentComment({
      _id: 'parent-1',
      postId: 'post-1',
      userId: 'demo-mia',
      authorName: 'Mia',
    });

    await expect(
      service.addComment(
        'post-1',
        '我也想加入',
        'demo-kyle',
        'Kyle',
        'parent-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects post author replying to own top-level comment', async () => {
    mockParentComment({
      _id: 'parent-1',
      postId: 'post-1',
      userId: 'demo-zara',
      authorName: 'Zara Chen',
    });

    await expect(
      service.addComment(
        'post-1',
        '补充一下',
        'demo-zara',
        'Zara Chen',
        'parent-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows post author to reply to another user comment', async () => {
    mockParentComment({
      _id: 'parent-1',
      postId: 'post-1',
      userId: 'demo-mia',
      authorName: 'Mia',
    });

    await service.addComment(
      'post-1',
      '有的，私我对票区～',
      'demo-zara',
      'Zara Chen',
      'parent-1',
    );

    expect(commentModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        parentCommentId: 'parent-1',
        userId: 'demo-zara',
      }),
    );
  });
});
