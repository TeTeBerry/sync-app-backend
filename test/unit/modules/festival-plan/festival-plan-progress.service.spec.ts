import { toRequestActor } from '@src/common/auth/actor-query.util';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { TravelGuideGenerationJob } from '@src/database/schemas/travel-guide-generation-job.schema';
import { UserItinerary } from '@src/database/schemas/user-itinerary.schema';
import { FestivalPlanProgressService } from '@src/modules/festival-plan/festival-plan-progress.service';
import { TripPlanCollaborationService } from '@src/modules/trip-plan/trip-plan-collaboration.service';

describe('FestivalPlanProgressService', () => {
  const actor = toRequestActor('user-1', 'Berry');
  const travelGuideJobModel = {
    findOne: jest.fn(),
  };
  const itineraryModel = {
    findOne: jest.fn(),
  };
  const tripPlanCollaboration = {
    resolveForActivity: jest.fn(),
    resolveSharedItineraryDoc: jest.fn(),
  };

  let service: FestivalPlanProgressService;

  beforeEach(async () => {
    jest.clearAllMocks();

    travelGuideJobModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ jobId: 'guide-job-1' }),
        }),
      }),
    });
    itineraryModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            days: [{ id: 'd1', label: 'Day 1', items: [] }],
          }),
        }),
      }),
    });
    tripPlanCollaboration.resolveForActivity.mockResolvedValue({
      _id: 'trip-1',
    });
    tripPlanCollaboration.resolveSharedItineraryDoc.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        FestivalPlanProgressService,
        {
          provide: getModelToken(TravelGuideGenerationJob.name),
          useValue: travelGuideJobModel,
        },
        {
          provide: getModelToken(UserItinerary.name),
          useValue: itineraryModel,
        },
        {
          provide: TripPlanCollaborationService,
          useValue: tripPlanCollaboration,
        },
      ],
    }).compile();

    service = moduleRef.get(FestivalPlanProgressService);
  });

  it('aggregates travel guide, itinerary, and trip plan', async () => {
    const result = await service.getProgress(4, actor);

    expect(result).toEqual({
      activityLegacyId: 4,
      hasTravelGuide: true,
      travelGuideId: 'guide-job-1',
      hasItinerary: true,
      itineraryDayCount: 1,
      itinerarySelectedDjIds: undefined,
      hasTripPlan: true,
    });
  });

  it('returns empty progress when user has no artifacts', async () => {
    tripPlanCollaboration.resolveForActivity.mockResolvedValue(null);
    travelGuideJobModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      }),
    });
    itineraryModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      }),
    });

    const result = await service.getProgress(7, actor);

    expect(result).toEqual({
      activityLegacyId: 7,
      hasTravelGuide: false,
      travelGuideId: undefined,
      hasItinerary: false,
      itineraryDayCount: 0,
      itinerarySelectedDjIds: undefined,
      hasTripPlan: false,
    });
  });
});
