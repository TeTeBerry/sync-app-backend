import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TravelGuideSavedPlanService } from '@src/modules/travel-guide/travel-guide-saved-plan.service';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';
import { BffReadCacheInvalidationService } from '@src/infra/cache/bff-read-cache.service';
import { UserGoalService } from '@src/modules/goal/goal.service';
import { TripPlanCollaborationService } from '@src/modules/trip-plan/trip-plan-collaboration.service';
import { TravelGuidePlanRepository } from '@src/modules/travel-guide/persistence/travel-guide-plan.repository';

const plan: TravelGuidePlan = {
  activityName: 'Storm',
  venue: '深圳',
  eventDates: '06/13',
  departure: '上海',
  headcount: 2,
  budgetLabel: '舒适',
  accommodationNights: 2,
  selfDrive: false,
  transport: { title: '交通', lines: [] },
  accommodation: { title: '住宿', hotels: [] },
  nightlife: { title: '散场', spots: [] },
  tips: { title: '提示', items: [] },
};

describe('TravelGuideSavedPlanService', () => {
  let service: TravelGuideSavedPlanService;
  let upsertPlan: jest.Mock;
  let findByGuideId: jest.Mock;
  let findLatestByOwnerAndActivity: jest.Mock;

  beforeEach(async () => {
    upsertPlan = jest.fn().mockResolvedValue(undefined);
    findByGuideId = jest.fn().mockResolvedValue(null);
    findLatestByOwnerAndActivity = jest.fn().mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        TravelGuideSavedPlanService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'travelGuide.savedPlanTtlSec' ? 3600 : undefined,
          },
        },
        {
          provide: TravelGuidePlanRepository,
          useValue: {
            upsertPlan,
            findByGuideId,
            findLatestByOwnerAndActivity,
            updatePlan: jest.fn(),
            updateBudgetTier: jest.fn(),
          },
        },
        {
          provide: BffReadCacheInvalidationService,
          useValue: { invalidateFestivalPlanForUser: jest.fn() },
        },
        {
          provide: UserGoalService,
          useValue: { subscribeOnEngagement: jest.fn() },
        },
        {
          provide: TripPlanCollaborationService,
          useValue: { linkGuideForActivity: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(TravelGuideSavedPlanService);
  });

  it('upserts saved plan with resolved form fields', async () => {
    await service.upsert(
      'guide-12345678',
      'wx_user',
      4,
      {
        departure: '上海',
        headcount: 2,
        budgetTier: 'standard',
        selfDrive: true,
      },
      2,
      plan,
    );

    expect(upsertPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        guideId: 'guide-12345678',
        ownerUserId: 'wx_user',
        activityLegacyId: 4,
        form: {
          departure: '上海',
          headcount: 2,
          budgetTier: 'standard',
          selfDrive: true,
          accommodationNights: 2,
        },
        plan,
      }),
    );
  });

  it('returns null when guide id is blank', async () => {
    await expect(service.findByGuideId('   ')).resolves.toBeNull();
    expect(findByGuideId).not.toHaveBeenCalled();
  });

  it('finds latest saved plan for owner and activity', async () => {
    findLatestByOwnerAndActivity.mockResolvedValueOnce({
      guideId: 'guide-latest',
      form: {
        departure: '上海',
        headcount: 2,
        budgetTier: 'standard',
        accommodationNights: 2,
      },
    });

    await expect(
      service.findLatestByOwnerAndActivity('wx_user', 4),
    ).resolves.toEqual({
      guideId: 'guide-latest',
      form: {
        departure: '上海',
        headcount: 2,
        budgetTier: 'standard',
        accommodationNights: 2,
      },
    });

    expect(findLatestByOwnerAndActivity).toHaveBeenCalledWith('wx_user', 4);
  });

  it('maps stored document to read view', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    findByGuideId.mockResolvedValueOnce({
      guideId: 'guide-12345678',
      ownerUserId: 'wx_user',
      activityLegacyId: 4,
      form: {
        departure: '上海',
        headcount: 2,
        budgetTier: 'standard',
        accommodationNights: 2,
      },
      plan,
      expiresAt: new Date(),
      createdAt,
    });

    await expect(service.findByGuideId('guide-12345678')).resolves.toEqual({
      guideId: 'guide-12345678',
      activityLegacyId: 4,
      form: {
        departure: '上海',
        headcount: 2,
        budgetTier: 'standard',
        accommodationNights: 2,
      },
      plan,
      createdAt: createdAt.toISOString(),
    });
  });
});
