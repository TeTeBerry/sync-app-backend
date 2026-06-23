import type { ActivityLookupRecord } from '../../activity/ports/activity-lookup.port';
import {
  compareActivityDateAsc,
  extractYearFromText,
  isActivityEnded,
} from '../../../common/utils/activity-date.util';
import {
  resolveItineraryCatalogSeed,
  resolveLineupDjs,
} from './itinerary-catalog.util';
import type {
  CatalogLineupArtistDto,
  CatalogLineupArtistNextActivityDto,
} from '../itinerary-schedule.types';

export function collectLineupArtistsForActivity(
  activityLegacyId: number,
  performances: Array<{
    activityLegacyId: number;
    artistName?: string;
    genreLabel?: string;
  }>,
): Array<{ artistName: string; genreLabel: string }> {
  const byName = new Map<string, { artistName: string; genreLabel: string }>();
  const addArtist = (artistName: string, genreLabel: string) => {
    const trimmed = artistName.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (byName.has(key)) return;
    byName.set(key, {
      artistName: trimmed,
      genreLabel: genreLabel.trim() || 'Electronic',
    });
  };

  const beforeCount = byName.size;

  for (const perf of performances) {
    if (perf.activityLegacyId !== activityLegacyId) {
      continue;
    }
    addArtist(perf.artistName ?? '', perf.genreLabel ?? '');
  }

  for (const dj of resolveLineupDjs(activityLegacyId)) {
    addArtist(dj.name, dj.genreLabel);
  }

  if (byName.size === beforeCount) {
    const { performances: seedPerformances } =
      resolveItineraryCatalogSeed(activityLegacyId);
    for (const perf of seedPerformances) {
      addArtist(perf.artistName, perf.genreLabel);
    }
  }

  return [...byName.values()];
}

export function pickNextActivityForArtist(
  activityIds: Set<number>,
  activitiesByLegacyId: Map<number, ActivityLookupRecord>,
  now = new Date(),
): CatalogLineupArtistNextActivityDto | undefined {
  const upcoming = [...activityIds]
    .map((legacyId) => activitiesByLegacyId.get(legacyId))
    .filter((activity): activity is ActivityLookupRecord => Boolean(activity))
    .filter(
      (activity) =>
        !isActivityEnded(activity.date, {
          yearHint: extractYearFromText(activity.name),
          now,
        }),
    )
    .sort((a, b) =>
      compareActivityDateAsc(
        { date: a.date, title: a.name },
        { date: b.date, title: b.name },
      ),
    );

  const next = upcoming[0];
  if (!next) {
    return undefined;
  }

  return {
    legacyId: next.legacyId,
    name: next.name?.trim() || `活动 ${next.legacyId}`,
    date: next.date?.trim() || '',
    ...(next.area?.trim() ? { area: next.area.trim() } : {}),
  };
}

export function compareCatalogLineupArtists(
  a: CatalogLineupArtistDto,
  b: CatalogLineupArtistDto,
): number {
  const aHasUpcoming = Boolean(a.nextActivity);
  const bHasUpcoming = Boolean(b.nextActivity);
  if (aHasUpcoming !== bHasUpcoming) {
    return aHasUpcoming ? -1 : 1;
  }

  if (aHasUpcoming && bHasUpcoming && a.nextActivity && b.nextActivity) {
    const byDate = compareActivityDateAsc(
      { date: a.nextActivity.date, title: a.nextActivity.name },
      { date: b.nextActivity.date, title: b.nextActivity.name },
    );
    if (byDate !== 0) {
      return byDate;
    }
  }

  if (b.activityCount !== a.activityCount) {
    return b.activityCount - a.activityCount;
  }

  return a.name.localeCompare(b.name, 'zh');
}
