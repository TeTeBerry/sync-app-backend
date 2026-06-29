import {
  buildRollingGoQuoteGeoContext,
  normalizeQuoteDestinationCity,
  resolveHotPathPrimaryAirportCode,
} from '@src/modules/travel-guide/domain/travel-guide-rollinggo-geo.util';

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
});
