import {
  findHotActivityProfile,
  matchHotHubRoute,
  matchHotInterCityRoute,
} from '../../../../src/modules/travel-guide/map/travel-guide-hot-path.data';

describe('travel-guide-hot-path', () => {
  it('resolves storm venue without API', () => {
    const profile = findHotActivityProfile(4);
    expect(profile?.venue.title).toContain('国际会展中心');
  });

  it('matches hub route by airport alias', () => {
    const profile = findHotActivityProfile(4)!;
    const hub = matchHotHubRoute(profile, '宝安机场');
    expect(hub?.hubLabel).toBe('深圳宝安国际机场');
    expect(hub?.driving.distanceKm).toBeGreaterThan(0);
  });

  it('matches inter-city origin 上海 before local hub', () => {
    const profile = findHotActivityProfile(4)!;
    const inter = matchHotInterCityRoute(profile, '上海');
    expect(inter?.origin.originLabel).toBe('上海');
  });

  it('resolves Tomorrowland Thailand venue in Pattaya', () => {
    const profile = findHotActivityProfile(1);
    expect(profile?.venue.title).toContain('Wisdom Valley');
    expect(profile?.venue.lat).toBeCloseTo(12.9367, 2);
    expect(profile?.venue.lng).toBeCloseTo(100.8839, 2);
  });
});
