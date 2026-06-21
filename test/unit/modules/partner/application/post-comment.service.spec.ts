import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { toRequestActor } from '@src/common/auth/actor-query.util';
import { COMMENT_CONTACT_FORBIDDEN_MESSAGE } from '@src/ai/risk/risk-rules.util';
import { PostCommentService } from '@src/modules/partner/application/post-comment.service';
import type { IPostRepository } from '@src/modules/partner/interfaces/post.repository.interface';
import type { IPostNotificationPort } from '@src/modules/partner/ports/post-notification.port';
import type { AccountRiskService } from '@src/modules/account-risk/account-risk.service';
import type { UserService } from '@src/modules/user/user.service';
import type { WechatContentSecurityService } from '@src/modules/auth/wechat-content-security.service';

describe('PostCommentService notifications', () => {
  const repository = {
    findById: jest.fn(),
    incrementCommentCount: jest.fn(),
  } as unknown as IPostRepository;

  const commentModel = {
    create: jest.fn().mockResolvedValue({}),
    findById: jest.fn(),
    find: jest.fn(),
  };

  const postNotification = {
    notifyPostHidden: jest.fn(),
    notifyComment: jest.fn(),
    notifyCommentReply: jest.fn(),
  } as unknown as IPostNotificationPort;

  const accountRisk = {
    assertCanPublish: jest.fn().mockResolvedValue(undefined),
    recordPublishRiskViolation: jest.fn(),
    recordTicketPolicyViolation: jest.fn(),
  } as unknown as AccountRiskService;

  const userService = {
    resolveProfile: jest.fn(),
    findAuthorSummariesByExternalIds: jest.fn().mockResolvedValue(new Map()),
  } as unknown as UserService;

  const wechatContentSecurity = {
    assertTextSafe: jest.fn().mockResolvedValue(undefined),
    assertTextsSafe: jest.fn().mockResolvedValue(undefined),
  } as unknown as WechatContentSecurityService;

  let service: PostCommentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostCommentService(
      repository,
      commentModel as never,
      postNotification,
      accountRisk,
      userService,
      wechatContentSecurity,
    );
  });

  it('notifies post owner on top-level comment', async () => {
    repository.findById = jest.fn().mockResolvedValue({
      id: 'post-1',
      userId: 'owner-1',
      activityLegacyId: 4,
      status: 'active',
    });
    repository.incrementCommentCount = jest
      .fn()
      .mockResolvedValue({ comments: 1 });

    await service.addComment(
      'post-1',
      '我也想去',
      toRequestActor('user-2', '小红'),
    );

    expect(commentModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2',
        authorName: expect.any(String),
      }),
    );
    expect(postNotification.notifyComment).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'owner-1',
        postId: 'post-1',
        activityLegacyId: 4,
        actorUserId: 'user-2',
        actorUserName: '小红',
        commentPreview: '我也想去',
      }),
    );
    expect(postNotification.notifyCommentReply).not.toHaveBeenCalled();
  });

  it('notifies comment author when post owner replies', async () => {
    repository.findById = jest.fn().mockResolvedValue({
      id: 'post-1',
      userId: 'owner-1',
      activityLegacyId: 4,
      status: 'active',
      authorName: '楼主',
    });
    commentModel.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'comment-1',
        userId: 'commenter-1',
        authorName: '路人',
        postId: 'post-1',
      }),
    });
    userService.resolveProfile = jest.fn().mockResolvedValue({ name: '楼主' });
    repository.incrementCommentCount = jest
      .fn()
      .mockResolvedValue({ comments: 2 });

    await service.addComment(
      'post-1',
      '可以的',
      toRequestActor('owner-1', '楼主'),
      'comment-1',
    );

    expect(postNotification.notifyCommentReply).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'commenter-1',
        postId: 'post-1',
        parentCommentId: 'comment-1',
        actorUserId: 'owner-1',
        commentPreview: '可以的',
      }),
    );
    expect(postNotification.notifyComment).not.toHaveBeenCalled();
  });

  it('does not notify when commenting on own post', async () => {
    repository.findById = jest.fn().mockResolvedValue({
      id: 'post-1',
      userId: 'owner-1',
      activityLegacyId: 4,
      status: 'active',
    });
    repository.incrementCommentCount = jest
      .fn()
      .mockResolvedValue({ comments: 1 });

    await service.addComment(
      'post-1',
      '补充一下',
      toRequestActor('owner-1', '楼主'),
    );

    expect(postNotification.notifyComment).not.toHaveBeenCalled();
    expect(postNotification.notifyCommentReply).not.toHaveBeenCalled();
  });

  it('rejects reply from non-owner', async () => {
    repository.findById = jest.fn().mockResolvedValue({
      id: 'post-1',
      userId: 'owner-1',
      activityLegacyId: 4,
      status: 'active',
    });
    commentModel.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'comment-1',
        userId: 'commenter-1',
        postId: 'post-1',
      }),
    });
    userService.resolveProfile = jest.fn().mockResolvedValue({ name: '路人' });

    await expect(
      service.addComment(
        'post-1',
        '我也想回复',
        toRequestActor('user-3', '路人'),
        'comment-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects comments with contact info before persistence', async () => {
    repository.findById = jest.fn().mockResolvedValue({
      id: 'post-1',
      userId: 'owner-1',
      activityLegacyId: 4,
      status: 'active',
    });

    await expect(
      service.addComment(
        'post-1',
        '加我微信 vx12345',
        toRequestActor('user-2', '小红'),
      ),
    ).rejects.toThrow(
      new BadRequestException(COMMENT_CONTACT_FORBIDDEN_MESSAGE),
    );

    expect(commentModel.create).not.toHaveBeenCalled();
    expect(wechatContentSecurity.assertTextsSafe).not.toHaveBeenCalled();
  });

  it('runs wechat ugc check and risk rules for valid comments', async () => {
    repository.findById = jest.fn().mockResolvedValue({
      id: 'post-1',
      userId: 'owner-1',
      activityLegacyId: 4,
      status: 'active',
    });
    repository.incrementCommentCount = jest
      .fn()
      .mockResolvedValue({ comments: 1 });

    await service.addComment(
      'post-1',
      '我也想去',
      toRequestActor('user-2', '小红'),
    );

    expect(wechatContentSecurity.assertTextsSafe).toHaveBeenCalledWith([
      '我也想去',
    ]);
    expect(commentModel.create).toHaveBeenCalled();
  });
});

describe('PostCommentService deleteOwnedComment', () => {
  const repository = {
    findById: jest.fn(),
    decrementCommentCount: jest.fn(),
  } as unknown as IPostRepository;

  const commentModel = {
    findById: jest.fn(),
    countDocuments: jest.fn(),
    deleteMany: jest.fn(),
  };

  const postNotification = {} as unknown as IPostNotificationPort;
  const accountRisk = {} as unknown as AccountRiskService;
  const userService = {
    resolveProfile: jest.fn().mockResolvedValue({ name: '小红' }),
  } as unknown as UserService;
  const wechatContentSecurity = {} as unknown as WechatContentSecurityService;

  let service: PostCommentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostCommentService(
      repository,
      commentModel as never,
      postNotification,
      accountRisk,
      userService,
      wechatContentSecurity,
    );
  });

  it('deletes owned comment and decrements post count', async () => {
    repository.findById = jest.fn().mockResolvedValue({
      _id: 'post-1',
      userId: 'owner-1',
      status: 'active',
      comments: 3,
    });
    commentModel.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'comment-1',
        userId: 'user-2',
        authorName: '小红',
        postId: 'post-1',
      }),
    });
    commentModel.countDocuments = jest.fn().mockResolvedValue(1);
    commentModel.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 2 });
    repository.decrementCommentCount = jest
      .fn()
      .mockResolvedValue({ comments: 1 });

    const result = await service.deleteOwnedComment(
      'post-1',
      'comment-1',
      toRequestActor('user-2', '小红'),
    );

    expect(result).toEqual({ id: 'post-1', comments: 1 });
    expect(repository.decrementCommentCount).toHaveBeenCalledWith('post-1', 2);
  });
});
