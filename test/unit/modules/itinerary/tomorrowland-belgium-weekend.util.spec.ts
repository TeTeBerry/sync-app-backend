import {
  TOMORROWLAND_BELGIUM_WEEKENDS,
  dateKeysForTomorrowlandBelgiumWeekend,
  isTomorrowlandBelgiumWeekend,
} from '@src/modules/itinerary/domain/tomorrowland-belgium-weekend.util';

describe('Tomorrowland Belgium weekend dates', () => {
  it('keeps the two 2026 weekends in separate date-key groups', () => {
    expect(TOMORROWLAND_BELGIUM_WEEKENDS.w1).toEqual([
      'jul17',
      'jul18',
      'jul19',
    ]);
    expect(TOMORROWLAND_BELGIUM_WEEKENDS.w2).toEqual([
      'jul24',
      'jul25',
      'jul26',
    ]);
  });

  it('only applies weekend filtering to Tomorrowland Belgium', () => {
    expect(isTomorrowlandBelgiumWeekend('w1')).toBe(true);
    expect(isTomorrowlandBelgiumWeekend('weekend-1')).toBe(false);
    expect(dateKeysForTomorrowlandBelgiumWeekend(7, 'w2')).toEqual([
      'jul24',
      'jul25',
      'jul26',
    ]);
    expect(dateKeysForTomorrowlandBelgiumWeekend(8, 'w2')).toBeUndefined();
  });
});
