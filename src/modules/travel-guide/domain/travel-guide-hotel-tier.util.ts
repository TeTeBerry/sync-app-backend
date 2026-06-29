import type {
  TravelGuideBudgetTier,
  TravelGuideHotelTierAccommodation,
  TravelGuidePlan,
} from '@sync/travel-guide-contracts';
import type { HotelQuoteSnapshot } from '../ports/travel-quote.types';
import {
  rollingGoHotelSchemes,
  rollingGoHotelToGuideItem,
} from './travel-guide-rollinggo-recommendations.util';

const TIER_ORDER: TravelGuideBudgetTier[] = ['economy', 'standard', 'comfort'];

export function buildHotelTierAccommodationFromQuote(
  quote: HotelQuoteSnapshot,
  input: {
    accommodationNights: number;
    headcount: number;
    tier?: TravelGuideBudgetTier;
  },
): TravelGuideHotelTierAccommodation | null {
  if (!quote.recommendations?.length || input.accommodationNights <= 0) {
    return null;
  }

  const nightLabel = `${input.accommodationNights} 晚`;
  const hotels = quote.recommendations.map((rec, index) =>
    rollingGoHotelToGuideItem(rec, {
      nightLabel,
      headcount: input.headcount,
      currency: quote.currency,
      index,
    }),
  );

  return {
    hotels,
    schemes: rollingGoHotelSchemes(hotels, input.tier ?? 'standard'),
  };
}

export function buildPlanHotelByTierFromQuotes(
  hotelByTier: Partial<Record<TravelGuideBudgetTier, HotelQuoteSnapshot>>,
  input: {
    accommodationNights: number;
    headcount: number;
  },
): TravelGuidePlan['hotelByTier'] | undefined {
  const result: NonNullable<TravelGuidePlan['hotelByTier']> = {};

  for (const tier of TIER_ORDER) {
    const quote = hotelByTier[tier];
    if (!quote) continue;
    const accommodation = buildHotelTierAccommodationFromQuote(quote, {
      ...input,
      tier,
    });
    if (accommodation) {
      result[tier] = accommodation;
    }
  }

  return Object.keys(result).length ? result : undefined;
}

export function applyHotelTierAccommodationToPlan(
  plan: TravelGuidePlan,
  tier: TravelGuideBudgetTier,
): TravelGuidePlan {
  const tierAccommodation = plan.hotelByTier?.[tier];
  if (!tierAccommodation?.hotels.length) return plan;

  return {
    ...plan,
    accommodation: {
      title: plan.accommodation.title || '住宿推荐',
      hotels: tierAccommodation.hotels,
      schemes: tierAccommodation.schemes,
    },
  };
}

export function mergeHotelQuoteIntoPlanHotelByTier(
  plan: TravelGuidePlan,
  tier: TravelGuideBudgetTier,
  quote: HotelQuoteSnapshot,
  input: {
    accommodationNights: number;
    headcount: number;
  },
): TravelGuidePlan {
  const accommodation = buildHotelTierAccommodationFromQuote(quote, {
    ...input,
    tier,
  });
  if (!accommodation) return plan;

  return {
    ...plan,
    hotelByTier: {
      ...(plan.hotelByTier ?? {}),
      [tier]: accommodation,
    },
    accommodation: {
      title: plan.accommodation.title || '住宿推荐（RollingGo 参考）',
      hotels: accommodation.hotels,
      schemes: accommodation.schemes,
    },
  };
}
