import type { CatalogLineupArtist } from '@sync/activity-contracts';
import { resolveCuratedLineupArtistProfile } from '@src/data/itinerary/curated-lineup-artist-profiles';
import type { DjCatalogItem } from '@src/modules/dj/dj.types';
import {
  formatDiscogsStyleLabel,
  mergeDiscogsStyleLabels,
} from '@src/modules/dj/discogs-style-label.util';
import { sanitizeCatalogGenreTokens } from '@src/modules/dj/web-only-genre-normalize.util';

import { LINEUP_SEED_GENRE_PLACEHOLDER } from '@src/data/itinerary/lineup-seed-genre.constants';

type CatalogGenreSource = Pick<DjCatalogItem, 'styles' | 'genres'>;

const PLACEHOLDER_GENRE = {
  genre: LINEUP_SEED_GENRE_PLACEHOLDER,
  genreLabel: LINEUP_SEED_GENRE_PLACEHOLDER,
} as const;

/** Editorial genre overrides when Discogs/Hermes maps the wrong person or sub-styles. */
const CURATED_LINEUP_DISPLAY_GENRES = new Map<
  string,
  { genre: string; genreLabel: string }
>([['DJ SNAKE', { genre: 'Trap', genreLabel: 'Trap · EDM' }]]);

export function resolveCuratedLineupDisplayGenre(
  lineupName: string,
): { genre: string; genreLabel: string } | undefined {
  const key = lineupName.trim().toUpperCase();
  if (!key) {
    return undefined;
  }
  return CURATED_LINEUP_DISPLAY_GENRES.get(key);
}

function resolvePrimaryGenreFromCatalogItems(
  items: CatalogGenreSource[],
  genreLabel: string,
): string {
  for (const item of items) {
    const style = sanitizeCatalogGenreTokens(item.styles)[0];
    if (style) {
      return style;
    }
  }
  for (const item of items) {
    const genre = sanitizeCatalogGenreTokens(item.genres)[0];
    if (genre) {
      return genre;
    }
  }
  if (genreLabel && genreLabel !== LINEUP_SEED_GENRE_PLACEHOLDER) {
    return genreLabel.split(' · ')[0]?.trim() || genreLabel;
  }
  return LINEUP_SEED_GENRE_PLACEHOLDER;
}

/** Lineup genre display — Discogs mapped catalog first; else placeholder (seeds are not shown). */
export function resolveLineupDisplayGenreFromCatalog(
  catalogItems: CatalogGenreSource[] | null | undefined,
): { genre: string; genreLabel: string } {
  const items = catalogItems?.filter(Boolean) ?? [];
  if (!items.length) {
    return { ...PLACEHOLDER_GENRE };
  }

  const genreLabel =
    items.length === 1
      ? formatDiscogsStyleLabel(items[0])
      : mergeDiscogsStyleLabels(items);
  if (genreLabel === LINEUP_SEED_GENRE_PLACEHOLDER) {
    return { ...PLACEHOLDER_GENRE };
  }

  return {
    genre: resolvePrimaryGenreFromCatalogItems(items, genreLabel),
    genreLabel,
  };
}

/** @deprecated Seeds are not used for lineup genre display — kept for legacy call sites. */
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

/** Profile/tracks when Discogs match is skipped — curated row only (seeds are names-only). */
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

  return { representativeTracks: [] };
}
