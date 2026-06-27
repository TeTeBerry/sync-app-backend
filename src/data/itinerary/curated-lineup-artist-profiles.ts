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
> = {
  'AN!KA': {
    profileSummary:
      'AN!KA 是曼谷 DJ / 制作人，风格偏 house、disco、minimal 与 techno，在 Pissawong Records 发行作品（如 Turn Me On），并登上 Tomorrowland Thailand。',
    profileFull:
      'AN!KA 是曼谷 DJ / 制作人，风格偏 house、disco、minimal 与 techno，在 Pissawong Records 发行作品（如 Turn Me On），并登上 Tomorrowland Thailand。' +
      ' 她不应与英国 dub 艺人 Anika（Annika Henderson，Discogs #1982320）混淆。',
    representativeTracks: ['Turn Me On', 'Will You Be Mine?'],
  },
};

export function resolveCuratedLineupArtistProfile(
  artistName: string,
): CuratedLineupArtistProfile | undefined {
  const key = artistName.trim().toUpperCase();
  if (!key) {
    return undefined;
  }
  return CURATED_LINEUP_ARTIST_PROFILES[key];
}
