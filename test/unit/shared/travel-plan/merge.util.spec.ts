import {
  filterUserTravelPlanNodes,
  normalizeHiddenActivityNodeIds,
} from '@src/shared/travel-plan';

describe('shared travel-plan merge.util', () => {
  it('normalizeHiddenActivityNodeIds keeps activity ids only', () => {
    expect(
      normalizeHiddenActivityNodeIds([
        'activity-event-1',
        'user-1',
        'activity-event-1',
      ]),
    ).toEqual(['activity-event-1']);
  });

  it('filterUserTravelPlanNodes respects source when present', () => {
    const nodes = [
      {
        id: 'activity-event-1',
        category: 'event' as const,
        startDate: '2026-03-15',
        endDate: '2026-03-15',
        title: 'A',
        subtitle: 'B',
        confirmed: false,
        source: 'activity' as const,
      },
      {
        id: 'user-1',
        category: 'hotel' as const,
        startDate: '2026-03-14',
        endDate: '2026-03-16',
        title: 'H',
        subtitle: 'B',
        confirmed: true,
        source: 'user' as const,
      },
    ];
    expect(filterUserTravelPlanNodes(nodes)).toHaveLength(1);
    expect(filterUserTravelPlanNodes(nodes)[0]?.id).toBe('user-1');
  });
});
