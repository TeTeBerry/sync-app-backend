import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';
import { BUDGET_TIER_CONFIG } from '../budget/travel-guide-budget.service';

export type BudgetAmountRange = {
  min?: number;
  max?: number;
};

/**
 * Pre-recommendation budget policy (estimated tier targets, not live prices).
 */
export interface TravelGuideBudgetConstraints {
  /** API tier */
  tier: TravelGuideBudgetTier;
  /** Internal alias: budget | balanced | premium */
  tierAlias: 'budget' | 'balanced' | 'premium';
  currency: 'CNY' | 'USD';
  travelers: number;
  nights: number;
  rooms: number;
  interCity: boolean;
  /** Estimated total trip band (all travelers) */
  totalTarget?: BudgetAmountRange;
  /** Per-adult round-trip flight target */
  flightTarget?: BudgetAmountRange;
  /** Per-room nightly hotel target */
  hotelTarget?: BudgetAmountRange;
  ticketReserve?: BudgetAmountRange;
  foodReserve?: BudgetAmountRange;
  transportReserve?: BudgetAmountRange;
  /** True when targets come from configured tier tables, not live quotes. */
  estimated: true;
}

export type BudgetFitBand =
  | 'within'
  | 'slightly_over'
  | 'materially_over'
  | 'extreme_over'
  | 'unknown';

export function roomCountFromTravelers(travelers: number): number {
  if (travelers <= 1) return 1;
  return Math.ceil(travelers / 2);
}

export function tierAliasFor(
  tier: TravelGuideBudgetTier,
): TravelGuideBudgetConstraints['tierAlias'] {
  return BUDGET_TIER_CONFIG[tier].alias;
}

/**
 * Map amount vs target max into a 0–1 fit score and band.
 * Slightly over ≤15%, materially ≤40%, extreme >40%.
 */
export function scoreBudgetFit(
  amount: number | undefined,
  target: BudgetAmountRange | undefined,
): { fit: number; band: BudgetFitBand } {
  if (
    amount == null ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    target?.max == null ||
    !Number.isFinite(target.max) ||
    target.max <= 0
  ) {
    return { fit: 0.5, band: 'unknown' };
  }

  const max = target.max;
  const min = target.min != null && target.min > 0 ? target.min : max * 0.5;

  if (amount <= max) {
    // Prefer mid-band; still positive when under min.
    if (amount >= min) return { fit: 1, band: 'within' };
    const underRatio = amount / min;
    return { fit: 0.75 + 0.25 * underRatio, band: 'within' };
  }

  const overRatio = amount / max;
  if (overRatio <= 1.15) {
    return { fit: 0.55, band: 'slightly_over' };
  }
  if (overRatio <= 1.4) {
    return { fit: 0.25, band: 'materially_over' };
  }
  return { fit: 0.05, band: 'extreme_over' };
}

export function isViableBudgetFit(band: BudgetFitBand): boolean {
  return (
    band === 'within' ||
    band === 'slightly_over' ||
    band === 'materially_over' ||
    band === 'unknown'
  );
}

/** Pick dominant currency among options; returns null if empty. */
export function dominantCurrency(
  currencies: Array<'CNY' | 'USD' | undefined>,
): 'CNY' | 'USD' | null {
  const counts = { CNY: 0, USD: 0 };
  for (const c of currencies) {
    if (c === 'CNY' || c === 'USD') counts[c] += 1;
  }
  if (counts.CNY === 0 && counts.USD === 0) return null;
  if (counts.CNY >= counts.USD) return 'CNY';
  return 'USD';
}
