import { mergeFreeAndPaidQuotas } from '@src/modules/profile/domain/merged-entitlement.util';
import { createEmptyUsage } from '@src/modules/profile/domain/event-entitlement.util';
import { getPackageTierDefinition } from '@src/modules/profile/domain/package-tier.config';
import {
  FREE_MONTHLY_AI_MATCH_LIMIT,
  FREE_MONTHLY_CONTACT_UNLOCK_LIMIT,
} from '@src/modules/profile/domain/free-tier.config';

describe('per-activity entitlement quotas', () => {
  const freeUsage = {
    period: '2026-05',
    aiMatchUsed: 0,
    contactUnlockUsed: 0,
  };

  it('activity without purchase gets free-only merged quotas (3 AI / 3 contact)', () => {
    const quotas = mergeFreeAndPaidQuotas(freeUsage, null, null, null);
    expect(quotas.aiMatch.limit).toBe(FREE_MONTHLY_AI_MATCH_LIMIT);
    expect(quotas.aiMatch.remaining).toBe(FREE_MONTHLY_AI_MATCH_LIMIT);
    expect(quotas.contactUnlock.limit).toBe(FREE_MONTHLY_CONTACT_UNLOCK_LIMIT);
    expect(quotas.contactUnlock.remaining).toBe(
      FREE_MONTHLY_CONTACT_UNLOCK_LIMIT,
    );
    expect(quotas.map.active).toBe(false);
  });

  it('activity with Pro purchase merges free monthly + paid per-event limits', () => {
    const pro = getPackageTierDefinition('pro');
    const quotas = mergeFreeAndPaidQuotas(
      freeUsage,
      pro.limits,
      createEmptyUsage(),
      new Date(Date.now() + 7 * 86_400_000),
    );
    const paidAi = pro.limits.aiMatchCount ?? 0;
    const paidContact = pro.limits.contactUnlockCount ?? 0;
    expect(quotas.aiMatch.limit).toBe(FREE_MONTHLY_AI_MATCH_LIMIT + paidAi);
    expect(quotas.contactUnlock.limit).toBe(
      FREE_MONTHLY_CONTACT_UNLOCK_LIMIT + paidContact,
    );
    expect(quotas.map.active).toBe(true);
  });
});
