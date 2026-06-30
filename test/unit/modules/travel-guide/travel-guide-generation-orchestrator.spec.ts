import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TravelGuideGenerationOrchestrator } from '@src/modules/travel-guide/travel-guide-generation-orchestrator.service';
import { ActivityService } from '@src/modules/activity/activity.service';
import { AmapMapService } from '@src/modules/travel-guide/map/amap.service';
import { TravelGuidePoiPipeline } from '@src/modules/travel-guide/map/travel-guide-poi.pipeline';
import { TravelGuideLlmPolishService } from '@src/modules/travel-guide/travel-guide-llm-polish.service';
import { TravelGuideGenerationCacheService } from '@src/modules/travel-guide/travel-guide-generation-cache.service';
import { TravelGuideGuardService } from '@src/modules/travel-guide/travel-guide-guard.service';
import { TravelGuideSavedPlanService } from '@src/modules/travel-guide/travel-guide-saved-plan.service';
import { WechatContentSecurityService } from '@src/modules/auth/wechat-content-security.service';
import { TravelQuoteEnrichmentService } from '@src/modules/travel-guide/travel-quote-enrichment.service';
import { TRAVEL_QUOTE_DISCLAIMER } from '@src/modules/travel-guide/domain/travel-guide-quote.util';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';

const testActor = {
  clientUserId: 'wx_test',
  resolvedUserId: 'wx_test',
  displayName: 'Test',
  source: 'jwt' as const,
};

const freshCachedPlan: TravelGuidePlan = {
  activityName: 'Storm',
  venue: '深圳',
  eventDates: '06/13',
  departure: '上海',
  headcount: 2,
  budgetLabel: '舒适',
  accommodationNights: 2,
  selfDrive: true,
  transport: { title: '交通', lines: ['高铁'] },
  accommodation: { title: '住宿', hotels: [{ name: '酒店A', note: 'n' }] },
  nightlife: { title: '散场', spots: [{ name: '夜宵', note: 'n' }] },
  tips: { title: '提示', items: ['tip'] },
  quoteFetchedAt: new Date().toISOString(),
  budget: {
    title: '预算',
    items: [
      {
        label: '住宿',
        range: '约 ¥1000',
        note: `${TRAVEL_QUOTE_DISCLAIMER} 按 1 间房 · 2 晚 · 舒适档估算。`,
      },
    ],
  },
  budgetTierSnapshots: [
    { tier: 'economy', nightlyMin: 200, nightlyMax: 300, currency: 'CNY' },
    { tier: 'standard', nightlyMin: 300, nightlyMax: 400, currency: 'CNY' },
    { tier: 'comfort', nightlyMin: 500, nightlyMax: 600, currency: 'CNY' },
  ],
};

describe('TravelGuideGenerationOrchestrator', () => {
  const dto = {
    departure: '上海',
    headcount: 2,
    budgetTier: 'standard' as const,
    selfDrive: true,
    accommodationNights: 2,
  };

  let orchestrator: TravelGuideGenerationOrchestrator;
  let quoteRun: jest.Mock;
  let llmBuild: jest.Mock;
  let savePlan: jest.Mock;
  let poiRun: jest.Mock;
  let findPlan: jest.Mock;

  beforeEach(async () => {
    quoteRun = jest.fn().mockResolvedValue(null);
    llmBuild = jest.fn().mockResolvedValue({
      transport: { title: '交通', lines: ['line'] },
      accommodation: { title: '住宿', hotels: [] },
      nightlife: { title: '散场', spots: [] },
      tips: { title: '提示', items: [] },
    });
    savePlan = jest.fn().mockResolvedValue(undefined);
    findPlan = jest.fn().mockResolvedValue(null);
    poiRun = jest.fn().mockResolvedValue({
      mapCtx: {
        venue: { title: 'Venue', address: '深圳', lat: 22.7, lng: 113.9 },
        venueReadableAddress: '深圳',
        venueSource: 'api',
        transportSource: 'api',
        transportHints: [],
        interCity: true,
        pois: [],
        eventEndHour: 23.5,
        collectedAt: new Date().toISOString(),
      },
      ranked: { hotels: [], nightlife: [], parking: [] },
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        TravelGuideGenerationOrchestrator,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'rollinggo.quoteCacheTtlSec' ? 3600 : undefined,
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
        { provide: TravelGuidePoiPipeline, useValue: { run: poiRun } },
        {
          provide: TravelGuideLlmPolishService,
          useValue: { buildPayloadFromMap: llmBuild },
        },
        {
          provide: TravelGuideGenerationCacheService,
          useValue: {
            findPlan,
            findSimilarPlan: jest.fn().mockResolvedValue(null),
            savePlan,
          },
        },
        {
          provide: TravelGuideGuardService,
          useValue: {
            assertCanGenerate: jest.fn().mockResolvedValue(undefined),
            acquireGenerationLock: jest.fn().mockResolvedValue(true),
            releaseGenerationLock: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TravelGuideSavedPlanService,
          useValue: { upsert: jest.fn() },
        },
        {
          provide: WechatContentSecurityService,
          useValue: { assertTextsSafe: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: TravelQuoteEnrichmentService,
          useValue: { run: quoteRun },
        },
      ],
    }).compile();

    orchestrator = moduleRef.get(TravelGuideGenerationOrchestrator);
  });

  it('skips RollingGo when cached plan quote is still fresh', async () => {
    findPlan.mockResolvedValue(freshCachedPlan);

    const result = await orchestrator.generate(4, dto, testActor);

    expect(quoteRun).not.toHaveBeenCalled();
    expect(savePlan).not.toHaveBeenCalled();
    expect(result.plan.quoteFetchedAt).toBe(freshCachedPlan.quoteFetchedAt);
  });

  it('runs RollingGo quotes before LLM on cold path', async () => {
    let quoteFinished = 0;
    let llmStarted = 0;
    quoteRun.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      quoteFinished = Date.now();
      return null;
    });
    llmBuild.mockImplementation(async () => {
      llmStarted = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        transport: { title: '交通', lines: ['line'] },
        accommodation: { title: '住宿', hotels: [] },
        nightlife: { title: '散场', spots: [] },
        tips: { title: '提示', items: [] },
      };
    });

    await orchestrator.generate(4, dto, testActor);

    expect(quoteRun).toHaveBeenCalled();
    expect(llmBuild).toHaveBeenCalled();
    expect(llmStarted).toBeGreaterThanOrEqual(quoteFinished);
  });
});
