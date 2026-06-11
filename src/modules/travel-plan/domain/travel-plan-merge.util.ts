import type { TravelPlanNodeRecord } from '../../../database/schemas/user-travel-plan.schema';

const CATEGORY_ORDER: Record<TravelPlanNodeRecord['category'], number> = {
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

export function filterUserTravelPlanNodes(nodes: TravelPlanNodeRecord[]) {
  return nodes.filter(
    (node) => node.category !== 'event' && !isActivityTravelPlanNodeId(node.id),
  );
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
