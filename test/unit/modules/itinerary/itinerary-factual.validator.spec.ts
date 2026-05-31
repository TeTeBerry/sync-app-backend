import { validateItineraryAgainstFactualSchedule } from '../../../../src/modules/itinerary/domain/itinerary-factual.validator';
import type { PromptPerformance } from '../../../../src/modules/itinerary/domain/itinerary-prompt.builder';

describe('validateItineraryAgainstFactualSchedule', () => {
  const performances: PromptPerformance[] = [
    {
      artistId: 'slander',
      artistName: 'SLANDER',
      dateKey: 'jun13',
      dateLabel: '6月13日',
      startMinutes: 1260,
      endMinutes: 1335,
      startTime: '21:00',
      endTime: '22:15',
      stageLabel: 'Bass 区',
      genre: 'Dubstep',
      genreLabel: 'Heaven & Hell',
      stage: 'bass',
    },
    {
      artistId: 'layz',
      artistName: 'LAYZ',
      dateKey: 'jun13',
      dateLabel: '6月13日',
      startMinutes: 1275,
      endMinutes: 1335,
      startTime: '21:15',
      endTime: '22:15',
      stageLabel: 'Bass 区',
      genre: 'Dubstep',
      genreLabel: 'Riddim',
      stage: 'bass',
    },
  ];

  it('accepts itinerary with official start times for selected DJs', () => {
    const ok = validateItineraryAgainstFactualSchedule(
      {
        eventMeta: 'Storm',
        days: [
          {
            id: 'jun13',
            label: '6月13日',
            bannerDateLabel: '6月13日',
            nodeCount: 2,
            items: [
              {
                id: '1',
                time: '21:00',
                dotColor: 'pink',
                title: 'SLANDER · Bass 区',
                highlighted: true,
              },
              {
                id: '2',
                time: '21:15',
                dotColor: 'cyan',
                title: 'LAYZ · Bass 区',
                highlighted: true,
              },
            ],
          },
        ],
      },
      performances,
      ['slander', 'layz'],
    );
    expect(ok).toBe(true);
  });

  it('rejects invented performance times', () => {
    const ok = validateItineraryAgainstFactualSchedule(
      {
        eventMeta: 'Storm',
        days: [
          {
            id: 'jun13',
            label: '6月13日',
            bannerDateLabel: '6月13日',
            nodeCount: 1,
            items: [
              {
                id: '1',
                time: '20:00',
                dotColor: 'pink',
                title: 'SLANDER · Bass 区',
                highlighted: true,
              },
            ],
          },
        ],
      },
      performances,
      ['slander', 'layz'],
    );
    expect(ok).toBe(false);
  });
});
