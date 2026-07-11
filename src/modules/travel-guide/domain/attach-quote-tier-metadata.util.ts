import type { TravelGuidePlan } from '@sync/travel-guide-contracts';
import type { TravelQuoteEnrichment } from '../ports/travel-quote.types';
import { attachBudgetTierSnapshots } from './travel-guide-budget-tier-ranges.util';
import {
  buildPlanFlightByTier,
  normalizeFlightTierQuotesMonotonic,
} from './travel-guide-flight-tier.util';
import { buildPlanHotelByTierFromQuotes } from './travel-guide-hotel-tier.util';
import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';
import type { TravelGuideLocale } from './travel-guide-locale';

/**
 * Attach RollingGo tier metadata only.
 * Never mutates selected flight/hotel, budget items, transport lead lines,
 * accommodation primary list, tips, or itinerary.
 */
export function attachQuoteTierMetadataToPlan(
  plan: TravelGuidePlan,
  enrichment: TravelQuoteEnrichment | null | undefined,
  input: {
    headcount: number;
    accommodationNights: number;
    budgetTier?: TravelGuideBudgetTier;
    locale?: TravelGuideLocale;
  },
): TravelGuidePlan {
  if (
    !enrichment?.flight &&
    !enrichment?.hotel &&
    !enrichment?.flightByTier &&
    !enrichment?.hotelByTier
  ) {
    return attachBudgetTierSnapshots(plan, enrichment, {
      selectedBudgetTier: input.budgetTier,
    });
  }

  const rawFlightByTier = enrichment.flightByTier
    ? buildPlanFlightByTier(enrichment.flightByTier)
    : plan.flightByTier;
  const flightByTier = rawFlightByTier
    ? normalizeFlightTierQuotesMonotonic(rawFlightByTier)
    : undefined;

  const builtHotelByTier = enrichment.hotelByTier
    ? buildPlanHotelByTierFromQuotes(enrichment.hotelByTier, {
        accommodationNights: input.accommodationNights,
        headcount: input.headcount,
        locale: input.locale,
      })
    : undefined;
  const hotelByTier = builtHotelByTier
    ? { ...(plan.hotelByTier ?? {}), ...builtHotelByTier }
    : plan.hotelByTier;

  return attachBudgetTierSnapshots(
    {
      ...plan,
      quoteFetchedAt: new Date().toISOString(),
      ...(flightByTier ? { flightByTier } : {}),
      ...(hotelByTier ? { hotelByTier } : {}),
    },
    enrichment,
    { selectedBudgetTier: input.budgetTier },
  );
}
