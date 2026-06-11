import {
  applyActivityNodeOverrides,
  mergeTravelPlanNodes,
  sortTravelPlanNodes,
  type TravelPlanNodeRecord,
} from '@src/shared/travel-plan';

const activityNodes: TravelPlanNodeRecord[] = [
  {
    id: 'activity-event-1',
    category: 'event' as const,
    startDate: '2026-03-15',
    endDate: '2026-03-15',
    startTime: '20:00',
    title: 'Main Stage',
    subtitle: 'EDC',
    confirmed: false,
    price: 0,
  },
];

const userNodes: TravelPlanNodeRecord[] = [
  {
    id: 'user-hotel-1',
    category: 'hotel' as const,
    startDate: '2026-03-14',
    endDate: '2026-03-16',
    title: 'Hotel',
    subtitle: 'Bangkok',
    confirmed: true,
    price: 1200,
  },
];

describe('travel-plan merge parity', () => {
  it('mergeTravelPlanNodes tags sources and sorts by date/category', () => {
    const merged = mergeTravelPlanNodes(activityNodes, userNodes);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.source).toBe('user');
    expect(merged[0]?.id).toBe('user-hotel-1');
    expect(merged[1]?.source).toBe('activity');
    expect(merged[1]?.id).toBe('activity-event-1');
  });

  it('applyActivityNodeOverrides applies confirmations and prices', () => {
    const overridden = applyActivityNodeOverrides(
      activityNodes,
      {
        'activity-event-1': true,
      },
      {
        'activity-event-1': 99,
      },
    );
    expect(overridden[0]?.confirmed).toBe(true);
    expect(overridden[0]?.price).toBe(99);
  });

  it('sortTravelPlanNodes is stable for equal keys', () => {
    const sorted = sortTravelPlanNodes([
      ...userNodes,
      {
        id: 'user-flight-1',
        category: 'flight' as const,
        startDate: '2026-03-14',
        endDate: '2026-03-14',
        title: 'Flight',
        subtitle: 'BKK',
        confirmed: true,
      },
    ]);
    expect(sorted[0]?.category).toBe('flight');
    expect(sorted[1]?.category).toBe('hotel');
  });
});
