import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TravelGuideGenerationOrchestrator } from '@src/modules/travel-guide/travel-guide-generation-orchestrator.service';
import { ActivityService } from '@src/modules/activity/activity.service';
import { AmapMapService } from '@src/modules/travel-guide/map/amap.service';
import { TravelGuideGuardService } from '@src/modules/travel-guide/travel-guide-guard.service';
import { TravelGuideSavedPlanService } from '@src/modules/travel-guide/travel-guide-saved-plan.service';
import { WechatContentSecurityService } from '@src/modules/auth/wechat-content-security.service';
import { TravelQuoteEnrichmentService } from '@src/modules/travel-guide/travel-quote-enrichment.service';
import { TRAVEL_QUOTE_DISCLAIMER } from '@src/modules/travel-guide/domain/travel-guide-quote.util';
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
import { FestivalStayGuideService } from '@src/modules/travel-guide/stay-guide/festival-stay-guide.service';

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
    departureDate: '2026-06-12',
    returnDate: '2026-06-15',
    headcount: 2,
    budgetTier: 'standard' as const,
    selfDrive: true,
    accommodationNights: 2,
  };

  let orchestrator: TravelGuideGenerationOrchestrator;
  let quoteRun: jest.Mock;
  let llmBuild: jest.Mock;
  let savePlan: jest.Mock;
  let locationResolve: jest.Mock;
  let findPlan: jest.Mock;

  beforeEach(async () => {
    quoteRun = jest.fn().mockResolvedValue(null);
    llmBuild = jest.fn().mockResolvedValue({
      transportLines: ['line'],
      hotels: [],
      nightlifeSpots: [{ name: '夜宵', note: 'n' }],
      tipItems: ['tip'],
    });
    savePlan = jest.fn().mockResolvedValue(undefined);
    findPlan = jest.fn().mockResolvedValue(null);
    locationResolve = jest.fn().mockResolvedValue({
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
        nightlife: [{ name: '夜宵', note: 'n', score: 1 }],
        parking: [],
        minHotelRating: 4,
        budgetTier: 'standard',
        hotelPriceBand: ['300', '600'],
      },
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
            isRouteStackEnabled: jest.fn().mockReturnValue(false),
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
          useValue: { generatePlanContent: llmBuild },
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
              total: { min: 1000, max: 2000 },
              items: [{ label: '合计参考（全员）', range: '约 ¥1000–2000' }],
            }),
            summarizeFromPlan: jest.fn().mockReturnValue({
              currency: 'CNY',
              tier: 'standard',
              tierAlias: 'balanced',
              total: { min: 0, max: 0 },
              items: [],
            }),
          },
        },
        {
          provide: FestivalStayGuideService,
          useValue: {
            getGuide: jest.fn().mockReturnValue({
              festivalId: 'storm',
              recommendedAreas: [],
            }),
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
        transportLines: ['line'],
        hotels: [],
        nightlifeSpots: [{ name: '夜宵', note: 'n' }],
        tipItems: ['tip'],
      };
    });

    await orchestrator.generate(4, dto, testActor);

    expect(quoteRun).toHaveBeenCalled();
    expect(llmBuild).toHaveBeenCalled();
    expect(locationResolve).toHaveBeenCalled();
    expect(llmStarted).toBeGreaterThanOrEqual(quoteFinished);
  });

  it('skips live hotel inventory during EN plan generation', async () => {
    const hotelSearch = jest.fn().mockResolvedValue([
      {
        id: 'rs1',
        provider: 'routestack',
        name: 'Docklands Hotel',
        price: { nightlyAmount: 180, totalAmount: 360, currency: 'USD' },
      },
    ]);
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
              location: '安特卫普',
              region: 'overseas',
              code: 'storm',
              area: '比利时',
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
            fromEnrichment: jest.fn().mockReturnValue([
              {
                id: 'rg-hotel',
                provider: 'rollinggo',
                name: 'Should Not Appear',
              },
            ]),
            fromMapRanked: jest
              .fn()
              .mockReturnValue([
                { id: 'map-hotel', provider: 'amap', name: 'Map Hotel' },
              ]),
            search: hotelSearch,
            isRouteStackEnabled: jest.fn().mockReturnValue(true),
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
          useValue: {
            recommend: jest.fn().mockImplementation((hotels: unknown[]) => ({
              ranked: [],
              bestOverall: hotels[0]
                ? {
                    optionId: (hotels[0] as { id: string }).id,
                    category: 'bestOverall',
                    score: 1,
                    reasonCodes: [],
                  }
                : undefined,
            })),
          },
        },
        {
          provide: TravelGuideLlmService,
          useValue: { generatePlanContent: llmBuild },
        },
        {
          provide: TravelGuideCacheService,
          useValue: {
            findGeneratedPlan: jest.fn().mockResolvedValue(null),
            findSimilarGeneratedPlan: jest.fn().mockResolvedValue(null),
            saveGeneratedPlan: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TravelGuideBudgetService,
          useValue: {
            resolveBudgetConstraints: jest.fn().mockReturnValue({
              tier: 'standard',
              tierAlias: 'balanced',
              currency: 'USD',
              travelers: 2,
              nights: 2,
              rooms: 1,
              interCity: true,
              flightTarget: { min: 300, max: 600 },
              hotelTarget: { min: 40, max: 90 },
              estimated: true,
            }),
            buildFromSelected: jest.fn().mockReturnValue({
              currency: 'USD',
              tier: 'standard',
              tierAlias: 'balanced',
              total: { min: 1000, max: 2000 },
              items: [],
            }),
            summarizeFromPlan: jest.fn().mockReturnValue({
              currency: 'USD',
              tier: 'standard',
              tierAlias: 'balanced',
              total: { min: 0, max: 0 },
              items: [],
            }),
          },
        },
        {
          provide: FestivalStayGuideService,
          useValue: {
            getGuide: jest.fn().mockReturnValue({
              festivalId: 'storm',
              recommendedAreas: [],
            }),
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

    const enOrchestrator = moduleRef.get(TravelGuideGenerationOrchestrator);
    await enOrchestrator.generate(
      4,
      { ...dto, locale: 'en', departure: 'London, United Kingdom' },
      testActor,
    );

    expect(quoteRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ locale: 'en' }),
      expect.anything(),
      expect.any(Number),
      expect.objectContaining({ skipHotels: true }),
    );
    expect(hotelSearch).not.toHaveBeenCalled();
  });

  it('uses recommendation bestOverall + BudgetService as response source of truth', async () => {
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
            fromEnrichment: jest.fn().mockReturnValue([
              {
                id: 'cheap',
                provider: 'rollinggo',
                originAirportCode: 'PVG',
                destinationAirportCode: 'SZX',
                departureAt: '2026-06-12T01:00:00',
                arrivalAt: '2026-06-12T05:00:00',
                durationMinutes: 300,
                stops: 2,
                airlines: ['MU'],
                price: { amount: 800, currency: 'CNY' },
              },
              {
                id: 'best',
                provider: 'rollinggo',
                originAirportCode: 'PVG',
                destinationAirportCode: 'SZX',
                departureAt: '2026-06-12T08:00:00',
                arrivalAt: '2026-06-12T10:00:00',
                durationMinutes: 120,
                stops: 0,
                airlines: ['CA'],
                price: { amount: 1100, currency: 'CNY' },
              },
            ]),
            search: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: HotelSearchService,
          useValue: {
            fromEnrichment: jest.fn().mockReturnValue([]),
            fromMapRanked: jest.fn().mockReturnValue([
              {
                id: 'far',
                provider: 'amap',
                name: 'Far Cheap',
                distanceToFestivalKm: 6,
                reviewScore: 4,
                starRating: 3,
                price: {
                  nightlyAmount: 280,
                  totalAmount: 560,
                  currency: 'CNY',
                },
              },
              {
                id: 'near',
                provider: 'amap',
                name: 'Best Near',
                distanceToFestivalKm: 0.6,
                reviewScore: 4.6,
                starRating: 4,
                price: {
                  nightlyAmount: 520,
                  totalAmount: 1040,
                  currency: 'CNY',
                },
              },
            ]),
            search: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: TicketSearchService,
          useValue: { search: jest.fn().mockResolvedValue([]) },
        },
        FlightRecommendationService,
        HotelRecommendationService,
        TravelGuideBudgetService,
        {
          provide: FestivalStayGuideService,
          useValue: {
            getGuide: jest.fn().mockReturnValue({
              festivalId: 'storm',
              recommendedAreas: [],
            }),
          },
        },
        {
          provide: TravelGuideLlmService,
          useValue: { generatePlanContent: llmBuild },
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

    const orch = moduleRef.get(TravelGuideGenerationOrchestrator);
    const result = await orch.generate(4, dto, testActor);

    expect(llmBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedOptions: expect.objectContaining({
          flight: expect.objectContaining({ id: 'cheap' }),
          hotel: expect.objectContaining({ id: 'near' }),
        }),
        recommendations: expect.objectContaining({
          flights: expect.objectContaining({
            bestOverall: expect.objectContaining({ optionId: 'cheap' }),
          }),
          hotels: expect.objectContaining({
            bestOverall: expect.objectContaining({ optionId: 'near' }),
          }),
        }),
        budget: expect.objectContaining({
          items: expect.any(Array),
        }),
      }),
    );

    expect(result.plan.transport.flightOffers?.[0]?.pricePerAdult).toBe(800);
    expect(result.plan.accommodation.hotels[0]?.name).toBe('Best Near');
    expect(result.plan.budget?.items?.length).toBeGreaterThan(0);
    expect(
      result.plan.budget?.items.some((i) => i.label.includes('机票')),
    ).toBe(true);
  });
});
