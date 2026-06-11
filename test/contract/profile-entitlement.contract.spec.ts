import {
  buildEventEntitlementQuotas,
  createEmptyUsage,
  type EventEntitlementQuotas,
} from '@src/modules/profile/domain/event-entitlement.util';
import { buildFreeMonthlyQuotaSlots } from '@src/modules/profile/domain/free-quota.util';
import { getPackageTierDefinition } from '@src/modules/profile/domain/package-tier.config';
import type { ConsumeProfileEntitlementResultDto } from '@src/modules/profile/profile-entitlement-consume.service';
import type { EventPackageEntitlementDto } from '@src/modules/profile/profile-package.service';
import type { FreeMonthlyQuotaDto } from '@src/modules/profile/profile-free-quota.service';

const EVENT_QUOTA_KEYS: (keyof EventEntitlementQuotas)[] = [
  'contactUnlock',
  'map',
  'postPin',
  'basicExposure',
];

const FREE_MONTHLY_KEYS: (keyof FreeMonthlyQuotaDto)[] = [
  'period',
  'contactUnlock',
];

describe('profile entitlement contract', () => {
  it('EventEntitlementQuotas keys exclude removed aiMatch', () => {
    const tier = getPackageTierDefinition('pro');
    const quotas = buildEventEntitlementQuotas(
      tier.limits,
      createEmptyUsage(),
      new Date('2099-06-01T00:00:00.000Z'),
      new Date('2026-06-01T00:00:00.000Z'),
    );

    expect(Object.keys(quotas).sort()).toEqual([...EVENT_QUOTA_KEYS].sort());
    expect(quotas).not.toHaveProperty('aiMatch');
    for (const key of EVENT_QUOTA_KEYS) {
      expect(quotas).toHaveProperty(key);
    }
  });

  it('FreeMonthlyQuota keys exclude removed aiMatch', () => {
    const freeMonthly: FreeMonthlyQuotaDto = {
      period: '2026-06',
      ...buildFreeMonthlyQuotaSlots({
        period: '2026-06',
        contactUnlockUsed: 0,
      }),
    };

    expect(Object.keys(freeMonthly).sort()).toEqual(
      [...FREE_MONTHLY_KEYS].sort(),
    );
    expect(freeMonthly).not.toHaveProperty('aiMatch');
  });

  it('documents EventPackageEntitlementDto sample shape', () => {
    const tier = getPackageTierDefinition('pro');
    const quotas = buildEventEntitlementQuotas(
      tier.limits,
      createEmptyUsage(),
      new Date('2099-06-01T00:00:00.000Z'),
      new Date('2026-06-01T00:00:00.000Z'),
    );
    const sample: EventPackageEntitlementDto = {
      activityLegacyId: 4,
      tierId: 'pro',
      tierName: 'Pro',
      purchasedAt: '2026-06-01T00:00:00.000Z',
      validFrom: '2026-06-01T00:00:00.000Z',
      validUntil: '2026-07-01T00:00:00.000Z',
      quotas,
      freeMonthly: {
        period: '2026-06',
        contactUnlock: { limit: 3, used: 0, remaining: 3 },
      },
      paidTierId: 'pro',
    };

    expect(sample.quotas).not.toHaveProperty('aiMatch');
    expect(sample.freeMonthly?.contactUnlock.limit).toBe(3);
  });

  it('documents ConsumeProfileEntitlementResultDto', () => {
    const tier = getPackageTierDefinition('pro');
    const quotas = buildEventEntitlementQuotas(
      tier.limits,
      { contactUnlockUsed: 1, postPinUsed: 0 },
      new Date('2099-06-01T00:00:00.000Z'),
      new Date('2026-06-01T00:00:00.000Z'),
    );
    const result: ConsumeProfileEntitlementResultDto = {
      ok: true,
      bucket: 'free',
      entitlement: {
        activityLegacyId: 4,
        tierId: 'free',
        tierName: '免费版',
        quotas,
        freeMonthly: {
          period: '2026-06',
          contactUnlock: { limit: 3, used: 1, remaining: 2 },
        },
        paidTierId: null,
      },
    };

    expect(result.ok).toBe(true);
    expect(['free', 'paid']).toContain(result.bucket);
    expect(result.entitlement.quotas.contactUnlock).toBeDefined();
    expect(result.entitlement.quotas).not.toHaveProperty('aiMatch');
  });
});
