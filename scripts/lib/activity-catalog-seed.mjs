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
