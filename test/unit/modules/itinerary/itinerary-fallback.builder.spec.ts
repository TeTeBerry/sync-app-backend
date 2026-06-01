import { buildFallbackItinerary } from '@src/modules/itinerary/domain/itinerary-fallback.builder';
import type { ArtistPerformance } from '@src/database/schemas/artist-performance.schema';
import type { FestivalSession } from '@src/database/schemas/festival-session.schema';

function perf(
  partial: Pick<
    ArtistPerformance,
    | 'artistId'
    | 'artistName'
    | 'dateKey'
    | 'startTime'
    | 'endTime'
    | 'startMinutes'
    | 'endMinutes'
  > &
    Partial<ArtistPerformance>,
): ArtistPerformance {
  return {
    activityLegacyId: 1,
    dateLabel: partial.dateKey,
    genre: 'bass',
    genreLabel: 'Bass',
    stage: 'main',
    stageLabel: '主舞台',
    popularity: 80,
    avatarSeed: '',
    genreColor: '#ff2d55',
    ...partial,
  } as ArtistPerformance;
}

const sessions: FestivalSession[] = [
  {
    activityLegacyId: 1,
    dateKey: 'jun13',
    label: '6月13日',
    bannerDateLabel: '6月13日',
    sortOrder: 0,
  } as FestivalSession,
  {
    activityLegacyId: 1,
    dateKey: 'jun14',
    label: '6月14日',
    bannerDateLabel: '6月14日',
    sortOrder: 1,
  } as FestivalSession,
];

describe('buildFallbackItinerary', () => {
  const performances: ArtistPerformance[] = [
    perf({
      artistId: 'marshmello',
      artistName: 'Marshmello',
      dateKey: 'jun13',
      startTime: '21:00',
      endTime: '22:30',
      startMinutes: 21 * 60,
      endMinutes: 22 * 60 + 30,
    }),
    perf({
      artistId: 'illenium',
      artistName: 'ILLENIUM',
      dateKey: 'jun14',
      startTime: '20:00',
      endTime: '21:30',
      startMinutes: 20 * 60,
      endMinutes: 21 * 60 + 30,
    }),
  ];

  it('builds days with departure node and selected performances', () => {
    const { eventMeta, days } = buildFallbackItinerary({
      eventMeta: '风暴电音节',
      sessions,
      performances,
      selectedDjIds: ['marshmello', 'illenium'],
      primaryDateKey: 'jun13',
    });

    expect(eventMeta).toBe('风暴电音节');
    expect(days).toHaveLength(2);
    expect(days[0].id).toBe('jun13');
    expect(days[0].items[0].title).toBe('出发前往场馆');
    expect(days[0].items[0].time).toBe('19:30');
    expect(days[0].items.some((i) => i.title.includes('Marshmello'))).toBe(
      true,
    );
    expect(days[1].items.some((i) => i.title.includes('ILLENIUM'))).toBe(true);
    expect(days[1].items[0].title).not.toBe('出发前往场馆');
  });

  it('omits days with no selected performances on that date', () => {
    const { days } = buildFallbackItinerary({
      eventMeta: '风暴',
      sessions,
      performances,
      selectedDjIds: ['marshmello'],
      primaryDateKey: 'jun13',
    });

    expect(days).toHaveLength(1);
    expect(days[0].id).toBe('jun13');
  });

  it('returns placeholder day when selection matches no performances', () => {
    const { days } = buildFallbackItinerary({
      eventMeta: '风暴',
      sessions,
      performances,
      selectedDjIds: ['unknown-dj'],
    });

    expect(days).toHaveLength(1);
    expect(days[0].items[0].title).toBe('行程生成中');
  });
});
