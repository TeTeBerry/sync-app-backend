import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';

export type HotelSearchKeywordOptions = {
  abroad?: boolean;
};

/** 按预算档位检索不同价位段的酒店 POI，避免各档位都落到同一批结果。 */
export function hotelSearchKeywordsForBudgetTier(
  tier: TravelGuideBudgetTier,
  options?: HotelSearchKeywordOptions,
): string[] {
  if (options?.abroad) {
    switch (tier) {
      case 'economy':
        return ['guesthouse', 'hostel', '经济型酒店'];
      case 'standard':
        return ['商务酒店', '四星级酒店'];
      case 'comfort':
        return ['豪华酒店', 'resort'];
      default:
        return ['酒店'];
    }
  }

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
