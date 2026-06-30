import { filterUserTravelPlanNodes } from '@sync/travel-plan-contracts';
import type { ItineraryDay } from '@sync/itinerary-contracts';
import type { TravelPlanNodeRecord } from '@sync/travel-plan-contracts';

export type TravelPlanEngagementSnapshot = {
  nodes?: TravelPlanNodeRecord[];
  activityConfirmations?: Record<string, boolean>;
  activityPriceOverrides?: Record<string, number>;
  splitCount?: number;
};

/** User saved a personal festival schedule with at least one slot. */
export function hasMeaningfulItineraryData(
  days: ItineraryDay[] | undefined,
): boolean {
  return (days ?? []).some((day) => (day.items?.length ?? 0) > 0);
}

/** User added expenses / confirmations in the travel ledger. */
export function hasMeaningfulTravelPlanData(
  plan: TravelPlanEngagementSnapshot | null | undefined,
): boolean {
  if (!plan) return false;
  if (plan.splitCount != null && plan.splitCount > 0) return true;

  if (
    plan.activityPriceOverrides &&
    Object.keys(plan.activityPriceOverrides).length > 0
  ) {
    return true;
  }

  if (
    plan.activityConfirmations &&
    Object.values(plan.activityConfirmations).some(Boolean)
  ) {
    return true;
  }

  const nodes = plan.nodes ?? [];
  if (filterUserTravelPlanNodes(nodes).length > 0) {
    return true;
  }

  return nodes.some(
    (node) =>
      (node.diningBills?.length ?? 0) > 0 ||
      (node.transportBills?.length ?? 0) > 0,
  );
}

export function mergeActivityLegacyIds(
  ...groups: Array<readonly number[] | Iterable<number>>
): number[] {
  const ids = new Set<number>();
  for (const group of groups) {
    for (const raw of group) {
      if (Number.isFinite(raw) && raw > 0) {
        ids.add(raw);
      }
    }
  }
  return [...ids];
}
