import { resolveContactUnlockConsumeBucket } from '@src/modules/profile/domain/entitlement-consume.util';
import { createEmptyUsage } from '@src/modules/profile/domain/event-entitlement.util';
import { getPackageTierDefinition } from '@src/modules/profile/domain/package-tier.config';

describe('entitlement-consume.util', () => {
  const freeFresh = { period: '2026-05', contactUnlockUsed: 0 };
  const freeExhausted = {
    period: '2026-05',
    contactUnlockUsed: 3,
  };
  const proLimits = getPackageTierDefinition('pro').limits;

  it('prefers free bucket for contact unlock when monthly remains', () => {
    expect(
      resolveContactUnlockConsumeBucket(
        freeFresh,
        proLimits,
        createEmptyUsage(),
      ),
    ).toBe('free');
  });

  it('uses paid contact unlock when free monthly is exhausted', () => {
    const paidUsage = { ...createEmptyUsage(), contactUnlockUsed: 4 };
    expect(
      resolveContactUnlockConsumeBucket(freeExhausted, proLimits, paidUsage),
    ).toBe('paid');
  });
});
