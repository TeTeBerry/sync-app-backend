import {
  buildDynamicBudgetTierSnapshots,
  buildBudgetTierSnapshotsFromSources,
  formatBudgetTierNightlyHint,
  normalizeBudgetTierSnapshotsMonotonic,
} from '@src/modules/travel-guide/domain/travel-guide-budget-tier-ranges.util';

describe('travel-guide-budget-tier-ranges.util', () => {
  it('buildDynamicBudgetTierSnapshots splits hotel prices into three tiers', () => {
    const snapshots = buildDynamicBudgetTierSnapshots(
      [280, 320, 380, 420, 520, 680, 720, 890],
      'CNY',
    );

    expect(snapshots).toHaveLength(3);
    expect(snapshots[0]).toMatchObject({
      tier: 'economy',
      nightlyMin: 280,
      nightlyMax: 380,
    });
    expect(snapshots[1]).toMatchObject({
      tier: 'standard',
      nightlyMin: 420,
      nightlyMax: 680,
    });
    expect(snapshots[2]).toMatchObject({
      tier: 'comfort',
      nightlyMin: 720,
      nightlyMax: 890,
    });
  });

  it('normalizeBudgetTierSnapshotsMonotonic reorders inverted hotelByTier prices', () => {
    const normalized = normalizeBudgetTierSnapshotsMonotonic([
      { tier: 'economy', nightlyMin: 1120, nightlyMax: 2880, currency: 'CNY' },
      { tier: 'standard', nightlyMin: 1120, nightlyMax: 2030, currency: 'CNY' },
      { tier: 'comfort', nightlyMin: 4560, nightlyMax: 4560, currency: 'CNY' },
    ]);

    expect(normalized).toEqual([
      { tier: 'economy', nightlyMin: 1120, nightlyMax: 2030, currency: 'CNY' },
      { tier: 'standard', nightlyMin: 2030, nightlyMax: 2880, currency: 'CNY' },
      { tier: 'comfort', nightlyMin: 4560, nightlyMax: 4560, currency: 'CNY' },
    ]);
  });

  it('normalizeBudgetTierSnapshotsMonotonic separates overlapping nightly mins', () => {
    const normalized = normalizeBudgetTierSnapshotsMonotonic([
      { tier: 'economy', nightlyMin: 1120, nightlyMax: 2110, currency: 'CNY' },
      { tier: 'standard', nightlyMin: 1120, nightlyMax: 2880, currency: 'CNY' },
      { tier: 'comfort', nightlyMin: 4560, nightlyMax: 4560, currency: 'CNY' },
    ]);

    expect(normalized).toEqual([
      { tier: 'economy', nightlyMin: 1120, nightlyMax: 2110, currency: 'CNY' },
      { tier: 'standard', nightlyMin: 2110, nightlyMax: 2880, currency: 'CNY' },
      { tier: 'comfort', nightlyMin: 4560, nightlyMax: 4560, currency: 'CNY' },
    ]);
  });

  it('buildBudgetTierSnapshotsFromSources prefers hotelByTier over tercile split', () => {
    const snapshots = buildBudgetTierSnapshotsFromSources({
      enrichment: {
        hotelByTier: {
          economy: {
            minPricePerNight: 180,
            maxPricePerNight: 260,
            currency: 'CNY',
            sampleCount: 4,
            fetchedAt: '2026-06-29T00:00:00.000Z',
            source: 'rollinggo',
          },
          standard: {
            minPricePerNight: 420,
            maxPricePerNight: 580,
            currency: 'CNY',
            sampleCount: 4,
            fetchedAt: '2026-06-29T00:00:00.000Z',
            source: 'rollinggo',
          },
          comfort: {
            minPricePerNight: 880,
            maxPricePerNight: 1200,
            currency: 'CNY',
            sampleCount: 4,
            fetchedAt: '2026-06-29T00:00:00.000Z',
            source: 'rollinggo',
          },
        },
      },
    });

    expect(snapshots).toEqual([
      { tier: 'economy', nightlyMin: 180, nightlyMax: 260, currency: 'CNY' },
      { tier: 'standard', nightlyMin: 420, nightlyMax: 580, currency: 'CNY' },
      { tier: 'comfort', nightlyMin: 880, nightlyMax: 1200, currency: 'CNY' },
    ]);
  });

  it('buildBudgetTierSnapshotsFromSources falls back to recommendations tercile', () => {
    const snapshots = buildBudgetTierSnapshotsFromSources({
      enrichment: {
        hotel: {
          minPricePerNight: 300,
          maxPricePerNight: 900,
          currency: 'CNY',
          sampleCount: 6,
          fetchedAt: '2026-06-29T00:00:00.000Z',
          source: 'rollinggo',
          recommendations: [
            { name: 'A', minPricePerNight: 320 },
            { name: 'B', minPricePerNight: 450 },
            { name: 'C', minPricePerNight: 680 },
            { name: 'D', minPricePerNight: 820 },
          ],
        },
      },
    });

    expect(snapshots[0]?.nightlyMax).toBeLessThanOrEqual(450);
    expect(snapshots[2]?.nightlyMin).toBeGreaterThanOrEqual(680);
  });

  it('formatBudgetTierNightlyHint renders USD ranges', () => {
    expect(
      formatBudgetTierNightlyHint({
        tier: 'standard',
        nightlyMin: 120,
        nightlyMax: 180,
        currency: 'USD',
      }),
    ).toBe('$120-180');
  });
});
