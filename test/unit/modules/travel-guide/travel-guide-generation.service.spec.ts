import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TravelGuideGenerationService } from '@src/modules/travel-guide/travel-guide-generation.service';
import { TravelGuideGenerationOrchestrator } from '@src/modules/travel-guide/travel-guide-generation-orchestrator.service';
import { ActivityService } from '@src/modules/activity/activity.service';
import { AmapMapService } from '@src/modules/travel-guide/map/amap.service';
import { TravelGuideGuardService } from '@src/modules/travel-guide/travel-guide-guard.service';
import { TravelGuideSavedPlanService } from '@src/modules/travel-guide/travel-guide-saved-plan.service';
import { WechatContentSecurityService } from '@src/modules/auth/wechat-content-security.service';
import { TravelQuoteEnrichmentService } from '@src/modules/travel-guide/travel-quote-enrichment.service';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';
import { LocationSearchService } from '@src/modules/travel-guide/search/location-search.service';
import { FlightSearchService } from '@src/modules/travel-guide/search/flight-search.service';
import { HotelSearchService } from '@src/modules/travel-guide/search/hotel-search.service';
import { TicketSearchService } from '@src/modules/travel-guide/search/ticket-search.service';
import { FlightRecommendationService } from '@src/modules/travel-guide/recommendation/flight-recommendation.service';
import { HotelRecommendationService } from '@src/modules/travel-guide/recommendation/hotel-recommendation.service';
import { TravelGuideLlmService } from '@src/modules/travel-guide/ai/travel-guide-llm.service';
import { TravelGuideCacheService } from '@src/modules/travel-guide/cache/travel-guide-cache.service';
import { TravelGuideBudgetService } from '@src/modules/travel-guide/budget/travel-guide-budget.service';

const testActor = {
  clientUserId: 'wx_test',
  resolvedUserId: 'wx_test',
  displayName: 'Test',
  source: 'jwt' as const,
};

const cachedPlan: TravelGuidePlan = {
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
};

describe('TravelGuideGenerationService cache', () => {
  const dto = {
    departure: '上海',
    headcount: 2,
    budgetTier: 'standard' as const,
    selfDrive: true,
    accommodationNights: 2,
  };

  let service: TravelGuideGenerationService;
  let findPlan: jest.Mock;
  let savePlan: jest.Mock;
  let locationResolve: jest.Mock;

  beforeEach(async () => {
    findPlan = jest.fn().mockResolvedValue(null);
    savePlan = jest.fn().mockResolvedValue(undefined);
    locationResolve = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        TravelGuideGenerationService,
        TravelGuideGenerationOrchestrator,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'rollinggo.quoteCacheTtlSec') return 3600;
              return undefined;
            },
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
              code: 'storm',
            }),
          },
        },
        { provide: AmapMapService, useValue: { enabled: true } },
        {
          provide: LocationSearchService,
          useValue: { resolveAndCollect: locationResolve },
        },
        {
          provide: FlightSearchService,
          useValue: {
            fromEnrichment: jest.fn().mockReturnValue([]),
            search: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: HotelSearchService,
          useValue: {
            fromEnrichment: jest.fn().mockReturnValue([]),
            fromMapRanked: jest.fn().mockReturnValue([]),
            search: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: TicketSearchService,
          useValue: { search: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: FlightRecommendationService,
          useValue: { recommend: jest.fn().mockReturnValue({ ranked: [] }) },
        },
        {
          provide: HotelRecommendationService,
          useValue: { recommend: jest.fn().mockReturnValue({ ranked: [] }) },
        },
        {
          provide: TravelGuideLlmService,
          useValue: {
            generatePlanContent: jest.fn().mockResolvedValue({
              transportLines: ['line'],
              hotels: [],
              nightlifeSpots: [{ name: '夜宵', note: 'n' }],
              tipItems: ['tip'],
            }),
          },
        },
        {
          provide: TravelGuideCacheService,
          useValue: {
            findGeneratedPlan: findPlan,
            findSimilarGeneratedPlan: jest.fn().mockResolvedValue(null),
            saveGeneratedPlan: savePlan,
          },
        },
        {
          provide: TravelGuideBudgetService,
          useValue: {
            resolveBudgetConstraints: jest.fn().mockReturnValue({
              tier: 'standard',
              tierAlias: 'balanced',
              currency: 'CNY',
              travelers: 2,
              nights: 2,
              rooms: 1,
              interCity: true,
              flightTarget: { min: 600, max: 1200 },
              hotelTarget: { min: 300, max: 600 },
              estimated: true,
            }),
            buildFromSelected: jest.fn().mockReturnValue({
              currency: 'CNY',
              tier: 'standard',
              tierAlias: 'balanced',
              total: { min: 0, max: 0 },
              items: [],
            }),
            summarizeFromPlan: jest.fn().mockReturnValue({}),
          },
        },
        {
          provide: TravelGuideSavedPlanService,
          useValue: { upsert: jest.fn().mockResolvedValue(undefined) },
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
          provide: WechatContentSecurityService,
          useValue: { assertTextsSafe: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: TravelQuoteEnrichmentService,
          useValue: { run: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = moduleRef.get(TravelGuideGenerationService);
  });

  it('returns cached plan without calling location search', async () => {
    findPlan.mockResolvedValue(cachedPlan);

    const result = await service.generate(4, dto, testActor);

    expect(result.plan).toEqual(cachedPlan);
    expect(locationResolve).not.toHaveBeenCalled();
    expect(savePlan).not.toHaveBeenCalled();
  });

  it('bypasses cache when forceRegenerate is true', async () => {
    findPlan.mockResolvedValue(cachedPlan);
    locationResolve.mockResolvedValue({
      venue: null,
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
      ranked: {
        hotels: [],
        nightlife: [{ name: 'spot', note: 'n', score: 1 }],
        parking: [],
        minHotelRating: 4,
        budgetTier: 'standard',
        hotelPriceBand: ['300', '600'],
      },
    });

    await service.generate(
      4,
      { ...dto, departure: '北京', forceRegenerate: true },
      testActor,
    );

    expect(findPlan).not.toHaveBeenCalled();
    expect(locationResolve).toHaveBeenCalled();
  });
});
