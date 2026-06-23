import type {
  TravelPlanCategory,
  TravelPlanNode,
  TravelPlanNodeRecord,
} from './types';

const CATEGORY_ORDER: Record<TravelPlanCategory, number> = {
  flight: 0,
  transport: 1,
  hotel: 2,
  dining: 3,
  event: 4,
};

export function isActivityTravelPlanNodeId(id: string) {
  return id.startsWith('activity-event-');
}

export function normalizeHiddenActivityNodeIds(ids?: string[]) {
  if (!ids?.length) {
    return [];
  }

  return [
    ...new Set(ids.filter((id) => isActivityTravelPlanNodeId(id.trim()))),
  ];
}

export function filterUserTravelPlanNodes<T extends TravelPlanNodeRecord>(
  nodes: T[],
): T[] {
  return nodes.filter((node) => {
    const source = (node as TravelPlanNode).source;
    if (source === 'activity') {
      return false;
    }
    if (source === 'user') {
      return true;
    }
    // Persisted nodes and save payloads omit `source`; activity nodes use activity-event-* ids.
    return !isActivityTravelPlanNodeId(node.id);
  });
}

export function sortTravelPlanNodes<T extends TravelPlanNodeRecord>(
  nodes: T[],
): T[] {
  return [...nodes].sort((a, b) => {
    const dateDiff = a.startDate.localeCompare(b.startDate);
    if (dateDiff !== 0) {
      return dateDiff;
    }

    const categoryDiff =
      CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (categoryDiff !== 0) {
      return categoryDiff;
    }

    const timeDiff = (a.startTime ?? '00:00').localeCompare(
      b.startTime ?? '00:00',
    );
    if (timeDiff !== 0) {
      return timeDiff;
    }

    if (a.category === 'hotel' && a.endDate !== b.endDate) {
      return a.endDate.localeCompare(b.endDate);
    }

    return a.id.localeCompare(b.id);
  });
}

export function mergeTravelPlanNodes<T extends TravelPlanNodeRecord>(
  activityNodes: T[],
  userNodes: T[],
): Array<T & { source: 'activity' | 'user' }> {
  return sortTravelPlanNodes([
    ...activityNodes.map((node) => ({
      ...node,
      source: 'activity' as const,
    })),
    ...userNodes.map((node) => ({ ...node, source: 'user' as const })),
  ]);
}

export function applyActivityNodeOverrides<T extends TravelPlanNodeRecord>(
  activityNodes: T[],
  activityConfirmations: Record<string, boolean>,
  activityPriceOverrides: Record<string, number>,
): T[] {
  return activityNodes.map((node) => {
    const priceOverride = activityPriceOverrides[node.id];
    const next = {
      ...node,
      confirmed: activityConfirmations[node.id] ?? node.confirmed,
    };

    if (
      priceOverride != null &&
      Number.isFinite(priceOverride) &&
      priceOverride >= 0
    ) {
      return { ...next, price: priceOverride };
    }

    return next;
  });
}
