import { GoalOrchestrator } from '../../../src/modules/goal/goal-orchestrator.service';
import { UserGoalKind } from '../../../src/modules/goal/goal.model';

describe('GoalOrchestrator', () => {
  const activity = {
    legacyId: 8,
    name: 'Test Fest',
    date: '2026-07-18',
    location: 'Shanghai',
  };

  it('notifies registered users and goal watchers with dedupe', async () => {
    const goalService = {
      findActiveByActivityLegacyId: jest.fn().mockResolvedValue([
        {
          _id: 'goal-1',
          userId: 'goal-user',
          kind: UserGoalKind.WATCH_LINEUP,
          params: { notifyWechat: false },
        },
      ]),
      update: jest.fn().mockResolvedValue({}),
    };
    const noticeAgent = {
      notifyActivityUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const registrationRepository = {
      findRegisteredUserIds: jest
        .fn()
        .mockResolvedValue(['reg-user', 'goal-user']),
      findWechatActivityUpdateOptInUserIds: jest
        .fn()
        .mockResolvedValue(['reg-user']),
    };

    const orchestrator = new GoalOrchestrator(
      goalService as never,
      noticeAgent as never,
      registrationRepository as never,
    );

    await orchestrator.onLineupPublished(activity, '阵容已官宣');

    expect(noticeAgent.notifyActivityUpdate).toHaveBeenCalledWith(
      ['reg-user', 'goal-user'],
      8,
      'Test Fest',
      '阵容已官宣',
      '2026-07-18',
      'Shanghai',
      ['reg-user'],
    );
    expect(goalService.update).toHaveBeenCalled();
  });
});
