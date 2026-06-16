import type { DjCatalogItem } from '../../dj/dj.types';
import type { DjService } from '../../dj/dj.service';
import type { ItineraryScheduleService } from '../../itinerary/itinerary-schedule.service';
import { lineupDjId } from '../data/personality-lineup';
import type { PersonalityLineupDj } from '../personality-test.types';
import { formatDiscogsStyleLabel } from '../../dj/discogs-style-label.util';

export function normalizeDjName(name: string): string {
  return name.trim().toLowerCase();
}

function catalogItemToLineupDj(item: DjCatalogItem): PersonalityLineupDj {
  const works = item.representativeWorks?.length ?? 0;
  return {
    id: lineupDjId(item.name),
    name: item.name,
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

export async function buildUpcomingLineupDjPool(
  scheduleService: Pick<ItineraryScheduleService, 'listUpcomingLineupArtists'>,
  djService: DjService,
): Promise<{
  lineupDjs: PersonalityLineupDj[];
  lineupDjNames: Set<string>;
}> {
  const artists = await scheduleService.listUpcomingLineupArtists();
  if (!artists.length) {
    return { lineupDjs: [], lineupDjNames: new Set() };
  }

  const lineupDjNames = new Set(
    artists.map((artist) => normalizeDjName(artist.artistName)),
  );
  const catalogByLineupName = await djService.lookupForLineupArtists(
    artists.map((artist) => artist.artistName),
  );

  const lineupDjs: PersonalityLineupDj[] = [];
  const seenIds = new Set<string>();

  for (const artist of artists) {
    const catalog = catalogByLineupName.get(artist.artistName);
    const dj = catalog
      ? catalogItemToLineupDj(catalog)
      : performanceToLineupDj(artist);
    if (seenIds.has(dj.id)) continue;
    seenIds.add(dj.id);
    lineupDjs.push(dj);
  }

  return { lineupDjs, lineupDjNames };
}
