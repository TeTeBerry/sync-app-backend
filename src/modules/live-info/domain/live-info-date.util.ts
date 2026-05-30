/** Calendar day in Asia/Shanghai (YYYY-MM-DD). */
export function shanghaiEventDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** End of `eventDate` in Shanghai (23:59:59.999). */
export function shanghaiEndOfEventDate(eventDate: string): Date {
  return new Date(`${eventDate}T23:59:59.999+08:00`);
}

export function certExpiryLabelForDate(eventDate: string): string {
  const today = shanghaiEventDate();
  if (eventDate !== today) {
    return '已过期';
  }
  return '23:59';
}

export const LIVE_INFO_UPDATE_TTL_MS = 90 * 60 * 1000;
export const LIVE_INFO_PUBLISH_COOLDOWN_MS = 15 * 60 * 1000;
