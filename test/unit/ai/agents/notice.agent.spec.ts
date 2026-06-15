jest.mock('@src/modules/user/user.service', () => ({
  UserService: jest.fn(),
}));
jest.mock('@src/modules/notification/notification.service', () => ({
  NotificationService: jest.fn(),
}));

import { NoticeAgent } from '@src/ai/agents/notice.agent';
import type { NotificationService } from '@src/modules/notification/notification.service';
import type { UserService } from '@src/modules/user/user.service';

describe('NoticeAgent', () => {
  let agent: NoticeAgent;
  let notificationService: jest.Mocked<
    Pick<NotificationService, 'createFromTemplate' | 'hasRecentByMeta'>
  >;
  let userService: jest.Mocked<Pick<UserService, 'isNotificationsEnabled'>>;

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
});
