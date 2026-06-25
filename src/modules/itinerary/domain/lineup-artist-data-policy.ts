import type { CatalogLineupArtist } from '@sync/activity-contracts';
import { resolveCuratedLineupArtistProfile } from '@src/data/itinerary/curated-lineup-artist-profiles';

import { LINEUP_SEED_GENRE_PLACEHOLDER } from '@src/data/itinerary/lineup-seed-genre.constants';

/** Lineup genre display — never Discogs; seeds use placeholder unless officially tagged. */
export function resolveLineupSeedGenreLabel(seedGenreLabel: string): string {
  const trimmed = seedGenreLabel?.trim();
  if (!trimmed || trimmed === LINEUP_SEED_GENRE_PLACEHOLDER) {
    return LINEUP_SEED_GENRE_PLACEHOLDER;
  }
  return trimmed;
}

export function resolveLineupSeedGenre(
  seedGenre: string,
  _seedGenreLabel: string,
): string {
  const genre = seedGenre?.trim();
  if (genre && genre !== LINEUP_SEED_GENRE_PLACEHOLDER) {
    return genre;
  }
  return LINEUP_SEED_GENRE_PLACEHOLDER;
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
  if (!label || label === LINEUP_SEED_GENRE_PLACEHOLDER) {
    return { representativeTracks: [] };
  }

  return {
    profileSummary: `${artist.name} 是以 ${label} 为主风格的电子音乐人。`,
    representativeTracks: [],
  };
}
