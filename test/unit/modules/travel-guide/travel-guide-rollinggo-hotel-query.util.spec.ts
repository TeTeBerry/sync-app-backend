import { buildRollingGoHotelOriginQuery } from '@src/modules/travel-guide/domain/travel-guide-rollinggo-hotel-query.util';
import type { TravelQuoteQuery } from '@src/modules/travel-guide/ports/travel-quote.types';

const baseQuery: TravelQuoteQuery = {
  departureText: '上海',
  destinationCity: '曼谷',
  activityName: 'S2O Thailand',
  venueTitle: 'Live Park',
  venueAddress: 'Rama IX',
  regionKind: 'overseas',
  interCity: true,
  headcount: 2,
  accommodationNights: 2,
  budgetTier: 'standard',
  outboundDate: '2026-04-10',
  returnDate: '2026-04-13',
  selfDrive: false,
};

describe('buildRollingGoHotelOriginQuery', () => {
  it('builds generic hotel query without festival-specific keywords', () => {
    expect(buildRollingGoHotelOriginQuery(baseQuery)).toBe(
      '曼谷 S2O Thailand Live Park 酒店',
    );
    expect(buildRollingGoHotelOriginQuery(baseQuery)).not.toContain('电音节');
  });

  it('falls back to city and venue when activity name is absent', () => {
    expect(
      buildRollingGoHotelOriginQuery({
        ...baseQuery,
        activityName: undefined,
      }),
    ).toBe('曼谷 Live Park 酒店');
  });
});
