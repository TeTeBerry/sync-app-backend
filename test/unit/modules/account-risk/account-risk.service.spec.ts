import { ForbiddenException } from '@nestjs/common';
import { AccountRiskService } from '@src/modules/account-risk/account-risk.service';
import type { RequestActor } from '@src/common/auth/request-actor.types';

describe('AccountRiskService', () => {
  const actor: RequestActor = {
    clientUserId: 'wx_user_a',
    resolvedUserId: 'wx_user_a',
    displayName: 'Tester',
    source: 'jwt',
  };

  function createService(overrides?: {
    user?: {
      accountRiskStatus?: string;
      postRestrictedUntil?: Date;
    };
    counts?: {
      scalperViolations?: number;
      highSeverity?: number;
      scalperReports?: number;
    };
  }) {
    const eventModel = {
      create: jest.fn().mockResolvedValue({}),
      countDocuments: jest
        .fn()
        .mockImplementation((query: Record<string, unknown>) => {
          if (query.violationType === 'scalper') {
            return Promise.resolve(overrides?.counts?.scalperViolations ?? 0);
          }
          if (query.severity === 'high') {
            return Promise.resolve(overrides?.counts?.highSeverity ?? 0);
          }
          return Promise.resolve(0);
        }),
    };

    const userModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(overrides?.user ?? null),
        }),
      }),
      updateOne: jest.fn().mockResolvedValue({}),
    };

    const reportModel = {
      countDocuments: jest
        .fn()
        .mockResolvedValue(overrides?.counts?.scalperReports ?? 0),
    };

    const postModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      }),
    };

    return new AccountRiskService(
      eventModel as never,
      userModel as never,
      reportModel as never,
      postModel as never,
    );
  }

  it('assertCanPublish throws when account is restricted', async () => {
    const until = new Date(Date.now() + 86_400_000);
    const service = createService({
      user: { accountRiskStatus: 'restricted', postRestrictedUntil: until },
    });

    await expect(service.assertCanPublish(actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('records scalper violation and applies restrict sanction', async () => {
    const eventModel = {
      create: jest.fn().mockResolvedValue({}),
      countDocuments: jest
        .fn()
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0),
    };
    const userModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      }),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    const service = new AccountRiskService(
      eventModel as never,
      userModel as never,
      { countDocuments: jest.fn().mockResolvedValue(0) } as never,
      {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        }),
      } as never,
    );

    await service.recordTicketPolicyViolation(actor, '转票');

    expect(eventModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'wx_user_a',
        violationType: 'scalper',
        source: 'post_ticket_policy',
      }),
    );
    expect(userModel.updateOne).toHaveBeenCalledWith(
      { externalId: 'wx_user_a' },
      expect.objectContaining({
        $set: expect.objectContaining({
          accountRiskStatus: 'restricted',
        }),
      }),
    );
  });

  it('getPublicStatus includes reasonCode and appealHint when restricted', async () => {
    const until = new Date(Date.now() + 86_400_000);
    const service = createService({
      user: { accountRiskStatus: 'restricted', postRestrictedUntil: until },
      counts: { scalperViolations: 2 },
    });

    const status = await service.getPublicStatus(actor);

    expect(status.status).toBe('restricted');
    expect(status.reasonCode).toBe('scalper');
    expect(status.appealHint).toContain('申诉说明');
    expect(status.message).toContain('黄牛');
  });

  it('skips duplicate violations for escalation', async () => {
    const eventModel = { create: jest.fn(), countDocuments: jest.fn() };
    const service = createService();

    await service.recordPublishRiskViolation(
      actor,
      {
        publishable: false,
        violationType: 'duplicate',
        severity: 'medium',
        reason: '重复帖',
      },
      { source: 'post_risk' },
    );

    expect(eventModel.create).not.toHaveBeenCalled();
  });
});
