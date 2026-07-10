import {
  buildTravelGuideGenerationCacheKey,
  normalizeTravelGuideGenerationParams,
  reconcileDepartureCityForCache,
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

  it('reconcileDepartureCityForCache drops stale city when departure switches', () => {
    expect(reconcileDepartureCityForCache('北京', '上海')).toBe('北京');
    expect(reconcileDepartureCityForCache('上海虹桥', '上海')).toBe('上海');
  });

  it('differs cache key when departure city changes', () => {
    const shanghai = buildTravelGuideGenerationCacheKey(
      normalizeTravelGuideGenerationParams(
        4,
        { ...baseDto, departure: '上海', departureCity: '上海' },
        2,
      ),
    );
    const beijing = buildTravelGuideGenerationCacheKey(
      normalizeTravelGuideGenerationParams(
        4,
        { ...baseDto, departure: '北京', departureCity: '北京' },
        2,
      ),
    );
    expect(shanghai).not.toBe(beijing);
  });

  it('differs cache key when locale changes', () => {
    const zh = buildTravelGuideGenerationCacheKey(
      normalizeTravelGuideGenerationParams(4, { ...baseDto, locale: 'zh' }, 2),
    );
    const en = buildTravelGuideGenerationCacheKey(
      normalizeTravelGuideGenerationParams(4, { ...baseDto, locale: 'en' }, 2),
    );
    expect(zh).not.toBe(en);
  });
});
