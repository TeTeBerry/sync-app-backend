import { TravelPlanService } from '@src/modules/travel-plan/travel-plan.service';
import type { RequestActor } from '@src/common/auth/request-actor.types';
import { TripPlanCollaborationService } from '@src/modules/trip-plan/trip-plan-collaboration.service';

describe('TravelPlanService', () => {
  const actor = {
    resolvedUserId: 'user-1',
    clientUserId: 'user-1',
  } as RequestActor;

  function createCollaboration(overrides?: {
    tripPlan?: Record<string, unknown> | null;
    sharedDoc?: Record<string, unknown> | null;
  }) {
    const tripPlan = overrides?.tripPlan ?? null;
    return {
      resolveForActivity: jest.fn().mockResolvedValue(tripPlan),
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

  function createService(overrides?: {
    travelDoc?: Record<string, unknown> | null;
    sessions?: unknown[];
    activity?: { name: string; date: string; location: string } | null;
    collaboration?: TripPlanCollaborationService;
  }) {
    const travelPlanModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(overrides?.travelDoc ?? null),
        }),
      }),
      findOneAndUpdate: jest.fn(),
    };
    const sessionModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(overrides?.sessions ?? []),
          }),
        }),
      }),
    };
    const activityService = {
      findByLegacyId: jest.fn().mockResolvedValue(
        overrides?.activity ?? {
          name: '风暴电音节',
          date: '2026-03-15',
          location: '曼谷',
        },
      ),
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
      overrides?.collaboration ?? createCollaboration(),
    );

    return { service, travelPlanModel, activityService };
  }

  it('getSaved merges activity and user nodes when doc exists', async () => {
    const { service } = createService({
      travelDoc: {
        nodes: [
          {
            id: 'user-hotel-1',
            category: 'hotel',
            startDate: '2026-03-14',
            endDate: '2026-03-16',
            title: 'Hotel',
            subtitle: 'Bangkok',
            confirmed: true,
          },
        ],
        activityConfirmations: {},
        activityPriceOverrides: {},
        hiddenActivityNodeIds: [],
        updatedAt: new Date('2026-03-01'),
      },
      sessions: [
        {
          dateKey: '2026-03-15',
          label: 'Day 1',
          bannerDateLabel: '3/15',
          sortOrder: 1,
        },
      ],
    });

    const result = await service.getSaved(4, actor);
    expect(result.saved).toBe(true);
    expect(result.userNodes?.length).toBe(1);
    expect(result.nodes?.some((node) => node.source === 'user')).toBe(true);
  });

  it('save filters activity nodes and persists user nodes only', async () => {
    const { service, travelPlanModel } = createService();
    travelPlanModel.findOneAndUpdate.mockReturnValue({
      updatedAt: new Date('2026-03-02'),
    });

    const result = await service.save(
      4,
      {
        nodes: [
          {
            id: 'user-flight-1',
            category: 'flight',
            startDate: '2026-03-14',
            endDate: '2026-03-14',
            title: 'Flight',
            subtitle: 'BKK',
            confirmed: true,
          },
          {
            id: 'activity-event-1',
            category: 'event',
            startDate: '2026-03-15',
            endDate: '2026-03-15',
            title: 'Main',
            subtitle: 'Stage',
            confirmed: false,
          },
        ],
      },
      actor,
    );

    expect(result.ok).toBe(true);
    expect(result.nodeCount).toBe(1);
    expect(travelPlanModel.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1', activityLegacyId: 4 },
      expect.objectContaining({
        nodes: [
          expect.objectContaining({ id: 'user-flight-1', category: 'flight' }),
        ],
      }),
      expect.any(Object),
    );
  });

  it('save uses tripPlanId when collaboration context exists', async () => {
    const collaboration = createCollaboration({
      tripPlan: {
        ownerId: 'owner-1',
        memberIds: ['owner-1', 'user-1'],
      },
    });
    const { service, travelPlanModel } = createService({ collaboration });
    travelPlanModel.findOneAndUpdate.mockReturnValue({
      updatedAt: new Date('2026-03-02'),
    });

    await service.save(
      4,
      {
        nodes: [
          {
            id: 'user-flight-1',
            category: 'flight',
            startDate: '2026-03-14',
            endDate: '2026-03-14',
            title: 'Flight',
            subtitle: 'BKK',
            confirmed: true,
          },
        ],
      },
      actor,
    );

    expect(travelPlanModel.findOneAndUpdate).toHaveBeenCalledWith(
      { tripPlanId: 'trip-1' },
      expect.objectContaining({
        tripPlanId: 'trip-1',
        userId: 'owner-1',
        lastEditedByUserId: 'user-1',
      }),
      expect.any(Object),
    );
    expect(collaboration.ensureTripPlanTravelPlanLink).toHaveBeenCalled();
  });
});
