import {
  findDepartureCityAnchor,
  mergePlaceSuggestions,
  resolveSuggestionRegion,
} from '@src/modules/travel-guide/map/travel-guide-departure-suggestions.util';

describe('travel-guide-departure-suggestions.util', () => {
  it('anchors 上海 for exact and extended input', () => {
    expect(findDepartureCityAnchor('上海')).toBe('上海');
    expect(findDepartureCityAnchor('上海虹桥')).toBe('上海');
  });

  it('resolves suggestion region from anchor or event city', () => {
    expect(resolveSuggestionRegion('上海', '深圳')).toBe('上海');
    expect(resolveSuggestionRegion('虹桥', '深圳')).toBe('深圳');
  });

  it('merges local cities before remote and filters by anchor', () => {
    const merged = mergePlaceSuggestions('上海', [
      { title: '慧智社区', address: '深圳市宝安区', city: '深圳市' },
      { title: '上海虹桥站', address: '上海市闵行区', city: '上海市' },
    ]);
    expect(merged.map((r) => r.title)).toEqual(['上海', '上海虹桥站']);
  });
});
