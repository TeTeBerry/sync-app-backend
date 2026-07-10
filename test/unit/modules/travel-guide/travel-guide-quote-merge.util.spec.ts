import { applyTravelQuoteEnrichment } from '@src/modules/travel-guide/domain/travel-guide-quote-merge.util';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';

const basePlan: TravelGuidePlan = {
  activityName: 'Storm',
  venue: '深圳',
  eventDates: '06/13',
  departure: '上海',
  headcount: 2,
  budgetLabel: '舒适',
  accommodationNights: 2,
  selfDrive: false,
  transport: { title: '交通', lines: ['高铁参考'] },
  accommodation: { title: '住宿', hotels: [{ name: '酒店A', note: 'n' }] },
  nightlife: { title: '散场', spots: [{ name: '夜宵', note: 'n' }] },
  tips: { title: '提示', items: ['tip'] },
  budget: {
    title: '预算',
    items: [
      { label: '住宿', range: '约 ¥1000–2000' },
      { label: '合计参考（全员）', range: '约 ¥1000–2000' },
    ],
  },
};

describe('travel-guide-quote-merge.util', () => {
  it('applyTravelQuoteEnrichment applies RollingGo domestic flight quotes', () => {
    const enriched = applyTravelQuoteEnrichment(
      basePlan,
      {
        flight: {
          fromCityCode: 'PVG',
          toCityCode: 'SZX',
          outboundDate: '2026-06-12',
          returnDate: '2026-06-15',
          currency: 'CNY',
          minPricePerAdult: 680,
          maxPricePerAdult: 920,
          sampleLines: [],
          cabinLabel: '经济舱',
          fetchedAt: '2026-06-29T00:00:00.000Z',
          source: 'rollinggo',
          flightOffers: [
            {
              pricePerAdult: 680,
              currency: 'CNY',
              cabinLabel: '经济舱',
              outbound: { route: 'PVG→SZX', stopsLabel: '直飞' },
            },
          ],
        },
        flightByTier: {
          economy: {
            fromCityCode: 'PVG',
            toCityCode: 'SZX',
            outboundDate: '2026-06-12',
            returnDate: '2026-06-15',
            currency: 'CNY',
            minPricePerAdult: 680,
            maxPricePerAdult: 920,
            sampleLines: [],
            cabinLabel: '经济舱',
            fetchedAt: '2026-06-29T00:00:00.000Z',
            source: 'rollinggo',
          },
        },
      },
      {
        headcount: 2,
        accommodationNights: 2,
        regionKind: 'domestic',
        interCity: true,
        budgetTier: 'economy',
      },
    );

    expect(enriched.budget?.items[0]?.label).toBe('机票（往返） · PVG→SZX');
    expect(enriched.transport.flightOffers).toHaveLength(1);
    expect(enriched.transport.lines).toEqual(['高铁参考']);
    expect(enriched.flightByTier?.economy?.minPricePerAdult).toBe(680);
  });

  it('strips RollingGo flight sample lines from transport when flightOffers exist', () => {
    const sampleLine =
      '去程 KMG 23:30→HND 22:50（1次中转） · 返程 HND 02:00→KMG 22:10（1次中转） · 约 ¥3342/人';
    const enriched = applyTravelQuoteEnrichment(
      {
        ...basePlan,
        transport: { title: '交通', lines: ['建议从昆明搭乘国际航班飞往东京'] },
      },
      {
        flight: {
          fromCityCode: 'KMG',
          toCityCode: 'HND',
          outboundDate: '2026-07-04',
          returnDate: '2026-07-08',
          currency: 'CNY',
          minPricePerAdult: 3342,
          maxPricePerAdult: 5297,
          sampleLines: [sampleLine],
          cabinLabel: '经济舱',
          fetchedAt: '2026-06-29T00:00:00.000Z',
          source: 'rollinggo',
          flightOffers: [
            {
              pricePerAdult: 3342,
              currency: 'CNY',
              cabinLabel: '经济舱',
              outbound: {
                route: 'KMG→HND',
                depAirport: 'KMG',
                arrAirport: 'HND',
                depTime: '23:30',
                arrTime: '22:50',
                stopsLabel: '1次中转',
              },
              return: {
                route: 'HND→KMG',
                depAirport: 'HND',
                arrAirport: 'KMG',
                depTime: '02:00',
                arrTime: '22:10',
                stopsLabel: '1次中转',
              },
            },
          ],
        },
      },
      {
        headcount: 2,
        accommodationNights: 2,
        regionKind: 'overseas',
        interCity: true,
        budgetTier: 'economy',
      },
    );

    expect(enriched.transport.flightOffers).toHaveLength(1);
    expect(enriched.transport.lines.some((line) => line.includes('去程'))).toBe(
      false,
    );
    expect(enriched.transport.lines[0]).toContain('昆明');
  });

  it('writes quoteFetchedAt and quoteTierSources when hotel enrichment applies', () => {
    const enriched = applyTravelQuoteEnrichment(
      basePlan,
      {
        hotel: {
          minPricePerNight: 300,
          maxPricePerNight: 450,
          currency: 'CNY',
          sampleCount: 5,
          fetchedAt: '2026-06-29T00:00:00.000Z',
          source: 'rollinggo',
        },
        hotelByTier: {
          standard: {
            minPricePerNight: 300,
            maxPricePerNight: 450,
            currency: 'CNY',
            sampleCount: 5,
            fetchedAt: '2026-06-29T00:00:00.000Z',
            source: 'rollinggo',
          },
        },
      },
      {
        headcount: 2,
        accommodationNights: 2,
        regionKind: 'domestic',
        interCity: true,
        budgetTier: 'standard',
      },
    );

    expect(enriched.quoteFetchedAt).toBeDefined();
    expect(enriched.quoteTierSources?.standard).toBe('rollinggo');
    expect(enriched.budgetTierSnapshots).toHaveLength(3);
  });

  it('protect flags prevent overwriting authoritative flight/hotel/budget', () => {
    const authoritative: TravelGuidePlan = {
      ...basePlan,
      transport: {
        title: '交通',
        lines: ['SELECTED_FLIGHT_LINE'],
        flightOffers: [
          {
            pricePerAdult: 1100,
            currency: 'CNY',
            outbound: {
              route: 'PVG→SZX',
              stopsLabel: '直飞',
              depTime: '08:00',
              arrTime: '10:00',
            },
          },
        ],
      },
      accommodation: {
        title: '住宿',
        hotels: [{ name: 'Best Near', note: 'selected', reason: '综合推荐' }],
      },
      budget: {
        title: '预算',
        items: [{ label: '合计参考（全员）', range: '约 ¥5000' }],
      },
    };

    const enriched = applyTravelQuoteEnrichment(
      authoritative,
      {
        flight: {
          fromCityCode: 'PVG',
          toCityCode: 'SZX',
          outboundDate: '2026-06-12',
          currency: 'CNY',
          minPricePerAdult: 500,
          maxPricePerAdult: 600,
          sampleLines: ['LEGACY_OVERWRITE'],
          flightOffers: [
            {
              pricePerAdult: 500,
              currency: 'CNY',
              outbound: {
                route: 'PVG→SZX',
                stopsLabel: '直飞',
                depTime: '06:00',
                arrTime: '08:00',
              },
            },
          ],
          fetchedAt: '2026-06-29T00:00:00.000Z',
          source: 'rollinggo',
        },
        hotel: {
          minPricePerNight: 200,
          maxPricePerNight: 250,
          currency: 'CNY',
          sampleCount: 3,
          fetchedAt: '2026-06-29T00:00:00.000Z',
          source: 'rollinggo',
          recommendations: [{ name: 'Legacy Hotel', minPricePerNight: 200 }],
        },
        hotelByTier: {
          standard: {
            minPricePerNight: 200,
            maxPricePerNight: 250,
            currency: 'CNY',
            sampleCount: 3,
            fetchedAt: '2026-06-29T00:00:00.000Z',
            source: 'rollinggo',
            recommendations: [{ name: 'Legacy Hotel', minPricePerNight: 200 }],
          },
        },
      },
      {
        headcount: 2,
        accommodationNights: 2,
        regionKind: 'domestic',
        interCity: true,
        budgetTier: 'standard',
      },
      {
        selectedFlight: true,
        selectedHotel: true,
        budget: true,
      },
    );

    expect(enriched.transport.flightOffers?.[0]?.pricePerAdult).toBe(1100);
    expect(enriched.transport.lines[0]).toBe('SELECTED_FLIGHT_LINE');
    expect(enriched.accommodation.hotels[0]?.name).toBe('Best Near');
    expect(enriched.budget?.items[0]?.range).toBe('约 ¥5000');
  });
});
