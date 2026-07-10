import type { Activity } from '../../../database/schemas/activity.schema';
import type { ActivityLookupRecord } from '../../activity/ports/activity-lookup.port';

export type ActivityTravelGuideSupportFields = {
  travelGuideSupported: boolean;
};

type TravelGuideSupportInput = Pick<
  Activity,
  'legacyId' | 'region' | 'latitude' | 'longitude' | 'location'
>;

/** All published activities can generate a guide; data providers degrade per section. */
export function resolveTravelGuideSupported(
  _activity: TravelGuideSupportInput,
): boolean {
  return true;
}

export function enrichActivityLookupRecord<T extends ActivityLookupRecord>(
  activity: T,
): T & ActivityTravelGuideSupportFields {
  return {
    ...activity,
    travelGuideSupported: resolveTravelGuideSupported(activity),
  };
}
