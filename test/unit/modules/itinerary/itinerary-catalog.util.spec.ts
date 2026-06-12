import {
  hasItineraryCatalogSeed,
  resolveItineraryCatalogSeed,
} from '@src/modules/itinerary/domain/itinerary-catalog.util';
import {
  ITINERARY_DEMO_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
  STORM_ACTIVITY_LEGACY_ID,
} from '@src/modules/itinerary/itinerary.seed';

describe('itinerary-catalog.util', () => {
  it('recognizes catalog activities', () => {
    expect(hasItineraryCatalogSeed(STORM_ACTIVITY_LEGACY_ID)).toBe(true);
    expect(hasItineraryCatalogSeed(ITINERARY_DEMO_ACTIVITY_LEGACY_ID)).toBe(
      true,
    );
    expect(
      hasItineraryCatalogSeed(ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID),
    ).toBe(true);
    expect(hasItineraryCatalogSeed(999)).toBe(false);
  });

  it('returns storm festival sessions and performances', () => {
    const seed = resolveItineraryCatalogSeed(STORM_ACTIVITY_LEGACY_ID);

    expect(seed.sessions.map((session) => session.dateKey)).toEqual([
      'jun13',
      'jun14',
    ]);
    expect(seed.performances.length).toBeGreaterThan(0);
    expect(
      seed.performances.some((perf) => perf.artistId === 'marshmello'),
    ).toBe(true);
  });

  it('filters catalog seed by dateKey', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_DEMO_ACTIVITY_LEGACY_ID,
      'jun13',
    );

    expect(seed.sessions).toHaveLength(1);
    expect(seed.sessions[0]?.dateKey).toBe('jun13');
    expect(seed.performances.every((perf) => perf.dateKey === 'jun13')).toBe(
      true,
    );
  });
});
