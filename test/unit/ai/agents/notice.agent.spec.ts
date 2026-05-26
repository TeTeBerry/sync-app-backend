jest.mock('@src/modules/user/user.service', () => ({
  UserService: jest.fn(),
}));
jest.mock('@src/modules/notification/notification.service', () => ({
  NotificationService: jest.fn(),
}));

import { NoticeAgent } from '@src/ai/agents/notice.agent';
import type { NotificationService } from '@src/modules/notification/notification.service';
import type { UserService } from '@src/modules/user/user.service';
import type { PostRecord } from '@src/modules/post/interfaces/post.repository.interface';

describe('NoticeAgent', () => {
  let agent: NoticeAgent;
  let notificationService: jest.Mocked<
    Pick<NotificationService, 'createFromTemplate' | 'hasRecentByMeta'>
  >;
  let userService: jest.Mocked<Pick<UserService, 'isNotificationsEnabled'>>;

  const post = {
    userId: 'owner-1',
    authorName: 'Owner',
    activityLegacyId: 10,
  } as unknown as PostRecord;

  beforeEach(() => {
    notificationService = {
      createFromTemplate: jest.fn().mockResolvedValue({ id: 'n1' }),
      hasRecentByMeta: jest.fn().mockResolvedValue(false),
    };
    userService = {
      isNotificationsEnabled: jest.fn().mockResolvedValue(true),
    };
    agent = new NoticeAgent(
      notificationService as unknown as NotificationService,
      userService as unknown as UserService,
    );
  });

  it('skips like notification when notifications are disabled', async () => {
    userService.isNotificationsEnabled.mockResolvedValue(false);

    await agent.notifyLike(post, 'post-1', 'actor-1', 'Actor');

    expect(notificationService.createFromTemplate).not.toHaveBeenCalled();
  });

  it('creates like notification for post owner with category', async () => {
    await agent.notifyLike(post, 'post-1', 'actor-1', 'Actor');

    expect(notificationService.createFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'owner-1',
        templateKey: 'like',
        meta: expect.objectContaining({
          category: 'like',
          type: 'like',
          postId: 'post-1',
          actorUserId: 'actor-1',
        }),
      }),
    );
  });

  it('does not notify post owner when actor is the owner', async () => {
    await agent.notifyLike(post, 'post-1', 'owner-1', 'Owner');

    expect(notificationService.createFromTemplate).not.toHaveBeenCalled();
  });

  it('creates comment notification with preview', async () => {
    await agent.notifyComment(post, 'post-1', 'actor-2', 'Bob', '你好');

    expect(notificationService.createFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: 'comment',
        templateParams: { actor: 'Bob', preview: '你好' },
        meta: expect.objectContaining({ category: 'comment', type: 'comment' }),
      }),
    );
  });

  it('creates buddy recommendation with dedupe key', async () => {
    await agent.notifyMatchRecommendation('user-1', 10, 'EDC', ['p1', 'p2'], 2);

    expect(notificationService.createFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        templateKey: 'matchRecommendation',
        meta: expect.objectContaining({
          category: 'buddy_recommend',
          type: 'match_recommendation',
          matchPostIds: ['p1', 'p2'],
        }),
      }),
    );
    expect(notificationService.hasRecentByMeta).toHaveBeenCalledWith(
      'user-1',
      'match_recommendation',
      expect.objectContaining({ activityLegacyId: 10 }),
    );
  });

  it('skips match recommendation when deduped for same activity', async () => {
    notificationService.hasRecentByMeta.mockResolvedValue(true);

    await agent.notifyMatchRecommendation('user-1', 10, 'EDC', ['p1'], 1);

    expect(notificationService.createFromTemplate).not.toHaveBeenCalled();
  });

  it('notifies activity update recipients who opted in', async () => {
    await agent.notifyActivityUpdate(
      ['user-a', 'user-b'],
      99,
      'Tomorrowland',
      '时间已更新',
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
        }),
      }),
    );
  });
});
