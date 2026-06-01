import {
  buildFreeMonthlyQuotaSlots,
  formatQuotaPeriod,
  normalizeFreeMonthlyUsage,
} from '@src/modules/profile/domain/free-quota.util';

describe('free-quota.util', () => {
  it('formats period as YYYY-MM in UTC', () => {
    expect(formatQuotaPeriod(new Date('2026-05-15T12:00:00.000Z'))).toBe(
      '2026-05',
    );
    expect(formatQuotaPeriod(new Date('2026-01-02T00:00:00.000Z'))).toBe(
      '2026-01',
    );
  });

  it('resets usage when calendar month changes', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const normalized = normalizeFreeMonthlyUsage(
      { period: '2026-05', aiMatchUsed: 3, contactUnlockUsed: 2 },
      now,
    );
    expect(normalized).toEqual({
      period: '2026-06',
      aiMatchUsed: 0,
      contactUnlockUsed: 0,
    });
  });

  it('keeps usage within the same month', () => {
    const now = new Date('2026-05-20T00:00:00.000Z');
    const normalized = normalizeFreeMonthlyUsage(
      { period: '2026-05', aiMatchUsed: 2, contactUnlockUsed: 1 },
      now,
    );
    expect(normalized.aiMatchUsed).toBe(2);
    expect(normalized.contactUnlockUsed).toBe(1);
  });

  it('exposes 3/3 monthly limits with remaining counts', () => {
    const slots = buildFreeMonthlyQuotaSlots({
      period: '2026-05',
      aiMatchUsed: 1,
      contactUnlockUsed: 0,
    });
    expect(slots.aiMatch).toEqual({ limit: 3, used: 1, remaining: 2 });
    expect(slots.contactUnlock).toEqual({ limit: 3, used: 0, remaining: 3 });
  });
});
