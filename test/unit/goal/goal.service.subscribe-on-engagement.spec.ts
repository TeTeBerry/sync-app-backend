import { UserGoalKind, UserGoalStatus } from '@src/modules/goal/goal.model';
import { UserGoalService } from '@src/modules/goal/goal.service';

describe('UserGoalService.subscribeOnEngagement', () => {
  const actor = { resolvedUserId: 'user-1', source: 'jwt' as const };

  function createService(overrides?: {
    goals?: Array<{
      kind: string;
      status: string;
      activityLegacyId: number;
    }>;
    createImpl?: jest.Mock;
  }) {
    const goalModel = {
      findOne: jest.fn(),
      create: jest.fn(),
    };
    const registrationService = {
      register: jest.fn().mockResolvedValue({ ok: true }),
      optInWechatActivityUpdates: jest.fn(),
      unregister: jest.fn(),
    };
    const service = new UserGoalService(
      goalModel as never,
      registrationService as never,
    );

    jest
      .spyOn(service, 'findByUser')
      .mockResolvedValue((overrides?.goals ?? []) as never);
    jest.spyOn(service, 'create').mockImplementation(
      overrides?.createImpl ??
        jest.fn().mockResolvedValue({
          _id: 'goal-1',
          kind: UserGoalKind.WATCH_LINEUP,
          status: UserGoalStatus.ACTIVE,
        }),
    );

    return { service, registrationService };
  }

  it('creates in-app watch_lineup when user has no prior goal', async () => {
    const { service } = createService();
    await service.subscribeOnEngagement(actor as never, 8);

    expect(service.create).toHaveBeenCalledWith(actor, {
      activityLegacyId: 8,
      kind: UserGoalKind.WATCH_LINEUP,
      params: { notifyWechat: false },
    });
  });

  it('skips when watch_lineup is already active', async () => {
    const { service } = createService({
      goals: [
        {
          kind: UserGoalKind.WATCH_LINEUP,
          status: UserGoalStatus.ACTIVE,
          activityLegacyId: 8,
        },
      ],
    });

    await service.subscribeOnEngagement(actor as never, 8);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('skips when user previously cancelled watch_lineup', async () => {
    const { service } = createService({
      goals: [
        {
          kind: UserGoalKind.WATCH_LINEUP,
          status: UserGoalStatus.CANCELLED,
          activityLegacyId: 8,
        },
      ],
    });

    await service.subscribeOnEngagement(actor as never, 8);
    expect(service.create).not.toHaveBeenCalled();
  });
});
