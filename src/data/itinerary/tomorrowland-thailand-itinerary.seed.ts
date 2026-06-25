import { LINEUP_SEED_GENRE_PLACEHOLDER } from './lineup-seed-genre.constants';

export const ITINERARY_TOMORROWLAND_THAILAND_ACTIVITY_LEGACY_ID = 1;

const MAIN_STAGE = 'main' as const;

type TmlArtistSeed = {
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
 * Tomorrowland Thailand 2026 全阵容官宣（Wisdom Valley · 12/11–13）。
 * 官方演出时间表未发布前仅提供阵容预选，不写入占位排期。
 */
const TOMORROWLAND_THAILAND_ARTISTS: TmlArtistSeed[] = [
  {
    name: '22 BULLETS',
    popularity: 82,
    genreColor: '#f97316',
  },
  {
    name: 'AFROJACK',
    popularity: 94,
    genreColor: '#f97316',
  },
  {
    name: 'AGENTS OF TIME',
    popularity: 86,
    genreColor: '#a855f7',
  },
  {
    name: 'ALAN WALKER',
    popularity: 93,
    genreColor: '#38bdf8',
  },
  {
    name: 'ALOK',
    popularity: 92,
    genreColor: '#22c55e',
  },
  {
    name: 'ALY & FILA',
    popularity: 88,
    genreColor: '#60a5fa',
  },
  {
    name: 'AMBER BROOS B2B SPACE 92',
    popularity: 84,
    genreColor: '#c084fc',
  },
  {
    name: 'AMÉMÉ B2B HONEYLUV',
    popularity: 83,
    genreColor: '#f472b6',
  },
  {
    name: 'AMY WILES',
    popularity: 80,
    genreColor: '#34d399',
  },
  {
    name: 'AN!KA',
    popularity: 79,
    genreColor: '#e879f9',
  },
  {
    name: 'ANDROMEDIK',
    popularity: 84,
    genreColor: '#818cf8',
  },
  {
    name: 'ANGEMI',
    popularity: 85,
    genreColor: '#3b82f6',
  },
  {
    name: 'APASHE',
    popularity: 87,
    genreColor: '#fb7185',
  },
  {
    name: 'ARTBAT',
    popularity: 90,
    genreColor: '#7c3aed',
  },
  {
    name: 'ARTBAT B2B R3HAB',
    popularity: 91,
    genreColor: '#6366f1',
  },
  {
    name: 'BASSJACKERS',
    popularity: 89,
    genreColor: '#facc15',
  },
  {
    name: 'BIBI SECK',
    popularity: 80,
    genreColor: '#d97706',
  },
  {
    name: 'BLASTOYZ B2B WHITENO1SE',
    popularity: 85,
    genreColor: '#a3e635',
  },
  {
    name: 'BLAZY',
    popularity: 81,
    genreColor: '#4ade80',
  },
  {
    name: 'BOTCASH',
    popularity: 80,
    genreColor: '#2dd4bf',
  },
  {
    name: 'BRENNAN HEART',
    popularity: 89,
    genreColor: '#ea580c',
  },
  {
    name: 'CAMILA JUN',
    popularity: 79,
    genreColor: '#f9a8d4',
  },
  {
    name: 'CAPOON',
    popularity: 83,
    genreColor: '#9333ea',
  },
  {
    name: 'CLAUDINE',
    popularity: 80,
    genreColor: '#86efac',
  },
  {
    name: 'COSMIC GATE',
    popularity: 90,
    genreColor: '#38bdf8',
  },
  {
    name: 'DA TWEEKAZ',
    popularity: 88,
    genreColor: '#f97316',
  },
  {
    name: 'DADOO',
    popularity: 79,
    genreColor: '#6ee7b7',
  },
  {
    name: 'DENNIS GOLD',
    popularity: 82,
    genreColor: '#fbbf24',
  },
  {
    name: 'DIMITRI VEGAS & LIKE MIKE',
    popularity: 97,
    genreColor: '#3b82f6',
  },
  {
    name: 'DINO LENNY',
    popularity: 84,
    genreColor: '#a78bfa',
  },
  {
    name: 'DJ SALLY',
    popularity: 79,
    genreColor: '#f472b6',
  },
  {
    name: 'DJ TENNIS',
    popularity: 86,
    genreColor: '#14b8a6',
  },
  {
    name: 'DUBVISION',
    popularity: 86,
    genreColor: '#60a5fa',
  },
  {
    name: 'DVBBS',
    popularity: 88,
    genreColor: '#22d3ee',
  },
  {
    name: 'ELFIGO',
    popularity: 80,
    genreColor: '#34d399',
  },
  {
    name: 'ELI & FUR B2B YOTTO',
    popularity: 87,
    genreColor: '#818cf8',
  },
  {
    name: 'FERRY CORSTEN',
    popularity: 88,
    genreColor: '#0ea5e9',
  },
  {
    name: 'FIRAGA',
    popularity: 79,
    genreColor: '#4ade80',
  },
  {
    name: 'FLOSSTRADAMUS B2B YELLOW CLAW',
    popularity: 88,
    genreColor: '#f43f5e',
  },
  {
    name: 'FUNK TRIBU',
    popularity: 86,
    genreColor: '#ef4444',
  },
  {
    name: 'GHOST RIDER',
    popularity: 84,
    genreColor: '#84cc16',
  },
  {
    name: 'GOLDFISH',
    popularity: 83,
    genreColor: '#f59e0b',
  },
  {
    name: 'HALŌ',
    popularity: 81,
    genreColor: '#c4b5fd',
  },
  {
    name: 'HALO',
    popularity: 80,
    genreColor: '#a5b4fc',
  },
  {
    name: 'HANNAH LAING',
    popularity: 87,
    genreColor: '#f43f5e',
  },
  {
    name: 'HENRI BERGMANN',
    popularity: 83,
    genreColor: '#8b5cf6',
  },
  {
    name: 'HENRI PFR',
    popularity: 82,
    genreColor: '#2dd4bf',
  },
  {
    name: 'HONEY GEE',
    popularity: 79,
    genreColor: '#fcd34d',
  },
  {
    name: 'INFECTED MUSHROOM',
    popularity: 93,
    genreColor: '#a3e635',
  },
  {
    name: 'JAN V',
    popularity: 84,
    genreColor: '#7c3aed',
  },
  {
    name: 'JELLE DK',
    popularity: 82,
    genreColor: '#fb923c',
  },
  {
    name: 'JERROOO',
    popularity: 85,
    genreColor: '#60a5fa',
  },
  {
    name: 'JOHN NEWMAN',
    popularity: 87,
    genreColor: '#f472b6',
  },
  {
    name: 'JONNIE B',
    popularity: 79,
    genreColor: '#6ee7b7',
  },
  {
    name: 'KARTY',
    popularity: 80,
    genreColor: '#34d399',
  },
  {
    name: 'KEVIN DE VRIES',
    popularity: 88,
    genreColor: '#6366f1',
  },
  {
    name: 'KEVIN DE VRIES B2B MORTEN',
    popularity: 89,
    genreColor: '#4f46e5',
  },
  {
    name: 'KÖLSCH',
    popularity: 90,
    genreColor: '#0d9488',
  },
  {
    name: 'LAIDBACK LUKE',
    popularity: 89,
    genreColor: '#facc15',
  },
  {
    name: 'LILLY PALMER',
    popularity: 87,
    genreColor: '#dc2626',
  },
  {
    name: 'LONSKII',
    popularity: 79,
    genreColor: '#4ade80',
  },
  {
    name: 'LOST FREQUENCIES',
    popularity: 90,
    genreColor: '#22d3ee',
  },
  {
    name: 'LUCAS & STEVE',
    popularity: 87,
    genreColor: '#ff2d55',
  },
  {
    name: 'LUUK VAN DIJK',
    popularity: 86,
    genreColor: '#9333ea',
  },
  {
    name: 'MAD MAXX B2B STRYKER',
    popularity: 84,
    genreColor: '#ea580c',
  },
  {
    name: 'MANDY',
    popularity: 83,
    genreColor: '#a855f7',
  },
  {
    name: 'MANUALS',
    popularity: 79,
    genreColor: '#2dd4bf',
  },
  {
    name: 'MARSH',
    popularity: 85,
    genreColor: '#818cf8',
  },
  {
    name: 'MARTIN GARRIX',
    popularity: 99,
    genreColor: '#ff2d55',
  },
  {
    name: 'MATISSE & SADKO',
    popularity: 86,
    genreColor: '#3b82f6',
  },
  {
    name: 'MATTN',
    popularity: 84,
    genreColor: '#f97316',
  },
  {
    name: 'MAYSAA',
    popularity: 79,
    genreColor: '#f9a8d4',
  },
  {
    name: 'MC STRETCH',
    popularity: 78,
    genreColor: '#a3a3a3',
  },
  {
    name: 'MEAGHAN',
    popularity: 79,
    genreColor: '#e879f9',
  },
  {
    name: 'MEGURU',
    popularity: 79,
    genreColor: '#6ee7b7',
  },
  {
    name: 'MELTMODE',
    popularity: 80,
    genreColor: '#8b5cf6',
  },
  {
    name: 'MEROW',
    popularity: 79,
    genreColor: '#34d399',
  },
  {
    name: 'MIKE BOND',
    popularity: 82,
    genreColor: '#fbbf24',
  },
  {
    name: 'MIND AGAINST',
    popularity: 90,
    genreColor: '#1e3a8a',
  },
  {
    name: 'NAKADIA',
    popularity: 86,
    genreColor: '#be185d',
  },
  {
    name: 'NERVO',
    popularity: 88,
    genreColor: '#ec4899',
  },
  {
    name: 'NETSKY',
    popularity: 90,
    genreColor: '#22c55e',
  },
  {
    name: 'NICO MORENO',
    popularity: 85,
    genreColor: '#ef4444',
  },
  {
    name: 'NOME.',
    popularity: 82,
    genreColor: '#fb7185',
  },
  {
    name: 'NOVAH',
    popularity: 79,
    genreColor: '#c4b5fd',
  },
  {
    name: 'NUTTRIX',
    popularity: 81,
    genreColor: '#f43f5e',
  },
  {
    name: 'OPPIDAN',
    popularity: 84,
    genreColor: '#16a34a',
  },
  {
    name: 'PEGASSI',
    popularity: 80,
    genreColor: '#4ade80',
  },
  {
    name: 'PIXZY',
    popularity: 79,
    genreColor: '#f472b6',
  },
  {
    name: 'PUFFER P',
    popularity: 79,
    genreColor: '#2dd4bf',
  },
  {
    name: 'QUINTINO',
    popularity: 89,
    genreColor: '#facc15',
  },
  {
    name: 'R3HAB',
    popularity: 91,
    genreColor: '#3b82f6',
  },
  {
    name: 'RAVE REPUBLIC',
    popularity: 83,
    genreColor: '#f97316',
  },
  {
    name: 'RAYRAY',
    popularity: 81,
    genreColor: '#34d399',
  },
  {
    name: 'RIVIERE',
    popularity: 80,
    genreColor: '#818cf8',
  },
  {
    name: 'ROMEO BLANCO',
    popularity: 84,
    genreColor: '#38bdf8',
  },
  {
    name: 'SABAI',
    popularity: 84,
    genreColor: '#22d3ee',
  },
  {
    name: 'SAINT LUDO',
    popularity: 80,
    genreColor: '#a78bfa',
  },
  {
    name: 'SM1LE',
    popularity: 82,
    genreColor: '#fb923c',
  },
  {
    name: 'STEVE AOKI',
    popularity: 95,
    genreColor: '#ff2d55',
  },
  {
    name: 'SUB ZERO PROJECT',
    popularity: 89,
    genreColor: '#dc2626',
  },
  {
    name: 'SWEDISH HOUSE MAFIA',
    popularity: 98,
    genreColor: '#facc15',
  },
  {
    name: 'THIRD PARTY',
    popularity: 87,
    genreColor: '#60a5fa',
  },
  {
    name: 'TIGER DRAMA',
    popularity: 79,
    genreColor: '#f97316',
  },
  {
    name: 'TRIPTICAL NOTE',
    popularity: 79,
    genreColor: '#8b5cf6',
  },
  {
    name: 'VEGAS',
    popularity: 85,
    genreColor: '#3b82f6',
  },
  {
    name: 'VINI VICI',
    popularity: 93,
    genreColor: '#a3e635',
  },
  {
    name: 'WHISNU SANTIKA',
    popularity: 84,
    genreColor: '#f97316',
  },
  {
    name: 'WUKONG',
    popularity: 83,
    genreColor: '#facc15',
  },
  {
    name: 'XCLUB.',
    popularity: 81,
    genreColor: '#4ade80',
  },
  {
    name: 'XENIA DIA',
    popularity: 80,
    genreColor: '#f9a8d4',
  },
  {
    name: 'XY',
    popularity: 82,
    genreColor: '#7c3aed',
  },
  {
    name: 'YELLOW CLAW',
    popularity: 88,
    genreColor: '#facc15',
  },
  {
    name: 'YOUNA',
    popularity: 84,
    genreColor: '#ec4899',
  },
  {
    name: 'YUKIO',
    popularity: 79,
    genreColor: '#6ee7b7',
  },
  {
    name: 'YVES V',
    popularity: 86,
    genreColor: '#3b82f6',
  },
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
      genre: LINEUP_SEED_GENRE_PLACEHOLDER,
      genreLabel: LINEUP_SEED_GENRE_PLACEHOLDER,
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
