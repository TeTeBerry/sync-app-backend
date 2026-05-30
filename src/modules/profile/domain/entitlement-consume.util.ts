import {
  canConsumeAiMatch,
  canConsumeContactUnlock,
} from './event-entitlement.util';
import type { EventEntitlementUsage } from './event-entitlement.util';
import {
  buildFreeMonthlyQuotaSlots,
  type FreeMonthlyUsage,
} from './free-quota.util';
import type { PackageTierLimits } from './package-tier.config';

export type EntitlementConsumeBucket = 'free' | 'paid';

export function resolveAiMatchConsumeBucket(
  freeUsage: FreeMonthlyUsage,
  paidLimits: PackageTierLimits | null,
  paidUsage: EventEntitlementUsage | null,
): EntitlementConsumeBucket | null {
  const freeSlots = buildFreeMonthlyQuotaSlots(freeUsage);
  if ((freeSlots.aiMatch.remaining ?? 0) > 0) {
    return 'free';
  }
  if (paidLimits && paidUsage && canConsumeAiMatch(paidLimits, paidUsage)) {
    return 'paid';
  }
  return null;
}

export function resolveContactUnlockConsumeBucket(
  freeUsage: FreeMonthlyUsage,
  paidLimits: PackageTierLimits | null,
  paidUsage: EventEntitlementUsage | null,
): EntitlementConsumeBucket | null {
  const freeSlots = buildFreeMonthlyQuotaSlots(freeUsage);
  if ((freeSlots.contactUnlock.remaining ?? 0) > 0) {
    return 'free';
  }
  if (
    paidLimits &&
    paidUsage &&
    canConsumeContactUnlock(paidLimits, paidUsage)
  ) {
    return 'paid';
  }
  return null;
}
