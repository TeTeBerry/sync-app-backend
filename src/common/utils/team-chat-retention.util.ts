/** Temp team-chat threads are removed this many days after the festival ends. */
export const TEAM_CHAT_RETENTION_DAYS_AFTER_EVENT = 3;

const DEFAULT_FESTIVAL_YEAR = 2026;

function endOfLocalDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function startOfLocalDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function inferYearFromActivityName(name?: string): number {
  const match = name?.match(/(20\d{2})/);
  if (match) {
    const year = Number(match[1]);
    if (Number.isFinite(year)) return year;
  }
  return DEFAULT_FESTIVAL_YEAR;
}

/** Parse festival `date` label to the last calendar day of the event. */
export function parseActivityEndDate(
  dateLabel?: string,
  year = DEFAULT_FESTIVAL_YEAR,
): Date | null {
  const raw = dateLabel?.trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(parsed.getTime()) ? null : endOfLocalDay(parsed);
  }

  const slashRange = raw.match(
    /^(\d{1,2})\/(\d{1,2})(?:\s*[-–~至]\s*(\d{1,2}))?$/,
  );
  if (slashRange) {
    const month = Number(slashRange[1]);
    const startDay = Number(slashRange[2]);
    const endDay = slashRange[3] ? Number(slashRange[3]) : startDay;
    if (!month || !endDay) return null;
    const parsed = new Date(year, month - 1, endDay);
    return Number.isNaN(parsed.getTime()) ? null : endOfLocalDay(parsed);
  }

  const dotRange = raw.match(/(\d{1,2})[./月](\d{1,2})\s*[-–~至]\s*(\d{1,2})/);
  if (dotRange) {
    const month = Number(dotRange[1]);
    const endDay = Number(dotRange[3]);
    const parsed = new Date(year, month - 1, endDay);
    return Number.isNaN(parsed.getTime()) ? null : endOfLocalDay(parsed);
  }

  return null;
}

export function buildTeamChatRetentionFields(
  activityDateLabel?: string,
  activityName?: string,
  activityLegacyId?: number,
): {
  activityLegacyId?: number;
  activityEndAt?: string;
  destroysAt?: string;
} {
  if (activityLegacyId == null || Number.isNaN(activityLegacyId)) {
    return {};
  }
  const endDate = parseActivityEndDate(
    activityDateLabel,
    inferYearFromActivityName(activityName),
  );
  if (!endDate) {
    return { activityLegacyId };
  }
  const destroysAt = startOfLocalDay(
    addDays(endOfLocalDay(endDate), TEAM_CHAT_RETENTION_DAYS_AFTER_EVENT),
  );
  return {
    activityLegacyId,
    activityEndAt: endOfLocalDay(endDate).toISOString(),
    destroysAt: destroysAt.toISOString(),
  };
}

export function isTeamChatExpired(
  destroysAt?: string,
  now = Date.now(),
): boolean {
  if (!destroysAt) return false;
  const ts = new Date(destroysAt).getTime();
  return Number.isFinite(ts) && now >= ts;
}
