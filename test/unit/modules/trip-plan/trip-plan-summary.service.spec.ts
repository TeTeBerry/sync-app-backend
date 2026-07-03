import { toRequestActor } from '@src/common/auth/actor-query.util';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { TravelGuideSavedPlan } from '@src/database/schemas/travel-guide-saved-plan.schema';
import { TripPlanSummaryService } from '@src/modules/trip-plan/trip-plan-summary.service';
import { TripPlanService } from '@src/modules/trip-plan/trip-plan.service';

describe('TripPlanSummaryService', () => {
  const actor = toRequestActor('user-1', 'Berry');
  const savedPlanModel = { findOne: jest.fn() };
  const tripPlanService = { getById: jest.fn() };

  let service: TripPlanSummaryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    tripPlanService.getById.mockResolvedValue({
      id: 'trip-1',
      activityLegacyId: 4,
      memberIds: ['user-1', 'user-2'],
      guideId: 'guide-1',
    });
    savedPlanModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          form: {
            departure: '上海',
            headcount: 4,
            budgetTier: 'standard',
          },
          plan: { budgetTierSnapshots: [] },
        }),
      }),
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        TripPlanSummaryService,
        {
          provide: getModelToken(TravelGuideSavedPlan.name),
          useValue: savedPlanModel,
        },
        { provide: TripPlanService, useValue: tripPlanService },
      ],
    }).compile();

    service = moduleRef.get(TripPlanSummaryService);
  });

  it('returns guide summary for linked trip plan', async () => {
    const result = await service.getSummary('trip-1', actor);

    expect(result.memberCount).toBe(2);
    expect(result.guide).toMatchObject({
      hasTravelGuide: true,
      guideId: 'guide-1',
      departure: '上海',
      headcount: 4,
      budgetTier: 'standard',
    });
  });
});
