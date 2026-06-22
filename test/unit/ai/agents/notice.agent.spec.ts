jest.mock('@src/modules/user/user.service', () => ({
  UserService: jest.fn(),
}));
jest.mock('@src/modules/notification/notification.service', () => ({
  NotificationService: jest.fn(),
}));

import { NoticeAgent } from '@src/ai/agents/notice.agent';
import type { NotificationService } from '@src/modules/notification/notification.service';
import type { UserService } from '@src/modules/user/user.service';
import type { IUserRepository } from '@src/modules/user/interfaces/user.repository.interface';
import type { WechatSubscribeMessageService } from '@src/modules/auth/wechat-subscribe-message.service';

describe('NoticeAgent', () => {
  let agent: NoticeAgent;
  let notificationService: jest.Mocked<
    Pick<NotificationService, 'createFromTemplate' | 'hasRecentByMeta'>
  >;
  let userService: jest.Mocked<Pick<UserService, 'isNotificationsEnabled'>>;
  let userRepository: jest.Mocked<Pick<IUserRepository, 'findByExternalId'>>;
  let wechatSubscribe: jest.Mocked<
    Pick<
      WechatSubscribeMessageService,
      | 'isEnabled'
      | 'isActivityUpdateEnabled'
      | 'sendPostEngagementNotice'
      | 'sendActivityUpdateNotice'
    >
  >;

  beforeEach(() => {
    notificationService = {
      createFromTemplate: jest.fn().mockResolvedValue({ id: 'n1' }),
      hasRecentByMeta: jest.fn().mockResolvedValue(false),
    };
    userService = {
      isNotificationsEnabled: jest.fn().mockResolvedValue(true),
    };
    userRepository = {
      findByExternalId: jest.fn().mockResolvedValue({ openid: 'openid-owner' }),
    };
    wechatSubscribe = {
      isEnabled: jest.fn().mockReturnValue(true),
      isActivityUpdateEnabled: jest.fn().mockReturnValue(true),
      sendPostEngagementNotice: jest.fn().mockResolvedValue(undefined),
      sendActivityUpdateNotice: jest.fn().mockResolvedValue(undefined),
    };
    agent = new NoticeAgent(
      notificationService as unknown as NotificationService,
      userService as unknown as UserService,
      userRepository as unknown as IUserRepository,
      wechatSubscribe as unknown as WechatSubscribeMessageService,
    );
  });

  it('notifies activity update recipients who opted in', async () => {
    await agent.notifyActivityUpdate(
      ['user-a', 'user-b'],
      99,
      'Tomorrowland',
      '时间已更新',
    );

    expect(notificationService.hasRecentByMeta).toHaveBeenCalledWith(
      'user-a',
      'activity_update',
      expect.objectContaining({
        activityLegacyId: 99,
        changeSummary: '时间已更新',
      }),
    );
    expect(notificationService.createFromTemplate).toHaveBeenCalledTimes(2);
    expect(notificationService.createFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-a',
        templateKey: 'activityUpdate',
        meta: expect.objectContaining({
          category: 'system',
          type: 'activity_update',
          activityLegacyId: 99,
          changeSummary: '时间已更新',
        }),
      }),
    );
    expect(wechatSubscribe.sendActivityUpdateNotice).toHaveBeenCalledTimes(2);
  });

  it('sends WeChat activity update only to opted-in recipients', async () => {
    await agent.notifyActivityUpdate(
      ['user-a', 'user-b'],
      99,
      'Tomorrowland',
      '阵容已官宣',
      undefined,
      undefined,
      ['user-b'],
    );

    expect(wechatSubscribe.sendActivityUpdateNotice).toHaveBeenCalledTimes(1);
    expect(wechatSubscribe.sendActivityUpdateNotice).toHaveBeenCalledWith(
      expect.objectContaining({ openid: 'openid-owner' }),
    );
  });

  it('skips duplicate activity update for same user and changeSummary', async () => {
    notificationService.hasRecentByMeta.mockResolvedValue(true);

    await agent.notifyActivityUpdate(
      ['user-a'],
      4,
      '风暴电音节 深圳站',
      '地点已更新为 深圳国际会展中心 17 号馆',
    );

    expect(notificationService.hasRecentByMeta).toHaveBeenCalledWith(
      'user-a',
      'activity_update',
      expect.objectContaining({
        activityLegacyId: 4,
        changeSummary: '地点已更新为 深圳国际会展中心 17 号馆',
      }),
    );
    expect(notificationService.createFromTemplate).not.toHaveBeenCalled();
  });

  it('notifies post owner on new comment', async () => {
    await agent.notifyComment({
      recipientUserId: 'owner-1',
      postId: 'post-1',
      activityLegacyId: 4,
      actorUserId: 'user-2',
      actorUserName: '小红',
      commentPreview: '我也想去，可以一起吗',
    });

    expect(notificationService.createFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'owner-1',
        templateKey: 'comment',
        meta: expect.objectContaining({
          type: 'comment',
          postId: 'post-1',
          activityLegacyId: 4,
          actorUserId: 'user-2',
        }),
      }),
    );
    expect(wechatSubscribe.sendPostEngagementNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        openid: 'openid-owner',
        templateKey: 'comment',
        postId: 'post-1',
      }),
    );
  });

  it('skips comment notification when actor is post owner', async () => {
    await agent.notifyComment({
      recipientUserId: 'owner-1',
      postId: 'post-1',
      activityLegacyId: 4,
      actorUserId: 'owner-1',
      commentPreview: '自己评论',
    });

    expect(notificationService.createFromTemplate).not.toHaveBeenCalled();
  });

  it('notifies comment author on post owner reply', async () => {
    await agent.notifyCommentReply({
      recipientUserId: 'commenter-1',
      postId: 'post-1',
      activityLegacyId: 4,
      actorUserId: 'owner-1',
      actorUserName: '楼主',
      commentPreview: '可以的，我们活动见',
      parentCommentId: 'comment-1',
    });

    expect(notificationService.createFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'commenter-1',
        templateKey: 'commentReply',
        meta: expect.objectContaining({
          type: 'comment_reply',
          parentCommentId: 'comment-1',
        }),
      }),
    );
  });
});
