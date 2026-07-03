import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { TravelGuideBudgetTierService } from '@src/modules/travel-guide/travel-guide-budget-tier.service';
import { TravelGuideSavedPlanService } from '@src/modules/travel-guide/travel-guide-saved-plan.service';
import { ActivityService } from '@src/modules/activity/activity.service';
import { AmapMapService } from '@src/modules/travel-guide/map/amap.service';
import { TravelGuidePoiCollector } from '@src/modules/travel-guide/map/travel-guide-poi.collector';
import { TravelGuidePoiRanker } from '@src/modules/travel-guide/map/travel-guide-poi.ranker';
import { TravelQuoteEnrichmentService } from '@src/modules/travel-guide/travel-quote-enrichment.service';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';

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
    items: [
      { label: '机票（往返）', range: '约 ¥5286–14396' },
      { label: '住宿', range: '约 ¥2240–5760' },
      { label: '合计参考（全员）', range: '约 ¥7526–20556' },
    ],
  },
  budgetTierSnapshots: [
    { tier: 'economy', nightlyMin: 1120, nightlyMax: 2030, currency: 'CNY' },
    { tier: 'standard', nightlyMin: 2030, nightlyMax: 2880, currency: 'CNY' },
    { tier: 'comfort', nightlyMin: 4560, nightlyMax: 4560, currency: 'CNY' },
  ],
  quoteTierSources: {
    economy: 'rollinggo',
    standard: 'rollinggo',
    comfort: 'rollinggo',
  },
};

describe('TravelGuideBudgetTierService', () => {
  let service: TravelGuideBudgetTierService;
  let updateBudgetTier: jest.Mock;
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
          provide: TravelQuoteEnrichmentService,
          useValue: {
            run: jest.fn(),
            fetchHotelQuoteForTier: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(TravelGuideBudgetTierService);
  });

  it('skips POI collect when plan already has hotels and tier snapshots', async () => {
    await service.selectBudgetTier(
      'guide-1',
      { budgetTier: 'economy' },
      testActor,
    );

    expect(collect).not.toHaveBeenCalled();
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
        budgetLabel: '经济(¥1120-2030/晚)',
        budget: expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              label: '机票（往返）',
              range: '约 ¥5286–14396',
            }),
            expect.objectContaining({ label: '住宿', range: '约 ¥2240–4060' }),
            expect.objectContaining({
              label: '合计参考（全员）',
              range: '约 ¥7526–18456',
            }),
          ]),
        }),
      }),
    );
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
          provide: TravelQuoteEnrichmentService,
          useValue: {
            run: jest.fn(),
            fetchHotelQuoteForTier: jest.fn(),
          },
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
          provide: TravelQuoteEnrichmentService,
          useValue: {
            run: jest.fn(),
            fetchHotelQuoteForTier: jest.fn(),
          },
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
