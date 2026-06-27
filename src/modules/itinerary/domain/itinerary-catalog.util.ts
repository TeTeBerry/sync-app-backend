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

/** Festivals with lineup announced but no official timetable in seed yet. */
export const LINEUP_ONLY_CATALOG_ACTIVITY_LEGACY_IDS = [
  ITINERARY_TOMORROWLAND_THAILAND_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_ORLANDO_ACTIVITY_LEGACY_ID,
] as const;

const LINEUP_ONLY_STAGE_LABELS: Record<string, string> = {
  main: '主舞台',
};

/** Minutes sentinel when official timetable is not published yet. */
export const LINEUP_ONLY_UNPUBLISHED_MINUTES = -1;

/** True when a performance row carries an official set time (not lineup-only placeholder). */
export function isPublishedSchedulePerformance(perf: {
  startMinutes: number;
  startTime?: string;
}): boolean {
  if (perf.startMinutes === LINEUP_ONLY_UNPUBLISHED_MINUTES) {
    return false;
  }
  return perf.startMinutes >= 0 && Boolean(perf.startTime?.trim());
}

export type LineupOnlyPerformanceSeed = {
  activityLegacyId: number;
  dateKey: string;
  dateLabel: string;
  artistId: string;
  artistName: string;
  genre: string;
  genreLabel: string;
  stage: string;
  stageLabel: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  popularity: number;
  avatarSeed: string;
  genreColor: string;
};

/** Materialize lineup-only festivals into artist_performances for Mongo crawl. */
export function buildLineupOnlyArtistPerformanceSeed(
  activityLegacyId: number,
): LineupOnlyPerformanceSeed[] {
  const djs = resolveLineupDjs(activityLegacyId);
  if (!djs.length) {
    return [];
  }

  const sessions = ALL_FESTIVAL_SESSION_SEED_COMBINED.filter(
    (session) => session.activityLegacyId === activityLegacyId,
  ).sort((a, b) => a.sortOrder - b.sortOrder);
  const firstSession = sessions[0];
  if (!firstSession) {
    return [];
  }

  return djs.map((dj) => ({
    activityLegacyId,
    dateKey: firstSession.dateKey,
    dateLabel: firstSession.label,
    artistId: dj.id,
    artistName: dj.name,
    genre: dj.genre,
    genreLabel: dj.genreLabel,
    stage: dj.stage,
    stageLabel: LINEUP_ONLY_STAGE_LABELS[dj.stage] ?? dj.stage,
    startTime: '',
    endTime: '',
    startMinutes: LINEUP_ONLY_UNPUBLISHED_MINUTES,
    endMinutes: LINEUP_ONLY_UNPUBLISHED_MINUTES,
    popularity: dj.popularity,
    avatarSeed: dj.avatarSeed,
    genreColor: dj.genreColor,
  }));
}

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
