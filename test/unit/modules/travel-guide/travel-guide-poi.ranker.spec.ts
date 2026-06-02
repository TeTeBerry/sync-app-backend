import { TravelGuidePoiRanker } from '../../../../src/modules/travel-guide/map/travel-guide-poi.ranker';
import type {
  RawMapPoi,
  TravelGuideMapContext,
} from '../../../../src/modules/travel-guide/map/travel-guide-map.types';

describe('TravelGuidePoiRanker', () => {
  const ranker = new TravelGuidePoiRanker();

  const baseCtx: TravelGuideMapContext = {
    venue: { title: '会场', address: '深圳', lat: 22.5, lng: 114.0 },
    venueReadableAddress: '深圳市·会场',
    venueSource: 'hot_path',
    transportSource: 'hot_path',
    transportHints: [],
    pois: [],
    eventEndHour: 23.5,
    collectedAt: new Date().toISOString(),
  };

  function hotel(
    partial: Partial<RawMapPoi> & Pick<RawMapPoi, 'name' | 'distanceM'>,
  ): RawMapPoi {
    return {
      id: partial.name,
      address: '测试路1号',
      lat: 22.51,
      lng: 114.01,
      category: partial.category ?? '酒店宾馆:商务酒店',
      kind: 'hotel',
      keyword: '酒店',
      lateNightFriendly: false,
      ...partial,
    };
  }

  it('filters hotels below min rating', () => {
    const ranked = ranker.rank(
      {
        ...baseCtx,
        pois: [
          hotel({ name: '低分酒店', distanceM: 500, rating: 3.2 }),
          hotel({ name: '高分酒店', distanceM: 800, rating: 4.6 }),
        ],
      },
      {
        departure: '北京',
        headcount: 2,
        budgetTier: 'standard',
      },
    );

    expect(ranked.hotels.map((h) => h.name)).toEqual(['高分酒店']);
  });

  it('picks different hotels for economy vs comfort when prices span tiers', () => {
    const pois = [
      hotel({ name: '近档中价', distanceM: 400, rating: 4.5, avgPrice: 380 }),
      hotel({ name: '远经济型', distanceM: 900, rating: 4.6, avgPrice: 220 }),
      hotel({ name: '近豪华', distanceM: 500, rating: 4.7, avgPrice: 780 }),
    ];
    const economy = ranker.rank(
      { ...baseCtx, pois },
      { departure: '上海', headcount: 2, budgetTier: 'economy' },
    );
    const comfort = ranker.rank(
      { ...baseCtx, pois },
      { departure: '上海', headcount: 2, budgetTier: 'comfort' },
    );

    expect(economy.hotels[0]?.name).toBe('远经济型');
    expect(comfort.hotels[0]?.name).toBe('近豪华');
    expect(economy.hotels[0]?.name).not.toBe(comfort.hotels[0]?.name);
  });

  it('prefers closer hotel when scores are similar', () => {
    const ranked = ranker.rank(
      {
        ...baseCtx,
        pois: [
          hotel({
            name: '远但便宜',
            distanceM: 2000,
            rating: 4.5,
            category: '快捷酒店',
          }),
          hotel({
            name: '近',
            distanceM: 400,
            rating: 4.4,
            category: '商务酒店',
          }),
        ],
      },
      {
        departure: '上海',
        headcount: 2,
        budgetTier: 'standard',
      },
    );

    expect(ranked.hotels[0]?.name).toBe('近');
  });

  it('uses curated hotels when provided', () => {
    const curated = [
      {
        id: 'c1',
        name: '库内酒店A',
        address: '',
        lat: 0,
        lng: 0,
        category: '酒店',
        distanceM: 1300,
        distanceLabel: '步行1.3公里',
        avgPrice: 319,
        rating: 4.4,
        kind: 'hotel' as const,
        keyword: 'curated',
        lateNightFriendly: false,
        score: 1,
        scoreBreakdown: { distance: 1, rating: 1, budget: 1, lateNight: 0 },
      },
    ];
    const ranked = ranker.rank(
      {
        ...baseCtx,
        pois: [hotel({ name: '地图酒店', distanceM: 100, rating: 5 })],
      },
      { departure: '上海', headcount: 2, budgetTier: 'standard' },
      { curatedHotels: curated },
    );
    expect(ranked.hotels.map((h) => h.name)).toEqual(['库内酒店A']);
  });

  it('boosts late-night 夜宵 venues and ignores non-夜宵 nightlife', () => {
    const ranked = ranker.rank(
      {
        ...baseCtx,
        pois: [
          {
            id: '1',
            name: '普通夜宵店',
            address: '',
            lat: 22.51,
            lng: 114.01,
            category: '美食:中餐厅',
            distanceM: 300,
            kind: 'nightlife_food',
            keyword: '夜宵',
            lateNightFriendly: false,
          },
          {
            id: '2',
            name: '深夜火锅',
            address: '',
            lat: 22.51,
            lng: 114.01,
            category: '美食:火锅',
            distanceM: 500,
            kind: 'nightlife_food',
            keyword: '夜宵',
            lateNightFriendly: true,
            rating: 4.2,
          },
          {
            id: '3',
            name: 'Afterparty 酒吧',
            address: '',
            lat: 22.51,
            lng: 114.01,
            category: '娱乐:酒吧',
            distanceM: 200,
            kind: 'nightlife_club',
            keyword: '酒吧',
            lateNightFriendly: true,
            rating: 4.8,
          },
        ],
      },
      {
        departure: '广州',
        headcount: 2,
        budgetTier: 'comfort',
      },
    );

    expect(ranked.nightlife).toHaveLength(2);
    expect(ranked.nightlife[0]?.name).toBe('深夜火锅');
    expect(ranked.nightlife.some((p) => p.name.includes('酒吧'))).toBe(false);
  });
});
