import type { ArtistPerformance } from '../../../database/schemas/artist-performance.schema';
import type { FestivalSession } from '../../../database/schemas/festival-session.schema';
import {
  ALL_ARTIST_PERFORMANCE_SEED,
  ALL_FESTIVAL_SESSION_SEED_COMBINED,
  STORM_ACTIVITY_LEGACY_ID,
  ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_ORLANDO_ACTIVITY_LEGACY_ID,
  ITINERARY_TOMORROWLAND_THAILAND_ACTIVITY_LEGACY_ID,
  ITINERARY_ULTRA_EUROPE_ACTIVITY_LEGACY_ID,
  ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID,
} from '@src/data/itinerary/itinerary.seed';
import { DEFQON1_LINEUP_DJ_SEED } from '@src/data/itinerary/defqon1-itinerary.seed';
import { EDC_THAILAND_LINEUP_DJ_SEED } from '@src/data/itinerary/edc-thailand-itinerary.seed';
import { EDC_KOREA_LINEUP_DJ_SEED } from '@src/data/itinerary/edc-korea-itinerary.seed';
import { EDC_ORLANDO_LINEUP_DJ_SEED } from '@src/data/itinerary/edc-orlando-itinerary.seed';
import { TOMORROWLAND_THAILAND_LINEUP_DJ_SEED } from '@src/data/itinerary/tomorrowland-thailand-itinerary.seed';
import { ULTRA_EUROPE_LINEUP_DJ_SEED } from '@src/data/itinerary/ultra-europe-itinerary.seed';
import { WORLD_DJ_FESTIVAL_LINEUP_DJ_SEED } from '@src/data/itinerary/world-dj-festival-japan-itinerary.seed';

export const ITINERARY_CATALOG_ACTIVITY_LEGACY_IDS = new Set([
  STORM_ACTIVITY_LEGACY_ID,
  ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_ORLANDO_ACTIVITY_LEGACY_ID,
  ITINERARY_TOMORROWLAND_THAILAND_ACTIVITY_LEGACY_ID,
  ITINERARY_ULTRA_EUROPE_ACTIVITY_LEGACY_ID,
  ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID,
]);

export type LineupDjSeed = {
  id: string;
  name: string;
  genre: string;
  genreLabel: string;
  stage: string;
  popularity: number;
  avatarSeed: string;
  genreColor: string;
};

const LINEUP_DJS_BY_ACTIVITY_LEGACY_ID = new Map<number, LineupDjSeed[]>([
  [ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID, DEFQON1_LINEUP_DJ_SEED],
  [ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID, EDC_THAILAND_LINEUP_DJ_SEED],
  [ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID, EDC_KOREA_LINEUP_DJ_SEED],
  [ITINERARY_EDC_ORLANDO_ACTIVITY_LEGACY_ID, EDC_ORLANDO_LINEUP_DJ_SEED],
  [
    ITINERARY_TOMORROWLAND_THAILAND_ACTIVITY_LEGACY_ID,
    TOMORROWLAND_THAILAND_LINEUP_DJ_SEED,
  ],
  [ITINERARY_ULTRA_EUROPE_ACTIVITY_LEGACY_ID, ULTRA_EUROPE_LINEUP_DJ_SEED],
  [
    ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID,
    WORLD_DJ_FESTIVAL_LINEUP_DJ_SEED,
  ],
]);

export function hasItineraryCatalogSeed(activityLegacyId: number): boolean {
  return ITINERARY_CATALOG_ACTIVITY_LEGACY_IDS.has(activityLegacyId);
}

export function resolveLineupDjs(activityLegacyId: number): LineupDjSeed[] {
  return [...(LINEUP_DJS_BY_ACTIVITY_LEGACY_ID.get(activityLegacyId) ?? [])];
}

/** Seed catalog snapshot for tests/scripts — runtime schedule reads MongoDB only. */
export function resolveItineraryCatalogSeed(
  activityLegacyId: number,
  dateKey?: string,
): { sessions: FestivalSession[]; performances: ArtistPerformance[] } {
  const sessions = ALL_FESTIVAL_SESSION_SEED_COMBINED.filter(
    (session) => session.activityLegacyId === activityLegacyId,
  ) as FestivalSession[];

  let performances = ALL_ARTIST_PERFORMANCE_SEED.filter(
    (perf) => perf.activityLegacyId === activityLegacyId,
  ) as ArtistPerformance[];

  if (dateKey) {
    performances = performances.filter((perf) => perf.dateKey === dateKey);
    return {
      sessions: sessions.filter((session) => session.dateKey === dateKey),
      performances,
    };
  }

  return { sessions, performances };
}
