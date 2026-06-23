import {
  filterUserTravelPlanNodes,
  normalizeHiddenActivityNodeIds,
} from '@sync/travel-plan-contracts';

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

  it('filterUserTravelPlanNodes keeps user event nodes without source', () => {
    const nodes = [
      {
        id: 'plan-abc',
        category: 'event' as const,
        startDate: '2026-03-15',
        endDate: '2026-03-15',
        title: '其他安排',
        subtitle: '待补充详情',
        confirmed: true,
      },
      {
        id: 'activity-event-mar15',
        category: 'event' as const,
        startDate: '2026-03-15',
        endDate: '2026-03-15',
        title: 'Festival Day 1',
        subtitle: 'Main stage',
        confirmed: true,
      },
    ];

    expect(filterUserTravelPlanNodes(nodes)).toHaveLength(1);
    expect(filterUserTravelPlanNodes(nodes)[0]?.id).toBe('plan-abc');
  });
});
