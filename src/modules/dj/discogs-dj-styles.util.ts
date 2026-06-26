/**
 * Aggregate DJ main styles from Discogs release tags.
 * genres = broad categories; styles = artist-facing tags (Top N by frequency).
 */
export type DiscogsReleaseTags = {
  genres?: string[];
  styles?: string[];
};

export const DISCOGS_RELEASES_PAGE_SIZE_DEFAULT = 100;
export const DISCOGS_RELEASE_SAMPLE_SIZE_DEFAULT = 5;
export const DISCOGS_MAIN_STYLES_TOP_N_DEFAULT = 3;

/** Broad / non-electronic tags to drop before frequency ranking. */
export const DISCOGS_IRRELEVANT_TAGS = new Set([
  'pop',
  'rock',
  'folk, world, & country',
  'folk',
  'world',
  'country',
  'jazz',
  'classical',
  'stage & screen',
  'non-music',
  "children's",
  'brass & military',
  'latin',
  'blues',
  'vocal',
  'reggae',
  'spiritual',
  'stage',
  'dance-pop',
]);

/** House subgenres that also contribute to the parent "House" style bucket. */
export const DISCOGS_HOUSE_SUBGENRES = new Set([
  'electro house',
  'deep house',
  'future house',
  'funky house',
  'vocal house',
  'jackin house',
  'latin house',
  'tribal house',
  'microhouse',
]);

export type DiscogsArtistReleaseListItem = {
  main_release?: number;
  id?: number;
  year?: number;
  role?: string;
  title?: string;
  type?: string;
  resource_url?: string;
};

/**
 * Prefer recent Main-role releases when sampling Discogs tags for DJ styles.
 */
export function pickReleasesForStyleSampling(
  items: DiscogsArtistReleaseListItem[],
  sampleSize: number,
): DiscogsArtistReleaseListItem[] {
  const sorted = [...items].sort(
    (left, right) => (right.year ?? 0) - (left.year ?? 0),
  );
  const mainRole = sorted.filter(
    (item) => (item.role ?? '').trim().toLowerCase() === 'main',
  );
  const pool = mainRole.length >= Math.min(sampleSize, 3) ? mainRole : sorted;
  return pool.slice(0, sampleSize);
}

export function normalizeDiscogsTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function isIrrelevantDiscogsTag(tag: string): boolean {
  const normalized = normalizeDiscogsTag(tag);
  if (!normalized) {
    return true;
  }
  if (DISCOGS_IRRELEVANT_TAGS.has(normalized)) {
    return true;
  }
  return (
    normalized.includes('soundtrack') ||
    normalized === 'pop rock' ||
    normalized === 'rock & roll'
  );
}

function bumpTagCount(
  counts: Map<string, { label: string; count: number }>,
  tag: string,
) {
  const trimmed = tag.trim();
  if (!trimmed || isIrrelevantDiscogsTag(trimmed)) {
    return;
  }
  const key = normalizeDiscogsTag(trimmed);
  const existing = counts.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }
  counts.set(key, { label: trimmed, count: 1 });
}

function bumpStyleTagCounts(
  styleCounts: Map<string, { label: string; count: number }>,
  tag: string,
) {
  const normalized = normalizeDiscogsTag(tag);
  if (DISCOGS_HOUSE_SUBGENRES.has(normalized)) {
    bumpTagCount(styleCounts, 'House');
    return;
  }
  bumpTagCount(styleCounts, tag);
}

function rankTags(
  counts: Map<string, { label: string; count: number }>,
  topN?: number,
): string[] {
  const ranked = [...counts.values()].sort(
    (left, right) =>
      right.count - left.count || left.label.localeCompare(right.label),
  );
  const sliced = topN ? ranked.slice(0, topN) : ranked;
  return sliced.map((item) => item.label);
}

export function aggregateDiscogsReleaseStyles(
  releases: DiscogsReleaseTags[],
  options?: { topStyles?: number },
): { genres: string[]; styles: string[] } {
  const genreCounts = new Map<string, { label: string; count: number }>();
  const styleCounts = new Map<string, { label: string; count: number }>();

  for (const release of releases) {
    for (const genre of release.genres ?? []) {
      bumpTagCount(genreCounts, genre);
    }
    for (const style of release.styles ?? []) {
      bumpStyleTagCounts(styleCounts, style);
    }
  }

  const topStyles = options?.topStyles ?? DISCOGS_MAIN_STYLES_TOP_N_DEFAULT;

  return {
    genres: rankTags(genreCounts),
    styles: rankTags(styleCounts, topStyles),
  };
}
