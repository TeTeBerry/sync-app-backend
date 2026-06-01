import { buildTravelGuidePlan } from '../../../../src/modules/travel-guide/domain/travel-guide-fallback.builder';
import type { Activity } from '../../../../src/database/schemas/activity.schema';

function mockActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    name: 'Storm 深圳',
    location: '深圳·国际会展中心',
    date: '06/13-14',
    ...overrides,
  } as Activity;
}

describe('buildTravelGuidePlan hotels', () => {
  it('maps comfort tier to ¥600-800 primary band', () => {
    const plan = buildTravelGuidePlan({
      activity: mockActivity(),
      departure: '北京',
      headcount: 2,
      budgetTier: 'comfort',
      accommodationNights: 2,
    });

    expect(plan.accommodation.hotels[0]?.note).toContain('¥600-800');
    expect(plan.accommodation.hotels[1]?.note).toContain('¥800-1200');
  });

  it('maps standard tier within ¥300-600', () => {
    const plan = buildTravelGuidePlan({
      activity: mockActivity(),
      departure: '上海',
      headcount: 2,
      budgetTier: 'standard',
    });

    expect(plan.accommodation.hotels[0]?.note).toContain('¥300-450');
    expect(plan.accommodation.hotels[1]?.note).toContain('¥450-600');
  });

  it('maps economy tier within ¥150-300', () => {
    const plan = buildTravelGuidePlan({
      activity: mockActivity(),
      departure: '广州',
      headcount: 1,
      budgetTier: 'economy',
    });

    expect(plan.accommodation.hotels[0]?.note).toContain('¥150-250');
    expect(plan.accommodation.hotels[1]?.note).toContain('¥250-300');
  });
});
