import {
  formatMinutesAsTime,
  overlapWindow,
  parseTimeToMinutes,
  rangesOverlap,
} from '@src/modules/itinerary/domain/time-minutes.util';

describe('time-minutes.util', () => {
  describe('parseTimeToMinutes / formatMinutesAsTime', () => {
    it('round-trips clock strings', () => {
      expect(parseTimeToMinutes('21:15')).toBe(21 * 60 + 15);
      expect(formatMinutesAsTime(21 * 60 + 15)).toBe('21:15');
    });
  });

  describe('rangesOverlap', () => {
    it('detects partial overlap', () => {
      expect(
        rangesOverlap(21 * 60, 22 * 60 + 15, 21 * 60 + 15, 22 * 60 + 15),
      ).toBe(true);
    });

    it('returns false for adjacent non-overlapping ranges', () => {
      expect(rangesOverlap(19 * 60, 21 * 60, 21 * 60, 22 * 60)).toBe(false);
    });
  });

  describe('overlapWindow', () => {
    it('returns shared interval for overlapping ranges', () => {
      expect(
        overlapWindow(21 * 60, 22 * 60 + 30, 21 * 60 + 15, 22 * 60 + 15),
      ).toEqual({
        start: 21 * 60 + 15,
        end: 22 * 60 + 15,
      });
    });

    it('returns null when ranges only touch at an endpoint', () => {
      expect(overlapWindow(19 * 60, 21 * 60, 21 * 60, 22 * 60)).toBeNull();
    });
  });
});
