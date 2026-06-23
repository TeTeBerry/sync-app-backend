import type { Activity } from '../../../database/schemas/activity.schema';
import type { ActivityLookupRecord } from '../../activity/ports/activity-lookup.port';
import { isTravelGuideAbroad } from './travel-guide-international.util';
import { findHotActivityProfile } from '@src/data/travel-guide/travel-guide-hot-path.data';
import { getHotPathFallbackPois } from '@src/data/travel-guide/travel-guide-hot-path-pois.data';

export const TRAVEL_GUIDE_PREPARING_MESSAGE = '该场出行攻略筹备中，敬请期待';

export type ActivityTravelGuideSupportFields = {
  travelGuideSupported: boolean;
};

type TravelGuideSupportInput = Pick<
  Activity,
  'legacyId' | 'region' | 'latitude' | 'longitude' | 'location'
>;

/**
 * 境外场：Hot Path 场馆 + 精选酒店兜底 POI 双检。
 * 境内/港澳台：Hot Path、坐标或可查地址即可（高德周边检索）。
 */
export function resolveTravelGuideSupported(
  activity: TravelGuideSupportInput,
): boolean {
  const abroad = isTravelGuideAbroad(activity);
  const hot = findHotActivityProfile(activity.legacyId);
  const hotelFallback = getHotPathFallbackPois(activity.legacyId, 'hotel');

  if (abroad) {
    return Boolean(hot && hotelFallback.length > 0);
  }

  if (hot) return true;
  if (
    activity.latitude != null &&
    activity.longitude != null &&
    Number.isFinite(activity.latitude) &&
    Number.isFinite(activity.longitude)
  ) {
    return true;
  }
  return Boolean(activity.location?.trim());
}

export function enrichActivityLookupRecord<T extends ActivityLookupRecord>(
  activity: T,
): T & ActivityTravelGuideSupportFields {
  return {
    ...activity,
    travelGuideSupported: resolveTravelGuideSupported(activity),
  };
}
