import {
  buildGenericInterCityHints,
  haversineDistanceM,
  isInterCityByDistance,
} from '../../../../src/modules/travel-guide/map/travel-guide-intercity.util';
import {
  findHotActivityProfile,
  matchHotInterCityRoute,
} from '../../../../src/modules/travel-guide/map/travel-guide-hot-path.data';
import { buildTransportLinesFromMap } from '../../../../src/modules/travel-guide/map/travel-guide-map-plan.builder';

describe('travel-guide-intercity', () => {
  it('detects Shanghai to Shenzhen as inter-city by distance', () => {
    const shanghai = {
      lat: 31.23,
      lng: 121.47,
      title: '上海',
      address: '上海',
    };
    const shenzhenVenue = {
      lat: 22.7053,
      lng: 113.9396,
      title: '深圳国际会展中心',
      address: '深圳',
    };
    expect(isInterCityByDistance(shanghai, shenzhenVenue)).toBe(true);
    expect(haversineDistanceM(shanghai, shenzhenVenue)).toBeGreaterThan(80_000);
  });

  it('matches Shanghai hot inter-city route for storm', () => {
    const profile = findHotActivityProfile(4)!;
    const matched = matchHotInterCityRoute(profile, '上海');
    expect(matched?.origin.originLabel).toBe('上海');
    expect(matched?.hub.hubLabel).toContain('深圳北站');
  });

  it('builds transport lines with flight/rail first for inter-city', () => {
    const profile = findHotActivityProfile(4)!;
    const matched = matchHotInterCityRoute(profile, '上海')!;
    const hints = [
      ...matched.origin.primaryLegHints,
      `抵深后接驳：${matched.hub.transitHint}`,
    ];
    const lines = buildTransportLinesFromMap(
      '上海',
      profile.venue.title,
      profile.readableAddress,
      false,
      matched.hub.driving,
      hints,
      true,
    );
    expect(lines.some((l) => l.includes('高铁') || l.includes('航班'))).toBe(
      true,
    );
    expect(lines.some((l) => l.includes('地铁11号线'))).toBe(false);
  });

  it('generic inter-city hints mention high-speed rail or flight', () => {
    const hints = buildGenericInterCityHints({
      departureLabel: '上海',
      destinationCity: '深圳',
      venueTitle: '深圳国际会展中心',
      selfDrive: false,
    });
    expect(hints.join(' ')).toMatch(/高铁|飞机/);
  });
});
