import {
  buildFlightOfferItinerary,
  buildTravelGuideFlightOffer,
  describeFlightLegStops,
  formatFlightLegRoute,
  formatFlightOfferSampleLine,
  isOutboundDirect,
} from '@src/modules/travel-guide/domain/travel-guide-flight-itinerary.util';
import {
  normalizeFlightRecords,
  summarizeFlightOffers,
} from '@src/modules/travel-guide/infra/rollinggo/rollinggo-mcp.client';

describe('travel-guide-flight-itinerary.util', () => {
  it('formatFlightLegRoute collapses multi-segment legs into airport chain', () => {
    expect(
      formatFlightLegRoute([
        { flightNumber: 'JL894', depAirport: 'PVG', arrAirport: 'KIX' },
        { flightNumber: 'JL228', depAirport: 'KIX', arrAirport: 'HND' },
      ]),
    ).toBe('PVG→KIX→HND');
  });

  it('describeFlightLegStops labels transfers per leg only', () => {
    expect(
      describeFlightLegStops([{ depAirport: 'PVG', arrAirport: 'HND' }]),
    ).toBe('直飞');
    expect(
      describeFlightLegStops(
        [
          { depAirport: 'PVG', arrAirport: 'KIX' },
          { depAirport: 'KIX', arrAirport: 'HND' },
        ],
        'en',
      ),
    ).toBe('1 stop');
  });

  it('formatFlightOfferSampleLine includes segment times when available', () => {
    const line = formatFlightOfferSampleLine({
      fromSegments: [
        {
          flightNumber: 'JL879',
          depAirport: 'PVG',
          arrAirport: 'HND',
          depTime: '2026-07-04 09:30',
          arrTime: '2026-07-04 13:15',
        },
      ],
      retSegments: [
        {
          flightNumber: 'JL876',
          depAirport: 'HND',
          arrAirport: 'PVG',
          depTime: '2026-07-06 15:40',
          arrTime: '2026-07-06 18:50',
        },
      ],
      priceLabel: '¥3706',
    });

    expect(line).toContain('09:30');
    expect(line).toContain('13:15');
    expect(line).toContain('15:40');
    expect(line).toContain('18:50');
    expect(line).toContain('约 ¥3706/人');
  });

  it('buildTravelGuideFlightOffer exposes structured legs', () => {
    const offer = buildTravelGuideFlightOffer({
      fromSegments: [
        {
          flightNumber: 'MU521',
          depAirport: 'PVG',
          arrAirport: 'HND',
          depTime: '202607040930',
          arrTime: '202607041315',
        },
      ],
      retSegments: [{ depAirport: 'HND', arrAirport: 'PVG' }],
      pricePerAdult: 3706,
      currency: 'CNY',
    });

    expect(offer).toMatchObject({
      pricePerAdult: 3706,
      currency: 'CNY',
      outbound: {
        route: 'PVG→HND',
        depTime: '09:30',
        arrTime: '13:15',
        stopsLabel: '直飞',
        flightNumbers: ['MU521'],
      },
    });
  });
});

describe('normalizeFlightRecords flight itinerary', () => {
  it('builds structured outbound/return metadata', () => {
    const offers = normalizeFlightRecords({
      flightInformationList: [
        {
          totalAdultPrice: 3200,
          currency: 'CNY',
          fromSegments: [{ depAirport: 'PVG', arrAirport: 'HND' }],
          retSegments: [{ depAirport: 'HND', arrAirport: 'PVG' }],
        },
      ],
    });

    expect(offers[0]?.itineraries?.[0]).toMatchObject({
      outboundRoute: 'PVG→HND',
      returnRoute: 'HND→PVG',
      outboundStops: '直飞',
      returnStops: '直飞',
      isOutboundDirect: true,
    });
    expect(isOutboundDirect(offers[0]?.fromSegments)).toBe(true);
  });
});

describe('summarizeFlightOffers ranking', () => {
  it('prefers outbound direct flights for sample lines', () => {
    const summary = summarizeFlightOffers(
      [
        {
          totalAdultPrice: 4821,
          currency: 'CNY',
          fromSegments: [
            { depAirport: 'PVG', arrAirport: 'KIX' },
            { depAirport: 'KIX', arrAirport: 'HND' },
          ],
          retSegments: [{ depAirport: 'KIX', arrAirport: 'PVG' }],
        },
        {
          totalAdultPrice: 5200,
          currency: 'CNY',
          fromSegments: [{ depAirport: 'PVG', arrAirport: 'HND' }],
          retSegments: [{ depAirport: 'HND', arrAirport: 'PVG' }],
        },
      ],
      2,
    );

    expect(summary.min).toBe(4821);
    expect(summary.max).toBe(5200);
    expect(summary.sampleLines[0]).toContain('去程 PVG→HND（直飞）');
    expect(summary.sampleLines[1]).toContain('1次中转');
    expect(summary.flightOffers[0]).toMatchObject({
      pricePerAdult: 5200,
      outbound: { route: 'PVG→HND', stopsLabel: '直飞' },
    });
  });

  it('keeps EN sample lines free of Chinese stop labels', () => {
    const summary = summarizeFlightOffers(
      [
        {
          price: '¥2869 CNY',
          itineraries: [
            {
              segments: 'HGH → CTU',
              stops: '直飞',
            },
          ],
        },
      ],
      2,
      'Economy',
      'en',
    );
    expect(summary.sampleLines[0]).toMatch(/HGH → CTU/);
    expect(summary.sampleLines[0]).toMatch(/Direct/);
    expect(summary.sampleLines[0]).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it('limits min/max to displayed flight offers only', () => {
    const summary = summarizeFlightOffers(
      [
        {
          totalAdultPrice: 13102,
          currency: 'CNY',
          fromSegments: [
            { depAirport: 'KMG', arrAirport: 'CAN' },
            { depAirport: 'CAN', arrAirport: 'HND' },
          ],
          retSegments: [{ depAirport: 'HND', arrAirport: 'KMG' }],
        },
        {
          totalAdultPrice: 3342,
          currency: 'CNY',
          fromSegments: [{ depAirport: 'KMG', arrAirport: 'HND' }],
          retSegments: [{ depAirport: 'HND', arrAirport: 'KMG' }],
        },
        {
          totalAdultPrice: 5297,
          currency: 'CNY',
          fromSegments: [
            { depAirport: 'KMG', arrAirport: 'PVG' },
            { depAirport: 'PVG', arrAirport: 'HND' },
          ],
          retSegments: [{ depAirport: 'HND', arrAirport: 'KMG' }],
        },
        {
          totalAdultPrice: 6000,
          currency: 'CNY',
          fromSegments: [{ depAirport: 'KMG', arrAirport: 'HND' }],
          retSegments: [{ depAirport: 'HND', arrAirport: 'KMG' }],
        },
      ],
      3,
    );

    expect(summary.min).toBe(3342);
    expect(summary.max).toBe(6000);
    expect(summary.max).toBeLessThan(13102);
  });
});

describe('buildFlightOfferItinerary', () => {
  it('marks connecting outbound as not direct', () => {
    const [itinerary] = buildFlightOfferItinerary(
      [
        { depAirport: 'PVG', arrAirport: 'KIX' },
        { depAirport: 'KIX', arrAirport: 'HND' },
      ],
      [{ depAirport: 'HND', arrAirport: 'PVG' }],
    );
    expect(itinerary.isOutboundDirect).toBe(false);
    expect(itinerary.outboundStops).toBe('1次中转');
  });
});
