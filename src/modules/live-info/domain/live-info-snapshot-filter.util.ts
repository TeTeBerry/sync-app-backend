import type { LiveInfoCategoryId } from './live-info-categories';
import {
  LIVE_INFO_VENUE_ZONE_ID,
  normalizeZoneTag,
} from './live-info-zones.util';

export type LiveInfoSnapshotQuery = {
  zoneTag?: string;
  categoryId?: LiveInfoCategoryId;
  certifiedOnly?: boolean;
};

type FilterableUpdate = {
  userId: string;
  zoneTag?: string;
  ratings: { categoryId: string; score: number }[];
};

export function parseCertifiedOnlyQuery(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

export function matchesZoneFilter(
  updateZoneTag: string | undefined,
  filterZoneTag?: string,
): boolean {
  const filter = filterZoneTag?.trim();
  if (!filter || filter === 'all') return true;

  const updateZone = normalizeZoneTag(updateZoneTag);
  if (filter === LIVE_INFO_VENUE_ZONE_ID) {
    return updateZone === LIVE_INFO_VENUE_ZONE_ID;
  }
  return updateZone === filter;
}

export function matchesCategoryFilter(
  ratings: { categoryId: string }[],
  categoryId?: LiveInfoCategoryId,
): boolean {
  if (!categoryId) return true;
  return ratings.some((r) => r.categoryId === categoryId);
}

export function filterLiveInfoUpdates<T extends FilterableUpdate>(
  updates: T[],
  query: LiveInfoSnapshotQuery,
  onSiteUserIds: Set<string>,
): T[] {
  return updates.filter((update) => {
    if (
      query.certifiedOnly &&
      !onSiteUserIds.has(update.userId?.trim() ?? '')
    ) {
      return false;
    }
    if (!matchesZoneFilter(update.zoneTag, query.zoneTag)) {
      return false;
    }
    if (!matchesCategoryFilter(update.ratings, query.categoryId)) {
      return false;
    }
    return true;
  });
}
