import type { DjCatalogItem } from '../../dj/dj.types';
import type { DjService } from '../../dj/dj.service';
import type { ItineraryScheduleService } from '../../itinerary/itinerary-schedule.service';
import { lineupDjId } from '../data/personality-lineup';
import type { PersonalityLineupDj } from '../personality-test.types';
import { formatDiscogsStyleLabel } from '../../dj/discogs-style-label.util';

export const LINEUP_POOL_EMPTY = 'LINEUP_POOL_EMPTY';

export function normalizeDjName(name: string): string {
  return name.trim().toLowerCase();
}

function catalogItemToLineupDj(
  item: DjCatalogItem,
  lineupArtistName: string,
): PersonalityLineupDj {
  const works = item.representativeWorks?.length ?? 0;
  return {
    id: lineupDjId(lineupArtistName),
    name: lineupArtistName,
    genre: item.genres[0] ?? 'Electronic',
    genreLabel: formatDiscogsStyleLabel(item),
    stage: 'main',
    popularity: Math.min(98, 68 + works * 4),
    genreColor: '#7b61ff',
  };
}

function performanceToLineupDj(entry: {
  artistName: string;
  genreLabel: string;
}): PersonalityLineupDj {
  const genreLabel = entry.genreLabel.trim() || 'Electronic';
  return {
    id: lineupDjId(entry.artistName),
    name: entry.artistName,
    genre: genreLabel,
    genreLabel,
    stage: 'main',
    popularity: 88,
    genreColor: '#7b61ff',
  };
}

/** Lineup pool from all requested activities (including ended festivals). */
export async function buildUpcomingLineupDjPool(
  activityLegacyIds: number[],
  scheduleService: Pick<
    ItineraryScheduleService,
    'listLineupArtistsForActivities'
  >,
  djService: DjService,
): Promise<PersonalityLineupDj[]> {
  const artists =
    await scheduleService.listLineupArtistsForActivities(activityLegacyIds);
  if (!artists.length) {
    return [];
  }

  const allowedNames = new Set(
    artists.map((artist) => normalizeDjName(artist.artistName)),
  );
  const catalogByLineupName = await djService.lookupForLineupArtists(
    artists.map((artist) => artist.artistName),
  );

  const lineupDjs: PersonalityLineupDj[] = [];
  const seenIds = new Set<string>();

  for (const artist of artists) {
    if (!allowedNames.has(normalizeDjName(artist.artistName))) {
      continue;
    }

    const catalog = catalogByLineupName.get(artist.artistName);
    const dj = catalog
      ? catalogItemToLineupDj(catalog, artist.artistName)
      : performanceToLineupDj(artist);

    if (!allowedNames.has(normalizeDjName(dj.name))) {
      continue;
    }
    if (seenIds.has(dj.id)) continue;
    seenIds.add(dj.id);
    lineupDjs.push(dj);
  }

  return lineupDjs;
}
