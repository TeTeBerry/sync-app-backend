import {
  buildLineupOnlyArtistPerformanceSeed,
  hasItineraryCatalogSeed,
  isPublishedSchedulePerformance,
  resolveItineraryCatalogSeed,
  resolveLineupDjs,
} from '@src/modules/itinerary/domain/itinerary-catalog.util';
import {
  ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_ORLANDO_ACTIVITY_LEGACY_ID,
  ITINERARY_ULTRA_EUROPE_ACTIVITY_LEGACY_ID,
  ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID,
  ITINERARY_LOST_LANDS_ACTIVITY_LEGACY_ID,
  ITINERARY_808_FESTIVAL_ACTIVITY_LEGACY_ID,
  ITINERARY_ULTRA_JAPAN_ACTIVITY_LEGACY_ID,
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
    expect(
      hasItineraryCatalogSeed(ITINERARY_EDC_ORLANDO_ACTIVITY_LEGACY_ID),
    ).toBe(true);
    expect(
      hasItineraryCatalogSeed(ITINERARY_ULTRA_EUROPE_ACTIVITY_LEGACY_ID),
    ).toBe(true);
    expect(
      hasItineraryCatalogSeed(ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID),
    ).toBe(true);
    expect(
      hasItineraryCatalogSeed(ITINERARY_LOST_LANDS_ACTIVITY_LEGACY_ID),
    ).toBe(true);
    expect(
      hasItineraryCatalogSeed(ITINERARY_808_FESTIVAL_ACTIVITY_LEGACY_ID),
    ).toBe(true);
    expect(
      hasItineraryCatalogSeed(ITINERARY_ULTRA_JAPAN_ACTIVITY_LEGACY_ID),
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

  it('materializes lineup-only festivals for Mongo crawl', () => {
    const seed = buildLineupOnlyArtistPerformanceSeed(
      ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
    );

    expect(seed.length).toBe(
      resolveLineupDjs(ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID).length,
    );
    expect(seed.every((perf) => perf.startTime === '')).toBe(true);
    expect(seed.every((perf) => perf.endMinutes === -1)).toBe(true);
    expect(seed.every((perf) => perf.stage === '')).toBe(true);
    expect(seed.every((perf) => perf.stageLabel === '')).toBe(true);
    expect(seed.every((perf) => perf.dateKey === 'dec18')).toBe(true);
    expect(seed.some((perf) => perf.artistName === 'MARTIN GARRIX')).toBe(true);
    expect(seed.every((perf) => !isPublishedSchedulePerformance(perf))).toBe(
      true,
    );
  });

  it('detects published schedule performances by set time', () => {
    expect(
      isPublishedSchedulePerformance({
        startMinutes: 1320,
        startTime: '22:00',
      }),
    ).toBe(true);
    expect(
      isPublishedSchedulePerformance({
        startMinutes: -1,
        startTime: '',
      }),
    ).toBe(false);
    expect(
      isPublishedSchedulePerformance({
        startMinutes: 0,
        startTime: '',
      }),
    ).toBe(false);
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

  it('returns lineup DJs without performances for EDC Orlando', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_EDC_ORLANDO_ACTIVITY_LEGACY_ID,
    );

    expect(seed.performances).toHaveLength(0);
    expect(seed.sessions.map((session) => session.dateKey)).toEqual([
      'nov6',
      'nov7',
      'nov8',
    ]);
    expect(
      resolveLineupDjs(ITINERARY_EDC_ORLANDO_ACTIVITY_LEGACY_ID).length,
    ).toBe(110);
    expect(
      resolveLineupDjs(ITINERARY_EDC_ORLANDO_ACTIVITY_LEGACY_ID).some(
        (dj) => dj.name === 'MARTIN GARRIX',
      ),
    ).toBe(true);
  });

  it('returns lineup DJs without performances for Lost Lands', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_LOST_LANDS_ACTIVITY_LEGACY_ID,
    );

    expect(seed.performances).toHaveLength(0);
    expect(seed.sessions.map((session) => session.dateKey)).toEqual([
      'sep18',
      'sep19',
      'sep20',
    ]);
    expect(
      resolveLineupDjs(ITINERARY_LOST_LANDS_ACTIVITY_LEGACY_ID).length,
    ).toBe(210);
    expect(
      resolveLineupDjs(ITINERARY_LOST_LANDS_ACTIVITY_LEGACY_ID).some(
        (dj) => dj.name === 'EXCISION (2 HOUR SET)',
      ),
    ).toBe(true);
    expect(
      resolveLineupDjs(ITINERARY_LOST_LANDS_ACTIVITY_LEGACY_ID).some(
        (dj) => dj.name === 'DIRTY SNATCHA',
      ),
    ).toBe(true);
  });

  it('returns Ultra Europe day 1 performances across four stages', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_ULTRA_EUROPE_ACTIVITY_LEGACY_ID,
      'jul10',
    );

    expect(seed.sessions).toHaveLength(1);
    expect(seed.performances).toHaveLength(29);
    expect(
      seed.performances.some((perf) => perf.stageLabel === 'Ultra Main Stage'),
    ).toBe(true);
    expect(
      seed.performances.some((perf) => perf.stageLabel === 'Resistance'),
    ).toBe(true);
    expect(
      seed.performances.some((perf) => perf.artistName === 'JOHN SUMMIT'),
    ).toBe(true);
    expect(
      seed.performances.some((perf) => perf.artistName === 'CAMELPHAT'),
    ).toBe(true);

    const mainStage = seed.performances
      .filter((perf) => perf.stageLabel === 'Ultra Main Stage')
      .sort((left, right) => left.startMinutes - right.startMinutes);
    expect(mainStage.map((perf) => perf.artistName)).toEqual([
      'MYKRIS',
      'HALO',
      'SUBTRONICS',
      'OLIVER HELDENS',
      'AFROJACK',
      'DJ SNAKE',
      'JOHN SUMMIT',
    ]);
    expect(mainStage.map((perf) => perf.startTime)).toEqual([
      '20:00',
      '21:05',
      '22:10',
      '23:30',
      '00:50',
      '02:10',
      '03:30',
    ]);
    expect(mainStage.every((perf) => perf.endTime === perf.startTime)).toBe(
      true,
    );
  });

  it('returns Ultra Europe full timetable and lineup DJs', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_ULTRA_EUROPE_ACTIVITY_LEGACY_ID,
    );

    expect(seed.sessions.map((session) => session.dateKey)).toEqual([
      'jul10',
      'jul11',
      'jul12',
    ]);
    expect(seed.performances).toHaveLength(85);
    expect(
      resolveLineupDjs(ITINERARY_ULTRA_EUROPE_ACTIVITY_LEGACY_ID).length,
    ).toBe(85);
    expect(
      resolveLineupDjs(ITINERARY_ULTRA_EUROPE_ACTIVITY_LEGACY_ID).some(
        (dj) => dj.name === 'MARTIN GARRIX',
      ),
    ).toBe(true);
  });

  it('returns World DJ Festival Japan day 2 performances across three stages', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID,
      'jul5',
    );

    expect(seed.sessions).toHaveLength(1);
    expect(seed.performances).toHaveLength(35);
    expect(
      seed.performances.some((perf) => perf.artistName === 'MARTIN GARRIX'),
    ).toBe(true);
    expect(seed.performances.some((perf) => perf.artistName === 'ALOK')).toBe(
      true,
    );
    expect(
      seed.performances.some((perf) => perf.artistName === '999999999'),
    ).toBe(true);
  });

  it('returns World DJ Festival Japan day 1 performances across three stages', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID,
      'jul4',
    );

    expect(seed.sessions).toHaveLength(1);
    expect(seed.performances).toHaveLength(29);
    expect(
      seed.performances.some((perf) => perf.stageLabel === 'World Stage'),
    ).toBe(true);
    expect(
      seed.performances.some((perf) => perf.stageLabel === 'Dream Stage'),
    ).toBe(true);
    expect(
      seed.performances.some((perf) => perf.stageLabel === 'Welcome Stage'),
    ).toBe(true);
    expect(
      seed.performances.some((perf) => perf.artistName === 'PORTER ROBINSON'),
    ).toBe(true);
    expect(
      seed.performances.some((perf) => perf.artistName === 'ANGERFIST'),
    ).toBe(true);
  });

  it('returns World DJ Festival Japan sessions and lineup DJs', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID,
    );

    expect(seed.sessions.map((session) => session.dateKey)).toEqual([
      'jul4',
      'jul5',
    ]);
    expect(seed.performances).toHaveLength(64);
    expect(
      resolveLineupDjs(ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID).length,
    ).toBe(64);
    expect(
      resolveLineupDjs(ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID).some(
        (dj) => dj.name === 'KSHMR',
      ),
    ).toBe(true);
  });

  it('returns 808 Festival day 1 We Rave You performances', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_808_FESTIVAL_ACTIVITY_LEGACY_ID,
      'dec5',
    );

    expect(seed.sessions).toHaveLength(1);
    expect(seed.performances).toHaveLength(7);
    expect(seed.performances.some((perf) => perf.artistName === 'MADDIX')).toBe(
      true,
    );
    expect(
      seed.performances.some(
        (perf) =>
          perf.stageLabel === 'We Rave You' && perf.startTime === '22:45',
      ),
    ).toBe(true);
  });

  it('returns 808 Festival day 2 performances across Main Stage and Drumcode', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_808_FESTIVAL_ACTIVITY_LEGACY_ID,
      'dec6',
    );

    expect(seed.sessions).toHaveLength(1);
    expect(seed.performances).toHaveLength(12);
    expect(
      seed.performances.some(
        (perf) =>
          perf.artistName === 'DOM DOLLA' && perf.stageLabel === 'Main Stage',
      ),
    ).toBe(true);
    expect(
      seed.performances.some(
        (perf) =>
          perf.artistName === 'PAN-POT' && perf.stageLabel === 'Drumcode',
      ),
    ).toBe(true);
  });

  it('returns 808 Festival full timetable and lineup DJs', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_808_FESTIVAL_ACTIVITY_LEGACY_ID,
    );

    expect(seed.sessions.map((session) => session.dateKey)).toEqual([
      'dec5',
      'dec6',
      'dec7',
    ]);
    expect(seed.performances).toHaveLength(33);
    expect(
      resolveLineupDjs(ITINERARY_808_FESTIVAL_ACTIVITY_LEGACY_ID).length,
    ).toBe(33);
    expect(
      resolveLineupDjs(ITINERARY_808_FESTIVAL_ACTIVITY_LEGACY_ID).some(
        (dj) => dj.name === 'CHARLOTTE DE WITTE',
      ),
    ).toBe(true);
    expect(
      resolveLineupDjs(ITINERARY_808_FESTIVAL_ACTIVITY_LEGACY_ID).some(
        (dj) => dj.name === 'WUKI',
      ),
    ).toBe(true);
    expect(
      resolveLineupDjs(ITINERARY_808_FESTIVAL_ACTIVITY_LEGACY_ID).find(
        (dj) => dj.name === 'PAN-POT',
      )?.stage,
    ).toBe('drumcode');
    expect(
      resolveLineupDjs(ITINERARY_808_FESTIVAL_ACTIVITY_LEGACY_ID).find(
        (dj) => dj.name === 'WUKI',
      )?.stage,
    ).toBe('monstercat');
  });

  it('returns lineup DJs without performances for Ultra Japan', () => {
    const seed = resolveItineraryCatalogSeed(
      ITINERARY_ULTRA_JAPAN_ACTIVITY_LEGACY_ID,
    );

    expect(seed.performances).toHaveLength(0);
    expect(seed.sessions.map((session) => session.dateKey)).toEqual([
      'sep19',
      'sep20',
    ]);
    expect(
      resolveLineupDjs(ITINERARY_ULTRA_JAPAN_ACTIVITY_LEGACY_ID).length,
    ).toBe(15);
    expect(
      resolveLineupDjs(ITINERARY_ULTRA_JAPAN_ACTIVITY_LEGACY_ID).some(
        (dj) => dj.name === 'ZEDD B2B KNOCK2',
      ),
    ).toBe(true);
    expect(
      resolveLineupDjs(ITINERARY_ULTRA_JAPAN_ACTIVITY_LEGACY_ID).some(
        (dj) => dj.name === 'HALO',
      ),
    ).toBe(true);
    expect(
      buildLineupOnlyArtistPerformanceSeed(
        ITINERARY_ULTRA_JAPAN_ACTIVITY_LEGACY_ID,
      ),
    ).toHaveLength(15);
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
