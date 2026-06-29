import type {
  TravelGuideBudgetTier,
  TravelGuidePlan,
} from '@sync/travel-guide-contracts';
import { findBudgetTierSnapshot } from './travel-guide-budget-tier-ranges.util';

function isSnapshotFromRollingGoTier(
  plan: TravelGuidePlan,
  tier: TravelGuideBudgetTier,
): boolean {
  return plan.quoteTierSources?.[tier] === 'rollinggo';
}

export function shouldRefreshAccommodationFromMap(
  plan: TravelGuidePlan,
  targetTier: TravelGuideBudgetTier,
): boolean {
  if (plan.accommodationNights <= 0) return false;
  if (plan.hotelByTier?.[targetTier]?.hotels.length) return false;
  if (!plan.accommodation.hotels.length) return true;

  const snapshot = findBudgetTierSnapshot(targetTier, plan.budgetTierSnapshots);
  if (!snapshot || snapshot.nightlyMin <= 0) return true;

  return false;
}

export function shouldFetchHotelQuoteForTier(
  plan: TravelGuidePlan,
  targetTier: TravelGuideBudgetTier,
): boolean {
  if (plan.accommodationNights <= 0) return false;
  if (plan.hotelByTier?.[targetTier]?.hotels.length) return false;

  const snapshot = findBudgetTierSnapshot(targetTier, plan.budgetTierSnapshots);
  if (isSnapshotFromRollingGoTier(plan, targetTier)) return true;

  return !snapshot || snapshot.nightlyMin <= 0;
}
