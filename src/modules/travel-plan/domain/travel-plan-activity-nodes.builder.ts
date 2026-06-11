import {
  extractYearFromText,
  parseActivityDateRange,
} from '../../../common/utils/activity-date.util';
import type { FestivalSession } from '../../../database/schemas/festival-session.schema';
import type { TravelPlanNodeRecord } from '../../../database/schemas/user-travel-plan.schema';

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

export function isoDateFromFestivalDateKey(
  dateKey: string,
  yearHint: string,
): string | null {
  const match = dateKey
    .trim()
    .toLowerCase()
    .match(/^([a-z]{3})(\d{1,2})$/);
  if (!match) {
    return null;
  }

  const month = MONTH_MAP[match[1]];
  const day = Number(match[2]);
  const year = Number(yearHint);
  if (
    !month ||
    !Number.isFinite(day) ||
    day < 1 ||
    day > 31 ||
    !Number.isFinite(year)
  ) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function formatMmDd(isoDate: string) {
  const [, month, day] = isoDate.split('-');
  return `${month}/${day}`;
}

function resolveActivitySubtitle(
  location: string | undefined,
  dayIndex: number,
  dayCount: number,
) {
  const venue = location?.trim() || '活动现场';
  if (dayCount <= 1) {
    return venue;
  }
  if (dayIndex === 0) {
    return `${venue} · 主舞台`;
  }
  if (dayIndex === dayCount - 1) {
    return `${venue} · 全场开放`;
  }
  return `${venue} · 活动现场`;
}

export function buildActivityTravelPlanNodes(input: {
  activityLegacyId: number;
  activityName: string;
  activityDate?: string;
  location?: string;
  sessions: FestivalSession[];
  activityConfirmations?: Record<string, boolean>;
}): TravelPlanNodeRecord[] {
  const yearHint =
    extractYearFromText(input.activityName) ??
    extractYearFromText(input.activityDate) ??
    String(new Date().getFullYear());

  const sortedSessions = [...input.sessions].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );

  if (sortedSessions.length > 0) {
    return sortedSessions.map((session, index) => {
      const isoDate =
        isoDateFromFestivalDateKey(session.dateKey, yearHint) ??
        parseActivityDateRange(input.activityDate ?? '', yearHint)
          ?.start.toISOString()
          .slice(0, 10) ??
        `${yearHint}-01-01`;
      const nodeId = `activity-event-${session.dateKey}`;
      const dayNumber = index + 1;

      return {
        id: nodeId,
        category: 'event' as const,
        startDate: isoDate,
        endDate: isoDate,
        title: `${input.activityName} · Day ${dayNumber}`,
        subtitle: resolveActivitySubtitle(
          input.location,
          index,
          sortedSessions.length,
        ),
        detail:
          dayNumber === 1
            ? '建议提前 1 小时入场，预留安检时间'
            : '压轴阵容日 · 建议全程在场',
        ...(index === 0 ? { price: 880 } : {}),
        confirmed: input.activityConfirmations?.[nodeId] ?? true,
      };
    });
  }

  const parsedRange = input.activityDate?.trim()
    ? parseActivityDateRange(input.activityDate, yearHint)
    : null;
  if (!parsedRange) {
    return [];
  }

  const startIso = parsedRange.start.toISOString().slice(0, 10);
  const endIso = parsedRange.end.toISOString().slice(0, 10);
  const nodeId = `activity-event-${input.activityLegacyId}`;

  return [
    {
      id: nodeId,
      category: 'event',
      startDate: startIso,
      endDate: endIso,
      title: input.activityName,
      subtitle: input.location?.trim() || '活动现场',
      confirmed: input.activityConfirmations?.[nodeId] ?? true,
    },
  ];
}

function formatDateToken(dateLabel: string, time?: string) {
  const trimmed = time?.trim();
  return trimmed ? `${dateLabel} ${trimmed}` : dateLabel;
}

export function attachTravelPlanTimeLabels(
  nodes: TravelPlanNodeRecord[],
): Array<TravelPlanNodeRecord & { timeLabel: string }> {
  return nodes.map((node) => {
    const startLabel = formatMmDd(node.startDate);
    const endLabel = formatMmDd(node.endDate);
    const timeLabel =
      node.startDate === node.endDate
        ? formatDateToken(startLabel, node.startTime ?? node.endTime)
        : `${formatDateToken(startLabel, node.startTime)}–${formatDateToken(endLabel, node.endTime)}`;

    return {
      ...node,
      timeLabel,
    };
  });
}
