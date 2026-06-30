import {
  hasMeaningfulItineraryData,
  hasMeaningfulTravelPlanData,
} from '@src/modules/profile/utils/profile-activity-eligibility.util';

describe('profile-activity-eligibility.util', () => {
  it('treats itinerary with timeline items as meaningful', () => {
    expect(
      hasMeaningfulItineraryData([
        {
          id: 'day-1',
          label: 'Day 1',
          bannerDateLabel: '07/18',
          nodeCount: 1,
          items: [
            { id: 'slot-1', time: '20:00', dotColor: 'purple', title: 'DJ' },
          ],
        },
      ]),
    ).toBe(true);
    expect(
      hasMeaningfulItineraryData([
        {
          id: 'day-1',
          label: 'Day 1',
          bannerDateLabel: '',
          nodeCount: 0,
          items: [],
        },
      ]),
    ).toBe(false);
  });

  it('treats travel plan user nodes and bill data as meaningful', () => {
    expect(
      hasMeaningfulTravelPlanData({
        nodes: [
          {
            id: 'user-flight-1',
            category: 'flight',
            startDate: '2026-07-17',
            endDate: '2026-07-17',
            title: 'Flight',
            subtitle: 'PEK-ICN',
            confirmed: false,
          },
        ],
      }),
    ).toBe(true);

    expect(
      hasMeaningfulTravelPlanData({
        nodes: [
          {
            id: 'activity-event-ticket',
            category: 'event',
            startDate: '2026-07-18',
            endDate: '2026-07-18',
            title: 'Ticket',
            subtitle: '',
            confirmed: false,
          },
        ],
      }),
    ).toBe(false);

    expect(
      hasMeaningfulTravelPlanData({
        nodes: [],
        activityConfirmations: { 'activity-event-ticket': true },
      }),
    ).toBe(true);
  });
});
