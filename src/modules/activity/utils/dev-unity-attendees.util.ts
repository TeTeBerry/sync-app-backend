import type { ActivityLookupRecord } from '../../activity/ports/activity-lookup.port';
import { TML_THAILAND_LEGACY_ID } from '../../partner/data/dev-mock-buddy-posts.util';

function isDevMockBuddyPostsEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.DISABLE_DEV_MOCK_POSTS !== 'true'
  );
}

/**
 * Dev-only: mock recruit posts do not create registrations, so Unity index
 * would show e.g. "10 recruits · 1 interested". Floor attendees for atmosphere.
 */
export function enrichDevUnityAttendees<T extends ActivityLookupRecord>(
  activity: T,
): T {
  if (!isDevMockBuddyPostsEnabled()) {
    return activity;
  }
  if (activity.legacyId !== TML_THAILAND_LEGACY_ID) {
    return activity;
  }

  const recruits = activity.recruitPostCount ?? 0;
  if (recruits <= 0) {
    return activity;
  }

  const attendees = activity.attendees ?? 0;
  const floor = Math.min(Math.max(recruits * 2, 24), 120);
  if (attendees >= floor) {
    return activity;
  }

  return { ...activity, attendees: floor };
}
