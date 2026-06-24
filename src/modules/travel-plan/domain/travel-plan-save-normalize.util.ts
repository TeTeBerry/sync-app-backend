import type { TravelPlanBillLineItem } from '@sync/travel-plan-contracts/types';
import type { TravelPlanNodeRecord } from '../../../database/schemas/user-travel-plan.schema';
import type {
  TravelPlanBillLineItemDto,
  TravelPlanNodeDto,
} from '../dto/save-travel-plan.dto';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_NODES = 100;
const MAX_BILLS_PER_NODE = 50;
const MIN_SPLIT_COUNT = 2;
const MAX_SPLIT_COUNT = 8;

function normalizeSplitCount(value?: number): number | undefined {
  if (value == null || !Number.isFinite(value)) {
    return undefined;
  }
  const rounded = Math.round(value);
  if (rounded < MIN_SPLIT_COUNT || rounded > MAX_SPLIT_COUNT) {
    return undefined;
  }
  return rounded;
}

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

function normalizeBillLineItems(
  bills: TravelPlanBillLineItemDto[] | undefined,
): TravelPlanBillLineItem[] | undefined {
  if (!bills?.length) {
    return undefined;
  }

  const normalized: TravelPlanBillLineItem[] = [];
  for (const bill of bills.slice(0, MAX_BILLS_PER_NODE)) {
    const id = bill.id.trim();
    const title = bill.title.trim();
    const startDate = normalizeIsoDate(bill.startDate);
    if (!id || !title || !startDate) {
      continue;
    }

    const description = bill.description?.trim();
    const startTime = normalizeTime(bill.startTime);
    const cost =
      bill.cost != null && Number.isFinite(bill.cost) && bill.cost >= 0
        ? bill.cost
        : undefined;

    normalized.push({
      id,
      title,
      startDate,
      ...(description ? { description } : {}),
      ...(startTime ? { startTime } : {}),
      ...(cost != null ? { cost } : {}),
    });
  }

  return normalized.length > 0 ? normalized : undefined;
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
    const diningBills = normalizeBillLineItems(node.diningBills);
    const transportBills = normalizeBillLineItems(node.transportBills);
    const splitEnabled = node.splitEnabled === true ? true : undefined;
    const splitCount = splitEnabled
      ? normalizeSplitCount(node.splitCount)
      : undefined;

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
      ...(diningBills ? { diningBills } : {}),
      ...(transportBills ? { transportBills } : {}),
      ...(splitEnabled ? { splitEnabled: true } : {}),
      ...(splitCount != null ? { splitCount } : {}),
    });
  }

  return normalized;
}

export function normalizeTravelPlanSplitCount(
  value?: number,
): number | undefined {
  return normalizeSplitCount(value);
}
