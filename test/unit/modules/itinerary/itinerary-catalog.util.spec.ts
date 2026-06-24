import {
  hasItineraryCatalogSeed,
  resolveItineraryCatalogSeed,
  resolveLineupDjs,
} from '@src/modules/itinerary/domain/itinerary-catalog.util';
import {
  ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID,
  STORM_ACTIVITY_LEGACY_ID,
} from '@src/data/itinerary/itinerary.seed';

describe('itinerary-catalog.util', () => {
  it('recognizes catalog activities', () => {
    expect(hasItineraryCatalogSeed(STORM_ACTIVITY_LEGACY_ID)).toBe(true);
    expect(hasItineraryCatalogSeed(ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID)).toBe(
      true,
    );
    expect(
      hasItineraryCatalogSeed(ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID),
    ).toBe(true);
    expect(
      hasItineraryCatalogSeed(ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID),
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

  it('returns Defqon.1 day 1 performances and sessions', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID,
      'jun25',
    );

    expect(seed.sessions).toHaveLength(1);
    expect(seed.performances.length).toBe(34);
    expect(seed.performances.some((perf) => perf.artistName === 'COONE')).toBe(
      true,
    );
    expect(seed.performances.some((perf) => perf.stageLabel === 'Blue')).toBe(
      true,
    );
  });

  it('returns Defqon.1 day 2 performances across main stages', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID,
      'jun26',
    );

    expect(seed.sessions).toHaveLength(1);
    expect(seed.performances.length).toBe(131);
    expect(seed.performances.some((perf) => perf.stageLabel === 'Red')).toBe(
      true,
    );
    expect(
      seed.performances.some((perf) => perf.artistName === 'ANGERFIST'),
    ).toBe(true);
    expect(
      seed.performances.some(
        (perf) => perf.artistName === 'THE SPOTLIGHT WITH BRENNAN HEART',
      ),
    ).toBe(true);
  });

  it('returns Defqon.1 day 3 performances including night stages', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID,
      'jun27',
    );

    expect(seed.sessions).toHaveLength(1);
    expect(seed.performances.length).toBe(146);
    expect(
      seed.performances.some((perf) => perf.stageLabel === 'Blue Night'),
    ).toBe(true);
    expect(
      seed.performances.some(
        (perf) => perf.stageLabel === 'Magenta Night [Silent]',
      ),
    ).toBe(true);
    expect(
      seed.performances.some((perf) => perf.stageLabel === 'Stampkroeg Night'),
    ).toBe(true);
    expect(
      seed.performances.some(
        (perf) => perf.artistName === 'ENCORE WITH PHUTURE NOIZE',
      ),
    ).toBe(true);
    expect(
      seed.performances.some((perf) => perf.artistName === 'SHOWTEK'),
    ).toBe(true);
  });

  it('returns Defqon.1 day 4 closing-day performances', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID,
      'jun28',
    );

    expect(seed.sessions).toHaveLength(1);
    expect(seed.performances.length).toBe(96);
    expect(seed.performances.some((perf) => perf.stageLabel === 'Pink')).toBe(
      true,
    );
    expect(
      seed.performances.some(
        (perf) => perf.stageLabel === 'Stampkroeg - Bassbrain',
      ),
    ).toBe(true);
    expect(
      seed.performances.some((perf) => perf.artistName === 'DEFQON.1 LEGENDS'),
    ).toBe(true);
    expect(
      seed.performances.some(
        (perf) => perf.artistName === 'ROOLER - 3 HOUR SET',
      ),
    ).toBe(true);
  });

  it('returns lineup DJs without performances for EDC Thailand', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
    );

    expect(seed.performances).toHaveLength(0);
    expect(
      resolveLineupDjs(ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID).length,
    ).toBeGreaterThan(0);
  });

  it('returns lineup DJs without performances for EDC Korea', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID,
    );

    expect(seed.performances).toHaveLength(0);
    expect(seed.sessions.map((session) => session.dateKey)).toEqual([
      'oct03',
      'oct04',
    ]);
    expect(
      resolveLineupDjs(ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID).length,
    ).toBeGreaterThan(70);
    expect(
      resolveLineupDjs(ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID).some(
        (dj) => dj.name === 'TIËSTO',
      ),
    ).toBe(true);
  });

  it('filters catalog seed by dateKey', () => {
    const seed = resolveItineraryCatalogSeed(STORM_ACTIVITY_LEGACY_ID, 'jun13');

    expect(seed.sessions).toHaveLength(1);
    expect(seed.sessions[0]?.dateKey).toBe('jun13');
    expect(seed.performances.every((perf) => perf.dateKey === 'jun13')).toBe(
      true,
    );
  });
});
