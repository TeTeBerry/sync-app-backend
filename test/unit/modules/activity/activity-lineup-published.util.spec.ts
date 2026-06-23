import { isActivityLineupPublished } from '@src/modules/activity/utils/activity-lineup-published.util';
import { ITINERARY_TOMORROWLAND_THAILAND_ACTIVITY_LEGACY_ID } from '@src/data/itinerary/tomorrowland-thailand-itinerary.seed';
import { STORM_ACTIVITY_LEGACY_ID } from '@src/data/itinerary/itinerary.seed';

describe('isActivityLineupPublished', () => {
  it('returns true when performances exist', () => {
    expect(isActivityLineupPublished(STORM_ACTIVITY_LEGACY_ID, true)).toBe(
      true,
    );
  });

  it('returns true for TML when only lineup DJs are seeded', () => {
    expect(
      isActivityLineupPublished(
        ITINERARY_TOMORROWLAND_THAILAND_ACTIVITY_LEGACY_ID,
        false,
      ),
    ).toBe(true);
  });

  it('returns false when no performances and no lineup seed', () => {
    expect(isActivityLineupPublished(999, false)).toBe(false);
  });
});
