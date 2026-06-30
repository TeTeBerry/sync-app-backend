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
          params: { draftRecruitOnLineup: false },
        },
      ]),
      update: jest.fn().mockResolvedValue({}),
    };
    const noticeAgent = {
      notifyActivityUpdate: jest.fn().mockResolvedValue(undefined),
      notifyProactiveNudge: jest.fn().mockResolvedValue(undefined),
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
      undefined,
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
    expect(noticeAgent.notifyProactiveNudge).not.toHaveBeenCalled();
  });

  it('generates recruit draft when draftRecruitOnLineup is enabled', async () => {
    const goal = {
      _id: 'goal-2',
      userId: 'draft-user',
      kind: UserGoalKind.WATCH_LINEUP,
      params: { draftRecruitOnLineup: true, departureCity: '北京' },
      lastResult: {},
    };
    const goalService = {
      findActiveByActivityLegacyId: jest.fn().mockResolvedValue([goal]),
      update: jest.fn().mockResolvedValue({}),
      saveArtifact: jest.fn().mockResolvedValue({}),
    };
    const noticeAgent = {
      notifyActivityUpdate: jest.fn().mockResolvedValue(undefined),
      notifyProactiveNudge: jest.fn().mockResolvedValue(undefined),
    };
    const sceneRunService = {
      run: jest.fn().mockResolvedValue({
        effects: [
          {
            type: 'candidates',
            items: [{ id: 'c1', text: '一起出发', style: 'slogan' }],
            aiGenerated: true,
          },
        ],
      }),
    };
    const registrationRepository = {
      findRegisteredUserIds: jest.fn().mockResolvedValue(['draft-user']),
      findWechatActivityUpdateOptInUserIds: jest.fn().mockResolvedValue([]),
    };

    const orchestrator = new GoalOrchestrator(
      goalService as never,
      noticeAgent as never,
      sceneRunService as never,
      registrationRepository as never,
    );

    await orchestrator.onLineupPublished(activity, '阵容已官宣');

    expect(sceneRunService.run).toHaveBeenCalled();
    expect(goalService.saveArtifact).toHaveBeenCalled();
    expect(noticeAgent.notifyProactiveNudge).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'draft-user',
        copy: '阵容已官宣，招募草稿已备好',
      }),
    );
  });
});
