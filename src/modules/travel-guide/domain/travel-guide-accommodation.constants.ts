import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';
import type { RankedMapPoi } from '../map/travel-guide-map.types';

/** 每个预算档位展示的精选酒店方案数（卡片网格） */
export const TRAVEL_GUIDE_TIER_HOTEL_SCHEME_COUNT = 5;

/** 每个预算档位完整酒店名单上限 */
export const TRAVEL_GUIDE_TIER_HOTEL_LIST_LIMIT = 8;

const SCHEME_LABELS_BY_TIER: Record<TravelGuideBudgetTier, string[]> = {
  economy: ['性价比首推', '场馆周边', '经济连锁', '地铁沿线', '综合备选'],
  standard: ['综合首推', '场馆周边', '舒适商务', '商圈配套', '同档备选'],
  comfort: ['豪华首推', '场馆周边', '高星度假', '商圈尊享', '同档备选'],
};

const GENERIC_SCHEME_LABELS = [
  '综合首推',
  '场馆周边',
  '步行可达',
  '商圈配套',
  '同档备选',
];

export function tierAccommodationSchemeLabel(
  index: number,
  tier: TravelGuideBudgetTier,
): string {
  const labels = SCHEME_LABELS_BY_TIER[tier] ?? GENERIC_SCHEME_LABELS;
  return labels[index] ?? `综合推荐${index + 1}`;
}

export function tierAccommodationSchemeReason(
  poi: RankedMapPoi,
  tier: TravelGuideBudgetTier,
  index: number,
): string {
  if (index === 0) {
    if (tier === 'economy') {
      return '同档位内距离、评分与价位综合最优，控预算首选。';
    }
    if (tier === 'comfort') {
      return '同档位内综合评分与档次最优，适合追求住宿品质。';
    }
    return '同档位内距离、评分与价位综合最优，舒适档首推。';
  }
  if (poi.distanceM <= 800) {
    return '距会场近，散场后回程短，适合连刷多日、最大化在场时间。';
  }
  if (poi.distanceM >= 2000) {
    return '商圈/市区配套更全，餐饮购物与次日出行方便，适合兼顾城市体验。';
  }
  if (tier === 'economy') {
    return '价位落在经济档区间内，可作为同档备选对比预订。';
  }
  if (tier === 'comfort') {
    return '档次与价位匹配豪华档，可作为同档备选对比预订。';
  }
  return '综合距离、评分与同档价位入选，可按房态灵活替换。';
}
