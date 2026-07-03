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

/** One DJ in a B2B / combo lineup billing name. */
export interface CatalogLineupArtistMemberDetail {
  name: string;
  genre?: string;
  genreLabel?: string;
  thumbnail?: string;
  chineseAliases?: string[];
  country?: string;
  profileUrls?: string[];
  profileSummary?: string;
  profileFull?: string;
  representativeTracks?: string[];
}

export interface CatalogLineupArtistDetail extends CatalogLineupArtist {
  country?: string;
  profileUrls?: string[];
  profileSummary?: string;
  profileFull?: string;
  representativeTracks?: string[];
  /** Populated when the lineup billing name expands to multiple DJs (e.g. B2B). */
  members?: CatalogLineupArtistMemberDetail[];
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

/** Response for GET /artists/favorites — list of user-liked artist IDs. */
export interface UserArtistFavoritesResponse {
  artistIds: string[];
}

/** Response for POST/DELETE /artists/:id/favorite. */
export interface ArtistFavoriteToggleResponse {
  artistId: string;
}
