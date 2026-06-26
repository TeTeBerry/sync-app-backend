import { resolveLineupDjs } from '../../itinerary/domain/itinerary-catalog.util';

/** Experience showcases stay lineup-pending until the organizer announces. */
export const LINEUP_FORCE_PENDING_ACTIVITY_LEGACY_IDS = new Set([16]);

/** Lineup announced when catalog has performances or seeded lineup DJs. */
export function isActivityLineupPublished(
  activityLegacyId: number,
  hasPerformances: boolean,
): boolean {
  if (LINEUP_FORCE_PENDING_ACTIVITY_LEGACY_IDS.has(activityLegacyId)) {
    return false;
  }
  if (hasPerformances) {
    return true;
  }
  return resolveLineupDjs(activityLegacyId).length > 0;
}
