import type {
  TravelGuideBudgetTier,
  TravelGuidePlan,
} from '@sync/travel-guide-contracts';
import { SYNC_BUDGET_TIER_ORDER } from './travel-guide-rollinggo-flight-tier.util';

export function missingFlightBudgetTiers(
  plan: TravelGuidePlan,
): TravelGuideBudgetTier[] {
  return SYNC_BUDGET_TIER_ORDER.filter((tier) => !plan.flightByTier?.[tier]);
}

export function shouldFetchFlightQuoteForTier(
  plan: TravelGuidePlan,
  targetTier: TravelGuideBudgetTier,
  quoteEligible: boolean,
): boolean {
  if (!quoteEligible) return false;
  return !plan.flightByTier?.[targetTier];
}

export function planHasFullFlightTierQuotes(plan: TravelGuidePlan): boolean {
  return SYNC_BUDGET_TIER_ORDER.every((tier) =>
    Boolean(plan.flightByTier?.[tier]),
  );
}
