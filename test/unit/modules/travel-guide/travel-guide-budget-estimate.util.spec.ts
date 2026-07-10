import { buildTravelGuideBudgetItems } from '../../../../src/modules/travel-guide/domain/travel-guide-budget-estimate.util';
import { CNY_PER_USD } from '../../../../src/modules/travel-guide/domain/travel-guide-currency.util';

function parseRangeBounds(range: string): { min: number; max: number } {
  const nums = range.match(/\d+/g)?.map(Number) ?? [];
  return { min: nums[0] ?? 0, max: nums[nums.length - 1] ?? nums[0] ?? 0 };
}

describe('buildTravelGuideBudgetItems EN currency', () => {
  it('emits $ ranges for line items and total without double-converting the total', () => {
    const items = buildTravelGuideBudgetItems({
      budgetTier: 'standard',
      headcount: 2,
      accommodationNights: 2,
      interCity: true,
      regionKind: 'domestic',
      selfDrive: false,
      locale: 'en',
    });

    expect(items.length).toBeGreaterThan(2);
    for (const item of items) {
      expect(item.range).toMatch(/About \$/);
      expect(item.range).not.toContain('¥');
    }

    const lineItems = items.filter(
      (item) => !/Estimated total/i.test(item.label),
    );
    const total = items.find((item) => /Estimated total/i.test(item.label));
    expect(total).toBeDefined();

    const lineMinSum = lineItems.reduce(
      (sum, item) => sum + parseRangeBounds(item.range).min,
      0,
    );
    const lineMaxSum = lineItems.reduce(
      (sum, item) => sum + parseRangeBounds(item.range).max,
      0,
    );
    const totalBounds = parseRangeBounds(total!.range);

    // Total must match the sum of already-converted display amounts (not ~1/7.2 of that sum).
    expect(totalBounds.min).toBe(lineMinSum);
    expect(totalBounds.max).toBe(lineMaxSum);
    expect(totalBounds.min).toBeGreaterThan(lineMinSum / CNY_PER_USD + 5);
  });

  it('keeps ¥ ranges for ZH locale', () => {
    const items = buildTravelGuideBudgetItems({
      budgetTier: 'standard',
      headcount: 2,
      accommodationNights: 2,
      interCity: true,
      regionKind: 'domestic',
      selfDrive: false,
      locale: 'zh',
    });

    for (const item of items) {
      expect(item.range).toMatch(/约 ¥/);
      expect(item.range).not.toContain('$');
    }
  });
});
