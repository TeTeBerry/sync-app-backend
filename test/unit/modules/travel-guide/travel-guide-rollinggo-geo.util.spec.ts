import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildRollingGoQuoteGeoContext,
  normalizeQuoteDestinationCity,
  resolveHotPathPrimaryAirportCode,
} from '@src/modules/travel-guide/domain/travel-guide-rollinggo-geo.util';
import {
  ACTIVITY_PRIMARY_AIRPORTS,
  listActivityAirportLegacyIds,
  resolveActivityAlternateAirportCodes,
  resolveActivityPrimaryAirportCode,
} from '@src/data/travel-guide/travel-guide-activity-airports.data';

describe('travel-guide-rollinggo-geo.util', () => {
  it('normalizeQuoteDestinationCity extracts 仁川 from EDC Korea location', () => {
    expect(
      normalizeQuoteDestinationCity(
        '仁川 Inspire Entertainment Resort',
        '韩国',
      ),
    ).toBe('仁川');
  });

  it('normalizeQuoteDestinationCity handles country-prefixed locations', () => {
    expect(normalizeQuoteDestinationCity('韩国·首尔乐园', '韩国')).toBe('首尔');
    expect(normalizeQuoteDestinationCity('泰国·芭提雅', '泰国')).toBe('芭提雅');
  });

  it('buildRollingGoQuoteGeoContext resolves EDC Korea airport and hotel geo', () => {
    const geo = buildRollingGoQuoteGeoContext({
      activityLegacyId: 8,
      activityName: 'EDC Korea 2026',
      activityArea: '韩国',
      location: '仁川 Inspire Entertainment Resort',
      regionKind: 'overseas',
    });

    expect(geo.destinationCity).toBe('仁川');
    expect(geo.hotelCountryCode).toBe('KR');
    expect(geo.hotelPlace).toBe('Inspire Entertainment Resort');
    expect(geo.hotelSearchPlaceType).toBe('景点');
    expect(geo.venueCoords).toEqual({ lat: 37.466757, lng: 126.390594 });
    expect(geo.destinationCityCode).toBe('ICN');
    expect(geo.airportKeywords).toEqual(
      expect.arrayContaining(['仁川', '首尔', 'Incheon', 'Seoul']),
    );
  });

  it('buildRollingGoQuoteGeoContext uses Seoul Land venue for S2O Korea', () => {
    const geo = buildRollingGoQuoteGeoContext({
      activityLegacyId: 3,
      activityName: 'S2O Korea 2026',
      activityArea: '韩国',
      location: '韩国·首尔乐园 Seoul Land',
      venueTitle: 'Seoul Land',
      regionKind: 'overseas',
    });

    expect(geo.hotelPlace).toBe('Seoul Land');
    expect(geo.hotelSearchPlaceType).toBe('景点');
    expect(geo.venueCoords).toEqual({ lat: 37.421, lng: 126.9893 });
  });

  it('buildRollingGoQuoteGeoContext maps Pattaya to Bangkok airport keywords', () => {
    const geo = buildRollingGoQuoteGeoContext({
      activityLegacyId: 1,
      activityArea: '泰国',
      location: '芭提雅 Wisdom Valley',
      regionKind: 'overseas',
    });

    expect(geo.destinationCity).toBe('芭提雅');
    expect(geo.hotelCountryCode).toBe('TH');
    expect(geo.destinationCityCode).toBe('BKK');
    expect(geo.airportKeywords).toEqual(
      expect.arrayContaining(['曼谷', 'Bangkok', '芭提雅']),
    );
  });

  it('buildRollingGoQuoteGeoContext resolves domestic destination IATA without hot path', () => {
    const geo = buildRollingGoQuoteGeoContext({
      activityName: 'VAC 珠海',
      location: '珠海',
      regionKind: 'domestic',
    });

    expect(geo.destinationCity).toBe('珠海');
    expect(geo.destinationCityCode).toBe('ZUH');
  });

  it('resolveHotPathPrimaryAirportCode reads IATA from hot path hub', () => {
    expect(resolveHotPathPrimaryAirportCode(8)).toBe('ICN');
    expect(resolveHotPathPrimaryAirportCode(1)).toBe('BKK');
  });

  it('uses Lost Lands Columbus airport instead of US LAX country default', () => {
    const geo = buildRollingGoQuoteGeoContext({
      activityLegacyId: 19,
      activityName: 'Lost Lands 2026',
      activityArea: '美国',
      location: '美国·俄亥俄州 Legend Valley',
      regionKind: 'overseas',
    });

    expect(geo.destinationCityCode).toBe('CMH');
    expect(resolveActivityAlternateAirportCodes(19)).toEqual(['CLE']);
    expect(geo.airportKeywords[0]).toBe('Columbus');
    expect(geo.airportKeywords).toEqual(
      expect.arrayContaining(['Columbus', 'CMH']),
    );
    const columbusIdx = geo.airportKeywords.indexOf('Columbus');
    const laxIdx = geo.airportKeywords.indexOf('洛杉矶');
    expect(columbusIdx).toBeGreaterThanOrEqual(0);
    if (laxIdx >= 0) {
      expect(columbusIdx).toBeLessThan(laxIdx);
    }
  });

  it('uses Creamfields Manchester and UNTOLD Cluj as fly-in airports', () => {
    expect(
      buildRollingGoQuoteGeoContext({
        activityLegacyId: 10,
        activityName: 'Creamfields',
        activityArea: '英国',
        location: '英国·沃灵顿 Daresbury Estate',
        regionKind: 'overseas',
      }).destinationCityCode,
    ).toBe('MAN');
    expect(resolveActivityAlternateAirportCodes(10)).toEqual(['LPL']);

    expect(
      buildRollingGoQuoteGeoContext({
        activityLegacyId: 9,
        activityName: 'UNTOLD',
        activityArea: '罗马尼亚',
        location: '罗马尼亚·克卢日 Cluj Arena',
        regionKind: 'overseas',
      }).destinationCityCode,
    ).toBe('CLJ');
  });

  it('covers every catalog seed activity with a primary fly-in airport', () => {
    const seedPath = join(
      __dirname,
      '../../../../scripts/lib/activity-catalog-seed-data.mjs',
    );
    const raw = readFileSync(seedPath, 'utf8');
    const seedIds = [...raw.matchAll(/legacyId:\s*(\d+)/g)].map((match) =>
      Number(match[1]),
    );
    const uniqueSeedIds = [...new Set(seedIds)].sort((a, b) => a - b);

    expect(listActivityAirportLegacyIds()).toEqual(uniqueSeedIds);
    for (const legacyId of uniqueSeedIds) {
      expect(resolveActivityPrimaryAirportCode(legacyId)).toMatch(/^[A-Z]{3}$/);
      expect(
        ACTIVITY_PRIMARY_AIRPORTS[legacyId]?.airportKeywords.length,
      ).toBeGreaterThan(0);
    }
  });
});
