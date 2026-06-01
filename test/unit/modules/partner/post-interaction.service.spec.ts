import { BadRequestException, ForbiddenException } from '@nestjs/common';

jest.mock('chromadb', () => require('../../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () =>
  require('../../../mocks/langchain-documents'),
);

import { toRequestActor } from '@src/common/auth/actor-query.util';
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

  const likeModel = {
    exists: jest.fn().mockResolvedValue(null),
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
      likeModel as never,
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
    (commentModel.create as jest.Mock).mockResolvedValue({
      _id: 'new-comment',
    });
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
        toRequestActor('demo-kyle', 'Kyle'),
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
        toRequestActor('demo-zara', 'Zara Chen'),
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
      toRequestActor('demo-zara', 'Zara Chen'),
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

describe('PostInteractionService.likePost', () => {
  const repository = {
    findById: jest.fn(),
    incrementCounter: jest.fn(),
  } as unknown as IPostRepository;

  const likeModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
  };

  const postNotification = {
    notifyLike: jest.fn(),
  } as unknown as IPostNotificationPort;

  let service: PostInteractionService;

  const post = {
    _id: 'post-1',
    userId: 'demo-zara',
    authorName: 'Zara Chen',
    likes: 3,
    status: 'recruiting',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostInteractionService(
      repository,
      likeModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      postNotification,
      {} as never,
      {} as never,
    );
    (repository.findById as jest.Mock).mockResolvedValue(post);
  });

  it('creates like and increments counter when not yet liked', async () => {
    (likeModel.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    (likeModel.create as jest.Mock).mockResolvedValue({});
    (repository.incrementCounter as jest.Mock).mockResolvedValue({
      ...post,
      likes: 4,
    });

    const result = await service.likePost(
      'post-1',
      toRequestActor('demo-kyle', 'Kyle'),
    );

    expect(likeModel.create).toHaveBeenCalledWith({
      userId: 'demo-kyle',
      postId: 'post-1',
    });
    expect(repository.incrementCounter).toHaveBeenCalledWith('post-1', 'likes');
    expect(result.liked).toBe(true);
  });

  it('removes like and decrements counter when already liked', async () => {
    (likeModel.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ userId: 'demo-kyle', postId: 'post-1' }),
    });
    (repository.incrementCounter as jest.Mock).mockResolvedValue({
      ...post,
      likes: 2,
    });

    const result = await service.likePost(
      'post-1',
      toRequestActor('demo-kyle', 'Kyle'),
    );

    expect(likeModel.deleteOne).toHaveBeenCalledWith({
      userId: 'demo-kyle',
      postId: 'post-1',
    });
    expect(repository.incrementCounter).toHaveBeenCalledWith('post-1', 'likes', -1);
    expect(result.liked).toBe(false);
  });
});

describe('PostInteractionService.applyToPost', () => {
  const repository = {
    findById: jest.fn(),
  } as unknown as IPostRepository;

  const applicationModel = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const postNotification = {
    notifyApplication: jest.fn(),
  } as unknown as IPostNotificationPort;

  let service: PostInteractionService;

  const post = {
    _id: 'post-1',
    userId: 'demo-zara',
    authorName: 'Zara Chen',
    status: 'recruiting',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostInteractionService(
      repository,
      {} as never,
      applicationModel as never,
      {} as never,
      {} as never,
      {} as never,
      postNotification,
      {} as never,
      {} as never,
    );
    (repository.findById as jest.Mock).mockResolvedValue(post);
  });

  it('rejects applying to own post', async () => {
    await expect(
      service.applyToPost('post-1', toRequestActor('demo-zara', 'Zara Chen')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns alreadyApplied when duplicate application', async () => {
    (applicationModel.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ userId: 'demo-kyle', postId: 'post-1' }),
    });

    const result = await service.applyToPost(
      'post-1',
      toRequestActor('demo-kyle', 'Kyle'),
    );

    expect(result).toEqual({ ok: true, alreadyApplied: true });
    expect(applicationModel.create).not.toHaveBeenCalled();
  });

  it('creates pending application for another user', async () => {
    (applicationModel.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    (applicationModel.create as jest.Mock).mockResolvedValue({});

    const result = await service.applyToPost(
      'post-1',
      toRequestActor('demo-kyle', 'Kyle'),
    );

    expect(applicationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'demo-kyle',
        postId: 'post-1',
        status: 'pending',
      }),
    );
    expect(result).toEqual({ ok: true, alreadyApplied: false });
  });
});
