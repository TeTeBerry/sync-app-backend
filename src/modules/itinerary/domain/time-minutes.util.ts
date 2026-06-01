import {
  formatMinutesAsClock,
  parseClockToMinutes,
} from '../../../common/utils/day-time.util';

/** Parse "HH:mm" to minutes from midnight; supports hours > 24 for after-midnight sets. */
export function parseTimeToMinutes(time: string): number {
  return parseClockToMinutes(time);
}

export function formatMinutesAsTime(totalMinutes: number): string {
  return formatMinutesAsClock(totalMinutes);
}

export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function overlapWindow(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): { start: number; end: number } | null {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  if (start >= end) return null;
  return { start, end };
}
