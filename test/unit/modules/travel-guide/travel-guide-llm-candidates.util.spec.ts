import { compactCandidatesForLlm } from '../../../../src/modules/travel-guide/domain/travel-guide-llm-candidates.util';
import type { RankedMapPoi } from '../../../../src/modules/travel-guide/map/travel-guide-map.types';

function rankedPoi(
  partial: Partial<RankedMapPoi> & Pick<RankedMapPoi, 'name' | 'distanceM'>,
): RankedMapPoi {
  return {
    id: partial.name,
    address: '测试路',
    lat: 22.5,
    lng: 114,
    category: '酒店',
    kind: 'hotel',
    keyword: '酒店',
    lateNightFriendly: false,
    score: 0.9,
    scoreBreakdown: { distance: 0.9, rating: 0.8, budget: 0.8, lateNight: 0 },
    ...partial,
  };
}

describe('compactCandidatesForLlm', () => {
  it('trims ranked POIs to slim candidate lists', () => {
    const hotels = Array.from({ length: 8 }, (_, i) =>
      rankedPoi({ name: `酒店${i}`, distanceM: 500 + i * 100 }),
    );
    const nightlife = Array.from({ length: 8 }, (_, i) =>
      rankedPoi({
        name: `夜宵${i}`,
        distanceM: 300 + i * 50,
        kind: 'nightlife_food',
      }),
    );

    const compact = compactCandidatesForLlm({
      hotels,
      nightlife,
      parking: [],
      minHotelRating: 4,
      budgetTier: 'standard',
      hotelPriceBand: ['¥300-450', '¥450-600'],
    });

    expect(compact.hotels).toHaveLength(8);
    expect(compact.nightlife).toHaveLength(6);
    expect(compact.hotels[0]).toEqual({
      name: '酒店0',
      address: '测试路',
      distanceM: 500,
      category: '酒店',
      lateNightFriendly: false,
      rating: undefined,
      avgPrice: undefined,
    });
    expect(compact.hotels[0]).not.toHaveProperty('score');
  });
});
