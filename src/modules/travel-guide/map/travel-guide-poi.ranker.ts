import { Injectable } from '@nestjs/common';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import { budgetTierHotelNightRanges } from '../domain/parse-activity-days.util';
import type { TravelGuideBudgetTier } from '../domain/travel-guide.types';
import type {
  RankedMapPoi,
  RawMapPoi,
  TravelGuideMapContext,
  TravelGuideRankedCandidates,
} from './travel-guide-map.types';

const DEFAULT_MIN_HOTEL_RATING = 4.0;

const TIER_PRICE_MID: Record<TravelGuideBudgetTier, number> = {
  economy: 225,
  standard: 450,
  comfort: 700,
};

const TIER_PRICE_RANGE: Record<TravelGuideBudgetTier, [number, number]> = {
  economy: [150, 300],
  standard: [300, 600],
  comfort: [600, 1200],
};

@Injectable()
export class TravelGuidePoiRanker {
  rank(
    ctx: TravelGuideMapContext,
    dto: GenerateTravelGuideDto,
    minHotelRating = DEFAULT_MIN_HOTEL_RATING,
  ): TravelGuideRankedCandidates {
    const budgetTier = dto.budgetTier;
    const ranges = budgetTierHotelNightRanges(budgetTier);

    const hotels = this.rankList(
      ctx.pois.filter((p) => p.kind === 'hotel'),
      {
        budgetTier,
        minRating: minHotelRating,
        preferLateNight: false,
        eventEndHour: ctx.eventEndHour,
        isHotel: true,
      },
    ).slice(0, 6);

    const parking = this.rankList(
      ctx.pois.filter((p) => p.kind === 'parking'),
      {
        budgetTier,
        minRating: 0,
        preferLateNight: false,
        eventEndHour: ctx.eventEndHour,
        isHotel: false,
      },
    ).slice(0, 4);

    const nightlife = this.rankList(
      ctx.pois.filter((p) => p.kind.startsWith('nightlife')),
      {
        budgetTier,
        minRating: 3.5,
        preferLateNight: true,
        eventEndHour: ctx.eventEndHour,
        isHotel: false,
      },
    ).slice(0, 8);

    return {
      hotels,
      parking,
      nightlife,
      minHotelRating,
      budgetTier,
      hotelPriceBand: [ranges.primary, ranges.secondary],
    };
  }

  private rankList(
    pois: RawMapPoi[],
    opts: {
      budgetTier: TravelGuideBudgetTier;
      minRating: number;
      preferLateNight: boolean;
      eventEndHour: number;
      isHotel: boolean;
    },
  ): RankedMapPoi[] {
    const filtered = pois.filter((poi) => {
      if (poi.rating != null && poi.rating < opts.minRating) return false;
      return true;
    });

    return filtered
      .map((poi) => {
        const distance = distanceScore(poi.distanceM);
        const rating = ratingScore(poi.rating, opts.minRating);
        const budget =
          opts.isHotel ?
            budgetScore(estimateHotelPrice(poi, opts.budgetTier), opts.budgetTier)
          : 0.6;
        const lateNight =
          opts.preferLateNight ?
            lateNightScore(poi, opts.eventEndHour)
          : 0;

        const score =
          opts.isHotel ?
            0.42 * distance + 0.33 * rating + 0.25 * budget
          : opts.preferLateNight ?
            0.38 * distance + 0.27 * rating + 0.35 * lateNight
          : 0.55 * distance + 0.45 * rating;

        return {
          ...poi,
          score,
          scoreBreakdown: { distance, rating, budget, lateNight },
        };
      })
      .sort((a, b) => b.score - a.score || a.distanceM - b.distanceM);
  }
}

function distanceScore(distanceM: number): number {
  if (distanceM <= 0) return 0.5;
  return 1 / (1 + distanceM / 1800);
}

function ratingScore(rating: number | undefined, floor: number): number {
  const r = rating ?? Math.max(floor, 4.0);
  return Math.min(1, r / 5);
}

function budgetScore(estimate: number, tier: TravelGuideBudgetTier): number {
  const [min, max] = TIER_PRICE_RANGE[tier];
  if (estimate >= min && estimate <= max) return 1;
  if (estimate < min) return Math.max(0.2, 1 - (min - estimate) / min);
  return Math.max(0.15, 1 - (estimate - max) / max);
}

function estimateHotelPrice(
  poi: RawMapPoi,
  tier: TravelGuideBudgetTier,
): number {
  if (poi.avgPrice && poi.avgPrice > 50) return poi.avgPrice;
  const cat = poi.category;
  if (/五星|豪华|度假/.test(cat)) return 750;
  if (/四星|高档/.test(cat)) return 520;
  if (/三星|商务/.test(cat)) return 380;
  if (/快捷|经济|连锁/.test(cat)) return 220;
  return TIER_PRICE_MID[tier];
}

function lateNightScore(poi: RawMapPoi, eventEndHour: number): number {
  let score = poi.lateNightFriendly ? 0.85 : 0.35;
  if (eventEndHour >= 22 && /酒吧|夜店|club|live/i.test(`${poi.name} ${poi.category}`)) {
    score = Math.min(1, score + 0.15);
  }
  if (/24/.test(`${poi.name} ${poi.category}`)) {
    score = 1;
  }
  return score;
}
