import {
  formatMinutesAsClock,
  formatTimeAgo,
} from '../../../src/common/utils/day-time.util';

describe('day-time.util formatTimeAgo', () => {
  it('formats compact relative labels', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    expect(formatTimeAgo(fiveMinAgo, { compact: true })).toBe('5分钟前');
  });

  it('switches to YYYY-MM-DD after absoluteAfterDays', () => {
    const old = new Date(Date.now() - 31 * 86_400_000);
    expect(
      formatTimeAgo(old, { absoluteAfterDays: 30, compact: true }),
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('keeps day label without absoluteAfterDays cap', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000);
    expect(formatTimeAgo(tenDaysAgo, { compact: true })).toBe('10天前');
  });
});

describe('day-time.util formatMinutesAsClock', () => {
  it('formats departure time from minutes', () => {
    expect(formatMinutesAsClock(17 * 60 + 30)).toBe('17:30');
  });
});
