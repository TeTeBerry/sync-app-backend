import { TravelPlanService } from '@src/modules/travel-plan/travel-plan.service';
import type { RequestActor } from '@src/common/auth/request-actor.types';
import { TripPlanCollaborationService } from '@src/modules/trip-plan/trip-plan-collaboration.service';

describe('TravelPlanService collab fields', () => {
  const actorA = {
    resolvedUserId: 'user-a',
    clientUserId: 'user-a',
  } as RequestActor;

  const actorB = {
    resolvedUserId: 'user-b',
    clientUserId: 'user-b',
  } as RequestActor;

  function createCollaboration(overrides?: {
    sharedDoc?: Record<string, unknown> | null;
  }) {
    return {
      resolveForActivity: jest.fn().mockResolvedValue({
        ownerId: 'user-a',
        memberIds: ['user-a', 'user-b'],
      }),
      assertMember: jest.fn(),
      tripPlanIdString: jest.fn().mockReturnValue('trip-1'),
      ensureTripPlanTravelPlanLink: jest.fn().mockResolvedValue(undefined),
      resolveSharedTravelPlanDoc: jest
        .fn()
        .mockResolvedValue(
          overrides?.sharedDoc
            ? { toObject: () => overrides.sharedDoc, ...overrides.sharedDoc }
            : null,
        ),
    } as unknown as TripPlanCollaborationService;
  }

  function createService(collaboration: TripPlanCollaborationService) {
    const travelPlanModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        updatedAt: new Date('2026-03-02'),
      }),
    };
    const sessionModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    const activityService = {
      findByLegacyId: jest.fn().mockResolvedValue({
        name: '风暴电音节',
        date: '2026-03-15',
        location: '曼谷',
      }),
    };
    const wechatContentSecurity = {
      assertTextsSafe: jest.fn().mockResolvedValue(undefined),
    };

    const service = new TravelPlanService(
      travelPlanModel as never,
      sessionModel as never,
      activityService as never,
      wechatContentSecurity as never,
      { subscribeOnEngagement: jest.fn() } as never,
      collaboration,
    );

    return { service, travelPlanModel };
  }

  it('auto-fills createdBy and defaults splitAmong to all members on collab save', async () => {
    const collaboration = createCollaboration({ sharedDoc: { nodes: [] } });
    const { service, travelPlanModel } = createService(collaboration);

    await service.save(
      4,
      {
        nodes: [
          {
            id: 'user-dining-1',
            category: 'dining',
            startDate: '2026-03-14',
            endDate: '2026-03-14',
            title: '晚餐',
            subtitle: '4 人',
            confirmed: true,
            price: 400,
            splitEnabled: true,
          },
        ],
      },
      actorB,
    );

    expect(travelPlanModel.findOneAndUpdate).toHaveBeenCalledWith(
      { tripPlanId: 'trip-1' },
      expect.objectContaining({
        nodes: [
          expect.objectContaining({
            id: 'user-dining-1',
            createdBy: 'user-b',
            paidBy: 'user-b',
            splitAmong: ['user-a', 'user-b'],
            splitCount: 2,
          }),
        ],
      }),
      expect.any(Object),
    );
  });

  it('preserves createdBy on existing nodes when another member edits', async () => {
    const collaboration = createCollaboration({
      sharedDoc: {
        nodes: [
          {
            id: 'user-dining-1',
            category: 'dining',
            startDate: '2026-03-14',
            endDate: '2026-03-14',
            title: '晚餐',
            subtitle: '4 人',
            confirmed: true,
            price: 400,
            splitEnabled: true,
            createdBy: 'user-a',
            paidBy: 'user-a',
            splitAmong: ['user-a', 'user-b'],
            splitCount: 2,
          },
        ],
      },
    });
    const { service, travelPlanModel } = createService(collaboration);

    await service.save(
      4,
      {
        nodes: [
          {
            id: 'user-dining-1',
            category: 'dining',
            startDate: '2026-03-14',
            endDate: '2026-03-14',
            title: '晚餐（改价）',
            subtitle: '4 人',
            confirmed: true,
            price: 420,
            splitEnabled: true,
            splitAmong: ['user-a', 'user-b'],
            paidBy: 'user-a',
          },
        ],
      },
      actorB,
    );

    expect(travelPlanModel.findOneAndUpdate).toHaveBeenCalledWith(
      { tripPlanId: 'trip-1' },
      expect.objectContaining({
        nodes: [
          expect.objectContaining({
            id: 'user-dining-1',
            createdBy: 'user-a',
            paidBy: 'user-a',
          }),
        ],
      }),
      expect.any(Object),
    );
  });

  it('member B reads the same shared document via getSaved', async () => {
    const sharedDoc = {
      nodes: [
        {
          id: 'user-dining-1',
          category: 'dining',
          startDate: '2026-03-14',
          endDate: '2026-03-14',
          title: '晚餐',
          subtitle: '4 人',
          confirmed: true,
          price: 400,
          splitEnabled: true,
          createdBy: 'user-a',
          paidBy: 'user-a',
          splitAmong: ['user-a', 'user-b'],
          splitCount: 2,
        },
      ],
      activityConfirmations: {},
      activityPriceOverrides: {},
      hiddenActivityNodeIds: [],
      updatedAt: new Date('2026-03-01'),
    };
    const collaboration = createCollaboration({ sharedDoc });
    const { service } = createService(collaboration);

    const result = await service.getSaved(4, actorB);

    expect(result.saved).toBe(true);
    expect(result.userNodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'user-dining-1',
          createdBy: 'user-a',
        }),
      ]),
    );
  });
});
