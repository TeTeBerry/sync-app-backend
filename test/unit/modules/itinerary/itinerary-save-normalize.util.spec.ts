import {
  normalizeItineraryTimelineTime,
  normalizeItineraryDaysForSave,
} from '@src/shared/itinerary';

describe('itinerary-save-normalize.util', () => {
  it('extracts HH:mm from a time range', () => {
    expect(normalizeItineraryTimelineTime('20:30-22:00')).toBe('20:30');
  });

  it('pads single-digit hours', () => {
    expect(normalizeItineraryTimelineTime('9:05')).toBe('09:05');
  });

  it('normalizes days for save', () => {
    const days = normalizeItineraryDaysForSave([
      {
        id: 'jun13',
        label: '6月13日',
        bannerDateLabel: '6月13日',
        nodeCount: 1,
        items: [
          {
            id: 'a',
            time: '20:30-22:00',
            dotColor: 'pink',
            title: 'MARSHMELLO',
            timeTag: '20:30-22:00',
          },
        ],
      },
    ]);

    expect(days[0].items[0].time).toBe('20:30');
    expect(days[0].nodeCount).toBe(1);
  });
});
