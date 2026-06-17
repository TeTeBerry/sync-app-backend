export const ITINERARY_TOMORROWLAND_THAILAND_ACTIVITY_LEGACY_ID = 1;

const MAIN_STAGE = 'main' as const;

type TmlArtistSeed = {
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

function dj(
  name: string,
  genre: string,
  genreLabel: string,
  popularity: number,
  genreColor: string,
): TmlArtistSeed {
  return { name, genre, genreLabel, popularity, genreColor };
}

/**
 * Tomorrowland Thailand 2026 首批官宣阵容（Wisdom Valley · 12/11–13）。
 * 官方演出时间表未发布前仅提供阵容预选，不写入占位排期。
 */
const TOMORROWLAND_THAILAND_ARTISTS: TmlArtistSeed[] = [
  dj(
    'SWEDISH HOUSE MAFIA',
    'House',
    'Progressive House · Big Room',
    98,
    '#facc15',
  ),
  dj('MARTIN GARRIX', 'House', 'Big Room · Progressive House', 99, '#ff2d55'),
  dj(
    'DIMITRI VEGAS & LIKE MIKE',
    'House',
    'Big Room · Electro House',
    97,
    '#3b82f6',
  ),
  dj('AFROJACK', 'House', 'Big Room · Dutch House', 94, '#f97316'),
  dj('NERVO', 'House', 'Progressive House · Electro House', 88, '#ec4899'),
  dj('LOST FREQUENCIES', 'House', 'Deep House · Tropical House', 90, '#22d3ee'),
];

const TML_DATE_META = [
  {
    dateKey: 'dec11',
    label: '12月11日',
    bannerDateLabel: '12月11日',
    sortOrder: 0,
  },
  {
    dateKey: 'dec12',
    label: '12月12日',
    bannerDateLabel: '12月12日',
    sortOrder: 1,
  },
  {
    dateKey: 'dec13',
    label: '12月13日',
    bannerDateLabel: '12月13日',
    sortOrder: 2,
  },
] as const;

export const TOMORROWLAND_THAILAND_FESTIVAL_SESSION_SEED = TML_DATE_META.map(
  (day) => ({
    activityLegacyId: ITINERARY_TOMORROWLAND_THAILAND_ACTIVITY_LEGACY_ID,
    ...day,
  }),
);

export const TOMORROWLAND_THAILAND_LINEUP_DJ_SEED =
  TOMORROWLAND_THAILAND_ARTISTS.map((artist) => {
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
export const TOMORROWLAND_THAILAND_ARTIST_PERFORMANCE_SEED = [] as const;

export const TOMORROWLAND_THAILAND_ARTIST_NAMES =
  TOMORROWLAND_THAILAND_ARTISTS.map((artist) => artist.name);
