import {
  getAllHotPathFallbackPois,
  getHotPathFallbackPois,
} from '@src/modules/travel-guide/map/travel-guide-hot-path-pois.data';

describe('travel-guide-hot-path-pois', () => {
  it('provides storm activity fallback hotels and nightlife', () => {
    const hotels = getHotPathFallbackPois(4, 'hotel', '酒店');
    const nightlife = getHotPathFallbackPois(4, 'nightlife_club', '酒吧');
    expect(hotels.length).toBeGreaterThanOrEqual(2);
    expect(nightlife.length).toBeGreaterThanOrEqual(1);
  });

  it('returns full set for collector merge', () => {
    const all = getAllHotPathFallbackPois(4);
    expect(all.some((p) => p.kind === 'hotel')).toBe(true);
    expect(all.some((p) => p.kind.startsWith('nightlife'))).toBe(true);
  });
});
