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

  it('skips Amap direction APIs for overseas resolveTransport', async () => {
    const amap = {
      geocode: jest.fn(),
      drivingRoute: jest.fn(),
      transitRoute: jest.fn(),
      searchNearbyPois: jest.fn(),
    } as unknown as AmapMapService;
    const venueCacheModel = {
      findOne: jest.fn().mockReturnValue({ lean: async () => null }),
    } as unknown as Model<TravelGuideVenueCacheDocument>;
    const service = new TravelGuideGeoCacheService(amap, venueCacheModel);

    const result = await service.resolveTransport({
      activityLegacyId: 19,
      departureText: 'New York',
      venue: {
        title: '美国·俄亥俄州 Legend Valley',
        address: 'Legend Valley, OH',
        lat: 39.9612,
        lng: -82.9988,
      },
      destinationCity: '俄亥俄',
      selfDrive: false,
      locale: 'en',
      activity: {
        name: 'Lost Lands 2026',
        location: '美国·俄亥俄州 Legend Valley',
        region: 'overseas',
        area: '美国',
      },
    });

    expect(amap.geocode).not.toHaveBeenCalled();
    expect(amap.drivingRoute).not.toHaveBeenCalled();
    expect(amap.transitRoute).not.toHaveBeenCalled();
    expect(result.source).toBe('none');
    expect(result.interCity).toBe(true);
    expect(result.hintLines?.length).toBeGreaterThan(0);
    expect(result.hintLines?.join('\n')).toMatch(/international|flight/i);
  });

  it('marks same-area overseas departure as non-intercity without Amap', async () => {
    const amap = {
      geocode: jest.fn(),
      drivingRoute: jest.fn(),
      transitRoute: jest.fn(),
    } as unknown as AmapMapService;
    const venueCacheModel = {
      findOne: jest.fn().mockReturnValue({ lean: async () => null }),
    } as unknown as Model<TravelGuideVenueCacheDocument>;
    const service = new TravelGuideGeoCacheService(amap, venueCacheModel);

    const result = await service.resolveTransport({
      activityLegacyId: 19,
      departureText: '俄亥俄 Columbus',
      venue: {
        title: '美国·俄亥俄州 Legend Valley',
        address: 'Legend Valley, OH',
        lat: 39.9612,
        lng: -82.9988,
      },
      destinationCity: '俄亥俄',
      selfDrive: false,
      locale: 'zh',
      activity: {
        name: 'Lost Lands 2026',
        location: '美国·俄亥俄州 Legend Valley',
        region: 'overseas',
        area: '美国',
      },
    });

    expect(amap.geocode).not.toHaveBeenCalled();
    expect(amap.drivingRoute).not.toHaveBeenCalled();
    expect(result.interCity).toBe(false);
  });
});
