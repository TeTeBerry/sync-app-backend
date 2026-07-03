import { ForbiddenException } from '@nestjs/common';
import { TripPlanCollaborationService } from '@src/modules/trip-plan/trip-plan-collaboration.service';
import type { TripPlanDocument } from '@src/database/schemas/trip-plan.schema';

describe('TripPlanCollaborationService', () => {
  const owner = { resolvedUserId: 'owner-1', source: 'jwt' as const };
  const member = { resolvedUserId: 'member-1', source: 'jwt' as const };

  function createTripPlan(overrides?: Record<string, unknown>) {
    return {
      _id: 'trip-1',
      activityLegacyId: 1001,
      ownerId: owner.resolvedUserId,
      memberIds: [owner.resolvedUserId, member.resolvedUserId],
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    } as unknown as TripPlanDocument;
  }

  function createService(options?: {
    tripPlans?: TripPlanDocument[];
    travelDoc?: Record<string, unknown> | null;
    itineraryDoc?: Record<string, unknown> | null;
  }) {
    const tripPlanModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(options?.tripPlans ?? []),
        }),
      }),
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(options?.tripPlans?.[0] ?? null),
      }),
    };

    const travelPlanModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(options?.travelDoc ?? null),
      }),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(options?.travelDoc ?? null),
      }),
    };

    const itineraryModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(options?.itineraryDoc ?? null),
      }),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(options?.itineraryDoc ?? null),
      }),
    };

    const travelGuideJobModel = {
      updateMany: jest.fn().mockResolvedValue(undefined),
    };
    const travelGuideSavedPlanModel = {
      updateMany: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      }),
    };

    const service = new TripPlanCollaborationService(
      tripPlanModel as never,
      travelPlanModel as never,
      itineraryModel as never,
      travelGuideJobModel as never,
      travelGuideSavedPlanModel as never,
    );

    return {
      service,
      tripPlanModel,
      travelPlanModel,
      itineraryModel,
      travelGuideJobModel,
      travelGuideSavedPlanModel,
    };
  }

  it('prefers trip plan with more members when resolving for activity', async () => {
    const solo = createTripPlan({
      _id: 'solo',
      memberIds: [member.resolvedUserId],
    });
    const collab = createTripPlan({
      _id: 'collab',
      memberIds: [owner.resolvedUserId, member.resolvedUserId],
    });
    const { service } = createService({ tripPlans: [solo, collab] });

    const resolved = await service.resolveForActivity(member as never, 1001);
    expect(resolved?._id).toBe('collab');
  });

  it('assertMember rejects non-members', () => {
    const { service } = createService();
    const tripPlan = createTripPlan({ memberIds: [owner.resolvedUserId] });

    expect(() => service.assertMember(tripPlan, member as never)).toThrow(
      ForbiddenException,
    );
  });

  it('links guide id to trip plan and guide collections', async () => {
    const tripPlan = createTripPlan();
    const { service, travelGuideJobModel, travelGuideSavedPlanModel } =
      createService({ tripPlans: [tripPlan] });

    await service.linkGuideForActivity(owner as never, 1001, 'guide-abc');

    expect(tripPlan.guideId).toBe('guide-abc');
    expect(tripPlan.save).toHaveBeenCalled();
    expect(travelGuideJobModel.updateMany).toHaveBeenCalledWith(
      { jobId: 'guide-abc' },
      { $set: { tripPlanId: 'trip-1' } },
    );
    expect(travelGuideSavedPlanModel.updateMany).toHaveBeenCalledWith(
      { guideId: 'guide-abc' },
      { $set: { tripPlanId: 'trip-1' } },
    );
  });
});
