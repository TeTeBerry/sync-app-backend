import { FREE_MONTHLY_CONTACT_UNLOCK_LIMIT } from './free-tier.config';
import type { QuotaSlot } from './event-entitlement.util';
import { buildQuotaSlot } from './event-entitlement.util';

export interface FreeMonthlyUsage {
  period: string;
  contactUnlockUsed: number;
}

export function formatQuotaPeriod(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** Reset usage when stored period differs from the current calendar month. */
export function normalizeFreeMonthlyUsage(
  stored: Partial<FreeMonthlyUsage> | null | undefined,
  now: Date = new Date(),
): FreeMonthlyUsage {
  const period = formatQuotaPeriod(now);
  if (!stored || stored.period !== period) {
    return {
      period,
      contactUnlockUsed: 0,
    };
  }
  return {
    period,
    contactUnlockUsed: stored.contactUnlockUsed ?? 0,
  };
}

export function buildFreeMonthlyQuotaSlots(usage: FreeMonthlyUsage): {
  contactUnlock: QuotaSlot;
} {
  return {
    contactUnlock: buildQuotaSlot(
      FREE_MONTHLY_CONTACT_UNLOCK_LIMIT,
      usage.contactUnlockUsed,
    ),
  };
}
