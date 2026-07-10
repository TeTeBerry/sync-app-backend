import { FlightRecommendationService } from '@src/modules/travel-guide/recommendation/flight-recommendation.service';
import { HotelRecommendationService } from '@src/modules/travel-guide/recommendation/hotel-recommendation.service';
import { selectOptionsFromRecommendations } from '@src/modules/travel-guide/domain/select-recommended-options.util';
import { assembleTravelGuidePlanFromContext } from '@src/modules/travel-guide/domain/assemble-travel-guide-plan.util';
import { attachQuoteTierMetadataToPlan } from '@src/modules/travel-guide/domain/attach-quote-tier-metadata.util';
import { TravelGuideBudgetService } from '@src/modules/travel-guide/budget/travel-guide-budget.service';
import { TravelGuideLlmService } from '@src/modules/travel-guide/ai/travel-guide-llm.service';
import { createInitialPlanGenerationContext } from '@src/modules/travel-guide/types/plan-generation-context';
import type { NormalizedFlightOption } from '@src/modules/travel-guide/types/normalized-flight-option';
import type { NormalizedHotelOption } from '@src/modules/travel-guide/types/normalized-hotel-option';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';

const actor = {
  clientUserId: 'u1',
  resolvedUserId: 'u1',
  displayName: 'T',
  source: 'jwt' as const,
};

const activity = {
  legacyId: 4,
  name: 'Storm',
  date: '06/13-14',
  location: '深圳湾体育中心',
  region: 'domestic',
  code: 'storm',
} as any;

function flight(
  id: string,
  price: number,
  duration: number,
  stops = 0,
): NormalizedFlightOption {
  return {
    id,
    provider: 'rollinggo',
    originAirportCode: 'PVG',
    destinationAirportCode: 'SZX',
    departureAt: '2026-06-12T08:00:00',
    arrivalAt: `2026-06-12T${String(8 + Math.floor(duration / 60)).padStart(2, '0')}:00:00`,
    durationMinutes: duration,
    stops,
    airlines: ['MU'],
    price: { amount: price, currency: 'CNY' },
  };
}

function hotel(
  id: string,
  name: string,
  nightly: number,
  distanceKm: number,
): NormalizedHotelOption {
  return {
    id,
    provider: 'amap',
    name,
    distanceToFestivalKm: distanceKm,
    reviewScore: 4.5,
    starRating: 4,
    price: {
      nightlyAmount: nightly,
      totalAmount: nightly * 2,
      currency: 'CNY',
    },
  };
}

describe('recommendation-authoritative plan assembly', () => {
  const flights = [
    flight('cheap', 800, 180, 1),
    flight('best', 1100, 120, 0),
    flight('fast', 1500, 90, 1),
  ];
  const hotels = [
    hotel('far-cheap', 'Far Cheap', 300, 5),
    hotel('best-near', 'Best Near', 520, 0.8),
    hotel('lux', 'Lux Stay', 900, 2),
  ];

  it('selects bestOverall flight and hotel as selectedOptions', () => {
    const flightRecs = new FlightRecommendationService().recommend(flights);
    const hotelRecs = new HotelRecommendationService().recommend(hotels);
    const selected = selectOptionsFromRecommendations({
      flights,
      hotels,
      tickets: [],
      flightRecommendations: flightRecs,
      hotelRecommendations: hotelRecs,
    });

    expect(selected.flight?.id).toBe(flightRecs.bestOverall?.optionId);
    expect(selected.hotel?.id).toBe(hotelRecs.bestOverall?.optionId);
    expect(selected.flight?.id).not.toBe('cheap');
  });

  it('assembles plan with bestOverall flight/hotel and BudgetService items', () => {
    const flightRecs = new FlightRecommendationService().recommend(flights);
    const hotelRecs = new HotelRecommendationService().recommend(hotels);
    const selected = selectOptionsFromRecommendations({
      flights,
      hotels,
      tickets: [],
      flightRecommendations: flightRecs,
      hotelRecommendations: hotelRecs,
    });
    const budget = new TravelGuideBudgetService().buildFromSelected({
      budgetTier: 'standard',
      headcount: 2,
      accommodationNights: 2,
      interCity: true,
      regionKind: 'domestic',
      selfDrive: false,
      selected,
      flights,
      hotels,
    });

    const ctx = createInitialPlanGenerationContext({
      activity,
      dto: {
        departure: '上海',
        headcount: 2,
        budgetTier: 'standard',
        accommodationNights: 2,
      },
      actor,
      accommodationNights: 2,
      cacheKey: 'k',
    });
    ctx.locations = {
      mapCtx: {
        venue: {
          title: '深圳湾',
          address: '深圳',
          lat: 22.5,
          lng: 113.9,
        },
        venueReadableAddress: '深圳',
        venueSource: 'api',
        transportSource: 'api',
        transportHints: [],
        interCity: true,
        pois: [],
        eventEndHour: 23,
        collectedAt: new Date().toISOString(),
      },
      ranked: {
        hotels: [],
        nightlife: [],
        parking: [],
        minHotelRating: 4,
        budgetTier: 'standard',
        hotelPriceBand: ['300', '600'],
      },
    };
    ctx.searchResults = { flights, hotels, tickets: [] };
    ctx.recommendations = { flights: flightRecs, hotels: hotelRecs };
    ctx.selectedOptions = selected;
    ctx.budget = budget;
    ctx.generatedContent = {
      transportLines: ['高铁参考'],
      hotels: [{ name: 'LLM Hotel', note: 'should be overridden' }],
      nightlifeSpots: [{ name: '夜宵', note: 'n' }],
      tipItems: ['tip'],
      budgetItems: [{ label: 'LLM预算', range: '约 ¥1' }],
    };

    const plan = assembleTravelGuidePlanFromContext(ctx);

    expect(plan.accommodation.hotels[0]?.name).toBe(selected.hotel?.name);
    expect(plan.accommodation.hotels.length).toBeLessThanOrEqual(4);
    expect(plan.accommodation.schemes?.map((s) => s.label)).toEqual(
      expect.arrayContaining(
        [
          'Best overall',
          'Best value',
          'Closest practical stay',
          'Premium option',
        ].filter((label) =>
          plan.accommodation.schemes?.some((s) => s.label === label),
        ),
      ),
    );
    expect(plan.transport.flightOffers?.length).toBeLessThanOrEqual(3);
    expect(plan.transport.flightOffers?.[0]?.pricePerAdult).toBe(
      selected.flight?.price.amount,
    );
    expect(plan.budget?.items).toEqual(budget.items);
    expect(plan.budget?.items.some((i) => i.label === 'LLM预算')).toBe(false);
    expect(plan.nightlife.spots[0]?.name).toBe('夜宵');
  });

  it('attachQuoteTierMetadata cannot overwrite selected flight/hotel/budget', () => {
    const base: TravelGuidePlan = {
      activityName: 'Storm',
      venue: '深圳',
      eventDates: '06/13',
      departure: '上海',
      headcount: 2,
      budgetLabel: '舒适',
      accommodationNights: 2,
      selfDrive: false,
      transport: {
        title: '交通',
        lines: ['SELECTED_FLIGHT_LINE'],
        flightOffers: [
          {
            pricePerAdult: 1100,
            currency: 'CNY',
            outbound: {
              route: 'PVG-SZX',
              stopsLabel: '直飞',
              depTime: '2026-06-12T08:00:00',
              arrTime: '2026-06-12T10:00:00',
            },
          },
        ],
      },
      accommodation: {
        title: '住宿',
        hotels: [{ name: 'Best Near', note: 'selected', reason: '综合推荐' }],
      },
      nightlife: { title: '散场', spots: [] },
      tips: { title: '提示', items: ['keep'] },
      budget: {
        title: '预算',
        items: [{ label: '合计参考（全员）', range: '约 ¥5000' }],
      },
    };

    const enriched = attachQuoteTierMetadataToPlan(
      base,
      {
        flight: {
          fromCityCode: 'PVG',
          toCityCode: 'SZX',
          outboundDate: '2026-06-12',
          currency: 'CNY',
          minPricePerAdult: 500,
          maxPricePerAdult: 600,
          sampleLines: ['LEGACY_SAMPLE'],
          flightOffers: [
            {
              pricePerAdult: 500,
              currency: 'CNY',
              outbound: {
                route: 'PVG-SZX',
                stopsLabel: '直飞',
                depTime: '2026-06-12T06:00:00',
                arrTime: '2026-06-12T08:00:00',
              },
            },
          ],
          fetchedAt: new Date().toISOString(),
          source: 'rollinggo',
        },
        hotel: {
          minPricePerNight: 200,
          maxPricePerNight: 250,
          currency: 'CNY',
          sampleCount: 3,
          fetchedAt: new Date().toISOString(),
          source: 'rollinggo',
          recommendations: [{ name: 'Legacy Hotel', minPricePerNight: 200 }],
        },
        flightByTier: {
          standard: {
            fromCityCode: 'PVG',
            toCityCode: 'SZX',
            outboundDate: '2026-06-12',
            currency: 'CNY',
            minPricePerAdult: 500,
            maxPricePerAdult: 600,
            sampleLines: ['LEGACY_SAMPLE'],
            fetchedAt: new Date().toISOString(),
            source: 'rollinggo',
          },
        },
      },
      {
        headcount: 2,
        accommodationNights: 2,
        budgetTier: 'standard',
      },
    );

    expect(enriched.transport.flightOffers?.[0]?.pricePerAdult).toBe(1100);
    expect(enriched.transport.lines).toEqual(['SELECTED_FLIGHT_LINE']);
    expect(enriched.accommodation.hotels[0]?.name).toBe('Best Near');
    expect(enriched.budget?.items[0]?.range).toBe('约 ¥5000');
    expect(enriched.tips.items).toEqual(['keep']);
    expect(enriched.flightByTier?.standard?.minPricePerAdult).toBe(500);
  });

  it('LLM overlay receives recommendation context (no raw RollingGo)', async () => {
    const polish = {
      buildPayloadFromMap: jest.fn().mockResolvedValue({
        transportLines: ['base'],
        hotels: [{ name: 'Map Hotel', note: 'n' }],
        nightlifeSpots: [],
        tipItems: [],
      }),
    };
    const service = new TravelGuideLlmService(polish as any);
    const flightRecs = new FlightRecommendationService().recommend(flights);
    const hotelRecs = new HotelRecommendationService().recommend(hotels);
    const selected = selectOptionsFromRecommendations({
      flights,
      hotels,
      tickets: [],
      flightRecommendations: flightRecs,
      hotelRecommendations: hotelRecs,
    });
    const budget = new TravelGuideBudgetService().buildFromSelected({
      budgetTier: 'standard',
      headcount: 2,
      accommodationNights: 2,
      interCity: true,
      regionKind: 'domestic',
      selfDrive: false,
      selected,
    });

    const payload = await service.generatePlanContent({
      activity,
      dto: {
        departure: '上海',
        headcount: 2,
        budgetTier: 'standard',
        accommodationNights: 2,
      },
      accommodationNights: 2,
      mapCtx: {
        venue: { title: 'v', address: 'a', lat: 1, lng: 2 },
        venueReadableAddress: 'a',
        venueSource: 'api',
        transportSource: 'api',
        transportHints: [],
        interCity: true,
        pois: [],
        eventEndHour: 23,
        collectedAt: new Date().toISOString(),
      },
      ranked: {
        hotels: [],
        nightlife: [],
        parking: [],
        minHotelRating: 4,
        budgetTier: 'standard',
        hotelPriceBand: ['1', '2'],
      },
      recommendations: { flights: flightRecs, hotels: hotelRecs },
      selectedOptions: selected,
      budget,
      tickets: [],
    });

    expect(polish.buildPayloadFromMap).toHaveBeenCalled();
    expect(payload.tipItems?.some((t) => t.includes('推荐航班'))).toBe(true);
    expect(payload.tipItems?.some((t) => t.includes('推荐住宿'))).toBe(true);
    expect(
      payload.tipItems?.some(
        (t) => t.includes('勿另行挑选') || t.includes('不重新排序'),
      ),
    ).toBe(true);
    expect(payload.hotels?.[0]?.name).toBe(selected.hotel?.name);
    expect(payload.budgetItems).toEqual(budget.items);
    expect(JSON.stringify(payload)).not.toContain('rollinggo');
  });

  it('LLM overlay cannot replace selected hotel name with map hotel', async () => {
    const polish = {
      buildPayloadFromMap: jest.fn().mockResolvedValue({
        transportLines: ['base'],
        hotels: [{ name: 'Map Hotel Override', note: 'should not win' }],
        nightlifeSpots: [],
        tipItems: [],
      }),
    };
    const service = new TravelGuideLlmService(polish as any);
    const flightRecs = new FlightRecommendationService().recommend(flights);
    const hotelRecs = new HotelRecommendationService().recommend(hotels);
    const selected = selectOptionsFromRecommendations({
      flights,
      hotels,
      tickets: [],
      flightRecommendations: flightRecs,
      hotelRecommendations: hotelRecs,
    });
    const budget = new TravelGuideBudgetService().buildFromSelected({
      budgetTier: 'standard',
      headcount: 2,
      accommodationNights: 2,
      interCity: true,
      regionKind: 'domestic',
      selfDrive: false,
      selected,
    });

    const payload = await service.generatePlanContent({
      activity,
      dto: {
        departure: '上海',
        headcount: 2,
        budgetTier: 'standard',
        accommodationNights: 2,
      },
      accommodationNights: 2,
      mapCtx: {
        venue: { title: 'v', address: 'a', lat: 1, lng: 2 },
        venueReadableAddress: 'a',
        venueSource: 'api',
        transportSource: 'api',
        transportHints: [],
        interCity: true,
        pois: [],
        eventEndHour: 23,
        collectedAt: new Date().toISOString(),
      },
      ranked: {
        hotels: [],
        nightlife: [],
        parking: [],
        minHotelRating: 4,
        budgetTier: 'standard',
        hotelPriceBand: ['1', '2'],
      },
      recommendations: { flights: flightRecs, hotels: hotelRecs },
      selectedOptions: selected,
      budget,
      tickets: [],
    });

    expect(payload.hotels?.[0]?.name).toBe(selected.hotel?.name);
    expect(payload.hotels?.[0]?.name).not.toBe('Map Hotel Override');
  });

  it('hotel provider failure still yields partial plan without selected hotel', () => {
    const flightRecs = new FlightRecommendationService().recommend(flights);
    const hotelRecs = new HotelRecommendationService().recommend([]);
    const selected = selectOptionsFromRecommendations({
      flights,
      hotels: [],
      tickets: [],
      flightRecommendations: flightRecs,
      hotelRecommendations: hotelRecs,
    });
    expect(selected.hotel).toBeUndefined();

    const budget = new TravelGuideBudgetService().buildFromSelected({
      budgetTier: 'standard',
      headcount: 2,
      accommodationNights: 2,
      interCity: true,
      regionKind: 'domestic',
      selfDrive: false,
      selected,
      flights,
      hotels: [],
    });

    const ctx = createInitialPlanGenerationContext({
      activity,
      dto: {
        departure: '上海',
        headcount: 2,
        budgetTier: 'standard',
        accommodationNights: 2,
      },
      actor,
      accommodationNights: 2,
      cacheKey: 'k',
    });
    ctx.locations = {
      mapCtx: {
        venue: { title: 'v', address: '深圳', lat: 1, lng: 2 },
        venueReadableAddress: '深圳',
        venueSource: 'api',
        transportSource: 'api',
        transportHints: [],
        interCity: true,
        pois: [],
        eventEndHour: 23,
        collectedAt: new Date().toISOString(),
      },
      ranked: {
        hotels: [],
        nightlife: [{ name: '夜宵', note: 'n', score: 1 } as any],
        parking: [],
        minHotelRating: 4,
        budgetTier: 'standard',
        hotelPriceBand: ['1', '2'],
      },
    };
    ctx.searchResults = { flights, hotels: [], tickets: [] };
    ctx.recommendations = { flights: flightRecs, hotels: hotelRecs };
    ctx.selectedOptions = selected;
    ctx.budget = budget;
    ctx.sectionStatus.hotels = 'failed';
    ctx.generatedContent = {
      transportLines: ['line'],
      hotels: [],
      nightlifeSpots: [{ name: '夜宵', note: 'n' }],
      tipItems: ['tip'],
    };

    const plan = assembleTravelGuidePlanFromContext(ctx);
    expect(plan.transport.flightOffers?.[0]?.pricePerAdult).toBe(
      selected.flight?.price.amount,
    );
    expect(plan.accommodation.hotels).toEqual([]);
    expect(plan.budget?.items).toEqual(budget.items);
    expect(plan.nightlife.spots.length).toBeGreaterThan(0);
  });
});
