import { enrichDevUnityAttendees } from '@src/modules/activity/utils/dev-unity-attendees.util';
import type { ActivityLookupRecord } from '@src/modules/activity/ports/activity-lookup.port';

function tmlActivity(
  recruits: number,
  attendees: number,
): ActivityLookupRecord {
  return {
    _id: '1',
    legacyId: 1,
    code: 'tml-thailand',
    name: 'Tomorrowland Thailand 2026',
    recruitPostCount: recruits,
    attendees,
  } as ActivityLookupRecord;
}

describe('enrichDevUnityAttendees', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('floors attendees for TML mock activity in dev', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DISABLE_DEV_MOCK_POSTS;

    const enriched = enrichDevUnityAttendees(tmlActivity(10, 1));
    expect(enriched.attendees).toBe(24);
  });

  it('keeps higher real attendee counts', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DISABLE_DEV_MOCK_POSTS;

    const enriched = enrichDevUnityAttendees(tmlActivity(10, 40));
    expect(enriched.attendees).toBe(40);
  });

  it('is a no-op in production', () => {
    process.env.NODE_ENV = 'production';

    const enriched = enrichDevUnityAttendees(tmlActivity(10, 1));
    expect(enriched.attendees).toBe(1);
  });
});
