import { buildItineraryScheduleOverviewReply } from '@src/ai/agent/itinerary-schedule-reply.util';
import type { ItineraryScheduleDto } from '@src/modules/itinerary/itinerary-schedule.service';

describe('itinerary-schedule-reply.util', () => {
  const base = {
    activityLegacyId: 1,
    eventMeta: 'Tomorrowland Thailand',
    sessions: [],
    djs: [
      {
        id: '1',
        name: 'Martin Garrix',
        genre: 'edm',
        genreLabel: 'EDM',
        stage: 'main',
        popularity: 1,
        avatarSeed: 'mg',
        genreColor: '#fff',
      },
    ],
    performances: [],
    conflicts: [],
    schedulePublished: true,
  } satisfies ItineraryScheduleDto;

  it('formats published schedule overview', () => {
    const reply = buildItineraryScheduleOverviewReply({
      ...base,
      performances: Array.from({ length: 3 }, () => ({
        artistId: '1',
        artistName: 'Martin Garrix',
        dateKey: 'd1',
        dateLabel: 'Day 1',
        genre: 'edm',
        genreLabel: 'EDM',
        stage: 'main',
        stageLabel: 'Main',
        startTime: '20:00',
        endTime: '21:00',
        startMinutes: 1200,
        endMinutes: 1260,
        popularity: 1,
        avatarSeed: 'mg',
        genreColor: '#fff',
      })),
    });
    expect(reply).toContain('官方演出表已发布，共 3 场演出');
    expect(reply).toContain('Martin Garrix');
  });

  it('formats unpublished lineup without slots', () => {
    const reply = buildItineraryScheduleOverviewReply({
      ...base,
      schedulePublished: false,
      performances: [],
    });
    expect(reply).toContain('官方演出时段尚未发布');
  });

  it('formats empty lineup', () => {
    const reply = buildItineraryScheduleOverviewReply({
      ...base,
      djs: [],
      performances: [],
      schedulePublished: false,
    });
    expect(reply).toContain('阵容未公布');
  });
});
