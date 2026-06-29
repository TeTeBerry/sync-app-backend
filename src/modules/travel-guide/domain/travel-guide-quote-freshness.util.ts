import type { TravelGuidePlan } from '@sync/travel-guide-contracts';
import { TRAVEL_QUOTE_DISCLAIMER } from './travel-guide-quote.util';
import { hasRollingGoFlightBudget } from './travel-guide-flight-budget-detect.util';

const DEFAULT_QUOTE_CACHE_TTL_SEC = 3600;

export function resolveQuoteCacheTtlMs(
  quoteCacheTtlSec?: number | null,
): number {
  const sec =
    typeof quoteCacheTtlSec === 'number' && quoteCacheTtlSec > 0
      ? quoteCacheTtlSec
      : DEFAULT_QUOTE_CACHE_TTL_SEC;
  return sec * 1000;
}

export function hasEmbeddedRollingGoHotelQuote(plan: TravelGuidePlan): boolean {
  if (plan.accommodationNights <= 0) return false;
  const accommodationItem = plan.budget?.items?.find((item) =>
    item.label.startsWith('住宿'),
  );
  if (accommodationItem?.note?.includes(TRAVEL_QUOTE_DISCLAIMER)) {
    return true;
  }
  return (plan.budgetTierSnapshots?.length ?? 0) >= 3;
}

export function hasEmbeddedRollingGoQuote(plan: TravelGuidePlan): boolean {
  const items = plan.budget?.items ?? [];
  if (hasRollingGoFlightBudget(items)) return true;
  return hasEmbeddedRollingGoHotelQuote(plan);
}

export function isPlanQuoteFresh(
  plan: TravelGuidePlan,
  ttlMs: number,
  now: Date = new Date(),
): boolean {
  if (!plan.quoteFetchedAt?.trim()) return false;
  if (!hasEmbeddedRollingGoQuote(plan)) return false;
  const fetchedAt = Date.parse(plan.quoteFetchedAt);
  if (!Number.isFinite(fetchedAt)) return false;
  return now.getTime() - fetchedAt < ttlMs;
}
