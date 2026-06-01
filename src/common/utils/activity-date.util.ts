type ParsedActivityDates = {
  start: Date;
  end: Date;
};

function toStartOfDay(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function toEndOfDay(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

export function extractYearFromText(text?: string): string | undefined {
  if (!text) return undefined;
  const match = text.match(/\b(20\d{2})\b/);
  return match?.[1];
}

/** Parse catalog-style activity date strings (e.g. 06/13-14, 12/11-13). */
export function parseActivityDateRange(
  dateStr: string,
  yearHint?: string,
): ParsedActivityDates | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    return {
      start: toStartOfDay(year, month, day),
      end: toEndOfDay(year, month, day),
    };
  }

  const year = Number(yearHint ?? new Date().getFullYear());

  const sameMonthRange = trimmed.match(
    /(\d{1,2})\/(\d{1,2})\s*[–-]\s*(\d{1,2})/,
  );
  if (sameMonthRange) {
    const month = Number(sameMonthRange[1]);
    const startDay = Number(sameMonthRange[2]);
    const endDay = Number(sameMonthRange[3]);
    return {
      start: toStartOfDay(year, month, startDay),
      end: toEndOfDay(year, month, endDay),
    };
  }

  const slashDate = trimmed.match(/(\d{1,2})\/(\d{1,2})/);
  if (slashDate) {
    const month = Number(slashDate[1]);
    const day = Number(slashDate[2]);
    return {
      start: toStartOfDay(year, month, day),
      end: toEndOfDay(year, month, day),
    };
  }

  const cnDate = trimmed.match(/(20\d{2})?[年.\-/]?(\d{1,2})[月.\-/](\d{1,2})/);
  if (cnDate) {
    const resolvedYear = cnDate[1] ? Number(cnDate[1]) : year;
    const month = Number(cnDate[2]);
    const day = Number(cnDate[3]);
    return {
      start: toStartOfDay(resolvedYear, month, day),
      end: toEndOfDay(resolvedYear, month, day),
    };
  }

  return null;
}

export function isActivityEnded(
  dateStr?: string,
  options?: { yearHint?: string; now?: Date },
): boolean {
  if (!dateStr?.trim()) return false;

  const parsed = parseActivityDateRange(dateStr, options?.yearHint);
  if (!parsed) return false;

  const now = options?.now ?? new Date();
  return now > parsed.end;
}

export type ProfileActivityDisplayStatus = 'registered' | 'attended';

export function resolveProfileActivityStatus(
  dateStr?: string,
  title?: string,
  now?: Date,
): ProfileActivityDisplayStatus {
  const yearHint = extractYearFromText(title) ?? extractYearFromText(dateStr);
  return isActivityEnded(dateStr, { yearHint, now })
    ? 'attended'
    : 'registered';
}

export function getActivitySortTimestamp(
  dateStr?: string,
  title?: string,
): number {
  const yearHint = extractYearFromText(title) ?? extractYearFromText(dateStr);
  const parsed = dateStr?.trim()
    ? parseActivityDateRange(dateStr, yearHint)
    : null;
  return parsed?.start.getTime() ?? 0;
}

export function compareActivityDateDesc(
  a: { date?: string; title?: string },
  b: { date?: string; title?: string },
): number {
  return (
    getActivitySortTimestamp(b.date, b.title) -
    getActivitySortTimestamp(a.date, a.title)
  );
}

export function compareActivityDateAsc(
  a: { date?: string; title?: string },
  b: { date?: string; title?: string },
): number {
  return (
    getActivitySortTimestamp(a.date, a.title) -
    getActivitySortTimestamp(b.date, b.title)
  );
}
