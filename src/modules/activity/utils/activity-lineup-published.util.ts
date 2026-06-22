import { resolveLineupDjs } from '../../itinerary/domain/itinerary-catalog.util';

/** Lineup announced when catalog has performances or seeded lineup DJs. */
export function isActivityLineupPublished(
  activityLegacyId: number,
  hasPerformances: boolean,
): boolean {
  if (hasPerformances) {
    return true;
  }
  return resolveLineupDjs(activityLegacyId).length > 0;
}
