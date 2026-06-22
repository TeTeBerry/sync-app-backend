import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { TravelGuideBudgetTierService } from '@src/modules/travel-guide/travel-guide-budget-tier.service';
import { TravelGuideSavedPlanService } from '@src/modules/travel-guide/travel-guide-saved-plan.service';
import { ActivityService } from '@src/modules/activity/activity.service';
import { AmapMapService } from '@src/modules/travel-guide/map/amap.service';
import { TravelGuidePoiCollector } from '@src/modules/travel-guide/map/travel-guide-poi.collector';
import { TravelGuidePoiRanker } from '@src/modules/travel-guide/map/travel-guide-poi.ranker';
import { UserProfileSyncService } from '@src/modules/user/user-profile-sync.service';
import type { TravelGuidePlan } from '@src/modules/travel-guide/domain/travel-guide.types';

const testActor = {
  clientUserId: 'wx_test',
  resolvedUserId: 'wx_owner',
  displayName: 'Test',
  source: 'jwt' as const,
};

const basePlan: TravelGuidePlan = {
  activityName: 'Storm',
  venue: '深圳',
  eventDates: '06/13',
  departure: '上海',
  headcount: 2,
  budgetLabel: '舒适(¥300-600/晚)',
  accommodationNights: 2,
  selfDrive: false,
  transport: { title: '城际交通', lines: ['上海高铁至深圳'] },
  accommodation: {
    title: '住宿',
    hotels: [{ name: '酒店A', note: 'n' }],
    schemes: [
      {
        label: '就近方案',
        name: '酒店A',
        note: 'n',
        reason: 'r',
      },
    ],
  },
  nightlife: { title: '散场', spots: [{ name: '夜宵', note: 'n' }] },
  tips: { title: '提示', items: ['tip'] },
  budget: {
    title: '预算参考（全程 · 合计）',
    items: [{ label: '住宿', range: '约 ¥1200–1800' }],
  },
};

describe('TravelGuideBudgetTierService', () => {
  let service: TravelGuideBudgetTierService;
  let updateBudgetTier: jest.Mock;
  let applyTravelGuideHints: jest.Mock;
  let collect: jest.Mock;
  let rank: jest.Mock;

  beforeEach(async () => {
    updateBudgetTier = jest.fn().mockResolvedValue({
      guideId: 'guide-1',
      activityLegacyId: 4,
      form: {
        departure: '上海',
        headcount: 2,
        accommodationNights: 2,
        budgetTier: 'economy',
      },
      plan: { ...basePlan, budgetLabel: '经济(¥150-300/晚)' },
      createdAt: new Date().toISOString(),
    });
    applyTravelGuideHints = jest.fn();
    collect = jest.fn().mockResolvedValue(null);
    rank = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        TravelGuideBudgetTierService,
        {
          provide: TravelGuideSavedPlanService,
          useValue: {
            findOwnedByGuideId: jest.fn().mockResolvedValue({
              guideId: 'guide-1',
              activityLegacyId: 4,
              ownerUserId: 'wx_owner',
              form: {
                departure: '上海',
                headcount: 2,
                accommodationNights: 2,
              },
              plan: basePlan,
              createdAt: new Date().toISOString(),
            }),
            findByGuideId: jest.fn(),
            updateBudgetTier,
          },
        },
        {
          provide: ActivityService,
          useValue: {
            findByLegacyId: jest.fn().mockResolvedValue({
              legacyId: 4,
              name: 'Storm',
              date: '06/13-14',
              location: '深圳',
              region: 'domestic',
            }),
          },
        },
        { provide: AmapMapService, useValue: { enabled: true } },
        { provide: TravelGuidePoiCollector, useValue: { collect } },
        { provide: TravelGuidePoiRanker, useValue: { rank } },
        {
          provide: UserProfileSyncService,
          useValue: { applyTravelGuideHints },
        },
      ],
    }).compile();

    service = moduleRef.get(TravelGuideBudgetTierService);
  });

  it('updates saved plan and writes budget hints on tier select', async () => {
    const result = await service.selectBudgetTier(
      'guide-1',
      { budgetTier: 'economy' },
      testActor,
    );

    expect(updateBudgetTier).toHaveBeenCalledWith(
      'guide-1',
      'wx_owner',
      'economy',
      expect.objectContaining({
        budgetLabel: '经济(¥150-300/晚)',
      }),
    );
    expect(applyTravelGuideHints).toHaveBeenCalledWith(testActor, {
      departure: '上海',
      departureCity: undefined,
      budgetTier: 'economy',
    });
    expect(result.form.budgetTier).toBe('economy');
  });

  it('returns existing plan when tier unchanged', async () => {
    const savedPlanService = {
      findOwnedByGuideId: jest.fn().mockResolvedValue({
        guideId: 'guide-1',
        activityLegacyId: 4,
        ownerUserId: 'wx_owner',
        form: {
          departure: '上海',
          headcount: 2,
          accommodationNights: 2,
          budgetTier: 'economy',
        },
        plan: basePlan,
        createdAt: new Date().toISOString(),
      }),
      findByGuideId: jest.fn(),
      updateBudgetTier,
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TravelGuideBudgetTierService,
        { provide: TravelGuideSavedPlanService, useValue: savedPlanService },
        {
          provide: ActivityService,
          useValue: { findByLegacyId: jest.fn().mockResolvedValue(null) },
        },
        { provide: AmapMapService, useValue: { enabled: true } },
        { provide: TravelGuidePoiCollector, useValue: { collect } },
        { provide: TravelGuidePoiRanker, useValue: { rank } },
        {
          provide: UserProfileSyncService,
          useValue: { applyTravelGuideHints },
        },
      ],
    }).compile();

    const localService = moduleRef.get(TravelGuideBudgetTierService);
    const result = await localService.selectBudgetTier(
      'guide-1',
      { budgetTier: 'economy' },
      testActor,
    );

    expect(updateBudgetTier).not.toHaveBeenCalled();
    expect(applyTravelGuideHints).not.toHaveBeenCalled();
    expect(result.form.budgetTier).toBe('economy');
  });

  it('rejects non-owner updates', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TravelGuideBudgetTierService,
        {
          provide: TravelGuideSavedPlanService,
          useValue: {
            findOwnedByGuideId: jest.fn().mockResolvedValue(null),
            findByGuideId: jest.fn().mockResolvedValue({ guideId: 'guide-1' }),
          },
        },
        {
          provide: ActivityService,
          useValue: { findByLegacyId: jest.fn() },
        },
        { provide: AmapMapService, useValue: { enabled: true } },
        { provide: TravelGuidePoiCollector, useValue: { collect } },
        { provide: TravelGuidePoiRanker, useValue: { rank } },
        {
          provide: UserProfileSyncService,
          useValue: { applyTravelGuideHints },
        },
      ],
    }).compile();

    const localService = moduleRef.get(TravelGuideBudgetTierService);
    await expect(
      localService.selectBudgetTier(
        'guide-1',
        { budgetTier: 'comfort' },
        testActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
