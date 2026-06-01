import { aggregateLiveInfoSummary } from '../../../../src/modules/live-info/domain/live-info-aggregate.util';

describe('aggregateLiveInfoSummary', () => {
  it('averages scores per category', () => {
    const result = aggregateLiveInfoSummary([
      {
        ratings: [
          { categoryId: 'entry_crowd', score: 4 },
          { categoryId: 'smoke_drink', score: 2 },
        ],
      },
      {
        ratings: [
          { categoryId: 'entry_crowd', score: 2 },
          { categoryId: 'smoke_drink', score: 4 },
        ],
      },
    ]);

    expect(result.certCount).toBe(2);
    expect(
      result.summary.find((r) => r.categoryId === 'entry_crowd')?.score,
    ).toBe(3);
    expect(
      result.summary.find((r) => r.categoryId === 'smoke_drink')?.score,
    ).toBe(3);
  });
});
