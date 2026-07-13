import { Injectable } from '@nestjs/common';
import type { NormalizedHotelOption } from '../types/normalized-hotel-option';
import type { TravelGuideBudgetConstraints } from '../budget/budget-constraints.types';
import type { TravelGuideStayPreference } from '@sync/travel-guide-contracts';
import {
  dominantCurrency,
  isViableBudgetFit,
  scoreBudgetFit,
} from '../budget/budget-constraints.types';
import type {
  HotelReasonCode,
  HotelRecommendationCategory,
  HotelRecommendationSet,
  RecommendationResult,
} from './recommendation.types';
import {
  HOTEL_BUDGET_FIT_BLEND,
  HOTEL_SCORE_WEIGHTS,
} from './recommendation.types';

/**
 * Hotel Score =
 *   (distance/price/review/transport/cancellation/trust) blended with
 *   user hotel-budget fit (nightly, separate from relative price).
 *
 * Categories: Best overall / Best value / Closest / Premium
 */
@Injectable()
export class HotelRecommendationService {
  recommend(
    hotels: NormalizedHotelOption[],
    constraints?: TravelGuideBudgetConstraints | null,
    stayPreference: TravelGuideStayPreference = 'festival',
  ): HotelRecommendationSet {
    if (!hotels.length) {
      return { ranked: [] };
    }

    const currency =
      constraints?.currency ??
      dominantCurrency(hotels.map((h) => h.price?.currency)) ??
      'CNY';

    const comparable = hotels.filter(
      (h) => !h.price?.currency || h.price.currency === currency,
    );
    const pool = comparable.length ? comparable : hotels;
    const crossCurrency =
      comparable.length > 0 && comparable.length < hotels.length;

    const scored = pool.map((hotel) =>
      scoreHotel(hotel, pool, constraints, crossCurrency, stayPreference),
    );
    scored.sort((a, b) => b.score - a.score);

    const bestValue = [...scored].sort(
      (a, b) => b.valueScore - a.valueScore || b.score - a.score,
    )[0];
    const closest = [...scored].sort((a, b) => {
      const aDist = a.hotel.distanceToFestivalKm ?? Number.MAX_SAFE_INTEGER;
      const bDist = b.hotel.distanceToFestivalKm ?? Number.MAX_SAFE_INTEGER;
      return aDist - bDist || b.score - a.score;
    })[0];
    const premium = [...scored].sort((a, b) => {
      const aStar = a.hotel.starRating ?? a.hotel.reviewScore ?? 0;
      const bStar = b.hotel.starRating ?? b.hotel.reviewScore ?? 0;
      return bStar - aStar || b.score - a.score;
    })[0];

    // bestOverall: prefer budget-viable; expensive close hotels stay in premium.
    const viable = scored.filter((s) => isViableBudgetFit(s.budgetBand));
    const bestPool = viable.length ? viable : scored;
    const bestOverallResult = toResult(bestPool[0]!, 'bestOverall');

    const bestValueResult = bestValue
      ? toResult(
          {
            ...bestValue,
            reasonCodes: uniqueReasons([
              ...bestValue.reasonCodes,
              'GOOD_VALUE_SCORE',
            ]),
          },
          'bestValue',
        )
      : undefined;
    const closestResult = closest
      ? toResult(
          {
            ...closest,
            reasonCodes: uniqueReasons([
              ...closest.reasonCodes,
              'CLOSEST_TO_VENUE',
            ]),
          },
          'closestPracticalStay',
        )
      : undefined;
    const premiumResult = premium
      ? toResult(
          {
            ...premium,
            reasonCodes: uniqueReasons([
              ...premium.reasonCodes,
              'HIGH_STAR_RATING',
              'PREMIUM_OPTION',
            ]),
          },
          'premium',
        )
      : undefined;

    return {
      bestOverall: bestOverallResult,
      bestValue: bestValueResult,
      closestPracticalStay: closestResult,
      premium: premiumResult,
      ranked: dedupeCategoryResults([
        bestOverallResult,
        bestValueResult,
        closestResult,
        premiumResult,
      ]),
    };
  }
}

function totalPrice(hotel: NormalizedHotelOption, nights: number): number {
  if (hotel.price?.totalAmount && hotel.price.totalAmount > 0) {
    return hotel.price.totalAmount;
  }
  return (hotel.price?.nightlyAmount ?? 0) * Math.max(1, nights);
}

function scoreHotel(
  hotel: NormalizedHotelOption,
  all: NormalizedHotelOption[],
  constraints: TravelGuideBudgetConstraints | null | undefined,
  crossCurrency: boolean,
  stayPreference: TravelGuideStayPreference,
): {
  hotel: NormalizedHotelOption;
  score: number;
  valueScore: number;
  budgetBand: ReturnType<typeof scoreBudgetFit>['band'];
  reasonCodes: HotelReasonCode[];
} {
  const nights = Math.max(1, constraints?.nights ?? 1);
  const totalPrices = all
    .map((h) => totalPrice(h, nights))
    .filter((p) => p > 0);
  const distances = all
    .map((h) => h.distanceToFestivalKm)
    .filter((d): d is number => typeof d === 'number' && d >= 0);
  const travelTimes = all
    .map((h) => h.travelTimeToFestivalMinutes)
    .filter((t): t is number => typeof t === 'number' && t >= 0);

  const minPrice = totalPrices.length ? Math.min(...totalPrices) : 0;
  const maxPrice = totalPrices.length ? Math.max(...totalPrices) : 0;
  const minDist = distances.length ? Math.min(...distances) : 0;
  const maxDist = distances.length ? Math.max(...distances) : 0;
  const minTravel = travelTimes.length ? Math.min(...travelTimes) : 0;
  const maxTravel = travelTimes.length ? Math.max(...travelTimes) : 0;

  const nightly =
    hotel.price?.nightlyAmount ??
    totalPrice(hotel, nights) / Math.max(1, nights);
  const total = totalPrice(hotel, nights);
  const priceNorm =
    maxPrice > minPrice && total > 0
      ? 1 - (total - minPrice) / (maxPrice - minPrice)
      : total > 0
        ? 0.7
        : 0.4;

  const dist =
    hotel.distanceToFestivalKm ?? (distances.length ? maxDist : undefined);
  const distanceNorm =
    dist != null && maxDist > minDist
      ? 1 - (dist - minDist) / (maxDist - minDist)
      : dist != null
        ? 1
        : 0.5;

  const reviewNorm = clamp((hotel.reviewScore ?? 4) / 5);
  const { fit: budgetFit, band: budgetBand } = scoreBudgetFit(
    nightly,
    constraints?.hotelTarget,
  );

  const reasonCodes: HotelReasonCode[] = [];
  if (dist != null && dist === minDist) reasonCodes.push('CLOSEST_TO_VENUE');
  if (priceNorm >= 0.55) reasonCodes.push('PRICE_WITHIN_BALANCED_RANGE');
  if (nightly > 0 && nightly === minPrice) {
    reasonCodes.push('LOWEST_NIGHTLY_PRICE');
  }
  if ((hotel.reviewScore ?? 0) >= 4.3) reasonCodes.push('BEST_REVIEW_SCORE');
  if ((hotel.starRating ?? 0) >= 4) reasonCodes.push('HIGH_STAR_RATING');
  const transportNorm = resolveTransportConvenience(
    hotel,
    distanceNorm,
    minTravel,
    maxTravel,
  );
  if (transportNorm >= 0.75) reasonCodes.push('CONVENIENT_TRANSPORT');
  if (transportNorm <= 0.35) reasonCodes.push('LONG_TRAVEL_TIME');
  if (resolveCancellation(hotel) >= 0.75)
    reasonCodes.push('FLEXIBLE_CANCELLATION');
  if (resolveSupplierTrust(hotel) >= 0.8) reasonCodes.push('TRUSTED_SUPPLIER');
  if (budgetBand === 'within') reasonCodes.push('WITHIN_HOTEL_BUDGET');
  else if (budgetBand === 'slightly_over') {
    reasonCodes.push('SLIGHTLY_OVER_HOTEL_BUDGET');
  } else if (
    budgetBand === 'materially_over' ||
    budgetBand === 'extreme_over'
  ) {
    reasonCodes.push('OVER_HOTEL_BUDGET');
  }
  if (crossCurrency) reasonCodes.push('CURRENCY_MISMATCH');

  const quality =
    HOTEL_SCORE_WEIGHTS.distance * distanceNorm +
    HOTEL_SCORE_WEIGHTS.price * priceNorm +
    HOTEL_SCORE_WEIGHTS.review * reviewNorm;

  const score =
    (1 - HOTEL_BUDGET_FIT_BLEND) * quality + HOTEL_BUDGET_FIT_BLEND * budgetFit;

  const valueScore =
    total > 0
      ? (reviewNorm * 0.45 + distanceNorm * 0.35 + transportNorm * 0.2) /
        Math.max(total / 500, 0.5)
      : score;

  if (valueScore >= 0.8) reasonCodes.push('GOOD_VALUE_SCORE');

  return {
    hotel,
    score: roundScore(score),
    valueScore: roundScore(valueScore),
    budgetBand,
    reasonCodes: uniqueReasons(reasonCodes),
  };
}

function stayPreferenceBonus(
  hotel: NormalizedHotelOption,
  preference: TravelGuideStayPreference,
): number {
  if (preference === 'festival') {
    return hotel.distanceToFestivalKm != null && hotel.distanceToFestivalKm <= 2
      ? 0.18
      : 0;
  }
  if (preference === 'value') {
    return hotel.price?.nightlyAmount ? 0.08 : 0;
  }
  const amenities = (hotel.amenities ?? []).join(' ').toLowerCase();
  return /metro|restaurant|bar|nightclub|city/.test(amenities) ? 0.12 : 0;
}

function resolveTransportConvenience(
  hotel: NormalizedHotelOption,
  distanceNorm: number,
  minTravel: number,
  maxTravel: number,
): number {
  if (hotel.travelTimeToFestivalMinutes != null && maxTravel > minTravel) {
    return (
      1 -
      (hotel.travelTimeToFestivalMinutes - minTravel) / (maxTravel - minTravel)
    );
  }
  if (hotel.travelTimeToFestivalMinutes != null) {
    const minutes = hotel.travelTimeToFestivalMinutes;
    if (minutes <= 15) return 1;
    if (minutes <= 30) return 0.8;
    if (minutes <= 45) return 0.6;
    if (minutes <= 60) return 0.4;
    return 0.2;
  }
  return distanceNorm;
}

function resolveCancellation(hotel: NormalizedHotelOption): number {
  if (
    typeof hotel.cancellationFlexibility === 'number' &&
    Number.isFinite(hotel.cancellationFlexibility)
  ) {
    return clamp(hotel.cancellationFlexibility);
  }
  return 0.5;
}

function resolveSupplierTrust(hotel: NormalizedHotelOption): number {
  if (
    typeof hotel.supplierTrust === 'number' &&
    Number.isFinite(hotel.supplierTrust)
  ) {
    return clamp(hotel.supplierTrust);
  }
  const provider = hotel.provider.toLowerCase();
  if (provider === 'rollinggo') return 0.85;
  if (provider === 'amap') return 0.8;
  return 0.55;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}

function uniqueReasons(codes: HotelReasonCode[]): HotelReasonCode[] {
  return [...new Set(codes)];
}

function toResult(
  item: {
    hotel: NormalizedHotelOption;
    score: number;
    reasonCodes: HotelReasonCode[];
  },
  category: HotelRecommendationCategory,
): RecommendationResult<HotelRecommendationCategory, HotelReasonCode> {
  return {
    optionId: item.hotel.id,
    category,
    score: item.score,
    reasonCodes: item.reasonCodes,
  };
}

function dedupeCategoryResults(
  results: Array<
    | RecommendationResult<HotelRecommendationCategory, HotelReasonCode>
    | undefined
  >,
): Array<RecommendationResult<HotelRecommendationCategory, HotelReasonCode>> {
  const seen = new Set<string>();
  const out: Array<
    RecommendationResult<HotelRecommendationCategory, HotelReasonCode>
  > = [];
  for (const row of results) {
    if (!row || seen.has(row.optionId)) continue;
    seen.add(row.optionId);
    out.push(row);
  }
  return out;
}
