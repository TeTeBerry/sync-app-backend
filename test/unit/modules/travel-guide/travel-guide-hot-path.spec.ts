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

  it('resolves EDC Korea venue at Inspire Incheon', () => {
    const profile = findHotActivityProfile(8);
    expect(profile?.activityCode).toBe('edc-korea');
    expect(profile?.venue.title).toContain('Inspire');
    expect(profile?.venue.lat).toBeCloseTo(37.466757, 3);
    expect(
      profile?.hubRoutes.some((h) => h.hubLabel.includes('仁川国际机场')),
    ).toBe(true);
  });

  it('matches EDC Korea inter-city origin 上海 to ICN hub', () => {
    const profile = findHotActivityProfile(8)!;
    const inter = matchHotInterCityRoute(profile, '上海');
    expect(inter?.origin.originLabel).toBe('上海');
    expect(inter?.hub.hubLabel).toContain('仁川国际机场');
  });

  it('matches EDC Korea hub route by ICN alias', () => {
    const profile = findHotActivityProfile(8)!;
    const hub = matchHotHubRoute(profile, 'ICN');
    expect(hub?.hubLabel).toBe('仁川国际机场');
    expect(hub?.driving.distanceKm).toBeGreaterThan(0);
  });

  it('resolves S2O Korea venue at Seoul Land', () => {
    const profile = findHotActivityProfile(3);
    expect(profile?.activityCode).toBe('s2o');
    expect(profile?.venue.title).toContain('Seoul Land');
    expect(
      profile?.hubRoutes.some((h) => h.hubLabel.includes('仁川国际机场')),
    ).toBe(true);
  });

  it('resolves WDJF Japan venue in Tokyo Bay', () => {
    const profile = findHotActivityProfile(6);
    expect(profile?.venue.title).toContain('海の森');
    expect(profile?.hubRoutes.some((h) => /羽田|HND/.test(h.hubLabel))).toBe(
      true,
    );
  });

  it('resolves Ultra Japan venue in Odaiba', () => {
    const profile = findHotActivityProfile(11);
    expect(profile?.activityCode).toBe('ultra-japan');
    expect(profile?.readableAddress).toContain('台场');
  });
});
