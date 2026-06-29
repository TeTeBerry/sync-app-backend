import {
  hasEmbeddedRollingGoQuote,
  isPlanQuoteFresh,
  resolveQuoteCacheTtlMs,
} from '@src/modules/travel-guide/domain/travel-guide-quote-freshness.util';
import { TRAVEL_QUOTE_DISCLAIMER } from '@src/modules/travel-guide/domain/travel-guide-quote.util';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';

const basePlan: TravelGuidePlan = {
  activityName: 'Storm',
  venue: '深圳',
  eventDates: '06/13',
  departure: '上海',
  headcount: 2,
  budgetLabel: '舒适',
  accommodationNights: 2,
  selfDrive: false,
  transport: { title: '交通', lines: ['高铁'] },
  accommodation: { title: '住宿', hotels: [{ name: '酒店A', note: 'n' }] },
  nightlife: { title: '散场', spots: [{ name: '夜宵', note: 'n' }] },
  tips: { title: '提示', items: ['tip'] },
  budget: {
    title: '预算',
    items: [
      {
        label: '住宿',
        range: '约 ¥1000',
        note: `${TRAVEL_QUOTE_DISCLAIMER} 按 1 间房 · 2 晚 · 舒适档估算。`,
      },
    ],
  },
  budgetTierSnapshots: [
    { tier: 'economy', nightlyMin: 200, nightlyMax: 300, currency: 'CNY' },
    { tier: 'standard', nightlyMin: 300, nightlyMax: 400, currency: 'CNY' },
    { tier: 'comfort', nightlyMin: 500, nightlyMax: 600, currency: 'CNY' },
  ],
};

describe('travel-guide-quote-freshness.util', () => {
  it('resolveQuoteCacheTtlMs falls back to one hour', () => {
    expect(resolveQuoteCacheTtlMs(undefined)).toBe(3_600_000);
    expect(resolveQuoteCacheTtlMs(120)).toBe(120_000);
  });

  it('hasEmbeddedRollingGoQuote detects hotel disclaimer and snapshots', () => {
    expect(hasEmbeddedRollingGoQuote(basePlan)).toBe(true);
    expect(
      hasEmbeddedRollingGoQuote({
        ...basePlan,
        budget: { title: '预算', items: [] },
        budgetTierSnapshots: undefined,
      }),
    ).toBe(false);
  });

  it('isPlanQuoteFresh requires quoteFetchedAt within ttl and embedded quote', () => {
    const now = new Date('2026-06-29T12:00:00.000Z');
    const freshPlan = {
      ...basePlan,
      quoteFetchedAt: '2026-06-29T11:30:00.000Z',
    };
    expect(isPlanQuoteFresh(freshPlan, 3_600_000, now)).toBe(true);
    expect(
      isPlanQuoteFresh(
        { ...freshPlan, quoteFetchedAt: '2026-06-29T10:00:00.000Z' },
        3_600_000,
        now,
      ),
    ).toBe(false);
    expect(isPlanQuoteFresh(basePlan, 3_600_000, now)).toBe(false);
  });
});
