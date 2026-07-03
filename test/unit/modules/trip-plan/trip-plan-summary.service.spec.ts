import { toRequestActor } from '@src/common/auth/actor-query.util';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { TravelGuideSavedPlan } from '@src/database/schemas/travel-guide-saved-plan.schema';
import { TripPlan } from '@src/database/schemas/trip-plan.schema';
import { TripMemberOverlay } from '@src/database/schemas/trip-member-overlay.schema';
import { TripPlanSummaryService } from '@src/modules/trip-plan/trip-plan-summary.service';
import { TripPlanService } from '@src/modules/trip-plan/trip-plan.service';
import { TripPlanCollaborationService } from '@src/modules/trip-plan/trip-plan-collaboration.service';
import { ItineraryScheduleService } from '@src/modules/itinerary/itinerary-schedule.service';
import { UserGoalService } from '@src/modules/goal/goal.service';

describe('TripPlanSummaryService', () => {
  const actor = toRequestActor('user-1', 'Berry');
  const savedPlanModel = { findOne: jest.fn() };
  const tripPlanModel = { findById: jest.fn() };
  const overlayModel = { find: jest.fn() };
  const tripPlanService = { getById: jest.fn() };
  const tripPlanCollaboration = { resolveSharedItineraryDoc: jest.fn() };
  const itineraryScheduleService = { getSchedule: jest.fn() };
  const userGoalService = { findByUser: jest.fn() };

  let service: TripPlanSummaryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    tripPlanService.getById.mockResolvedValue({
      id: 'trip-1',
      activityLegacyId: 4,
      memberIds: ['user-1', 'user-2'],
      guideId: 'guide-1',
    });
    tripPlanModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: 'trip-1',
        ownerId: 'user-1',
        activityLegacyId: 4,
        memberIds: ['user-1', 'user-2'],
      }),
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
    itineraryScheduleService.getSchedule.mockResolvedValue({
      schedulePublished: true,
    });
    userGoalService.findByUser.mockResolvedValue([]);
    tripPlanCollaboration.resolveSharedItineraryDoc.mockResolvedValue({
      toObject: () => ({
        days: [
          {
            items: [{ id: 'perf-1' }, { id: 'perf-2' }],
          },
        ],
      }),
    });
    overlayModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([
            { itineraryMarks: { 'perf-1': 'must' } },
            { itineraryMarks: { 'perf-1': 'must', 'perf-2': 'maybe' } },
          ]),
      }),
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        TripPlanSummaryService,
        {
          provide: getModelToken(TravelGuideSavedPlan.name),
          useValue: savedPlanModel,
        },
        {
          provide: getModelToken(TripPlan.name),
          useValue: tripPlanModel,
        },
        {
          provide: getModelToken(TripMemberOverlay.name),
          useValue: overlayModel,
        },
        { provide: TripPlanService, useValue: tripPlanService },
        {
          provide: TripPlanCollaborationService,
          useValue: tripPlanCollaboration,
        },
        {
          provide: ItineraryScheduleService,
          useValue: itineraryScheduleService,
        },
        { provide: UserGoalService, useValue: userGoalService },
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

  it('returns itinerary summary with performance and must-see counts', async () => {
    const result = await service.getSummary('trip-1', actor);

    expect(result.itinerary).toMatchObject({
      hasItinerary: true,
      performanceCount: 2,
      mustSeeCount: 1,
      schedulePublished: true,
      subscribed: false,
    });
  });
});
