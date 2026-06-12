import { buildActivityTravelPlanNodes } from '../../../../src/modules/travel-plan/domain/travel-plan-activity-nodes.builder';

describe('buildActivityTravelPlanNodes', () => {
  it('builds one node per festival session', () => {
    const nodes = buildActivityTravelPlanNodes({
      activityLegacyId: 4,
      activityName: '风暴电音节 深圳站',
      activityDate: '06/13-14',
      location: '深圳国际会展中心',
      sessions: [
        {
          activityLegacyId: 4,
          dateKey: 'jun13',
          label: '6月13日',
          bannerDateLabel: '6月13日',
          sortOrder: 0,
        },
        {
          activityLegacyId: 4,
          dateKey: 'jun14',
          label: '6月14日',
          bannerDateLabel: '6月14日',
          sortOrder: 1,
        },
      ],
    });

    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.id).toBe('activity-event-jun13');
    expect(nodes[0]?.title).toContain('Day 1');
    expect(nodes[1]?.id).toBe('activity-event-jun14');
    expect(nodes[1]?.subtitle).toContain('全场开放');
  });

  it('expands multi-day activityDate into one node per day when sessions are missing', () => {
    const nodes = buildActivityTravelPlanNodes({
      activityLegacyId: 4,
      activityName: '风暴电音节 深圳站',
      activityDate: '06/13-14',
      location: '深圳国际会展中心',
      sessions: [],
    });

    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.id).toBe('activity-event-jun13');
    expect(nodes[0]?.startDate).toBe('2026-06-13');
    expect(nodes[1]?.id).toBe('activity-event-jun14');
    expect(nodes[1]?.startDate).toBe('2026-06-14');
  });
});
