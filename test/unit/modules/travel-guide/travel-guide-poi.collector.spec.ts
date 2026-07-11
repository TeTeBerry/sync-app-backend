import { Test } from '@nestjs/testing';
import type { Activity } from '@src/database/schemas/activity.schema';
import { TravelGuidePoiCollector } from '@src/modules/travel-guide/map/travel-guide-poi.collector';
import { TravelGuideGeoCacheService } from '@src/modules/travel-guide/map/travel-guide-geo-cache.service';

const edcKoreaActivity: Activity = {
  legacyId: 8,
  code: 'edc-korea',
  name: 'EDC Korea 2026',
  date: '10/03-04',
  location: '仁川 Inspire Entertainment Resort',
  latitude: 37.466757,
  longitude: 126.390594,
  region: 'overseas',
  area: '韩国',
  hot: true,
} as Activity;

describe('TravelGuidePoiCollector', () => {
  it('requests overseas hotels and nightlife POIs from the local curated catalog', async () => {
    const searchPoisCached = jest.fn().mockImplementation(async (input) => {
      expect(input.abroad).toBe(true);
      expect(input.activityLegacyId).toBe(8);
      const { getHotPathFallbackPois } =
        await import('@src/data/travel-guide/travel-guide-hot-path-pois.data');
      return getHotPathFallbackPois(
        input.activityLegacyId,
        input.kind,
        input.keyword,
      );
    });

    const geoCache = {
      resolveVenue: jest.fn().mockResolvedValue({
        venue: {
          title: 'Inspire Entertainment Resort',
          address: 'Incheon, South Korea',
          lat: 37.466757,
          lng: 126.390594,
        },
        readableAddress: '韩国仁川·Inspire Entertainment Resort',
        source: 'hot_path',
      }),
      resolveDeparture: jest.fn().mockResolvedValue(null),
      resolveTransport: jest.fn().mockResolvedValue({
        source: 'none',
        hintLines: [],
      }),
      searchPoisCached,
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TravelGuidePoiCollector,
        { provide: TravelGuideGeoCacheService, useValue: geoCache },
      ],
    }).compile();

    const collector = moduleRef.get(TravelGuidePoiCollector);
    const ctx = await collector.collect(edcKoreaActivity, {
      departure: '上海',
      headcount: 2,
      budgetTier: 'standard',
      selfDrive: false,
    });

    expect(ctx).not.toBeNull();
    expect(ctx?.pois.length).toBeGreaterThan(0);
    expect(ctx?.venueSource).toBe('hot_path');
    expect(searchPoisCached).toHaveBeenCalled();
    expect(
      searchPoisCached.mock.calls.every(
        (call: [{ abroad?: boolean }]) => call[0].abroad === true,
      ),
    ).toBe(true);
    expect(
      searchPoisCached.mock.calls.some(
        (call: [{ kind?: string }]) => call[0].kind === 'hotel',
      ),
    ).toBe(true);
    expect(
      searchPoisCached.mock.calls.some(
        (call: [{ keyword?: string }]) => call[0].keyword === 'nightclub',
      ),
    ).toBe(true);
  });

  it('returns empty POIs for abroad venues without a curated catalog (no Amap)', async () => {
    const ohioActivity: Activity = {
      legacyId: 19,
      code: 'lost-lands',
      name: 'Lost Lands 2026',
      date: '09/18-20',
      location: '美国·俄亥俄州 Legend Valley',
      latitude: 39.9612,
      longitude: -82.9988,
      region: 'overseas',
      area: '美国',
      hot: false,
    } as Activity;

    const searchPoisCached = jest.fn().mockResolvedValue([]);
    const geoCache = {
      resolveVenue: jest.fn().mockResolvedValue({
        venue: {
          title: '美国·俄亥俄州 Legend Valley',
          address: '美国·俄亥俄州 Legend Valley',
          lat: 39.9612,
          lng: -82.9988,
        },
        readableAddress: '美国·俄亥俄州 Legend Valley',
        source: 'database',
      }),
      resolveDeparture: jest.fn().mockResolvedValue(null),
      resolveTransport: jest.fn().mockResolvedValue({
        source: 'none',
        hintLines: [],
      }),
      searchPoisCached,
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TravelGuidePoiCollector,
        { provide: TravelGuideGeoCacheService, useValue: geoCache },
      ],
    }).compile();

    const collector = moduleRef.get(TravelGuidePoiCollector);
    const ctx = await collector.collect(ohioActivity, {
      departure: '纽约',
      headcount: 2,
      budgetTier: 'standard',
      selfDrive: false,
    });

    expect(ctx).not.toBeNull();
    expect(ctx?.pois).toEqual([]);
    expect(geoCache.resolveDeparture).not.toHaveBeenCalled();
    expect(searchPoisCached).toHaveBeenCalled();
    expect(
      searchPoisCached.mock.calls.every(
        (call: [{ abroad?: boolean }]) => call[0].abroad === true,
      ),
    ).toBe(true);
    expect(geoCache.resolveTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'zh',
        activity: ohioActivity,
      }),
    );
  });
});
