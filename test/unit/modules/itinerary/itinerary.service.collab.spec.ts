import { toRequestActor } from '@src/common/auth/actor-query.util';
import { ItineraryService } from '@src/modules/itinerary/itinerary.service';

describe('ItineraryService collaboration', () => {
  const memberA = toRequestActor('user-a', 'A');
  const memberB = toRequestActor('user-b', 'B');
  const activityLegacyId = 1001;

  const sharedDoc = {
    tripPlanId: 'trip-1',
    userId: 'user-a',
    activityLegacyId,
    eventMeta: 'Storm Festival',
    selectedDjIds: ['dj-1'],
    days: [
      {
        id: 'day-1',
        label: 'Day 1',
        bannerDateLabel: 'Apr 12',
        nodeCount: 1,
        items: [
          {
            id: 'perf-1',
            time: '20:00',
            dotColor: 'pink' as const,
            title: 'Artist A',
          },
        ],
      },
    ],
    meetup: {
      stageLabel: 'Main Stage',
      dateKey: '2026-04-12',
      timeRange: '14:00–15:30',
    },
    toObject() {
      return this;
    },
  };

  function createService() {
    const itineraryModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue(sharedDoc),
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(sharedDoc),
        }),
      }),
    };

    const tripPlan = {
      _id: 'trip-1',
      ownerId: 'user-a',
      activityLegacyId,
      memberIds: ['user-a', 'user-b'],
      save: jest.fn().mockResolvedValue(undefined),
    };

    const tripPlanCollaboration = {
      resolveForActivity: jest.fn().mockResolvedValue(tripPlan),
      assertMember: jest.fn(),
      tripPlanIdString: jest.fn().mockReturnValue('trip-1'),
      ensureTripPlanItineraryLink: jest.fn().mockResolvedValue(undefined),
      resolveSharedItineraryDoc: jest.fn().mockResolvedValue(sharedDoc),
    };

    const service = new ItineraryService(
      itineraryModel as never,
      {} as never,
      {} as never,
      { assertTextsSafe: jest.fn().mockResolvedValue(undefined) } as never,
      { invalidateFestivalPlanForUser: jest.fn() } as never,
      { subscribeOnEngagement: jest.fn() } as never,
      tripPlanCollaboration as never,
    );

    return { service, itineraryModel, tripPlanCollaboration };
  }

  it('member A save upserts shared doc with meetup for trip plan', async () => {
    const { service, itineraryModel } = createService();

    await service.save(
      activityLegacyId,
      {
        eventMeta: 'Storm Festival',
        days: sharedDoc.days,
        selectedDjIds: ['dj-1'],
        meetup: {
          stageLabel: 'Main Stage',
          dateKey: '2026-04-12',
          timeRange: '14:00–15:30',
        },
      },
      memberA,
    );

    expect(itineraryModel.findOneAndUpdate).toHaveBeenCalledWith(
      { tripPlanId: 'trip-1' },
      expect.objectContaining({
        tripPlanId: 'trip-1',
        meetup: expect.objectContaining({ stageLabel: 'Main Stage' }),
      }),
      expect.any(Object),
    );
  });

  it('member B getSaved reads the same shared document including meetup', async () => {
    const { service, tripPlanCollaboration } = createService();

    const result = await service.getSaved(activityLegacyId, memberB);

    expect(tripPlanCollaboration.resolveSharedItineraryDoc).toHaveBeenCalled();
    expect(result).toMatchObject({
      saved: true,
      meetup: {
        stageLabel: 'Main Stage',
        dateKey: '2026-04-12',
        timeRange: '14:00–15:30',
      },
      days: sharedDoc.days,
    });
  });
});
