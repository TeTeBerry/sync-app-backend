import {
  findDepartureCityAnchor,
  mergePlaceSuggestions,
  resolveDepartureGeocodeTargets,
  resolveSuggestionRegion,
} from '@src/modules/travel-guide/map/travel-guide-departure-suggestions.util';

describe('travel-guide-departure-suggestions.util', () => {
  it('anchors 上海 for exact and extended input', () => {
    expect(findDepartureCityAnchor('上海')).toBe('上海');
    expect(findDepartureCityAnchor('上海虹桥')).toBe('上海');
  });

  it('resolves suggestion region from anchor, picked city, or event city', () => {
    expect(resolveSuggestionRegion('上海', { eventRegion: '深圳' })).toBe(
      '上海',
    );
    expect(resolveSuggestionRegion('虹桥', { eventRegion: '深圳' })).toBe(
      '深圳',
    );
    expect(
      resolveSuggestionRegion('拼多多', {
        eventRegion: '深圳',
        departureCity: '上海市',
      }),
    ).toBe('上海');
  });

  it('builds geocode targets without using POI name as region', () => {
    expect(resolveDepartureGeocodeTargets('上海', '深圳')).toEqual({
      address: '上海',
      region: '上海',
    });
    expect(resolveDepartureGeocodeTargets('拼多多公司', '深圳')).toEqual({
      address: '拼多多公司',
      region: '深圳',
    });
    expect(
      resolveDepartureGeocodeTargets('拼多多公司', '深圳', '上海市'),
    ).toEqual({
      address: '拼多多公司',
      region: '上海',
    });
    expect(resolveDepartureGeocodeTargets('上海虹桥', '深圳')).toEqual({
      address: '上海虹桥',
      region: '上海',
    });
  });

  it('merges local cities before remote and filters by anchor', () => {
    const merged = mergePlaceSuggestions('上海', [
      { title: '慧智社区', address: '深圳市宝安区', city: '深圳市' },
      { title: '上海虹桥站', address: '上海市闵行区', city: '上海市' },
    ]);
    expect(merged.map((r) => r.title)).toEqual(['上海', '上海虹桥站']);
  });
});
