import { FlightRecommendationService } from '@src/modules/travel-guide/recommendation/flight-recommendation.service';
import { HotelRecommendationService } from '@src/modules/travel-guide/recommendation/hotel-recommendation.service';
import { TravelGuideBudgetService } from '@src/modules/travel-guide/budget/travel-guide-budget.service';
import type { TravelGuideBudgetConstraints } from '@src/modules/travel-guide/budget/budget-constraints.types';
import { selectOptionsFromRecommendations } from '@src/modules/travel-guide/domain/select-recommended-options.util';
import type { NormalizedFlightOption } from '@src/modules/travel-guide/types/normalized-flight-option';
import type { NormalizedHotelOption } from '@src/modules/travel-guide/types/normalized-hotel-option';

function economyConstraints(
  overrides: Partial<TravelGuideBudgetConstraints> = {},
): TravelGuideBudgetConstraints {
  return {
    tier: 'economy',
    tierAlias: 'budget',
    currency: 'CNY',
    travelers: 2,
    nights: 2,
    rooms: 1,
    interCity: true,
    flightTarget: { min: 400, max: 900 },
    hotelTarget: { min: 150, max: 300 },
    estimated: true,
    ...overrides,
  };
}

describe('budget-aware recommendations', () => {
  const budgetService = new TravelGuideBudgetService();

  it('resolveBudgetConstraints returns tier flight/hotel targets before scoring', () => {
    const constraints = budgetService.resolveBudgetConstraints({
      dto: {
        departure: '上海',
        headcount: 2,
        budgetTier: 'economy',
      },
      accommodationNights: 2,
      regionKind: 'domestic',
      interCity: true,
      currency: 'CNY',
    });

    expect(constraints.tier).toBe('economy');
    expect(constraints.flightTarget?.max).toBe(900);
    expect(constraints.hotelTarget?.max).toBe(300);
    expect(constraints.estimated).toBe(true);
  });

  it('over-budget direct flight does not beat viable in-budget flight for bestOverall', () => {
    const flights: NormalizedFlightOption[] = [
      {
        id: 'cheap-ok',
        provider: 'rollinggo',
        originAirportCode: 'PVG',
        destinationAirportCode: 'SZX',
        departureAt: '2026-06-12T08:00:00',
        arrivalAt: '2026-06-12T11:00:00',
        durationMinutes: 180,
        stops: 1,
        airlines: ['MU'],
        price: { amount: 750, currency: 'CNY' },
      },
      {
        id: 'pricey-direct',
        provider: 'rollinggo',
        originAirportCode: 'PVG',
        destinationAirportCode: 'SZX',
        departureAt: '2026-06-12T09:00:00',
        arrivalAt: '2026-06-12T11:00:00',
        durationMinutes: 120,
        stops: 0,
        airlines: ['CA'],
        price: { amount: 2200, currency: 'CNY' },
      },
    ];

    const result = new FlightRecommendationService().recommend(
      flights,
      economyConstraints(),
    );

    expect(result.bestOverall?.optionId).toBe('cheap-ok');
    expect(result.cheapest?.optionId).toBe('cheap-ok');
    expect(result.fastest?.optionId).toBe('pricey-direct');
    expect(result.bestOverall?.reasonCodes).toContain('WITHIN_FLIGHT_BUDGET');
    expect(
      result.ranked.find((r) => r.optionId === 'pricey-direct')?.reasonCodes,
    ).toEqual(expect.arrayContaining(['OVER_FLIGHT_BUDGET']));
  });

  it('expensive close hotel does not become economy bestOverall when in-budget exists', () => {
    const hotels: NormalizedHotelOption[] = [
      {
        id: 'budget-far',
        provider: 'amap',
        name: 'Budget Far',
        distanceToFestivalKm: 4,
        reviewScore: 4.1,
        starRating: 3,
        price: { nightlyAmount: 220, totalAmount: 440, currency: 'CNY' },
      },
      {
        id: 'lux-near',
        provider: 'amap',
        name: 'Lux Near',
        distanceToFestivalKm: 0.4,
        reviewScore: 4.9,
        starRating: 5,
        price: { nightlyAmount: 980, totalAmount: 1960, currency: 'CNY' },
      },
    ];

    const result = new HotelRecommendationService().recommend(
      hotels,
      economyConstraints(),
    );

    expect(result.bestOverall?.optionId).toBe('budget-far');
    expect(result.closestPracticalStay?.optionId).toBe('lux-near');
    expect(result.premium?.optionId).toBe('lux-near');
    expect(result.bestOverall?.reasonCodes).toContain('WITHIN_HOTEL_BUDGET');
  });

  it('bestOverall becomes selectedOptions', () => {
    const flights: NormalizedFlightOption[] = [
      {
        id: 'a',
        provider: 'rollinggo',
        originAirportCode: 'PVG',
        destinationAirportCode: 'SZX',
        departureAt: '2026-06-12T08:00:00',
        arrivalAt: '2026-06-12T10:00:00',
        durationMinutes: 120,
        stops: 0,
        airlines: ['MU'],
        price: { amount: 800, currency: 'CNY' },
      },
    ];
    const hotels: NormalizedHotelOption[] = [
      {
        id: 'h1',
        provider: 'amap',
        name: 'H1',
        distanceToFestivalKm: 1,
        reviewScore: 4.5,
        starRating: 4,
        price: { nightlyAmount: 250, totalAmount: 500, currency: 'CNY' },
      },
    ];
    const flightRecs = new FlightRecommendationService().recommend(
      flights,
      economyConstraints(),
    );
    const hotelRecs = new HotelRecommendationService().recommend(
      hotels,
      economyConstraints(),
    );
    const selected = selectOptionsFromRecommendations({
      flights,
      hotels,
      tickets: [],
      flightRecommendations: flightRecs,
      hotelRecommendations: hotelRecs,
    });

    expect(selected.flight?.id).toBe(flightRecs.bestOverall?.optionId);
    expect(selected.hotel?.id).toBe(hotelRecs.bestOverall?.optionId);
  });

  it('buildFromSelected uses selected flight/hotel prices', () => {
    const constraints = economyConstraints();
    const flights: NormalizedFlightOption[] = [
      {
        id: 'f1',
        provider: 'rollinggo',
        originAirportCode: 'PVG',
        destinationAirportCode: 'SZX',
        departureAt: '2026-06-12T08:00:00',
        arrivalAt: '2026-06-12T10:00:00',
        durationMinutes: 120,
        stops: 0,
        airlines: ['MU'],
        price: { amount: 800, currency: 'CNY' },
      },
    ];
    const hotels: NormalizedHotelOption[] = [
      {
        id: 'h1',
        provider: 'amap',
        name: 'H1',
        distanceToFestivalKm: 1,
        reviewScore: 4.5,
        starRating: 4,
        price: { nightlyAmount: 250, totalAmount: 500, currency: 'CNY' },
      },
    ];
    const flightRecs = new FlightRecommendationService().recommend(
      flights,
      constraints,
    );
    const hotelRecs = new HotelRecommendationService().recommend(
      hotels,
      constraints,
    );
    const selected = selectOptionsFromRecommendations({
      flights,
      hotels,
      tickets: [],
      flightRecommendations: flightRecs,
      hotelRecommendations: hotelRecs,
    });

    const summary = budgetService.buildFromSelected({
      budgetTier: 'economy',
      headcount: 2,
      accommodationNights: 2,
      interCity: true,
      regionKind: 'domestic',
      selfDrive: false,
      selected,
      flights,
      hotels,
    });

    expect(selected.flight?.id).toBe('f1');
    expect(selected.hotel?.id).toBe('h1');
    expect(summary.flight?.min).toBe(1600); // 800 × 2 travelers
    expect(summary.hotel?.min).toBe(500); // 250 × 1 room × 2 nights
    expect(summary.total.min).toBeGreaterThan(0);
  });

  it('does not directly compare mixed currencies for bestOverall pool', () => {
    const flights: NormalizedFlightOption[] = [
      {
        id: 'cny',
        provider: 'rollinggo',
        originAirportCode: 'PVG',
        destinationAirportCode: 'SZX',
        departureAt: '2026-06-12T08:00:00',
        arrivalAt: '2026-06-12T10:00:00',
        durationMinutes: 120,
        stops: 0,
        airlines: ['MU'],
        price: { amount: 800, currency: 'CNY' },
      },
      {
        id: 'usd',
        provider: 'rollinggo',
        originAirportCode: 'PVG',
        destinationAirportCode: 'SZX',
        departureAt: '2026-06-12T09:00:00',
        arrivalAt: '2026-06-12T11:00:00',
        durationMinutes: 120,
        stops: 0,
        airlines: ['UA'],
        price: { amount: 120, currency: 'USD' },
      },
    ];

    const result = new FlightRecommendationService().recommend(
      flights,
      economyConstraints({ currency: 'CNY' }),
    );

    expect(result.bestOverall?.optionId).toBe('cny');
    expect(result.ranked.every((r) => r.optionId !== 'usd')).toBe(true);
  });
});
