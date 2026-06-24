export type ActivityRegion = 'domestic' | 'overseas' | 'hmt';

export type ActivityCatalogType = 'festival' | 'indoor';

/** Public activity record returned by GET /api/activities and detail endpoints. */
export interface BackendActivity {
  _id: string;
  legacyId: number;
  name: string;
  code: string;
  alias?: string[];
  date?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  region?: ActivityRegion;
  /** Display area for catalog badges (e.g. 泰国, 日本). */
  area?: string;
  image?: string;
  /** Catalog type: outdoor festival (`festival`) or indoor EDM (`indoor`). */
  activityType?: ActivityCatalogType;
  hot?: boolean;
  attendees?: number;
  damaiProjectId?: string;
  externalUrl?: string;
  infoSource?: string;
  infoUpdatedAt?: string;
  lineupPublished?: boolean;
  recruitPostCount?: number;
  /** false = overseas field without Hot Path; hide generate CTA */
  travelGuideSupported?: boolean;
}

export interface CatalogLineupArtistNextActivity {
  legacyId: number;
  name: string;
  date: string;
  area?: string;
}

export interface CatalogLineupArtist {
  id: string;
  name: string;
  /** Primary festival filter bucket (e.g. House, Techno). */
  genre: string;
  /** Human-readable sub-styles for display (e.g. Big Room · Dutch House). */
  genreLabel: string;
  activityCount: number;
  thumbnail?: string;
  nextActivity?: CatalogLineupArtistNextActivity;
  /** Common Chinese fan nicknames (e.g. 小马丁). */
  chineseAliases?: string[];
}

export interface CatalogLineupArtistDetail extends CatalogLineupArtist {
  profileSummary?: string;
  profileFull?: string;
  representativeTracks?: string[];
}

/** A single DJ pick in a set-vote ballot. */
export interface SetVotePick {
  artistId: string;
  artistName: string;
  genre?: string;
}

/** Aggregated leaderboard row for set-vote. */
export interface SetVoteLeaderboardEntry {
  artistId: string;
  artistName: string;
  voteCount: number;
  votePercent: number;
}
