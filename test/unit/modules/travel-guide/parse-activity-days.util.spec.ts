import {
  budgetTierHotelNightRanges,
  budgetTierLabel,
  parseActivityDayCount,
  resolveTravelGuideBudgetTier,
} from '@src/modules/travel-guide/domain/parse-activity-days.util';

describe('parse-activity-days.util', () => {
  it('parses date ranges', () => {
    expect(parseActivityDayCount('06/13-14')).toBe(2);
    expect(parseActivityDayCount('12/11-13')).toBe(3);
  });

  it('defaults to 2 when unknown', () => {
    expect(parseActivityDayCount()).toBe(2);
  });

  it('maps budget tiers', () => {
    expect(budgetTierLabel('economy')).toBe('经济(¥150-300/晚)');
    expect(budgetTierLabel('comfort')).toBe('豪华(¥600+/晚)');
  });

  it('maps hotel night ranges per budget tier', () => {
    expect(budgetTierHotelNightRanges('comfort')).toEqual({
      primary: '¥600-800',
      secondary: '¥800-1200',
    });
    expect(budgetTierHotelNightRanges('standard').secondary).toBe('¥450-600');
  });

  it('resolves missing budget tier to standard', () => {
    expect(resolveTravelGuideBudgetTier()).toBe('standard');
    expect(resolveTravelGuideBudgetTier('economy')).toBe('economy');
  });
});
