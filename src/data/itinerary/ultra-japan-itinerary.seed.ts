import { LINEUP_SEED_GENRE_PLACEHOLDER } from './lineup-seed-genre.constants';

export const ITINERARY_ULTRA_JAPAN_ACTIVITY_LEGACY_ID = 11;

const MAIN_STAGE = 'main' as const;

type UltraJapanArtistSeed = {
  name: string;
  genre: string;
  genreLabel: string;
  popularity: number;
  genreColor: string;
};

function artistId(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function artist(
  name: string,
  popularity: number,
  genreColor: string,
): UltraJapanArtistSeed {
  return {
    name,
    genre: LINEUP_SEED_GENRE_PLACEHOLDER,
    genreLabel: LINEUP_SEED_GENRE_PLACEHOLDER,
    popularity,
    genreColor,
  };
}

/**
 * Ultra Japan 2026 Phase 1 + Phase 2 lineup (Odaiba Ultra Park · 09/19–20).
 * Official timetable not published yet — lineup-only until Phase 3 / schedule drop.
 * Genres resolve from MongoDB (`djs` + `dj_discogs_map`), not seed literals.
 */
const ULTRA_JAPAN_ARTISTS: UltraJapanArtistSeed[] = [
  artist('AFROJACK B2B R3HAB', 97, '#f472b6'),
  artist('ALAN WALKER', 95, '#38bdf8'),
  artist('ALESSO', 96, '#60a5fa'),
  artist('THE MARTINEZ BROTHERS', 94, '#22c55e'),
  artist('PEGGY GOU', 96, '#ec4899'),
  artist('SARA LANDRY', 92, '#dc2626'),
  artist('TIMMY TRUMPET', 93, '#f97316'),
  artist('WORSHIP', 91, '#7c3aed'),
  artist('¥ØU$UK€ ¥UK1MAT$U', 88, '#a855f7'),
  artist('ZEDD B2B KNOCK2', 98, '#ff2d55'),
  artist('HALO', 90, '#6366f1'),
  artist('JORIS VOORN', 91, '#ef4444'),
  artist('LILLY PALMER', 89, '#991b1b'),
  artist('MADDIX', 89, '#ef4444'),
  artist('TRYM', 87, '#b91c1c'),
];

const ULTRA_JAPAN_DATE_META = [
  {
    dateKey: 'sep19',
    label: '9月19日',
    bannerDateLabel: '9月19日',
    sortOrder: 0,
  },
  {
    dateKey: 'sep20',
    label: '9月20日',
    bannerDateLabel: '9月20日',
    sortOrder: 1,
  },
] as const;

export const ULTRA_JAPAN_FESTIVAL_SESSION_SEED = ULTRA_JAPAN_DATE_META.map(
  (day) => ({
    activityLegacyId: ITINERARY_ULTRA_JAPAN_ACTIVITY_LEGACY_ID,
    ...day,
  }),
);

export const ULTRA_JAPAN_LINEUP_DJ_SEED = ULTRA_JAPAN_ARTISTS.map((artist) => {
  const id = artistId(artist.name);
  return {
    id,
    name: artist.name,
    genre: artist.genre,
    genreLabel: artist.genreLabel,
    stage: MAIN_STAGE,
    popularity: artist.popularity,
    avatarSeed: id,
    genreColor: artist.genreColor,
  };
});

/** Lineup-only: official timetable not published yet. */
export const ULTRA_JAPAN_ARTIST_PERFORMANCE_SEED = [] as const;

export const ULTRA_JAPAN_ARTIST_NAMES = ULTRA_JAPAN_ARTISTS.map((a) => a.name);
