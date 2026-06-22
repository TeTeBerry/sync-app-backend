/** Keep in sync with src/modules/activity/activity.seed.ts */
import { ACTIVITY_SEED } from './activity-catalog-seed-data.mjs';

export { ACTIVITY_SEED };

export const DEPRECATED_ACTIVITY_FILTER = {
  $or: [
    { code: 'sync-live-sh' },
    { code: 'ultra' },
    { code: 'edc' },
    { code: 'vac-zhuhai' },
  ],
};

/** Public recruit posts visible on activity feeds (matches PostRepository). */
export const PUBLIC_RECRUIT_POST_MATCH = {
  activityLegacyId: { $exists: true, $type: 'number' },
  status: { $ne: 'hidden' },
  listedInFeed: { $ne: false },
};
