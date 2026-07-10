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

  it('resolves domestic airports via known city IATA codes', async () => {
    const searchAirports = jest.fn().mockResolvedValue([]);
    const searchFlightsDetailed = jest.fn().mockResolvedValue({
      offers: [{ totalAdultPrice: 1200, currency: 'CNY' }],
    });
    const adapter = createAdapter({ searchAirports, searchFlightsDetailed });

    const result = await adapter.fetchFlightQuoteForTier(query, 'standard');

    expect(result?.fromCityCode).toBe('PVG');
    expect(result?.toCityCode).toBe('SZX');
    expect(searchAirports).not.toHaveBeenCalled();
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
