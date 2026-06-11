import type { TravelPlanNodeRecord } from '../../../database/schemas/user-travel-plan.schema';
import type { TravelPlanNodeDto } from '../dto/save-travel-plan.dto';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_NODES = 100;

function normalizeIsoDate(value: string): string | null {
  const trimmed = value.trim();
  return ISO_DATE.test(trimmed) ? trimmed : null;
}

function normalizeTime(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !TIME_OF_DAY.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function normalizeDateRange(startDate: string, endDate: string) {
  const start = normalizeIsoDate(startDate);
  const end = normalizeIsoDate(endDate);
  if (!start || !end) {
    return null;
  }
  if (start > end) {
    return { startDate: end, endDate: start };
  }
  return { startDate: start, endDate: end };
}

export function normalizeTravelPlanNodesForSave(
  nodes: TravelPlanNodeDto[],
): TravelPlanNodeRecord[] {
  const normalized: TravelPlanNodeRecord[] = [];

  for (const node of nodes.slice(0, MAX_NODES)) {
    const id = node.id.trim();
    const title = node.title.trim();
    if (!id || !title) {
      continue;
    }

    const range = normalizeDateRange(node.startDate, node.endDate);
    if (!range) {
      continue;
    }

    const subtitle = node.subtitle.trim() || '待补充详情';
    const duration = node.duration?.trim();
    const detail = node.detail?.trim();

    const startTime = normalizeTime(node.startTime);
    const endTime = normalizeTime(node.endTime);

    normalized.push({
      id,
      category: node.category,
      startDate: range.startDate,
      endDate: range.endDate,
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
      ...(duration ? { duration } : {}),
      title,
      subtitle,
      ...(detail ? { detail } : {}),
      ...(node.price != null && Number.isFinite(node.price) && node.price >= 0
        ? { price: node.price }
        : {}),
      confirmed: Boolean(node.confirmed),
    });
  }

  return normalized;
}
