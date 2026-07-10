import type { Activity } from '../../../database/schemas/activity.schema';
import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';
import { getHotPathFallbackPois } from '@src/data/travel-guide/travel-guide-hot-path-pois.data';
import { budgetTierHotelNightRanges } from './parse-activity-days.util';
import type { LlmTravelGuidePayload } from './travel-guide-llm.types';
import {
  accommodationSchemesFromRanked,
  hotelsFromRanked,
} from '../map/travel-guide-map-plan.builder';
import {
  pickTierAccommodationHotels,
  rankHotelPoisForBudgetTier,
} from '../map/travel-guide-poi.ranker';
import { TRAVEL_GUIDE_TIER_HOTEL_SCHEME_COUNT } from './travel-guide-accommodation.constants';
import { buildPlanHotelByTierFromMapRankings } from './travel-guide-map-hotel-tier.util';

function roomHint(headcount: number): string {
  if (headcount <= 1) return '单人入住';
  if (headcount === 2) return '双床/大床房即可';
  const rooms = Math.ceil(headcount / 2);
  return `建议 ${rooms} 间房（${headcount} 人可双人间拼住）`;
}

function hotPathHotelPois(activityLegacyId?: number) {
  if (!activityLegacyId) return [];
  return getHotPathFallbackPois(activityLegacyId, 'hotel');
}

export function buildAbroadAccommodationFromHotPath(
  activity: Pick<Activity, 'legacyId' | 'region'>,
  budgetTier: TravelGuideBudgetTier,
  headcount: number,
  accommodationNights: number,
): Pick<LlmTravelGuidePayload, 'hotels' | 'accommodationSchemes'> {
  const rawHotels = hotPathHotelPois(activity.legacyId);
  if (!rawHotels.length) {
    return { hotels: [], accommodationSchemes: [] };
  }

  const ranked = rankHotelPoisForBudgetTier(rawHotels, budgetTier);
  if (!ranked.length) {
    return { hotels: [], accommodationSchemes: [] };
  }

  const nightLabel = `${accommodationNights} 晚`;
  const room = roomHint(headcount);
  const ranges = budgetTierHotelNightRanges(budgetTier);
  const priceBand: [string, string] = [ranges.primary, ranges.secondary];
  const schemeHotels = pickTierAccommodationHotels(
    ranked,
    budgetTier,
    TRAVEL_GUIDE_TIER_HOTEL_SCHEME_COUNT,
  );

  return {
    hotels: hotelsFromRanked(
      ranked,
      nightLabel,
      room,
      priceBand,
      activity,
      schemeHotels,
      budgetTier,
    ),
    accommodationSchemes: accommodationSchemesFromRanked(
      schemeHotels,
      nightLabel,
      room,
      priceBand,
      activity,
      budgetTier,
    ),
  };
}

export function buildPlanHotelByTierFromHotPath(
  activity: Pick<Activity, 'legacyId' | 'region'>,
  input: {
    accommodationNights: number;
    headcount: number;
    budgetTier: TravelGuideBudgetTier;
  },
): ReturnType<typeof buildPlanHotelByTierFromMapRankings> {
  const rawHotels = hotPathHotelPois(activity.legacyId);
  if (!rawHotels.length || input.accommodationNights <= 0) {
    return undefined;
  }

  const ranked = rankHotelPoisForBudgetTier(rawHotels, input.budgetTier);
  if (!ranked.length) {
    return undefined;
  }

  return buildPlanHotelByTierFromMapRankings(
    { [input.budgetTier]: ranked },
    {
      accommodationNights: input.accommodationNights,
      headcount: input.headcount,
      activity,
      selectedBudgetTier: input.budgetTier,
    },
  );
}
