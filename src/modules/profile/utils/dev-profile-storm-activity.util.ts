import {
  resolveProfileActivityStatus,
  compareActivityDateDesc,
} from '../../../common/utils/activity-date.util';
import type { ActivityLookupRecord } from '../../activity/ports/activity-lookup.port';
import type { ProfileActivityItemDto } from '../profile-summary.service';

/** 风暴电音节 — dev-only injection into 我的活动. */
export const DEV_PROFILE_STORM_LEGACY_ID = 4;

export function isDevProfileStormEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.DISABLE_DEV_PROFILE_STORM !== 'true'
  );
}

export function shouldInjectDevProfileStorm(
  activityLegacyIds: readonly number[],
): boolean {
  return (
    isDevProfileStormEnabled() &&
    !activityLegacyIds.includes(DEV_PROFILE_STORM_LEGACY_ID)
  );
}

export function buildDevProfileStormActivityItem(
  activity: ActivityLookupRecord | null,
): ProfileActivityItemDto | null {
  if (!activity) {
    return null;
  }

  const title = activity.name;
  const date = activity.date ?? '';

  return {
    id: String(DEV_PROFILE_STORM_LEGACY_ID),
    title,
    date,
    location: activity.location ?? '',
    image: activity.image ?? '',
    status: resolveProfileActivityStatus(date, title),
    activityLegacyId: String(DEV_PROFILE_STORM_LEGACY_ID),
  };
}

export function appendDevProfileStormActivity(
  items: ProfileActivityItemDto[],
  activity: ActivityLookupRecord | null,
  registeredLegacyIds: readonly number[],
): ProfileActivityItemDto[] {
  if (!shouldInjectDevProfileStorm(registeredLegacyIds)) {
    return items;
  }

  const devItem = buildDevProfileStormActivityItem(activity);
  if (!devItem) {
    return items;
  }

  return [...items, devItem].sort(compareActivityDateDesc);
}
