import {
  dedupeNormalizedFlights,
  normalizeFlightOptionsFromQuote,
} from '@src/modules/travel-guide/domain/normalize-flight-options.util';
import type { FlightQuoteSnapshot } from '@src/modules/travel-guide/ports/travel-quote.types';
import { FlightSearchService } from '@src/modules/travel-guide/search/flight-search.service';
import { FlightRecommendationService } from '@src/modules/travel-guide/recommendation/flight-recommendation.service';
import { HotelRecommendationService } from '@src/modules/travel-guide/recommendation/hotel-recommendation.service';
import type { NormalizedHotelOption } from '@src/modules/travel-guide/types/normalized-hotel-option';
import { TravelGuideBudgetService } from '@src/modules/travel-guide/budget/travel-guide-budget.service';
import {
  createEmptySectionStatuses,
  resolveGenerationStatus,
} from '@src/modules/travel-guide/types/plan-generation-context';

describe('travel-guide architecture layers', () => {
  describe('normalizeFlightOptionsFromQuote', () => {
    it('normalizes structured flight offers', () => {
      const quote: FlightQuoteSnapshot = {
        fromCityCode: 'PVG',
        toCityCode: 'SZX',
        outboundDate: '2026-06-12',
        currency: 'CNY',
        minPricePerAdult: 1200,
        maxPricePerAdult: 1500,
        sampleLines: ['PVG→SZX'],
        flightOffers: [
          {
            pricePerAdult: 1200,
            currency: 'CNY',
            outbound: {
              route: 'PVG-SZX',
              depTime: '2026-06-12T08:00:00',
              arrTime: '2026-06-12T10:30:00',
              stopsLabel: '直飞',
              flightNumbers: ['MU123'],
            },
          },
        ],
        fetchedAt: new Date().toISOString(),
        source: 'rollinggo',
      };

      const options = normalizeFlightOptionsFromQuote(quote);
      expect(options).toHaveLength(1);
      expect(options[0]?.originAirportCode).toBe('PVG');
      expect(options[0]?.stops).toBe(0);
      expect(options[0]?.price.amount).toBe(1200);
      expect(dedupeNormalizedFlights([...options, ...options])).toHaveLength(1);
    });
  });

  describe('FlightSearchService.fromEnrichment', () => {
    it('returns empty when enrichment missing', () => {
      const service = new FlightSearchService();
      expect(service.fromEnrichment(null)).toEqual([]);
    });
  });

  describe('FlightRecommendationService', () => {
    it('scores cheapest and fastest categories with weighted formula', () => {
      const service = new FlightRecommendationService();
      const result = service.recommend([
        {
          id: 'a',
          provider: 'rollinggo',
          originAirportCode: 'PVG',
          destinationAirportCode: 'SZX',
          departureAt: '2026-06-12T08:00:00',
          arrivalAt: '2026-06-12T11:00:00',
          durationMinutes: 180,
          stops: 0,
          airlines: ['MU'],
          price: { amount: 900, currency: 'CNY' },
        },
        {
          id: 'b',
          provider: 'rollinggo',
          originAirportCode: 'PVG',
          destinationAirportCode: 'SZX',
          departureAt: '2026-06-12T09:00:00',
          arrivalAt: '2026-06-12T10:30:00',
          durationMinutes: 90,
          stops: 1,
          airlines: ['CA'],
          price: { amount: 1400, currency: 'CNY' },
        },
      ]);

      expect(result.cheapest?.optionId).toBe('a');
      expect(result.fastest?.optionId).toBe('b');
      expect(result.bestOverall?.reasonCodes.length).toBeGreaterThan(0);
      expect(result.ranked.length).toBeLessThanOrEqual(3);
    });
  });

  describe('HotelRecommendationService', () => {
    it('returns at most four category picks', () => {
      const service = new HotelRecommendationService();
      const hotels: NormalizedHotelOption[] = [
        {
          id: 'near',
          provider: 'amap',
          name: 'Near Hotel',
          distanceToFestivalKm: 0.5,
          reviewScore: 4.2,
          starRating: 3,
          price: { nightlyAmount: 400, totalAmount: 800, currency: 'CNY' },
        },
        {
          id: 'lux',
          provider: 'amap',
          name: 'Lux Hotel',
          distanceToFestivalKm: 3,
          reviewScore: 4.8,
          starRating: 5,
          price: { nightlyAmount: 900, totalAmount: 1800, currency: 'CNY' },
        },
        {
          id: 'mid',
          provider: 'amap',
          name: 'Mid Hotel',
          distanceToFestivalKm: 1.2,
          reviewScore: 4.5,
          starRating: 4,
          price: { nightlyAmount: 520, totalAmount: 1040, currency: 'CNY' },
        },
        {
          id: 'far',
          provider: 'amap',
          name: 'Far Hotel',
          distanceToFestivalKm: 8,
          reviewScore: 3.9,
          starRating: 3,
          price: { nightlyAmount: 280, totalAmount: 560, currency: 'CNY' },
        },
        {
          id: 'extra',
          provider: 'amap',
          name: 'Extra Hotel',
          distanceToFestivalKm: 4,
          reviewScore: 4.1,
          starRating: 4,
          price: { nightlyAmount: 600, totalAmount: 1200, currency: 'CNY' },
        },
      ];

      const result = service.recommend(hotels);
      expect(result.closestPracticalStay?.optionId).toBe('near');
      expect(result.premium?.optionId).toBe('lux');
      expect(result.ranked.length).toBeLessThanOrEqual(4);
      expect(result.bestOverall).toBeDefined();
      expect(result.bestValue).toBeDefined();
    });
  });

  describe('TravelGuideBudgetService', () => {
    it('maps economy/standard/comfort to budget aliases', () => {
      const service = new TravelGuideBudgetService();
      const summary = service.summarizeFromPlan(
        {
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
          budget: {
            title: '预算',
            items: [
              { label: '机票（往返）', range: '约 ¥1000–2000' },
              { label: '住宿', range: '约 ¥800–1200' },
              { label: '合计参考（全员）', range: '约 ¥1800–3200' },
            ],
          },
        },
        'standard',
      );

      expect(summary.tierAlias).toBe('balanced');
      expect(summary.flight).toEqual({ min: 1000, max: 2000 });
      expect(summary.hotel).toEqual({ min: 800, max: 1200 });
      expect(summary.total).toEqual({ min: 1800, max: 3200 });
    });

    it('buildFromSelected overrides flight/hotel with selected prices', () => {
      const service = new TravelGuideBudgetService();
      const breakdown = service.buildFromSelected({
        budgetTier: 'standard',
        headcount: 2,
        accommodationNights: 2,
        interCity: true,
        regionKind: 'domestic',
        selfDrive: false,
        selected: {
          flight: {
            id: 'f1',
            provider: 'rollinggo',
            originAirportCode: 'PVG',
            destinationAirportCode: 'SZX',
            departureAt: '2026-06-12T08:00:00',
            arrivalAt: '2026-06-12T10:00:00',
            durationMinutes: 120,
            stops: 0,
            airlines: ['MU'],
            price: { amount: 1234, currency: 'CNY' },
          },
          hotel: {
            id: 'h1',
            provider: 'amap',
            name: 'Near',
            price: {
              nightlyAmount: 500,
              totalAmount: 1000,
              currency: 'CNY',
            },
          },
        },
      });

      expect(
        breakdown.items.find((i) => i.label.includes('机票'))?.range,
      ).toContain('2468');
      expect(
        breakdown.items.find((i) => i.label.startsWith('住宿'))?.range,
      ).toContain('1000');
    });
  });

  describe('partial generation status', () => {
    it('marks partial when some sections fail and others succeed', () => {
      const sections = createEmptySectionStatuses();
      sections.flights = 'ready';
      sections.hotels = 'failed';
      sections.tickets = 'unavailable';
      sections.pois = 'ready';
      sections.itinerary = 'ready';
      sections.budget = 'ready';
      expect(resolveGenerationStatus(sections)).toBe('partial');
    });
  });
});
