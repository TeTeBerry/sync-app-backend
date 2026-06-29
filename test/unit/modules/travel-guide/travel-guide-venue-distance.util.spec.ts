import {
  formatVenueDistanceLabel,
  resolveHotelVenueDistanceM,
} from '@src/modules/travel-guide/domain/travel-guide-venue-distance.util';
import {
  buildRollingGoHotelRecommendations,
  normalizeHotelRecords,
} from '@src/modules/travel-guide/infra/rollinggo/rollinggo-mcp.client';
import { rollingGoHotelToGuideItem } from '@src/modules/travel-guide/domain/travel-guide-rollinggo-recommendations.util';

describe('travel-guide-venue-distance.util', () => {
  it('formatVenueDistanceLabel renders m and km', () => {
    expect(formatVenueDistanceLabel(850)).toBe('850m');
    expect(formatVenueDistanceLabel(1250)).toBe('1.3km');
  });

  it('resolveHotelVenueDistanceM prefers haversine to hot-path venue', () => {
    const venue = { lat: 37.421, lng: 126.989 };
    const hotel = { lat: 37.50643, lng: 127.03101, distanceM: 500 };
    const distance = resolveHotelVenueDistanceM(hotel, venue);
    expect(distance).toBeGreaterThan(9000);
    expect(distance).toBeLessThan(11_000);
  });

  it('resolveHotelVenueDistanceM falls back to RollingGo distanceM', () => {
    expect(resolveHotelVenueDistanceM({ distanceM: 1200 })).toBe(1200);
  });
});

describe('buildRollingGoHotelRecommendations distance ranking', () => {
  const venue = { lat: 37.421, lng: 126.989 };

  it('sorts by distance to venue then price for standard tier', () => {
    const recs = buildRollingGoHotelRecommendations(
      [
        {
          name: 'Far Cheap',
          minPrice: 200,
          lat: 37.55,
          lng: 127.05,
        },
        {
          name: 'Near Pricier',
          minPrice: 800,
          lat: 37.425,
          lng: 126.995,
        },
      ],
      2,
      venue,
      { tier: 'standard' },
    );

    expect(recs[0]?.name).toBe('Near Pricier');
    expect(recs[0]?.distanceM).toBeLessThan(2000);
  });
});

describe('rollingGoHotelToGuideItem distance note', () => {
  it('includes straight-line distance hint', () => {
    const item = rollingGoHotelToGuideItem(
      {
        name: 'Test Hotel',
        minPricePerNight: 500,
        distanceM: 1800,
      },
      {
        nightLabel: '2 晚',
        headcount: 2,
        currency: 'CNY',
        index: 0,
      },
    );

    expect(item.note).toContain('距会场约 1.8km（直线）');
  });
});

describe('normalizeHotelRecords geo fields', () => {
  it('parses latitude, longitude and distanceInMeters', () => {
    const hotels = normalizeHotelRecords({
      hotelInformationList: [
        {
          name: 'Near Venue',
          latitude: 37.425,
          longitude: 126.995,
          distanceInMeters: 1500,
          price: { lowestPrice: 900, currency: 'CNY' },
        },
      ],
    });

    expect(hotels[0]).toMatchObject({
      lat: 37.425,
      lng: 126.995,
      distanceM: 1500,
      minPrice: 900,
    });
  });
});
