import { buildTravelQuoteQuery } from '@src/modules/travel-guide/domain/travel-guide-quote.util';
import { FlightRecommendationService } from '@src/modules/travel-guide/recommendation/flight-recommendation.service';
import { HotelRecommendationService } from '@src/modules/travel-guide/recommendation/hotel-recommendation.service';
import { filterFlightsForFestivalWindow } from '@src/modules/travel-guide/search/flight-search.service';

describe('date-aware Raven travel recommendations', () => {
  const dto = {
    departure: 'Shanghai',
    departureDate: '2026-07-16',
    returnDate: '2026-07-21',
    headcount: 1,
  };

  it('passes the selected travel window to the existing quote query', () => {
    const query = buildTravelQuoteQuery(
      {
        legacyId: 1,
        name: 'Festival',
        location: 'Boom, Belgium',
        region: '海外',
      } as never,
      dto,
      {
        interCity: true,
        venue: { title: 'De Schorre', address: 'Boom' },
      } as never,
      5,
    );

    expect(query).toMatchObject({
      departureText: 'Shanghai',
      destinationCity: 'Boom',
      outboundDate: '2026-07-16',
      returnDate: '2026-07-21',
    });
  });

  it('removes unpriced, late-arriving, and early-returning flights before ranking', () => {
    const valid = {
      id: 'valid',
      provider: 'test',
      originAirportCode: 'PVG',
      destinationAirportCode: 'BRU',
      departureAt: '2026-07-16T10:00:00Z',
      arrivalAt: '2026-07-17T08:00:00Z',
      returnDepartureAt: '2026-07-20T12:00:00Z',
      durationMinutes: 600,
      stops: 0,
      airlines: [],
      price: { amount: 1000, currency: 'USD' as const },
    };
    const result = filterFlightsForFestivalWindow(
      [
        valid,
        {
          ...valid,
          id: 'no-price',
          price: { amount: 0, currency: 'USD' as const },
        },
        { ...valid, id: 'late', arrivalAt: '2026-07-19T08:00:00Z' },
        {
          ...valid,
          id: 'early-return',
          returnDepartureAt: '2026-07-18T08:00:00Z',
        },
      ],
      '07/18-20',
    );

    expect(result.map((flight) => flight.id)).toEqual(['valid']);
  });

  it('uses only the requested flight and hotel ranking factors', () => {
    const flight = new FlightRecommendationService().recommend([
      {
        id: 'cheap',
        provider: 'test',
        originAirportCode: 'PVG',
        destinationAirportCode: 'BRU',
        departureAt: '2026-07-16T08:00:00Z',
        arrivalAt: '2026-07-16T19:00:00Z',
        durationMinutes: 660,
        stops: 1,
        airlines: [],
        price: { amount: 500, currency: 'USD' as const },
      },
      {
        id: 'fast',
        provider: 'test',
        originAirportCode: 'PVG',
        destinationAirportCode: 'BRU',
        departureAt: '2026-07-16T08:00:00Z',
        arrivalAt: '2026-07-16T14:00:00Z',
        durationMinutes: 360,
        stops: 0,
        airlines: [],
        price: { amount: 900, currency: 'USD' as const },
      },
    ]);
    expect(flight.bestOverall?.optionId).toBe('cheap');

    const hotel = new HotelRecommendationService().recommend([
      {
        id: 'value',
        provider: 'test',
        name: 'Value',
        reviewScore: 4,
        distanceToFestivalKm: 3,
        price: { totalAmount: 400, currency: 'USD' as const },
      },
      {
        id: 'nearby',
        provider: 'test',
        name: 'Nearby',
        reviewScore: 5,
        distanceToFestivalKm: 0.5,
        price: { totalAmount: 900, currency: 'USD' as const },
      },
    ]);
    expect(hotel.bestOverall?.optionId).toBe('value');
  });
});
