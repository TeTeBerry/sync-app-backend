/**
 * Optional rich bios for artists where Discogs is skipped or unreliable.
 * Genre / genreLabel are not stored in lineup seeds (placeholder at export).
 */
export type CuratedLineupArtistProfile = {
  profileSummary: string;
  profileFull?: string;
  /** Recent releases — keep in sync with editorial intent for 近期发行. */
  representativeTracks: string[];
};

export const CURATED_LINEUP_ARTIST_PROFILES: Record<
  string,
  CuratedLineupArtistProfile
> = {};

export function resolveCuratedLineupArtistProfile(
  artistName: string,
): CuratedLineupArtistProfile | undefined {
  const key = artistName.trim().toUpperCase();
  if (!key) {
    return undefined;
  }
  return CURATED_LINEUP_ARTIST_PROFILES[key];
}
