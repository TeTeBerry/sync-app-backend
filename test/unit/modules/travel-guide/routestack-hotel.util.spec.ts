import {
  buildRouteStackDestinationQueries,
  buildRouteStackDestinationQuery,
  buildRouteStackRooms,
  enrichRouteStackHotelFromDetails,
  normalizeRouteStackHotels,
  pickRouteStackDestination,
  rankRouteStackHotelsForStayPreference,
} from '@src/modules/travel-guide/infra/routestack/routestack-hotel.util';
import type { RouteStackDestinationItem } from '@src/modules/travel-guide/infra/routestack/routestack.types';

describe('routestack-hotel.util', () => {
  describe('buildRouteStackDestinationQuery', () => {
    it('prefers destination city over venue title', () => {
      expect(
        buildRouteStackDestinationQuery({
          destinationCity: 'Antwerp',
          venueTitle: 'Festival Park',
        }),
      ).toBe('Antwerp');
    });

    it('maps Boom venue to Antwerp hotel hub when city is empty', () => {
      expect(
        buildRouteStackDestinationQuery({
          destinationCity: '  ',
          venueTitle: 'Boom, Belgium',
        }),
      ).toBe('Antwerp');
    });

    it('translates known Chinese cities to English for RouteStack', () => {
      expect(
        buildRouteStackDestinationQuery({
          destinationCity: '安特卫普',
          activityLocation: '比利时·安特卫普',
        }),
      ).toBe('Antwerp');
    });

    it('prefers Latin venue title when city is Chinese-only', () => {
      expect(
        buildRouteStackDestinationQuery({
          destinationCity: '安特卫普',
          venueTitle: 'Sportpaleis Antwerp',
        }),
      ).toBe('Antwerp');
    });

    it('uses Latin venue when no city translation is available', () => {
      expect(
        buildRouteStackDestinationQuery({
          destinationCity: '',
          venueTitle: 'Sportpaleis Antwerp',
        }),
      ).toBe('Sportpaleis Antwerp');
    });

    it('prefers Antwerp hub over Boom (no RouteStack hotel inventory)', () => {
      expect(
        buildRouteStackDestinationQuery({
          destinationCity: 'Boom',
          activityArea: '比利时',
          activityLocation: '比利时·Boom',
        }),
      ).toBe('Antwerp');
    });
  });

  describe('buildRouteStackDestinationQueries', () => {
    it('lists town hubs before the tiny festival town, area hubs last', () => {
      expect(
        buildRouteStackDestinationQueries({
          destinationCity: 'Boom',
          activityArea: '比利时',
        }),
      ).toEqual(['Antwerp', 'Brussels', 'Boom', '比利时']);
    });

    it('prefers the festival city before country-area hubs (Phuket before Bangkok)', () => {
      expect(
        buildRouteStackDestinationQueries({
          destinationCity: 'Phuket',
          activityArea: '泰国',
        })[0],
      ).toBe('Phuket');
      expect(
        buildRouteStackDestinationQueries({
          destinationCity: 'Phuket',
          activityArea: '泰国',
        }),
      ).toEqual(['Phuket', '泰国', 'Bangkok', 'Pattaya']);
    });

    it('does not treat Ukraine as UK via substring match', () => {
      expect(
        buildRouteStackDestinationQueries({
          destinationCity: 'Kyiv',
          activityLocation: 'Ukraine',
        }),
      ).toEqual(['Kyiv', 'Ukraine']);
    });
  });

  describe('pickRouteStackDestination', () => {
    const destinations: RouteStackDestinationItem[] = [
      {
        id: 'airport',
        type: 'Airport',
        fullName: 'Antwerp Airport',
        lat: 51.1894,
        long: 4.4603,
      },
      {
        id: 'city',
        type: 'City',
        fullName: 'Antwerp, Belgium',
        lat: 51.2194,
        long: 4.4025,
      },
      {
        id: 'far-city',
        type: 'City',
        fullName: 'Brussels, Belgium',
        lat: 50.8503,
        long: 4.3517,
      },
    ];

    it('prefers City type near the venue', () => {
      const picked = pickRouteStackDestination(destinations, {
        lat: 51.22,
        lng: 4.4,
      });
      expect(picked?.id).toBe('city');
    });

    it('returns null for empty list', () => {
      expect(pickRouteStackDestination([])).toBeNull();
    });
  });

  describe('buildRouteStackRooms', () => {
    it('splits guests into rooms of up to 2 adults', () => {
      expect(buildRouteStackRooms(1)).toEqual([
        { adults: 1, children: 0, childAges: [] },
      ]);
      expect(buildRouteStackRooms(3)).toEqual([
        { adults: 2, children: 0, childAges: [] },
        { adults: 1, children: 0, childAges: [] },
      ]);
    });
  });

  describe('normalizeRouteStackHotels', () => {
    it('treats ourprice as stay-total and derives nightly', () => {
      const hotels = normalizeRouteStackHotels(
        [
          {
            id: 'h1',
            name: 'Docklands Hotel',
            starRating: 4,
            ourprice: 180,
            distance: 2.4,
            reviews: { rating: 8.6, count: 120 },
            contact: {
              address: {
                line1: '1 Quay',
                city: { name: 'Antwerp' },
                country: { name: 'Belgium' },
              },
            },
          },
        ],
        { accommodationNights: 2, currency: 'USD' },
      );

      expect(hotels).toHaveLength(1);
      expect(hotels[0]).toMatchObject({
        id: 'h1',
        provider: 'routestack',
        name: 'Docklands Hotel',
        starRating: 4,
        reviewScore: 8.6,
        distanceToFestivalKm: 2.4,
        address: '1 Quay, Antwerp, Belgium',
        price: {
          nightlyAmount: 90,
          totalAmount: 180,
          currency: 'USD',
        },
      });
    });
  });

  it('uses verified hotel details when ranking a city-oriented stay', () => {
    const cityHotel = enrichRouteStackHotelFromDetails(
      {
        id: 'city',
        provider: 'routestack',
        name: 'City Hotel',
        reviewScore: 4.2,
        price: { totalAmount: 160, nightlyAmount: 80, currency: 'USD' },
      },
      {
        result: {
          facilities: [{ name: 'Metro access' }, { name: 'Rooftop bar' }],
          description: 'In the centre of town',
        },
      },
    );
    const quietHotel = {
      id: 'quiet',
      provider: 'routestack',
      name: 'Quiet Hotel',
      reviewScore: 4.2,
      price: { totalAmount: 160, nightlyAmount: 80, currency: 'USD' as const },
    };

    expect(cityHotel.amenities).toEqual(['Metro access', 'Rooftop bar']);
    expect(cityHotel.description).toBe('In the centre of town');
    expect(
      rankRouteStackHotelsForStayPreference([quietHotel, cityHotel], 'city')[0]
        ?.id,
    ).toBe('city');
  });
});
