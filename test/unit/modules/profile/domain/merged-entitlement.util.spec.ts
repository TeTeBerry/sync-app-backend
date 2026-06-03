import { addUtcDays } from '@src/modules/profile/domain/event-entitlement.util';
import { getPackageTierDefinition } from '@src/modules/profile/domain/package-tier.config';
import { mergeFreeAndPaidQuotas } from '@src/modules/profile/domain/merged-entitlement.util';
import { createEmptyUsage } from '@src/modules/profile/domain/event-entitlement.util';

describe('merged-entitlement.util', () => {
  it('returns free-only quotas when no paid tier', () => {
    const quotas = mergeFreeAndPaidQuotas(
      { period: '2026-05', aiMatchUsed: 0, contactUnlockUsed: 0 },
      null,
      null,
      null,
    );
    expect(quotas.aiMatch.remaining).toBe(3);
    expect(quotas.contactUnlock.remaining).toBe(3);
    expect(quotas.map.active).toBe(false);
    expect(quotas.map.days).toBe(0);
    expect(quotas.basicExposure).toBe(true);
  });

  it('combines free and pro_plus paid remaining', () => {
    const tier = getPackageTierDefinition('pro_plus');
    const purchasedAt = new Date('2026-05-01T00:00:00.000Z');
    const mapExpiresAt = addUtcDays(purchasedAt, tier.limits.mapDays);
    const usage = {
      ...createEmptyUsage(),
      aiMatchUsed: 5,
      contactUnlockUsed: 2,
    };

    const quotas = mergeFreeAndPaidQuotas(
      { period: '2026-05', aiMatchUsed: 1, contactUnlockUsed: 1 },
      tier.limits,
      usage,
      mapExpiresAt,
      new Date('2026-05-10T00:00:00.000Z'),
    );

    expect(quotas.aiMatch).toEqual({ limit: 18, used: 6, remaining: 12 });
    expect(quotas.contactUnlock).toEqual({ limit: 15, used: 3, remaining: 12 });
    expect(quotas.map.active).toBe(true);
    expect(quotas.map.days).toBe(15);
  });
});
