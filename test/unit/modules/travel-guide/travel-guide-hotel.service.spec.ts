import { TravelGuideHotelService } from '../../../../src/modules/travel-guide/map/travel-guide-hotel.service';
import { TRAVEL_GUIDE_HOTEL_SEED_ROWS } from '../../../../src/modules/travel-guide/map/travel-guide-hotel.seed.data';

describe('TravelGuideHotelService', () => {
  const service = new TravelGuideHotelService({
    find: () => ({
      sort: () => ({
        lean: () => ({
          exec: async () =>
            TRAVEL_GUIDE_HOTEL_SEED_ROWS.filter(
              (r) => r.activityLegacyId === 4 && r.budgetTier === 'economy',
            ),
        }),
      }),
    }),
  } as never);

  it('maps curated rows to ranked POIs preserving order and labels', async () => {
    const ranked = await service.findRankedForActivity(4, 'economy');
    expect(ranked).toHaveLength(6);
    expect(ranked[0]?.name).toContain('福华商务');
    expect(ranked[0]?.distanceLabel).toBe('驾车2.6公里');
    expect(ranked[0]?.avgPrice).toBe(158);
    expect(ranked[0]?.keyword).toBe('curated');
  });
});
