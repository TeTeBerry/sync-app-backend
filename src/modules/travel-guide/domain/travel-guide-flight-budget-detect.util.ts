import type { TravelGuideBudgetItem } from '@sync/travel-guide-contracts';
import { TRAVEL_QUOTE_DISCLAIMER } from './travel-guide-quote.util';

export const STATIC_FLIGHT_BUDGET_NOTE =
  /视出发城市、购票时间与舱位浮动|建议提前\s*2[\-–—]8\s*周关注.*(?:机票|票价)/;

export const FLIGHT_BUDGET_LABEL = /^(机票|城际|国际航班|航班|高铁|机票\/高铁)/;

export function isFlightBudgetItem(item: TravelGuideBudgetItem): boolean {
  if (FLIGHT_BUDGET_LABEL.test(item.label.trim())) return true;
  const note = item.note ?? '';
  if (STATIC_FLIGHT_BUDGET_NOTE.test(note)) return true;
  return false;
}

export function isStaticFlightBudgetItem(item: TravelGuideBudgetItem): boolean {
  if (STATIC_FLIGHT_BUDGET_NOTE.test(item.note ?? '')) return true;
  if (/1800.*5500|3600.*11000/.test(item.range.replace(/\s/g, ''))) return true;
  return (
    FLIGHT_BUDGET_LABEL.test(item.label.trim()) &&
    !item.label.includes('→') &&
    !item.note?.includes('RollingGo') &&
    !(item.details?.length ?? 0)
  );
}

export function hasRollingGoFlightBudget(
  items: TravelGuideBudgetItem[] = [],
): boolean {
  return items.some(
    (item) =>
      isFlightBudgetItem(item) &&
      (item.label.includes('→') ||
        item.note?.includes('RollingGo') ||
        item.note?.includes(TRAVEL_QUOTE_DISCLAIMER) ||
        (item.details?.length ?? 0) > 0),
  );
}

export function hasStaticFlightBudgetTemplate(
  items: TravelGuideBudgetItem[] = [],
): boolean {
  return items.some(isStaticFlightBudgetItem);
}
