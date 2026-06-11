import {
  addUtcDays,
  computeMapExpiresAt,
  computePackageValidUntil,
  buildEventEntitlementQuotas,
  canConsumeContactUnlock,
  canConsumePostPin,
  createEmptyUsage,
  isMapEntitlementActive,
} from '@src/modules/profile/domain/event-entitlement.util';
import { getPackageTierDefinition } from '@src/modules/profile/domain/package-tier.config';

describe('event-entitlement.util', () => {
  const purchasedAt = new Date('2026-05-01T00:00:00.000Z');

  it('computes remaining quotas for pro', () => {
    const limits = getPackageTierDefinition('pro').limits;
    const usage = { contactUnlockUsed: 2, postPinUsed: 0 };
    const mapExpiresAt = addUtcDays(purchasedAt, limits.mapDays);
    const quotas = buildEventEntitlementQuotas(
      limits,
      usage,
      mapExpiresAt,
      new Date('2026-05-05T00:00:00.000Z'),
    );

    expect(quotas.contactUnlock).toEqual({ limit: 5, used: 2, remaining: 3 });
    expect(quotas.postPin).toEqual({ limit: 0, used: 0, remaining: 0 });
    expect(quotas.basicExposure).toBe(true);
    expect(quotas.map.active).toBe(true);
  });

  it('treats ultra contact unlock as unlimited', () => {
    const limits = getPackageTierDefinition('ultra').limits;
    const usage = { contactUnlockUsed: 50, postPinUsed: 0 };
    const mapExpiresAt = addUtcDays(purchasedAt, limits.mapDays);

    expect(canConsumeContactUnlock(limits, usage)).toBe(true);

    const quotas = buildEventEntitlementQuotas(limits, usage, mapExpiresAt);
    expect(quotas.contactUnlock.remaining).toBeNull();
  });

  it('blocks post pin when pro_plus pin used', () => {
    const limits = getPackageTierDefinition('pro_plus').limits;
    const usage = { ...createEmptyUsage(), postPinUsed: 1 };
    expect(canConsumePostPin(limits, usage)).toBe(false);
  });

  it('detects expired map access', () => {
    const validUntil = computePackageValidUntil(purchasedAt);
    const mapExpiresAt = computeMapExpiresAt(purchasedAt, 7, validUntil);
    expect(
      isMapEntitlementActive(
        mapExpiresAt,
        new Date('2026-05-20T00:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('pro purchase map expires at tier map days within 30-day package', () => {
    const limits = getPackageTierDefinition('pro').limits;
    const validUntil = computePackageValidUntil(purchasedAt);
    const mapExpiresAt = computeMapExpiresAt(
      purchasedAt,
      limits.mapDays,
      validUntil,
    );
    expect(mapExpiresAt.toISOString()).toBe('2026-05-08T00:00:00.000Z');
    expect(validUntil.toISOString()).toBe('2026-05-31T00:00:00.000Z');
  });
});
