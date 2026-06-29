import { buildDiversifiedRollingGoHotelQuotesByTier } from '@src/modules/travel-guide/domain/travel-guide-rollinggo-hotel-quotes.util';
import { buildRollingGoHotelRecommendations } from '@src/modules/travel-guide/infra/rollinggo/rollinggo-mcp.client';

const venue = { lat: 37.421, lng: 126.989 };

describe('buildRollingGoHotelRecommendations tier ranking', () => {
  const hotels = [
    {
      name: 'Inspire Arena Hotel',
      minPrice: 980,
      starRating: 5,
      lat: 37.425,
      lng: 126.995,
    },
    {
      name: 'Budget Motel Incheon',
      minPrice: 260,
      starRating: 2.5,
      lat: 37.44,
      lng: 127.01,
    },
    {
      name: 'Business Hotel Yeongjong',
      minPrice: 520,
      starRating: 4,
      lat: 37.43,
      lng: 127.0,
    },
  ];

  it('ranks economy by price first', () => {
    const recs = buildRollingGoHotelRecommendations(hotels, 3, venue, {
      tier: 'economy',
    });
    expect(recs[0]?.name).toBe('Budget Motel Incheon');
  });

  it('ranks comfort by star and price first', () => {
    const recs = buildRollingGoHotelRecommendations(hotels, 3, venue, {
      tier: 'comfort',
    });
    expect(recs[0]?.name).toBe('Inspire Arena Hotel');
  });
});

describe('buildDiversifiedRollingGoHotelQuotesByTier', () => {
  it('assigns different lead hotels across SYNC tiers for Korea-like pool', () => {
    const sharedNear = {
      name: 'Paradise City Hotel',
      minPrice: 880,
      starRating: 5,
      lat: 37.425,
      lng: 126.995,
    };
    const economyOnly = {
      name: 'Incheon Guest House',
      minPrice: 240,
      starRating: 2.5,
      lat: 37.44,
      lng: 127.01,
    };
    const standardOnly = {
      name: 'Yeongjong Business Hotel',
      minPrice: 520,
      starRating: 4,
      lat: 37.43,
      lng: 127.0,
    };
    const luxuryOnly = {
      name: 'Inspire Grand Suite',
      minPrice: 1200,
      starRating: 5,
      lat: 37.426,
      lng: 126.996,
    };

    const quotes = buildDiversifiedRollingGoHotelQuotesByTier(
      {
        economy: [sharedNear, economyOnly, standardOnly],
        standard: [sharedNear, standardOnly, economyOnly],
        comfort: [sharedNear, luxuryOnly, standardOnly],
      },
      {
        regionKind: 'overseas',
        countryCode: 'KR',
        venueCoords: venue,
      },
    );

    const leads = [
      quotes.economy?.recommendations?.[0]?.name,
      quotes.standard?.recommendations?.[0]?.name,
      quotes.comfort?.recommendations?.[0]?.name,
    ];
    expect(new Set(leads).size).toBe(3);
    expect(quotes.economy?.recommendations?.[0]?.name).toBe(
      'Incheon Guest House',
    );
    expect(quotes.comfort?.recommendations?.[0]?.name).toBe(
      'Inspire Grand Suite',
    );
  });
});
