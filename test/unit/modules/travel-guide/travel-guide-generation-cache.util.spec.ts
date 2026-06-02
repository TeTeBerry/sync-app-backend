import {
  buildTravelGuideGenerationCacheKey,
  normalizeTravelGuideGenerationParams,
} from '@src/modules/travel-guide/domain/travel-guide-generation-cache.util';

describe('travel-guide-generation-cache.util', () => {
  const baseDto = {
    departure: '上海',
    headcount: 2,
    budgetTier: 'standard' as const,
    selfDrive: true,
    accommodationNights: 2,
  };

  it('builds stable cache keys for equivalent requests', () => {
    const a = normalizeTravelGuideGenerationParams(4, baseDto, 2);
    const b = normalizeTravelGuideGenerationParams(
      4,
      { ...baseDto, departure: ' 上海 ' },
      2,
    );
    expect(buildTravelGuideGenerationCacheKey(a)).toBe(
      buildTravelGuideGenerationCacheKey(b),
    );
  });

  it('differs when planning params change', () => {
    const standard = buildTravelGuideGenerationCacheKey(
      normalizeTravelGuideGenerationParams(4, baseDto, 2),
    );
    const economy = buildTravelGuideGenerationCacheKey(
      normalizeTravelGuideGenerationParams(
        4,
        { ...baseDto, budgetTier: 'economy' },
        2,
      ),
    );
    expect(standard).not.toBe(economy);
  });
});
