import dayjs = require('dayjs');
import customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(customParseFormat);

const CLOCK_PARSE_FORMATS = ['HH:mm', 'H:mm'] as const;

/**
 * Normalize clock text to HH:mm.
 * Accepts ranges like `20:30-22:00` (uses the first segment).
 */
export function formatClockTime(raw: string, maxFallbackLength = 32): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const segment = trimmed.match(/\d{1,2}:\d{2}/)?.[0] ?? trimmed;
  const parsed = dayjs(segment, [...CLOCK_PARSE_FORMATS], true);
  if (parsed.isValid()) {
    return parsed.format('HH:mm');
  }

  return trimmed.slice(0, maxFallbackLength);
}

/** Minutes from midnight for HH:mm (invalid input → 0). */
export function parseClockToMinutes(time: string): number {
  const clock = formatClockTime(time);
  const parsed = dayjs(clock, 'HH:mm', true);
  if (!parsed.isValid()) return 0;
  return parsed.hour() * 60 + parsed.minute();
}

/** Format minutes from midnight as HH:mm (wraps hours mod 24). */
export function formatMinutesAsClock(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return dayjs()
    .hour(hours)
    .minute(minutes)
    .second(0)
    .millisecond(0)
    .format('HH:mm');
}

function parseDateValue(value: Date | string): dayjs.Dayjs | null {
  const date = dayjs(value);
  return date.isValid() ? date : null;
}

export type FormatTimeAgoOptions = {
  /** After this many days, show YYYY-MM-DD instead of relative text. */
  absoluteAfterDays?: number;
  /** Use `5分钟前` instead of `5 分钟前` (API copy style). Default true. */
  compact?: boolean;
};

/**
 * Relative time in Chinese for API responses.
 */
export function formatTimeAgo(
  value?: Date | string,
  options?: FormatTimeAgoOptions,
): string {
  if (value == null || value === '') return '';
  const date = parseDateValue(value instanceof Date ? value : String(value));
  if (!date) return '';

  const diffMs = dayjs().diff(date);
  if (diffMs < 0) return '刚刚';

  const compact = options?.compact !== false;
  const unit = (suffix: string) => (compact ? suffix : ` ${suffix}`);

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}${unit('分钟前')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${unit('小时前')}`;
  const days = Math.floor(hours / 24);

  const absoluteAfterDays = options?.absoluteAfterDays;
  if (absoluteAfterDays != null && days >= absoluteAfterDays) {
    return date.format('YYYY-MM-DD');
  }

  return `${days}${unit('天前')}`;
}

/** Calendar date label YYYY-MM-DD for profile/history lists. */
export function formatDateLabel(value?: Date | string): string {
  if (value == null || value === '') return '';
  const date = parseDateValue(value instanceof Date ? value : String(value));
  if (!date) return '';
  return date.format('YYYY-MM-DD');
}
