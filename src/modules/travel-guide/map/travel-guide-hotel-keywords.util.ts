import type { TravelGuideBudgetTier } from '../domain/travel-guide.types';

/** 按预算档位检索不同价位段的酒店 POI，避免各档位都落到同一批经济型结果。 */
export function hotelSearchKeywordsForBudgetTier(
  tier: TravelGuideBudgetTier,
): string[] {
  switch (tier) {
    case 'economy':
      return ['快捷酒店', '经济型酒店'];
    case 'standard':
      return ['商务酒店', '酒店'];
    case 'comfort':
      return ['五星级酒店', '豪华酒店'];
    default:
      return ['酒店', '宾馆'];
  }
}
