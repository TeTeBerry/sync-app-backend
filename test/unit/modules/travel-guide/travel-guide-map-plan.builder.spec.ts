import {
  hotelsFromRanked,
  mergeRankedHotelsWithLlmPolish,
  mergeNightlifeWithLlmPolish,
  nightlifeFromRanked,
} from '../../../../src/modules/travel-guide/map/travel-guide-map-plan.builder';
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

describe('mergeRankedHotelsWithLlmPolish', () => {
  it('keeps ranked hotel order and names while applying LLM note polish', () => {
    const ranked = [
      { name: '酒店A', note: '¥150-250/晚', bookingHint: '携程' },
      { name: '酒店B', note: '¥250-300/晚' },
    ];
    const llm = [
      { name: '酒店B', note: '润色后的 B 文案' },
      { name: '酒店A', note: '润色后的 A 文案' },
      { name: '编造酒店', note: '不应出现' },
    ];

    const merged = mergeRankedHotelsWithLlmPolish(ranked, llm);
    expect(merged.map((h) => h.name)).toEqual(['酒店A', '酒店B']);
    expect(merged[0]?.note).toBe('润色后的 A 文案');
    expect(merged[1]?.note).toBe('润色后的 B 文案');
  });

  it('applies LLM reason polish while keeping ranked order', () => {
    const ranked = [{ name: '酒店A', note: 'note', reason: '地图理由' }];
    const merged = mergeRankedHotelsWithLlmPolish(ranked, [
      { name: '酒店A', note: 'note', reason: '润色理由' },
    ]);
    expect(merged[0]?.reason).toBe('润色理由');
  });
});

describe('hotels and nightlife lists', () => {
  it('returns up to 6 hotels and nightlife spots with reasons', () => {
    const picks = {
      nearby: rankedPoi({ name: '近酒店', distanceM: 400 }),
      cityCenter: rankedPoi({ name: '远酒店', distanceM: 2200 }),
    };
    const hotelList = Array.from({ length: 6 }, (_, i) =>
      rankedPoi({
        name: `酒店${i + 1}`,
        distanceM: 400 + i * 300,
        rating: 4.2 + i * 0.1,
      }),
    );
    hotelList[0] = picks.nearby;
    hotelList[1] = picks.cityCenter;

    const items = hotelsFromRanked(
      hotelList,
      '2 晚',
      '双床',
      ['¥300-450', '¥450-600'],
      undefined,
      picks,
    );
    expect(items).toHaveLength(6);
    expect(items[0]?.reason).toContain('距会场');
    expect(items[2]?.reason).toMatch(/备选|适中|商圈/);

    const nightlife = nightlifeFromRanked(
      [
        {
          ...rankedPoi({
            name: '深夜烧烤',
            distanceM: 600,
            category: '烧烤',
            lateNightFriendly: true,
          }),
          kind: 'nightlife_food',
        },
      ],
      23.5,
    );
    expect(nightlife[0]?.reason).toMatch(/散场|烧烤|近/);
  });

  it('mergeNightlifeWithLlmPolish keeps map order and names', () => {
    const ranked = [
      { name: 'A店', note: 'n1', reason: 'r1' },
      { name: 'B店', note: 'n2', reason: 'r2' },
    ];
    const merged = mergeNightlifeWithLlmPolish(ranked, [
      { name: 'B店', note: '润色B', reason: '润色理由B' },
      { name: '编造', note: 'x', reason: 'y' },
    ]);
    expect(merged.map((s) => s.name)).toEqual(['A店', 'B店']);
    expect(merged[1]?.reason).toBe('润色理由B');
  });
});
