import type { Activity } from '../../../database/schemas/activity.schema';
import type {
  TravelGuideBudgetTier,
  TravelGuidePlan,
} from '@sync/travel-guide-contracts';
import { budgetTierHotelNightRanges } from './parse-activity-days.util';
import { TRAVEL_GUIDE_TIER_HOTEL_SCHEME_COUNT } from './travel-guide-accommodation.constants';
import {
  accommodationSchemesFromRanked,
  hotelsFromRanked,
} from '../map/travel-guide-map-plan.builder';
import type { RankedMapPoi } from '../map/travel-guide-map.types';
import { pickTierAccommodationHotels } from '../map/travel-guide-poi.ranker';

const TIER_ORDER: TravelGuideBudgetTier[] = ['economy', 'standard', 'comfort'];

function roomHint(headcount: number): string {
  if (headcount <= 1) return '单人入住';
  if (headcount === 2) return '双床/大床房即可';
  const rooms = Math.ceil(headcount / 2);
  return `建议 ${rooms} 间房（${headcount} 人可双人间拼住）`;
}

/** 将地图 POI 写入 plan.hotelByTier；默认仅构建 selectedBudgetTier（用户所选档）。 */
export function buildPlanHotelByTierFromMapRankings(
  hotelsByTier: Partial<Record<TravelGuideBudgetTier, RankedMapPoi[]>>,
  input: {
    accommodationNights: number;
    headcount: number;
    activity: Pick<Activity, 'region'>;
    selectedBudgetTier?: TravelGuideBudgetTier;
  },
): TravelGuidePlan['hotelByTier'] | undefined {
  if (input.accommodationNights <= 0) return undefined;

  const nightLabel = `${input.accommodationNights} 晚`;
  const room = roomHint(input.headcount);
  const result: NonNullable<TravelGuidePlan['hotelByTier']> = {};
  const tiersToBuild: TravelGuideBudgetTier[] = input.selectedBudgetTier
    ? [input.selectedBudgetTier]
    : TIER_ORDER;

  for (const tier of tiersToBuild) {
    const ranked = hotelsByTier[tier];
    if (!ranked?.length) continue;

    const ranges = budgetTierHotelNightRanges(tier);
    const priceBand: [string, string] = [ranges.primary, ranges.secondary];
    const schemeHotels = pickTierAccommodationHotels(
      ranked,
      tier,
      TRAVEL_GUIDE_TIER_HOTEL_SCHEME_COUNT,
    );

    result[tier] = {
      hotels: hotelsFromRanked(
        ranked,
        nightLabel,
        room,
        priceBand,
        input.activity,
        schemeHotels,
        tier,
      ),
      schemes: accommodationSchemesFromRanked(
        schemeHotels,
        nightLabel,
        room,
        priceBand,
        input.activity,
        tier,
      ),
    };
  }

  return Object.keys(result).length ? result : undefined;
}
