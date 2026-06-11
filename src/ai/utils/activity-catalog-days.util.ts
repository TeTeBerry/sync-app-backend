import {
  catalogDateToIso,
  extractYearFromText,
} from '../rag/activity-date.util';

export function parseActivityCatalogDays(catalogDate?: string): number[] {
  if (!catalogDate?.trim()) return [];
  const range = catalogDate.trim().match(/(\d{1,2})\/(\d{1,2})(?:-(\d{1,2}))?/);
  if (!range) return [];

  const start = Number(range[2]);
  const end = range[3] ? Number(range[3]) : start;
  if (Number.isNaN(start) || Number.isNaN(end)) return [];

  const days: number[] = [];
  for (let day = start; day <= end; day += 1) {
    days.push(day);
  }
  return days;
}

export function formatActivityEventDayLabel(
  catalogDate: string,
  day: number,
  activityName?: string,
): string {
  const range = catalogDate.trim().match(/(\d{1,2})\/(\d{1,2})/);
  if (range) {
    const month = Number(range[1]);
    return `${month}月${day}日`;
  }
  const year =
    extractYearFromText(activityName) ?? String(new Date().getFullYear());
  const iso = catalogDateToIso(catalogDate, year);
  if (iso) {
    const [, m, d] = iso.split('-');
    if (Number(d) === day) return `${Number(m)}月${day}日`;
  }
  return `${day}号`;
}

/** catalog 日期 → 展示用场次日列表，如 6月13日、6月14日 */
export function formatActivityCatalogDayLabels(
  catalogDate?: string,
  activityName?: string,
): string {
  const days = parseActivityCatalogDays(catalogDate);
  if (!days.length || !catalogDate?.trim()) return '';
  return days
    .map((day) => formatActivityEventDayLabel(catalogDate, day, activityName))
    .join('、');
}
