import type { CatalogLineupArtist } from '@sync/activity-contracts';
import { resolveCuratedLineupArtistProfile } from '@src/data/itinerary/curated-lineup-artist-profiles';

/** Festival lineup genre fields are curated in itinerary seeds — never Discogs. */
export function resolveLineupSeedGenreLabel(seedGenreLabel: string): string {
  const trimmed = seedGenreLabel?.trim();
  if (!trimmed || trimmed === '风格待补充') {
    return '风格待补充';
  }
  return trimmed;
}

export function resolveLineupSeedGenre(
  seedGenre: string,
  seedGenreLabel: string,
): string {
  const genre = seedGenre?.trim();
  if (genre && genre !== '风格待补充') {
    return genre;
  }
  const [firstToken] = seedGenreLabel
    .split(/\s*[·/]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  return firstToken || 'Electronic';
}

/** Profile/tracks when Discogs match is skipped — curated row or seed-accurate one-liner. */
export function buildLineupArtistProfileFallback(
  artist: Pick<CatalogLineupArtist, 'name' | 'genre' | 'genreLabel'>,
): {
  profileSummary?: string;
  profileFull?: string;
  representativeTracks: string[];
} {
  const curated = resolveCuratedLineupArtistProfile(artist.name);
  if (curated) {
    return {
      profileSummary: curated.profileSummary,
      profileFull: curated.profileFull ?? curated.profileSummary,
      representativeTracks: curated.representativeTracks,
    };
  }

  const label = artist.genreLabel?.trim() || artist.genre?.trim();
  if (!label || label === '风格待补充') {
    return { representativeTracks: [] };
  }

  return {
    profileSummary: `${artist.name} 是以 ${label} 为主风格的电子音乐人。`,
    representativeTracks: [],
  };
}
