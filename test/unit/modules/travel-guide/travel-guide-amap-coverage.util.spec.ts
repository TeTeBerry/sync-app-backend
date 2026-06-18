import { isVenueOutsideAmapPoiCoverage } from '@src/modules/travel-guide/map/travel-guide-amap-coverage.util';

describe('travel-guide-amap-coverage', () => {
  it('treats Pattaya and Phuket as outside Amap POI coverage', () => {
    expect(isVenueOutsideAmapPoiCoverage(12.9367, 100.8839)).toBe(true);
    expect(isVenueOutsideAmapPoiCoverage(7.96, 98.35)).toBe(true);
  });

  it('treats Shenzhen as inside Amap POI coverage', () => {
    expect(isVenueOutsideAmapPoiCoverage(22.7053, 113.9396)).toBe(false);
  });
});
