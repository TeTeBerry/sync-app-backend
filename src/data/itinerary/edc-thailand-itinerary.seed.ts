import { LINEUP_SEED_GENRE_PLACEHOLDER } from './lineup-seed-genre.constants';

export const ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID = 5;

const MAIN_STAGE = 'main' as const;

type EdcArtistSeed = {
  name: string;
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

/**
 * EDC Thailand 2026 官宣阵容（Rhythm Park · 12/18–20）。
 * 官方演出时间表未发布前仅提供阵容预选，不写入占位排期。
 */
const EDC_THAILAND_ARTISTS: EdcArtistSeed[] = [
  {
    name: '&FRIENDS',
    popularity: 82,
    genreColor: '#f472b6',
  },
  {
    name: 'ABOVE & BEYOND',
    popularity: 97,
    genreColor: '#38bdf8',
  },
  {
    name: 'ALEX WANN',
    popularity: 86,
    genreColor: '#a78bfa',
  },
  {
    name: 'ALLEYCVT',
    popularity: 84,
    genreColor: '#fb7185',
  },
  {
    name: 'ALPHA 9',
    popularity: 85,
    genreColor: '#22d3ee',
  },
  {
    name: 'ANDEREX',
    popularity: 83,
    genreColor: '#818cf8',
  },
  {
    name: 'ANDREW RAYEL',
    popularity: 88,
    genreColor: '#60a5fa',
  },
  {
    name: 'ANDY C',
    popularity: 90,
    genreColor: '#22c55e',
  },
  {
    name: 'ATLIENS',
    popularity: 87,
    genreColor: '#f97316',
  },
  {
    name: 'BARBARA LAGO',
    popularity: 81,
    genreColor: '#c084fc',
  },
  {
    name: 'BASSTRIPPER',
    popularity: 83,
    genreColor: '#facc15',
  },
  {
    name: 'BELLA CLAXTON B2B KYLE STARKEY',
    popularity: 80,
    genreColor: '#e879f9',
  },
  {
    name: 'CAMELPHAT',
    popularity: 91,
    genreColor: '#34d399',
  },
  {
    name: 'CARTA',
    popularity: 84,
    genreColor: '#2dd4bf',
  },
  {
    name: 'CHARLOTTE DE WITTE',
    popularity: 96,
    genreColor: '#f43f5e',
  },
  {
    name: 'CHASEWEST',
    popularity: 82,
    genreColor: '#4ade80',
  },
  {
    name: 'CLARA CUVÉ',
    popularity: 89,
    genreColor: '#a855f7',
  },
  {
    name: 'COONE',
    popularity: 86,
    genreColor: '#ef4444',
  },
  {
    name: 'DA TWEEKAZ',
    popularity: 88,
    genreColor: '#dc2626',
  },
  {
    name: 'DARREN STYLES',
    popularity: 85,
    genreColor: '#f87171',
  },
  {
    name: 'DAXSON',
    popularity: 84,
    genreColor: '#fb923c',
  },
  {
    name: 'DEAN TURNLEY',
    popularity: 79,
    genreColor: '#fcd34d',
  },
  {
    name: 'DENNETT',
    popularity: 80,
    genreColor: '#86efac',
  },
  {
    name: 'DJ SNAKE',
    popularity: 98,
    genreColor: '#fbbf24',
  },
  {
    name: 'DOM DOLLA',
    popularity: 95,
    genreColor: '#10b981',
  },
  {
    name: 'FIFI',
    popularity: 78,
    genreColor: '#fda4af',
  },
  {
    name: 'FUNK TRIBU',
    popularity: 83,
    genreColor: '#d946ef',
  },
  {
    name: 'GIUSEPPE OTTAVIANI',
    popularity: 87,
    genreColor: '#0ea5e9',
  },
  {
    name: 'GREEN VELVET B2B STEVE ANGELLO',
    popularity: 94,
    genreColor: '#84cc16',
  },
  {
    name: 'GUDFELLA',
    popularity: 79,
    genreColor: '#bef264',
  },
  {
    name: 'HAMDI',
    popularity: 85,
    genreColor: '#fb7185',
  },
  {
    name: 'HANNAH LAING',
    popularity: 86,
    genreColor: '#c026d3',
  },
  {
    name: 'HORSEGIIRL',
    popularity: 84,
    genreColor: '#e11d48',
  },
  {
    name: 'I HATE MODELS',
    popularity: 93,
    genreColor: '#7c3aed',
  },
  {
    name: 'JACKIE HOLLANDER',
    popularity: 82,
    genreColor: '#14b8a6',
  },
  {
    name: 'JAMES HYPE',
    popularity: 92,
    genreColor: '#06b6d4',
  },
  {
    name: 'JAMIE JONES',
    popularity: 94,
    genreColor: '#65a30d',
  },
  {
    name: 'KANINE B2B SOTA',
    popularity: 86,
    genreColor: '#16a34a',
  },
  {
    name: 'KASKADE',
    popularity: 96,
    genreColor: '#3b82f6',
  },
  {
    name: 'KOROLOVA',
    popularity: 85,
    genreColor: '#6366f1',
  },
  {
    name: 'KREAM',
    popularity: 88,
    genreColor: '#0d9488',
  },
  {
    name: 'LEVELTRONICS (SUBTRONICS B2B LEVEL UP)',
    popularity: 90,
    genreColor: '#ea580c',
  },
  {
    name: 'LIL TEXAS',
    popularity: 87,
    genreColor: '#b91c1c',
  },
  {
    name: 'LOCO DICE',
    popularity: 89,
    genreColor: '#ca8a04',
  },
  {
    name: 'MARLO',
    popularity: 88,
    genreColor: '#059669',
  },
  {
    name: 'MARTIN GARRIX',
    popularity: 99,
    genreColor: '#ff2d55',
  },
  {
    name: 'MAU P',
    popularity: 91,
    genreColor: '#22c55e',
  },
  {
    name: 'MAX STYLER',
    popularity: 85,
    genreColor: '#2563eb',
  },
  {
    name: 'MISS MONIQUE',
    popularity: 90,
    genreColor: '#9333ea',
  },
  {
    name: 'NOISE MAFIA B2B AFEM SYKO',
    popularity: 83,
    genreColor: '#dc2626',
  },
  {
    name: 'ODD MOB',
    popularity: 89,
    genreColor: '#3b82f6',
  },
  {
    name: 'OMAR+',
    popularity: 84,
    genreColor: '#8b5cf6',
  },
  {
    name: 'OMNOM',
    popularity: 86,
    genreColor: '#f59e0b',
  },
  {
    name: 'OMRI',
    popularity: 82,
    genreColor: '#7dd3fc',
  },
  {
    name: 'OSMOSIS JONES',
    popularity: 83,
    genreColor: '#f43f5e',
  },
  {
    name: 'PAUL VAN DYK',
    popularity: 92,
    genreColor: '#0284c7',
  },
  {
    name: 'PETERBLUE',
    popularity: 78,
    genreColor: '#a3e635',
  },
  {
    name: 'QUEST',
    popularity: 84,
    genreColor: '#15803d',
  },
  {
    name: 'RESTRICTED',
    popularity: 87,
    genreColor: '#d97706',
  },
  {
    name: 'RØZ',
    popularity: 81,
    genreColor: '#f472b6',
  },
  {
    name: 'SABAI',
    popularity: 85,
    genreColor: '#38bdf8',
  },
  {
    name: 'SHOWTEK HARDSTYLE SET',
    popularity: 88,
    genreColor: '#ef4444',
  },
  {
    name: 'SICKMODE',
    popularity: 86,
    genreColor: '#c2410c',
  },
  {
    name: 'SIHK',
    popularity: 82,
    genreColor: '#e879f9',
  },
  {
    name: 'SOFI TUKKER',
    popularity: 93,
    genreColor: '#ec4899',
  },
  {
    name: 'SPACE 92 x POPOF PRESENT: TURBULENCES',
    popularity: 84,
    genreColor: '#6366f1',
  },
  {
    name: 'SUBTRONICS (SUNSET SET)',
    popularity: 95,
    genreColor: '#7c3aed',
  },
  {
    name: 'SUPERGLOSS',
    popularity: 80,
    genreColor: '#2dd4bf',
  },
  {
    name: 'TAIKI NULIGHT',
    popularity: 83,
    genreColor: '#facc15',
  },
  {
    name: 'TIËSTO',
    popularity: 99,
    genreColor: '#60a5fa',
  },
  {
    name: 'VINTAGE CULTURE',
    popularity: 94,
    genreColor: '#a855f7',
  },
  {
    name: 'VTSS',
    popularity: 87,
    genreColor: '#be123c',
  },
  {
    name: 'WHOMADEWHO (HYBRID DJ SET)',
    popularity: 88,
    genreColor: '#4f46e5',
  },
  {
    name: 'WORSHIP',
    popularity: 82,
    genreColor: '#b45309',
  },
  {
    name: 'WUJACKERS',
    popularity: 81,
    genreColor: '#0f766e',
  },
  {
    name: 'YANAMASTE',
    popularity: 80,
    genreColor: '#7c2d12',
  },
];

const EDC_DATE_META = [
  {
    dateKey: 'dec18',
    label: '12月18日',
    bannerDateLabel: '12月18日',
    sortOrder: 0,
  },
  {
    dateKey: 'dec19',
    label: '12月19日',
    bannerDateLabel: '12月19日',
    sortOrder: 1,
  },
  {
    dateKey: 'dec20',
    label: '12月20日',
    bannerDateLabel: '12月20日',
    sortOrder: 2,
  },
] as const;

export const EDC_THAILAND_FESTIVAL_SESSION_SEED = EDC_DATE_META.map((day) => ({
  activityLegacyId: ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
  ...day,
}));

export const EDC_THAILAND_LINEUP_DJ_SEED = EDC_THAILAND_ARTISTS.map(
  (artist) => {
    const id = artistId(artist.name);
    return {
      id,
      name: artist.name,
      genre: LINEUP_SEED_GENRE_PLACEHOLDER,
      genreLabel: LINEUP_SEED_GENRE_PLACEHOLDER,
      stage: MAIN_STAGE,
      popularity: artist.popularity,
      avatarSeed: id,
      genreColor: artist.genreColor,
    };
  },
);

/** Lineup-only: official timetable not published yet. */
export const EDC_THAILAND_ARTIST_PERFORMANCE_SEED = [] as const;

export const EDC_THAILAND_ARTIST_NAMES = EDC_THAILAND_ARTISTS.map(
  (a) => a.name,
);
