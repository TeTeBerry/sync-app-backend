import { parseTimeToMinutes } from './domain/time-minutes.util';
import {
  EDC_THAILAND_ARTIST_PERFORMANCE_SEED,
  EDC_THAILAND_FESTIVAL_SESSION_SEED,
  ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
} from './edc-thailand-itinerary.seed';

export const ITINERARY_DEMO_ACTIVITY_LEGACY_ID = 4;

export { ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID };

const MAIN_STAGE = 'main' as const;
const MAIN_STAGE_LABEL = '主舞台';

type SeedPerformance = {
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
  popularity: number;
  avatarSeed: string;
  genreColor: string;
};

function perf(input: SeedPerformance) {
  const startMinutes = parseTimeToMinutes(input.startTime);
  let endMinutes = parseTimeToMinutes(input.endTime);
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }
  return {
    activityLegacyId: ITINERARY_DEMO_ACTIVITY_LEGACY_ID,
    ...input,
    startMinutes,
    endMinutes,
  };
}

export const ALL_FESTIVAL_SESSION_SEED = [
  {
    activityLegacyId: ITINERARY_DEMO_ACTIVITY_LEGACY_ID,
    dateKey: 'jun13',
    label: '6月13日',
    bannerDateLabel: '6月13日',
    sortOrder: 0,
  },
  {
    activityLegacyId: ITINERARY_DEMO_ACTIVITY_LEGACY_ID,
    dateKey: 'jun14',
    label: '6月14日',
    bannerDateLabel: '6月14日',
    sortOrder: 1,
  },
];

export const FESTIVAL_SESSION_SEED = ALL_FESTIVAL_SESSION_SEED;

/** 深圳风暴电音节 2026 完整阵容（activity legacyId 4）— 单主舞台，与官宣海报一致。 */
export const STORM_ARTIST_PERFORMANCE_SEED = [
  perf({
    dateKey: 'jun13',
    dateLabel: '6月13日',
    artistId: 'domestic-jun13-slot1',
    artistName: '国内艺人',
    genre: 'Various',
    genreLabel: '国内艺人',
    stage: MAIN_STAGE,
    stageLabel: MAIN_STAGE_LABEL,
    startTime: '14:00',
    endTime: '15:00',
    popularity: 55,
    avatarSeed: 'domestic',
    genreColor: '#94a3b8',
  }),
  perf({
    dateKey: 'jun13',
    dateLabel: '6月13日',
    artistId: 'domestic-jun13-slot2',
    artistName: '国内艺人',
    genre: 'Various',
    genreLabel: '国内艺人',
    stage: MAIN_STAGE,
    stageLabel: MAIN_STAGE_LABEL,
    startTime: '15:00',
    endTime: '16:00',
    popularity: 55,
    avatarSeed: 'domestic',
    genreColor: '#94a3b8',
  }),
  perf({
    dateKey: 'jun13',
    dateLabel: '6月13日',
    artistId: 'blondex',
    artistName: 'BLONDEX',
    genre: 'Techno',
    genreLabel: 'Techno · Acid · Trance',
    stage: MAIN_STAGE,
    stageLabel: MAIN_STAGE_LABEL,
    startTime: '16:00',
    endTime: '17:00',
    popularity: 82,
    avatarSeed: 'blondex',
    genreColor: '#22d3ee',
  }),
  perf({
    dateKey: 'jun13',
    dateLabel: '6月13日',
    artistId: 'ghengar',
    artistName: 'GHENGAR (GHASTLY)',
    genre: 'Dubstep',
    genreLabel: 'Heavy Dubstep · Riddim',
    stage: MAIN_STAGE,
    stageLabel: MAIN_STAGE_LABEL,
    startTime: '17:00',
    endTime: '18:00',
    popularity: 88,
    avatarSeed: 'ghengar',
    genreColor: '#ef4444',
  }),
  perf({
    dateKey: 'jun13',
    dateLabel: '6月13日',
    artistId: 'andy-c',
    artistName: 'ANDY C',
    genre: 'Drum & Bass',
    genreLabel: 'D&B · Jungle',
    stage: MAIN_STAGE,
    stageLabel: MAIN_STAGE_LABEL,
    startTime: '18:00',
    endTime: '19:00',
    popularity: 90,
    avatarSeed: 'andy-c',
    genreColor: '#22c55e',
  }),
  perf({
    dateKey: 'jun13',
    dateLabel: '6月13日',
    artistId: 'excision',
    artistName: 'EXCISION',
    genre: 'Dubstep',
    genreLabel: 'Brostep',
    stage: MAIN_STAGE,
    stageLabel: MAIN_STAGE_LABEL,
    startTime: '19:00',
    endTime: '20:15',
    popularity: 95,
    avatarSeed: 'excision',
    genreColor: '#f97316',
  }),
  perf({
    dateKey: 'jun13',
    dateLabel: '6月13日',
    artistId: 'marshmello',
    artistName: 'MARSHMELLO',
    genre: 'Future Bass',
    genreLabel: 'Trap · Dubstep · Pop · Future Bass',
    stage: MAIN_STAGE,
    stageLabel: MAIN_STAGE_LABEL,
    startTime: '20:30',
    endTime: '22:00',
    popularity: 98,
    avatarSeed: 'marshmello',
    genreColor: '#ff2d55',
  }),
  perf({
    dateKey: 'jun14',
    dateLabel: '6月14日',
    artistId: 'domestic-jun14-slot1',
    artistName: '国内艺人',
    genre: 'Various',
    genreLabel: '国内艺人',
    stage: MAIN_STAGE,
    stageLabel: MAIN_STAGE_LABEL,
    startTime: '14:00',
    endTime: '15:00',
    popularity: 55,
    avatarSeed: 'domestic',
    genreColor: '#94a3b8',
  }),
  perf({
    dateKey: 'jun14',
    dateLabel: '6月14日',
    artistId: 'domestic-jun14-slot2',
    artistName: '国内艺人',
    genre: 'Various',
    genreLabel: '国内艺人',
    stage: MAIN_STAGE,
    stageLabel: MAIN_STAGE_LABEL,
    startTime: '15:00',
    endTime: '16:00',
    popularity: 55,
    avatarSeed: 'domestic',
    genreColor: '#94a3b8',
  }),
  perf({
    dateKey: 'jun14',
    dateLabel: '6月14日',
    artistId: 'vidojean',
    artistName: 'VIDOJEAN (VJ X OL)',
    genre: 'House',
    genreLabel: 'Afro House · Deep House · Funky House',
    stage: MAIN_STAGE,
    stageLabel: MAIN_STAGE_LABEL,
    startTime: '16:00',
    endTime: '17:00',
    popularity: 84,
    avatarSeed: 'vidojean',
    genreColor: '#eab308',
  }),
  perf({
    dateKey: 'jun14',
    dateLabel: '6月14日',
    artistId: 'julian-jordan',
    artistName: 'JULIAN JORDAN',
    genre: 'House',
    genreLabel: 'Electro House · Bass House · Future House',
    stage: MAIN_STAGE,
    stageLabel: MAIN_STAGE_LABEL,
    startTime: '17:00',
    endTime: '18:00',
    popularity: 87,
    avatarSeed: 'julian-jordan',
    genreColor: '#a855f7',
  }),
  perf({
    dateKey: 'jun14',
    dateLabel: '6月14日',
    artistId: 'odd-mob',
    artistName: 'ODD MOB',
    genre: 'House',
    genreLabel: 'Tech House · Bass House',
    stage: MAIN_STAGE,
    stageLabel: MAIN_STAGE_LABEL,
    startTime: '18:00',
    endTime: '19:00',
    popularity: 89,
    avatarSeed: 'odd-mob',
    genreColor: '#3b82f6',
  }),
  perf({
    dateKey: 'jun14',
    dateLabel: '6月14日',
    artistId: 'eric-prydz',
    artistName: 'ERIC PRYDZ',
    genre: 'House',
    genreLabel: 'Progressive House · Electro',
    stage: MAIN_STAGE,
    stageLabel: MAIN_STAGE_LABEL,
    startTime: '19:00',
    endTime: '20:20',
    popularity: 94,
    avatarSeed: 'eric-prydz',
    genreColor: '#60a5fa',
  }),
  perf({
    dateKey: 'jun14',
    dateLabel: '6月14日',
    artistId: 'illenium',
    artistName: 'ILLENIUM',
    genre: 'Dubstep',
    genreLabel: 'Melodic Dubstep · Future Bass',
    stage: MAIN_STAGE,
    stageLabel: MAIN_STAGE_LABEL,
    startTime: '20:20',
    endTime: '22:00',
    popularity: 96,
    avatarSeed: 'illenium',
    genreColor: '#7b61ff',
  }),
];

export const ARTIST_PERFORMANCE_SEED = STORM_ARTIST_PERFORMANCE_SEED;

export const ALL_ARTIST_PERFORMANCE_SEED = [
  ...STORM_ARTIST_PERFORMANCE_SEED,
  ...EDC_THAILAND_ARTIST_PERFORMANCE_SEED,
];

export const ALL_FESTIVAL_SESSION_SEED_COMBINED = [
  ...ALL_FESTIVAL_SESSION_SEED,
  ...EDC_THAILAND_FESTIVAL_SESSION_SEED,
];
