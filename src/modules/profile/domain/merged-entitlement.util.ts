import type { EventEntitlementQuotas, QuotaSlot } from './event-entitlement.util';
import { buildQuotaSlot } from './event-entitlement.util';
import type { PackageTierLimits } from './package-tier.config';
import type { EventEntitlementUsage } from './event-entitlement.util';
import { buildEventEntitlementQuotas } from './event-entitlement.util';
import type { FreeMonthlyUsage } from './free-quota.util';
import { buildFreeMonthlyQuotaSlots } from './free-quota.util';

function mergeCountableSlots(free: QuotaSlot, paid: QuotaSlot): QuotaSlot {
  if (paid.limit == null) {
    return paid;
  }
  const freeRemaining = free.remaining ?? 0;
  const paidRemaining = paid.remaining ?? 0;
  const freeLimit = free.limit ?? 0;
  const paidLimit = paid.limit ?? 0;
  const combinedLimit = freeLimit + paidLimit;
  const combinedUsed = free.used + paid.used;
  const combinedRemaining = freeRemaining + paidRemaining;
  return {
    limit: combinedLimit,
    used: combinedUsed,
    remaining: combinedRemaining,
  };
}

const INACTIVE_MAP: EventEntitlementQuotas['map'] = {
  days: 0,
  expiresAt: new Date(0).toISOString(),
  active: false,
};

/** Merge global free monthly quotas with optional per-event paid entitlements. */
export function mergeFreeAndPaidQuotas(
  freeUsage: FreeMonthlyUsage,
  paidLimits: PackageTierLimits | null,
  paidUsage: EventEntitlementUsage | null,
  mapExpiresAt: Date | null,
  now: Date = new Date(),
): EventEntitlementQuotas {
  const freeSlots = buildFreeMonthlyQuotaSlots(freeUsage);

  if (!paidLimits || !paidUsage || !mapExpiresAt) {
    return {
      aiMatch: freeSlots.aiMatch,
      contactUnlock: freeSlots.contactUnlock,
      map: INACTIVE_MAP,
      postPin: buildQuotaSlot(0, 0),
      basicExposure: true,
    };
  }

  const paidQuotas = buildEventEntitlementQuotas(
    paidLimits,
    paidUsage,
    mapExpiresAt,
    now,
  );

  return {
    aiMatch: mergeCountableSlots(freeSlots.aiMatch, paidQuotas.aiMatch),
    contactUnlock: mergeCountableSlots(
      freeSlots.contactUnlock,
      paidQuotas.contactUnlock,
    ),
    map: paidQuotas.map,
    postPin: paidQuotas.postPin,
    basicExposure: paidQuotas.basicExposure || true,
  };
}
