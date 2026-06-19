import { toRequestActor } from '@src/common/auth/actor-query.util';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { TravelGuideGenerationJob } from '@src/database/schemas/travel-guide-generation-job.schema';
import { FestivalPlanProgressService } from '@src/modules/festival-plan/festival-plan-progress.service';
import { ItineraryService } from '@src/modules/itinerary/itinerary.service';
import { PostQueryService } from '@src/modules/partner/application/post-query.service';
import { ACTIVITY_REGISTRATION_REPOSITORY } from '@src/modules/activity/registration/interfaces/activity-registration.repository.interface';
import { TravelGuideSavedPlanService } from '@src/modules/travel-guide/travel-guide-saved-plan.service';

describe('FestivalPlanProgressService', () => {
  const actor = toRequestActor('user-1', 'Berry');
  const travelGuideJobModel = {
    findOne: jest.fn(),
  };
  const savedPlanService = {
    findLatestByOwnerAndActivity: jest.fn(),
  };
  const itineraryService = {
    getSaved: jest.fn(),
  };
  const postQueryService = {
    findOwnerActivePostForActivity: jest.fn(),
  };
  const registrationRepository = {
    findByOwnerAndActivity: jest.fn(),
  };

  let service: FestivalPlanProgressService;

  beforeEach(async () => {
    jest.clearAllMocks();

    savedPlanService.findLatestByOwnerAndActivity.mockResolvedValue({
      guideId: 'guide-saved-1',
    });
    travelGuideJobModel.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            jobId: 'guide-job-1',
            requestParams: { guideId: 'guide-from-job' },
          }),
        }),
      }),
    });
    itineraryService.getSaved.mockResolvedValue({
      saved: true,
      selectedDjIds: ['dj-1'],
      days: [{ id: 'd1', label: 'Day 1', items: [] }],
    });
    postQueryService.findOwnerActivePostForActivity.mockResolvedValue({
      id: 'post-1',
    });
    registrationRepository.findByOwnerAndActivity.mockResolvedValue({
      activityLegacyId: 4,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        FestivalPlanProgressService,
        {
          provide: getModelToken(TravelGuideGenerationJob.name),
          useValue: travelGuideJobModel,
        },
        { provide: TravelGuideSavedPlanService, useValue: savedPlanService },
        { provide: ItineraryService, useValue: itineraryService },
        { provide: PostQueryService, useValue: postQueryService },
        {
          provide: ACTIVITY_REGISTRATION_REPOSITORY,
          useValue: registrationRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(FestivalPlanProgressService);
  });

  it('aggregates travel guide, itinerary, buddy post, and registration', async () => {
    const result = await service.getProgress(4, actor);

    expect(result).toEqual({
      activityLegacyId: 4,
      hasTravelGuide: true,
      travelGuideId: 'guide-saved-1',
      hasItinerary: true,
      itineraryDayCount: 1,
      itinerarySelectedDjIds: ['dj-1'],
      hasBuddyPost: true,
      buddyPostId: 'post-1',
      isRegistered: true,
    });
  });

  it('falls back to guideId from completed job when saved plan is missing', async () => {
    savedPlanService.findLatestByOwnerAndActivity.mockResolvedValue(null);

    const result = await service.getProgress(4, actor);

    expect(result.travelGuideId).toBe('guide-from-job');
    expect(result.hasTravelGuide).toBe(true);
  });

  it('returns empty progress when user has no artifacts', async () => {
    savedPlanService.findLatestByOwnerAndActivity.mockResolvedValue(null);
    travelGuideJobModel.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      }),
    });
    itineraryService.getSaved.mockResolvedValue({ saved: false });
    postQueryService.findOwnerActivePostForActivity.mockResolvedValue(null);
    registrationRepository.findByOwnerAndActivity.mockResolvedValue(null);

    const result = await service.getProgress(7, actor);

    expect(result).toEqual({
      activityLegacyId: 7,
      hasTravelGuide: false,
      travelGuideId: undefined,
      hasItinerary: false,
      itineraryDayCount: undefined,
      itinerarySelectedDjIds: undefined,
      hasBuddyPost: false,
      buddyPostId: undefined,
      isRegistered: false,
    });
  });
});
