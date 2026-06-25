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
]);

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
      bumpTagCount(styleCounts, style);
    }
  }

  const topStyles = options?.topStyles ?? DISCOGS_MAIN_STYLES_TOP_N_DEFAULT;

  return {
    genres: rankTags(genreCounts),
    styles: rankTags(styleCounts, topStyles),
  };
}
