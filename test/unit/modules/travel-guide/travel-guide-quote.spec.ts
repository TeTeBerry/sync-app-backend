import { applyTravelQuoteEnrichment } from '@src/modules/travel-guide/domain/travel-guide-quote-merge.util';
import { resolveTravelGuideQuoteDates } from '@src/modules/travel-guide/domain/travel-guide-quote-dates.util';
import {
  buildTravelQuoteQuery,
  flightBudgetLabel,
  flightBudgetLabelForQuote,
} from '@src/modules/travel-guide/domain/travel-guide-quote.util';
import {
  extractCnyPrices,
  normalizeAirportRecords,
  normalizeFlightRecords,
  normalizeHotelRecords,
  pickCityCode,
  summarizeFlightOffers,
  summarizeHotelOffers,
} from '@src/modules/travel-guide/infra/rollinggo/rollinggo-mcp.client';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';

describe('travel-guide-quote-dates.util', () => {
  it('parses festival range into outbound/return', () => {
    const dates = resolveTravelGuideQuoteDates('06/13-14', 2);
    expect(dates.outboundDate).toMatch(/-06-12$/);
    expect(dates.returnDate).toMatch(/-06-15$/);
  });

  it('parses S2O Korea dates for RollingGo quote window', () => {
    const dates = resolveTravelGuideQuoteDates('07/11-12', 2);
    expect(dates.outboundDate).toMatch(/-07-10$/);
    expect(dates.returnDate).toMatch(/-07-13$/);
  });
});

describe('travel-guide-quote.util', () => {
  it('buildTravelQuoteQuery accepts cross-city departure hint when mapCtx.interCity is false', () => {
    const query = buildTravelQuoteQuery(
      {
        date: '06/13-14',
        location: '深圳·国际会展中心',
        name: 'Storm',
        region: 'domestic',
        code: 'storm',
      },
      {
        departure: '上海虹桥',
        headcount: 2,
        budgetTier: 'standard',
        selfDrive: false,
      },
      {
        venue: {
          title: '深圳国际会展中心',
          address: '宝安区',
          lat: 22.7,
          lng: 113.9,
        },
        venueReadableAddress: '深圳宝安',
        venueSource: 'hot_path',
        transportSource: 'hot_path',
        transportHints: [],
        interCity: false,
        pois: [],
        eventEndHour: 23.5,
        collectedAt: new Date().toISOString(),
      },
      2,
    );
    expect(query).not.toBeNull();
    expect(query?.destinationCity).toBe('深圳');
    expect(query?.departureText).toBe('上海虹桥');
  });

  it('buildTravelQuoteQuery returns null for same-city domestic trip', () => {
    const query = buildTravelQuoteQuery(
      {
        date: '06/13-14',
        location: '深圳·国际会展中心',
        name: 'Storm',
        region: 'domestic',
        code: 'storm',
      },
      {
        departure: '深圳北站',
        headcount: 2,
        budgetTier: 'standard',
        selfDrive: false,
      },
      {
        venue: {
          title: '深圳国际会展中心',
          address: '宝安区',
          lat: 22.7,
          lng: 113.9,
        },
        venueReadableAddress: '深圳宝安',
        venueSource: 'hot_path',
        transportSource: 'hot_path',
        transportHints: [],
        interCity: false,
        pois: [],
        eventEndHour: 23.5,
        collectedAt: new Date().toISOString(),
      },
      2,
    );
    expect(query).toBeNull();
  });

  it('buildTravelQuoteQuery always runs for overseas catalog festivals', () => {
    const query = buildTravelQuoteQuery(
      {
        legacyId: 8,
        date: '10/03-04',
        location: '仁川 Inspire Entertainment Resort',
        area: '韩国',
        name: 'EDC Korea 2026',
        region: 'overseas',
        code: 'edc-korea',
      },
      {
        departure: '深圳',
        headcount: 2,
        budgetTier: 'standard',
        selfDrive: false,
      },
      {
        venue: {
          title: 'Inspire Entertainment Resort',
          address: 'Incheon, South Korea',
          lat: 37.47,
          lng: 126.39,
        },
        venueReadableAddress: '韩国仁川·Inspire Entertainment Resort',
        venueSource: 'hot_path',
        transportSource: 'hot_path',
        transportHints: [],
        interCity: false,
        pois: [],
        eventEndHour: 23.5,
        collectedAt: new Date().toISOString(),
      },
      2,
    );

    expect(query).not.toBeNull();
    expect(query?.destinationCity).toBe('仁川');
    expect(query?.activityLegacyId).toBe(8);
    expect(query?.activityArea).toBe('韩国');
  });

  it('flightBudgetLabel varies by region', () => {
    expect(flightBudgetLabel('overseas')).toBe('机票（往返）');
    expect(flightBudgetLabel('domestic')).toBe('城际交通（高铁/机票）');
  });

  it('flightBudgetLabelForQuote uses flight label when RollingGo route exists', () => {
    expect(
      flightBudgetLabelForQuote('domestic', {
        fromCityCode: 'PVG',
        toCityCode: 'SZX',
      }),
    ).toBe('机票（往返）');
  });
});

describe('rollinggo-mcp.client helpers', () => {
  it('extractCnyPrices parses yuan strings', () => {
    expect(extractCnyPrices('价格 ¥2,869 与 ¥5,341')).toEqual([2869, 5341]);
  });

  it('pickCityCode prefers airport records', () => {
    expect(
      pickCityCode([
        { subType: 'CITY', iataCode: 'HGH', cityCode: 'HGH' },
        { subType: 'AIRPORT', iataCode: 'HGH', cityCode: 'HGH' },
      ]),
    ).toBe('HGH');
  });

  it('normalizeFlightRecords parses RollingGo flightInformationList', () => {
    const offers = normalizeFlightRecords({
      success: true,
      flightInformationList: [
        {
          totalAdultPrice: 2869,
          currency: 'CNY',
          fromSegments: [
            {
              flightNumber: 'CA1741',
              depAirport: 'SZX',
              arrAirport: 'CTU',
            },
          ],
        },
      ],
    });
    const summary = summarizeFlightOffers(offers);
    expect(summary.min).toBe(2869);
    expect(summary.sampleLines[0]).toContain('SZX');
  });

  it('normalizeAirportRecords parses airPortInformationList', () => {
    const airports = normalizeAirportRecords({
      airPortInformationList: [
        { airportCode: 'SZX', airportName: '宝安机场', cityCode: 'SZX' },
      ],
    });
    expect(pickCityCode(airports)).toBe('SZX');
  });

  it('summarizeFlightOffers builds sample lines', () => {
    const summary = summarizeFlightOffers([
      {
        price: '¥2869 CNY',
        itineraries: [
          {
            segments: 'HGH → CTU',
            stops: 'Non-stop',
          },
        ],
      },
    ]);
    expect(summary.min).toBe(2869);
    expect(summary.sampleLines[0]).toContain('HGH → CTU');
  });

  it('normalizeHotelRecords reads nested price.lowestPrice', () => {
    const hotels = normalizeHotelRecords({
      hotelInformationList: [
        {
          hotelId: 47691,
          name: '深圳华强广场酒店',
          starRating: 5,
          price: {
            message: '查价成功。最低价格：1,200，币种：CNY',
            lowestPrice: 1200,
            currency: 'CNY',
          },
        },
        {
          hotelId: 99999,
          name: '另一家',
          price: { lowestPrice: 880, currency: 'CNY' },
        },
      ],
    });
    const summary = summarizeHotelOffers(hotels, '');
    expect(summary.min).toBe(880);
    expect(summary.max).toBe(1200);
    expect(summary.max).toBeLessThan(10_000);
  });

  it('summarizeHotelOffers ignores hotelId and coordinates from JSON fallback', () => {
    const hotels = normalizeHotelRecords({
      hotelInformationList: [
        {
          hotelId: 47691,
          latitude: 22.543918,
          name: '无价格酒店',
        },
      ],
    });
    const summary = summarizeHotelOffers(
      hotels,
      JSON.stringify({ hotelId: 47691, destinationId: '553248621532753971' }),
    );
    expect(summary.min).toBe(0);
    expect(summary.max).toBe(0);
  });
});

describe('travel-guide-quote-merge.util', () => {
  const basePlan: TravelGuidePlan = {
    activityName: 'EDC',
    venue: '曼谷',
    eventDates: '12/11-13',
    departure: '深圳',
    headcount: 2,
    budgetLabel: '舒适',
    accommodationNights: 2,
    selfDrive: false,
    transport: { title: '交通', lines: ['现有文案'] },
    accommodation: { title: '住宿', hotels: [] },
    nightlife: { title: '散场', spots: [] },
    tips: { title: '提示', items: [] },
    budget: {
      title: '预算',
      items: [
        { label: '机票（往返）', range: '约 ¥3600–11000' },
        { label: '住宿', range: '约 ¥1200–2400' },
        { label: '门票', range: '约 ¥1600–4400' },
        { label: '合计参考（全员）', range: '约 ¥10000' },
      ],
    },
  };

  it('applyTravelQuoteEnrichment updates flight/hotel budget and transport', () => {
    const plan = applyTravelQuoteEnrichment(
      basePlan,
      {
        flight: {
          fromCityCode: 'SZX',
          toCityCode: 'BKK',
          outboundDate: '2026-12-10',
          returnDate: '2026-12-14',
          currency: 'CNY',
          minPricePerAdult: 2000,
          maxPricePerAdult: 3500,
          sampleLines: ['MU123 SZX→BKK · 直飞 · 约 ¥2000/人'],
          fetchedAt: '2026-06-29T00:00:00.000Z',
          source: 'rollinggo',
        },
        hotel: {
          minPricePerNight: 400,
          maxPricePerNight: 700,
          currency: 'CNY',
          sampleCount: 5,
          fetchedAt: '2026-06-29T00:00:00.000Z',
          source: 'rollinggo',
        },
      },
      {
        headcount: 2,
        accommodationNights: 2,
        regionKind: 'overseas',
        interCity: true,
      },
    );

    expect(plan.transport.lines.some((l) => l.includes('SZX→BKK'))).toBe(true);
    expect(plan.budget?.items[0]?.label).toBe('机票（往返） · SZX→BKK');
    expect(plan.budget?.items[0]?.range).toBe('约 ¥4000–7000');
    expect(plan.budget?.items[0]?.note).toContain('约 ¥2000–3500/人');
    expect(plan.budget?.items[0]?.details?.length).toBeGreaterThan(0);
    expect(plan.budget?.items.find((i) => i.label === '住宿')?.range).toBe(
      '约 ¥1000–1200',
    );
  });

  it('applyTravelQuoteEnrichment replaces overseas hotels with RollingGo list', () => {
    const plan = applyTravelQuoteEnrichment(
      basePlan,
      {
        flight: {
          fromCityCode: 'SZX',
          toCityCode: 'BKK',
          outboundDate: '2026-12-10',
          returnDate: '2026-12-14',
          currency: 'CNY',
          minPricePerAdult: 2000,
          maxPricePerAdult: 3500,
          sampleLines: ['参考航班：SZX → BKK 约 ¥2000 起'],
          fetchedAt: '2026-06-29T00:00:00.000Z',
          source: 'rollinggo',
        },
        hotel: {
          minPricePerNight: 400,
          maxPricePerNight: 700,
          currency: 'USD',
          sampleCount: 3,
          fetchedAt: '2026-06-29T00:00:00.000Z',
          source: 'rollinggo',
          recommendations: [
            {
              name: 'Bangkok Riverside Hotel',
              address: 'Riverside',
              minPricePerNight: 400,
              starRating: 5,
              bookingUrl: 'https://rollinggo.cn/pages/hotel/detail/1',
            },
            {
              name: 'Sukhumvit Stay',
              minPricePerNight: 280,
              starRating: 4,
            },
          ],
        },
      },
      {
        headcount: 2,
        accommodationNights: 2,
        regionKind: 'overseas',
        interCity: true,
      },
    );

    expect(plan.accommodation.title).toContain('RollingGo');
    expect(plan.accommodation.hotels[0]?.name).toBe('Bangkok Riverside Hotel');
    expect(plan.accommodation.hotels[0]?.note).toContain('$400');
    expect(plan.accommodation.hotels[0]?.bookingHint).toContain('RollingGo');
    expect(plan.accommodation.schemes?.[0]?.name).toBe(
      'Bangkok Riverside Hotel',
    );
  });

  it('applyTravelQuoteEnrichment dedupes static flight template when RollingGo applies', () => {
    const planWithDuplicateFlights: TravelGuidePlan = {
      ...basePlan,
      budget: {
        title: '预算',
        items: [
          {
            label: '机票（往返） · WUH→ICN',
            range: '约 ¥3568–19132',
            note: 'RollingGo 实时查询',
            details: ['CX907 HKG→ICN · 经停 · 约 ¥2774/人'],
          },
          {
            label: '机票（往返）',
            range: '约 ¥3600–11000',
            note: '视出发城市、购票时间与舱位浮动，建议提前 2–8 周关注。',
          },
          { label: '住宿', range: '约 ¥1200–2400' },
          { label: '合计参考（全员）', range: '约 ¥10000' },
        ],
      },
    };

    const plan = applyTravelQuoteEnrichment(
      planWithDuplicateFlights,
      {
        flight: {
          fromCityCode: 'WUH',
          toCityCode: 'ICN',
          outboundDate: '2026-07-10',
          returnDate: '2026-07-13',
          currency: 'CNY',
          minPricePerAdult: 1784,
          maxPricePerAdult: 9566,
          sampleLines: ['CX907 HKG→ICN · 经停 · 约 ¥2774/人'],
          fetchedAt: '2026-06-29T00:00:00.000Z',
          source: 'rollinggo',
        },
      },
      {
        headcount: 2,
        accommodationNights: 2,
        regionKind: 'overseas',
        interCity: true,
      },
    );

    const flightItems =
      plan.budget?.items.filter((item) => item.label.includes('机票')) ?? [];
    expect(flightItems).toHaveLength(1);
    expect(flightItems[0]?.label).toContain('WUH→ICN');
    expect(flightItems[0]?.note).not.toContain('视出发城市');
  });

  it('applyTravelQuoteEnrichment attaches dynamic budget tier snapshots', () => {
    const plan = applyTravelQuoteEnrichment(
      basePlan,
      {
        hotel: {
          minPricePerNight: 320,
          maxPricePerNight: 820,
          currency: 'CNY',
          sampleCount: 4,
          fetchedAt: '2026-06-29T00:00:00.000Z',
          source: 'rollinggo',
          recommendations: [
            { name: 'Hotel A', minPricePerNight: 320 },
            { name: 'Hotel B', minPricePerNight: 450 },
            { name: 'Hotel C', minPricePerNight: 680 },
            { name: 'Hotel D', minPricePerNight: 820 },
          ],
        },
      },
      {
        headcount: 2,
        accommodationNights: 2,
        regionKind: 'overseas',
        interCity: true,
        budgetTier: 'standard',
      },
    );

    expect(plan.budgetTierSnapshots).toHaveLength(3);
    expect(plan.budgetTierSnapshots?.[1]?.tier).toBe('standard');
  });
});
