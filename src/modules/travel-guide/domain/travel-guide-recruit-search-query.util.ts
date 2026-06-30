import type { AiGuidePlanFormValues } from '@sync/travel-guide-contracts';
import { budgetTierLabel } from './parse-activity-days.util';

const LIST_SEPARATOR = ' · ';

function formatDepartureLabel(
  guide: AiGuidePlanFormValues,
): string | undefined {
  const departure = guide.departure?.trim() || guide.departureCity?.trim();
  if (!departure) return undefined;
  if (departure.endsWith('出发')) {
    return departure;
  }
  return `${departure}出发`;
}

function formatActivityDateShort(activityDate?: string): string | undefined {
  const raw = activityDate?.trim();
  if (!raw) return undefined;

  const isoRange = raw.match(
    /(\d{4})-(\d{2})-(\d{2})\s*[-–~至]\s*(\d{4})-(\d{2})-(\d{2})/,
  );
  if (isoRange) {
    return `${isoRange[2]}/${isoRange[3]}-${isoRange[5]}/${isoRange[6]}`;
  }

  const isoSingle = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoSingle) {
    return `${isoSingle[2]}/${isoSingle[3]}`;
  }

  const compactRange = raw.match(
    /(\d{1,2})[./月](\d{1,2})\s*[-–~至]\s*(\d{1,2})/,
  );
  if (compactRange) {
    return `${compactRange[1]}/${compactRange[2]}-${compactRange[3]}`;
  }

  const compactSingle = raw.match(/(\d{1,2})[./月](\d{1,2})/);
  if (compactSingle) {
    return `${compactSingle[1]}/${compactSingle[2]}`;
  }

  return undefined;
}

function resolveRecruitSlotsNeeded(headcount: number): number {
  if (!Number.isFinite(headcount) || headcount <= 0) return 1;
  return headcount > 1 ? headcount - 1 : 1;
}

export function travelGuideFormToRecruitSearchQuery(
  guide: AiGuidePlanFormValues,
  activityDate?: string,
): string {
  const parts: string[] = [];
  const departure = formatDepartureLabel(guide);
  if (departure) {
    parts.push(departure);
  }

  const dateShort = formatActivityDateShort(activityDate);
  if (dateShort) {
    parts.push(dateShort);
  }

  parts.push(`还差${resolveRecruitSlotsNeeded(guide.headcount)}个名额`);

  if (guide.budgetTier) {
    parts.push(budgetTierLabel(guide.budgetTier));
  }

  return parts.join(LIST_SEPARATOR);
}
