import {
  getAllHotPathFallbackPois,
  getHotPathFallbackPois,
} from '@src/modules/travel-guide/map/travel-guide-hot-path-pois.data';

describe('travel-guide-hot-path-pois', () => {
  it('provides storm activity fallback nightlife (hotels come from Amap only)', () => {
    const hotels = getHotPathFallbackPois(4, 'hotel', '酒店');
    const nightlife = getHotPathFallbackPois(4, 'nightlife_food', '夜宵');
    expect(hotels).toHaveLength(0);
    expect(nightlife.length).toBeGreaterThanOrEqual(1);
  });

  it('returns full set for collector merge', () => {
    const all = getAllHotPathFallbackPois(4);
    expect(all.some((p) => p.kind === 'hotel')).toBe(false);
    expect(all.some((p) => p.kind.startsWith('nightlife'))).toBe(true);
  });

  it('still provides EDC china fallback hotels', () => {
    const hotels = getHotPathFallbackPois(2, 'hotel', '酒店');
    expect(hotels.length).toBeGreaterThanOrEqual(1);
  });
});
