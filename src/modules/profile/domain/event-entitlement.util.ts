import type { PackageTierLimits } from './package-tier.config';
import { getPackageTierDefinition } from './package-tier.config';
import type { PackageTierId } from './package-tier-id.type';

export interface EventEntitlementUsage {
  aiMatchUsed: number;
  contactUnlockUsed: number;
  postPinUsed: number;
}

export interface QuotaSlot {
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface MapEntitlementSlot {
  days: number;
  expiresAt: string;
  active: boolean;
}

export interface EventEntitlementQuotas {
  aiMatch: QuotaSlot;
  contactUnlock: QuotaSlot;
  map: MapEntitlementSlot;
  postPin: QuotaSlot;
  basicExposure: boolean;
}

/** Per-activity package validity from purchase (UTC calendar days). */
export const PACKAGE_ENTITLEMENT_VALIDITY_DAYS = 30;

export function createEmptyUsage(): EventEntitlementUsage {
  return {
    aiMatchUsed: 0,
    contactUnlockUsed: 0,
    postPinUsed: 0,
  };
}

export function addUtcDays(from: Date, days: number): Date {
  const result = new Date(from.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function computePackageValidUntil(
  purchasedAt: Date,
  validityDays: number = PACKAGE_ENTITLEMENT_VALIDITY_DAYS,
): Date {
  return addUtcDays(purchasedAt, validityDays);
}

/** Map access ends at tier map-days or package validUntil, whichever is sooner. */
export function computeMapExpiresAt(
  purchasedAt: Date,
  mapDays: number,
  validUntil: Date,
): Date {
  const tierMapEnd = addUtcDays(purchasedAt, mapDays);
  return tierMapEnd.getTime() < validUntil.getTime() ? tierMapEnd : validUntil;
}

export function isPackageEntitlementActive(
  validUntil: Date,
  now: Date = new Date(),
): boolean {
  return validUntil.getTime() > now.getTime();
}

export function resolveRecordValidUntil(record: {
  validUntil?: Date | string | null;
  purchasedAt: Date | string;
}): Date {
  if (record.validUntil != null) {
    return new Date(record.validUntil);
  }
  return computePackageValidUntil(new Date(record.purchasedAt));
}

export function buildQuotaSlot(limit: number | null, used: number): QuotaSlot {
  if (limit == null) {
    return { limit: null, used, remaining: null };
  }
  const remaining = Math.max(0, limit - used);
  return { limit, used, remaining };
}

export function buildEventEntitlementQuotas(
  limits: PackageTierLimits,
  usage: EventEntitlementUsage,
  mapExpiresAt: Date,
  now: Date = new Date(),
): EventEntitlementQuotas {
  const mapActive = mapExpiresAt.getTime() > now.getTime();
  return {
    aiMatch: buildQuotaSlot(limits.aiMatchCount, usage.aiMatchUsed),
    contactUnlock: buildQuotaSlot(
      limits.contactUnlockCount,
      usage.contactUnlockUsed,
    ),
    map: {
      days: limits.mapDays,
      expiresAt: mapExpiresAt.toISOString(),
      active: mapActive,
    },
    postPin: buildQuotaSlot(limits.postPinCount, usage.postPinUsed),
    basicExposure: limits.basicExposure,
  };
}

export function canConsumeAiMatch(
  limits: PackageTierLimits,
  usage: EventEntitlementUsage,
): boolean {
  if (limits.aiMatchCount == null) return true;
  return usage.aiMatchUsed < limits.aiMatchCount;
}

export function canConsumeContactUnlock(
  limits: PackageTierLimits,
  usage: EventEntitlementUsage,
): boolean {
  if (limits.contactUnlockCount == null) return true;
  return usage.contactUnlockUsed < limits.contactUnlockCount;
}

export function canConsumePostPin(
  limits: PackageTierLimits,
  usage: EventEntitlementUsage,
): boolean {
  return usage.postPinUsed < limits.postPinCount;
}

export function isMapEntitlementActive(
  mapExpiresAt: Date,
  now: Date = new Date(),
): boolean {
  return mapExpiresAt.getTime() > now.getTime();
}

export function buildEntitlementView(
  tierId: PackageTierId,
  usage: EventEntitlementUsage,
  mapExpiresAt: Date,
  purchasedAt: Date,
  now?: Date,
): {
  tierId: PackageTierId;
  tierName: string;
  purchasedAt: string;
  quotas: EventEntitlementQuotas;
} {
  const tier = getPackageTierDefinition(tierId);
  return {
    tierId,
    tierName: tier.name,
    purchasedAt: purchasedAt.toISOString(),
    quotas: buildEventEntitlementQuotas(tier.limits, usage, mapExpiresAt, now),
  };
}
