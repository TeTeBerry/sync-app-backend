import { RollingGoTravelQuoteAdapter } from '@src/modules/travel-guide/infra/rollinggo/rollinggo-travel-quote.adapter';
import { RollingGoMcpClient } from '@src/modules/travel-guide/infra/rollinggo/rollinggo-mcp.client';
import type { TravelQuoteQuery } from '@src/modules/travel-guide/ports/travel-quote.types';

describe('RollingGoTravelQuoteAdapter', () => {
  const query: TravelQuoteQuery = {
    departureText: '上海',
    destinationCity: '深圳',
    venueTitle: '国际会展中心',
    venueAddress: '宝安区',
    regionKind: 'domestic',
    interCity: true,
    headcount: 2,
    accommodationNights: 2,
    budgetTier: 'standard',
    outboundDate: '2026-06-12',
    returnDate: '2026-06-15',
    selfDrive: false,
  };

  function createAdapter(mocks: {
    searchAirports?: jest.Mock;
    searchFlightsDetailed?: jest.Mock;
    searchHotels?: jest.Mock;
    enabled?: boolean;
  }) {
    const rollingGo = {
      enabled: mocks.enabled ?? true,
      flightMcpUrl: 'https://mcp.rollinggo.cn/mcp/flight',
      searchAirports:
        mocks.searchAirports ??
        jest
          .fn()
          .mockResolvedValue([
            { iataCode: 'SZX', airportName: '深圳机场', subType: 'AIRPORT' },
          ]),
      searchFlightsDetailed:
        mocks.searchFlightsDetailed ??
        jest.fn().mockResolvedValue({ offers: [], message: 'none' }),
      searchHotels:
        mocks.searchHotels ??
        jest
          .fn()
          .mockResolvedValue([
            { minPrice: 300, maxPrice: 450, name: 'Hotel A' },
          ]),
    } as unknown as RollingGoMcpClient;

    return new RollingGoTravelQuoteAdapter(rollingGo);
  }

  it('tries fromCity/toCity first with metro city codes, then airports', async () => {
    const searchAirports = jest.fn().mockResolvedValue([]);
    const searchFlightsDetailed = jest.fn().mockResolvedValue({
      offers: [{ totalAdultPrice: 1200, currency: 'CNY' }],
    });
    const adapter = createAdapter({ searchAirports, searchFlightsDetailed });

    const result = await adapter.fetchFlightQuoteForTier(query, 'standard');

    // City mode wins first: Shanghai metro SHA, Shenzhen SZX.
    expect(result?.fromCityCode).toBe('SHA');
    expect(result?.toCityCode).toBe('SZX');
    expect(searchAirports).not.toHaveBeenCalled();
    const firstCall = searchFlightsDetailed.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(firstCall).toMatchObject({
      fromCity: 'SHA',
      toCity: 'SZX',
      adultNumber: 2,
      childNumber: 0,
      tripType: 'ROUND_TRIP',
    });
    expect(firstCall.fromAirport).toBeUndefined();
    expect(firstCall.toAirport).toBeUndefined();
  });

  it('falls back to fromAirport/toAirport when city codes return no offers', async () => {
    const searchAirports = jest.fn().mockResolvedValue([]);
    const searchFlightsDetailed = jest
      .fn()
      .mockImplementation(async (args: Record<string, unknown>) => {
        if (args.fromCity || args.toCity) {
          return { offers: [], message: 'none' };
        }
        if (args.fromAirport === 'PVG' && args.toAirport === 'SZX') {
          return {
            offers: [{ totalAdultPrice: 1300, currency: 'CNY' }],
          };
        }
        return { offers: [], message: 'none' };
      });
    const adapter = createAdapter({ searchAirports, searchFlightsDetailed });

    const result = await adapter.fetchFlightQuoteForTier(query, 'standard');

    expect(result?.minPricePerAdult).toBe(1300);
    expect(result?.fromCityCode).toBe('PVG');
    expect(result?.toCityCode).toBe('SZX');
    expect(
      searchFlightsDetailed.mock.calls.some(
        (call) =>
          (call[0] as { fromAirport?: string }).fromAirport === 'PVG' &&
          (call[0] as { toAirport?: string }).toAirport === 'SZX',
      ),
    ).toBe(true);
  });

  it('reuses probe-proven mode for tier search without re-trying city', async () => {
    const searchAirports = jest.fn().mockResolvedValue([]);
    const searchFlightsDetailed = jest
      .fn()
      .mockImplementation(async (args: Record<string, unknown>) => {
        if (args.fromCity || args.toCity) {
          return { offers: [], message: 'none' };
        }
        if (args.fromAirport === 'PVG' && args.toAirport === 'SZX') {
          return {
            offers: [{ totalAdultPrice: 1400, currency: 'CNY' }],
          };
        }
        return { offers: [], message: 'none' };
      });
    const adapter = createAdapter({ searchAirports, searchFlightsDetailed });

    await adapter.fetchFlightQuoteForTier(query, 'standard');

    const cityCalls = searchFlightsDetailed.mock.calls.filter(
      (call) =>
        (call[0] as { fromCity?: string }).fromCity != null ||
        (call[0] as { toCity?: string }).toCity != null,
    );
    const airportCalls = searchFlightsDetailed.mock.calls.filter(
      (call) =>
        (call[0] as { fromAirport?: string }).fromAirport === 'PVG' &&
        (call[0] as { toAirport?: string }).toAirport === 'SZX',
    );
    // Probe finds airport once; tier search reuses preferred airport mode.
    expect(cityCalls.length).toBe(1);
    expect(airportCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('uses Lost Lands Columbus city codes first without searching airports MCP', async () => {
    const searchAirports = jest
      .fn()
      .mockResolvedValue([
        { iataCode: 'LAX', cityCode: 'LAX', airportName: 'Los Angeles' },
      ]);
    const searchFlightsDetailed = jest.fn().mockResolvedValue({
      offers: [{ totalAdultPrice: 6800, currency: 'CNY' }],
    });
    const adapter = createAdapter({ searchAirports, searchFlightsDetailed });

    const result = await adapter.fetchFlightQuoteForTier(
      {
        ...query,
        destinationCity: '俄亥俄州',
        activityLegacyId: 19,
        activityName: 'Lost Lands 2026',
        activityArea: '美国',
        activityLocation: '美国·俄亥俄州 Legend Valley',
        regionKind: 'overseas',
        venueTitle: 'Legend Valley',
        venueAddress: 'Thornville, OH',
      },
      'standard',
    );

    expect(result?.fromCityCode).toBe('SHA');
    expect(result?.toCityCode).toBe('CMH');
    expect(searchAirports).not.toHaveBeenCalled();
    const firstCall = searchFlightsDetailed.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(firstCall.toCity).toBe('CMH');
    expect(firstCall.fromCity).toBe('SHA');
    expect(firstCall.toAirport).toBeUndefined();
  });

  it('falls back to alternate airport when primary has no offers', async () => {
    const searchAirports = jest.fn().mockResolvedValue([]);
    const searchFlightsDetailed = jest
      .fn()
      .mockImplementation(
        async (args: { toCity?: string; toAirport?: string }) => {
          const dest = args.toCity ?? args.toAirport;
          if (dest === 'CMH') {
            return { offers: [], message: 'none' };
          }
          if (dest === 'CLE') {
            return {
              offers: [{ totalAdultPrice: 7200, currency: 'CNY' }],
            };
          }
          return { offers: [], message: 'none' };
        },
      );
    const adapter = createAdapter({ searchAirports, searchFlightsDetailed });

    const result = await adapter.fetchFlightQuoteForTier(
      {
        ...query,
        destinationCity: '俄亥俄州',
        activityLegacyId: 19,
        activityName: 'Lost Lands 2026',
        activityArea: '美国',
        activityLocation: '美国·俄亥俄州 Legend Valley',
        regionKind: 'overseas',
        venueTitle: 'Legend Valley',
        venueAddress: 'Thornville, OH',
      },
      'standard',
    );

    expect(result?.toCityCode).toBe('CLE');
    expect(searchAirports).not.toHaveBeenCalled();
    const destinations = searchFlightsDetailed.mock.calls.map((call) => {
      const args = call[0] as { toCity?: string; toAirport?: string };
      return args.toCity ?? args.toAirport;
    });
    expect(destinations).toContain('CMH');
    expect(destinations).toContain('CLE');
  });

  it('fetchHotelQuoteForTier calls searchHotels once for a tier', async () => {
    const searchHotels = jest
      .fn()
      .mockResolvedValue([{ minPrice: 280, maxPrice: 420, name: 'Hotel B' }]);
    const adapter = createAdapter({ searchHotels });

    const quote = await adapter.fetchHotelQuoteForTier(query, 'comfort');

    expect(quote?.minPricePerNight).toBe(280);
    expect(searchHotels).toHaveBeenCalledTimes(1);
  });

  it('enrich fetches selected hotel tier on cold path', async () => {
    const searchHotels = jest
      .fn()
      .mockResolvedValue([{ minPrice: 300, maxPrice: 450, name: 'Hotel C' }]);
    const adapter = createAdapter({
      searchHotels,
      searchFlightsDetailed: jest.fn().mockResolvedValue({
        offers: [{ totalAdultPrice: 1200, currency: 'CNY' }],
      }),
    });

    await adapter.enrich(
      {
        date: '06/13-14',
        location: '深圳',
        name: 'Storm',
        region: 'domestic',
      },
      {
        departure: '上海',
        headcount: 2,
        budgetTier: 'standard',
        selfDrive: false,
      },
      {
        venue: { title: '深圳', address: '深圳', lat: 22.7, lng: 113.9 },
        venueReadableAddress: '深圳',
        venueSource: 'api',
        transportSource: 'api',
        transportHints: [],
        interCity: true,
        pois: [],
        eventEndHour: 23.5,
        collectedAt: new Date().toISOString(),
      },
      2,
    );

    expect(searchHotels).toHaveBeenCalledTimes(1);
  });
});
