import type { Model } from 'mongoose';
import type { TravelGuideVenueCacheDocument } from '@src/database/schemas/travel-guide-venue-cache.schema';
import { AmapMapService } from '@src/modules/travel-guide/map/amap.service';
import { TravelGuideGeoCacheService } from '@src/modules/travel-guide/map/travel-guide-geo-cache.service';

describe('TravelGuideGeoCacheService', () => {
  it('uses only the local curated catalog for overseas POIs', async () => {
    const amap = {
      searchNearbyPois: jest.fn(),
    } as unknown as AmapMapService;
    const venueCacheModel = {} as Model<TravelGuideVenueCacheDocument>;
    const service = new TravelGuideGeoCacheService(amap, venueCacheModel);

    const pois = await service.searchPoisCached({
      activityLegacyId: 7,
      venue: {
        title: 'De Schorre',
        address: 'Schommelei 1, 2850 Boom, Belgium',
        lat: 51.0894,
        lng: 4.3774,
      },
      keyword: 'parking',
      kind: 'parking',
      abroad: true,
    });

    expect(amap.searchNearbyPois).not.toHaveBeenCalled();
    expect(pois.map((poi) => poi.id)).toEqual(['tml-be-p1', 'tml-be-p2']);
  });
});
