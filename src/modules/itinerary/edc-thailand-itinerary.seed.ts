import { parseTimeToMinutes } from './domain/time-minutes.util';

export const ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID = 5;

const MAIN_STAGE = 'main' as const;
const MAIN_STAGE_LABEL = '主舞台';

type EdcArtistSeed = {
  name: string;
  genre: string;
  genreLabel: string;
  popularity: number;
  genreColor: string;
};

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

function artistId(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function minutesToTime(totalMinutes: number): string {
  const mins = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function perf(input: SeedPerformance) {
  const startMinutes = parseTimeToMinutes(input.startTime);
  let endMinutes = parseTimeToMinutes(input.endTime);
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }
  return {
    activityLegacyId: ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
    ...input,
    startMinutes,
    endMinutes,
  };
}

/**
 * EDC Thailand 2026 官宣阵容（Rhythm Park · 12/18–20）— 日程为占位，便于专属行程选 DJ。
 * `genre` 为主筛选项；`genreLabel` 为艺人实际代表曲风。
 */
const EDC_THAILAND_ARTISTS: EdcArtistSeed[] = [
  {
    name: '&FRIENDS',
    genre: 'House',
    genreLabel: 'Tech House · Latin House',
    popularity: 82,
    genreColor: '#f472b6',
  },
  {
    name: 'ABOVE & BEYOND',
    genre: 'Trance',
    genreLabel: 'Progressive Trance',
    popularity: 97,
    genreColor: '#38bdf8',
  },
  {
    name: 'ALEX WANN',
    genre: 'House',
    genreLabel: 'Afro House · Melodic House',
    popularity: 86,
    genreColor: '#a78bfa',
  },
  {
    name: 'ALLEYCVT',
    genre: 'Dubstep',
    genreLabel: 'Dubstep · Bass Music',
    popularity: 84,
    genreColor: '#fb7185',
  },
  {
    name: 'ALPHA 9',
    genre: 'Trance',
    genreLabel: 'Melodic Trance',
    popularity: 85,
    genreColor: '#22d3ee',
  },
  {
    name: 'ANDEREX',
    genre: 'Techno',
    genreLabel: 'Hard Techno · Trance',
    popularity: 83,
    genreColor: '#818cf8',
  },
  {
    name: 'ANDREW RAYEL',
    genre: 'Trance',
    genreLabel: 'Trance · Big Room',
    popularity: 88,
    genreColor: '#60a5fa',
  },
  {
    name: 'ANDY C',
    genre: 'Drum & Bass',
    genreLabel: 'D&B · Jungle',
    popularity: 90,
    genreColor: '#22c55e',
  },
  {
    name: 'ATLIENS',
    genre: 'Dubstep',
    genreLabel: 'Bass · Trap',
    popularity: 87,
    genreColor: '#f97316',
  },
  {
    name: 'BARBARA LAGO',
    genre: 'Techno',
    genreLabel: 'Melodic Techno',
    popularity: 81,
    genreColor: '#c084fc',
  },
  {
    name: 'BASSTRIPPER',
    genre: 'Bass House',
    genreLabel: 'Bass House · UK Bass',
    popularity: 83,
    genreColor: '#facc15',
  },
  {
    name: 'BELLA CLAXTON B2B KYLE STARKEY',
    genre: 'House',
    genreLabel: 'Tech House',
    popularity: 80,
    genreColor: '#e879f9',
  },
  {
    name: 'CAMELPHAT',
    genre: 'House',
    genreLabel: 'Tech House · Melodic House',
    popularity: 91,
    genreColor: '#34d399',
  },
  {
    name: 'CARTA',
    genre: 'Big Room',
    genreLabel: 'Big Room · Electro',
    popularity: 84,
    genreColor: '#2dd4bf',
  },
  {
    name: 'CHARLOTTE DE WITTE',
    genre: 'Techno',
    genreLabel: 'Acid Techno · Peak Time',
    popularity: 96,
    genreColor: '#f43f5e',
  },
  {
    name: 'CHASEWEST',
    genre: 'House',
    genreLabel: 'Tech House',
    popularity: 82,
    genreColor: '#4ade80',
  },
  {
    name: 'CLARA CUVÉ',
    genre: 'Techno',
    genreLabel: 'Industrial Techno',
    popularity: 89,
    genreColor: '#a855f7',
  },
  {
    name: 'COONE',
    genre: 'Hardstyle',
    genreLabel: 'Hardstyle · Rawstyle',
    popularity: 86,
    genreColor: '#ef4444',
  },
  {
    name: 'DA TWEEKAZ',
    genre: 'Hardstyle',
    genreLabel: 'Hardstyle · Raw',
    popularity: 88,
    genreColor: '#dc2626',
  },
  {
    name: 'DARREN STYLES',
    genre: 'Hardstyle',
    genreLabel: 'UK Hardcore · Happy Hardcore',
    popularity: 85,
    genreColor: '#f87171',
  },
  {
    name: 'DAXSON',
    genre: 'Hardstyle',
    genreLabel: 'Rawstyle · Hardstyle',
    popularity: 84,
    genreColor: '#fb923c',
  },
  {
    name: 'DEAN TURNLEY',
    genre: 'House',
    genreLabel: 'Disco House · Funky House',
    popularity: 79,
    genreColor: '#fcd34d',
  },
  {
    name: 'DENNETT',
    genre: 'House',
    genreLabel: 'UK Garage · Breakbeat',
    popularity: 80,
    genreColor: '#86efac',
  },
  {
    name: 'DJ SNAKE',
    genre: 'Trap',
    genreLabel: 'Trap · Bass',
    popularity: 98,
    genreColor: '#fbbf24',
  },
  {
    name: 'DOM DOLLA',
    genre: 'House',
    genreLabel: 'Tech House',
    popularity: 95,
    genreColor: '#10b981',
  },
  {
    name: 'FIFI',
    genre: 'Bass House',
    genreLabel: 'UK Garage · Bassline',
    popularity: 78,
    genreColor: '#fda4af',
  },
  {
    name: 'FUNK TRIBU',
    genre: 'Techno',
    genreLabel: 'Hard Techno · Neo Rave',
    popularity: 83,
    genreColor: '#d946ef',
  },
  {
    name: 'GIUSEPPE OTTAVIANI',
    genre: 'Trance',
    genreLabel: 'Uplifting Trance',
    popularity: 87,
    genreColor: '#0ea5e9',
  },
  {
    name: 'GREEN VELVET B2B STEVE ANGELLO',
    genre: 'House',
    genreLabel: 'Tech House · Progressive House',
    popularity: 94,
    genreColor: '#84cc16',
  },
  {
    name: 'GUDFELLA',
    genre: 'Bass House',
    genreLabel: 'Bass House · UK Bass',
    popularity: 79,
    genreColor: '#bef264',
  },
  {
    name: 'HAMDI',
    genre: 'Dubstep',
    genreLabel: 'UK Bass · Dubstep',
    popularity: 85,
    genreColor: '#fb7185',
  },
  {
    name: 'HANNAH LAING',
    genre: 'Techno',
    genreLabel: 'Hard Techno · Hard House',
    popularity: 86,
    genreColor: '#c026d3',
  },
  {
    name: 'HORSEGIIRL',
    genre: 'Techno',
    genreLabel: 'Hard Techno · Industrial',
    popularity: 84,
    genreColor: '#e11d48',
  },
  {
    name: 'I HATE MODELS',
    genre: 'Techno',
    genreLabel: 'Industrial Techno · Hard Techno',
    popularity: 93,
    genreColor: '#7c3aed',
  },
  {
    name: 'JACKIE HOLLANDER',
    genre: 'House',
    genreLabel: 'Tech House',
    popularity: 82,
    genreColor: '#14b8a6',
  },
  {
    name: 'JAMES HYPE',
    genre: 'House',
    genreLabel: 'Tech House · Bass House',
    popularity: 92,
    genreColor: '#06b6d4',
  },
  {
    name: 'JAMIE JONES',
    genre: 'House',
    genreLabel: 'Tech House · Deep House',
    popularity: 94,
    genreColor: '#65a30d',
  },
  {
    name: 'KANINE B2B SOTA',
    genre: 'Drum & Bass',
    genreLabel: 'Jump Up · D&B',
    popularity: 86,
    genreColor: '#16a34a',
  },
  {
    name: 'KASKADE',
    genre: 'House',
    genreLabel: 'Progressive House · Deep House',
    popularity: 96,
    genreColor: '#3b82f6',
  },
  {
    name: 'KOROLOVA',
    genre: 'Techno',
    genreLabel: 'Melodic Techno · Progressive',
    popularity: 85,
    genreColor: '#6366f1',
  },
  {
    name: 'KREAM',
    genre: 'House',
    genreLabel: 'Bass House · Future House',
    popularity: 88,
    genreColor: '#0d9488',
  },
  {
    name: 'LEVELTRONICS (SUBTRONICS B2B LEVEL UP)',
    genre: 'Dubstep',
    genreLabel: 'Riddim · Dubstep',
    popularity: 90,
    genreColor: '#ea580c',
  },
  {
    name: 'LIL TEXAS',
    genre: 'Hardstyle',
    genreLabel: 'Hardcore · Trap',
    popularity: 87,
    genreColor: '#b91c1c',
  },
  {
    name: 'LOCO DICE',
    genre: 'House',
    genreLabel: 'Tech House · Minimal',
    popularity: 89,
    genreColor: '#ca8a04',
  },
  {
    name: 'MARLO',
    genre: 'Drum & Bass',
    genreLabel: 'Neurofunk · D&B',
    popularity: 88,
    genreColor: '#059669',
  },
  {
    name: 'MARTIN GARRIX',
    genre: 'Big Room',
    genreLabel: 'Big Room · Progressive House',
    popularity: 99,
    genreColor: '#ff2d55',
  },
  {
    name: 'MAU P',
    genre: 'House',
    genreLabel: 'Tech House',
    popularity: 91,
    genreColor: '#22c55e',
  },
  {
    name: 'MAX STYLER',
    genre: 'House',
    genreLabel: 'Tech House',
    popularity: 85,
    genreColor: '#2563eb',
  },
  {
    name: 'MISS MONIQUE',
    genre: 'Techno',
    genreLabel: 'Melodic Techno',
    popularity: 90,
    genreColor: '#9333ea',
  },
  {
    name: 'NOISE MAFIA B2B AFEM SYKO',
    genre: 'Hardstyle',
    genreLabel: 'Hardstyle · Rawstyle',
    popularity: 83,
    genreColor: '#dc2626',
  },
  {
    name: 'ODD MOB',
    genre: 'House',
    genreLabel: 'Tech House · Bass House',
    popularity: 89,
    genreColor: '#3b82f6',
  },
  {
    name: 'OMAR+',
    genre: 'Techno',
    genreLabel: 'Melodic Techno',
    popularity: 84,
    genreColor: '#8b5cf6',
  },
  {
    name: 'OMNOM',
    genre: 'House',
    genreLabel: 'Tech House · Disco House',
    popularity: 86,
    genreColor: '#f59e0b',
  },
  {
    name: 'OMRI',
    genre: 'Techno',
    genreLabel: 'Melodic Techno',
    popularity: 82,
    genreColor: '#7dd3fc',
  },
  {
    name: 'OSMOSIS JONES',
    genre: 'Dubstep',
    genreLabel: 'Riddim · Dubstep',
    popularity: 83,
    genreColor: '#f43f5e',
  },
  {
    name: 'PAUL VAN DYK',
    genre: 'Trance',
    genreLabel: 'Trance · Progressive',
    popularity: 92,
    genreColor: '#0284c7',
  },
  {
    name: 'PETERBLUE',
    genre: 'House',
    genreLabel: 'Tech House',
    popularity: 78,
    genreColor: '#a3e635',
  },
  {
    name: 'QUEST',
    genre: 'Drum & Bass',
    genreLabel: 'D&B · Jungle',
    popularity: 84,
    genreColor: '#15803d',
  },
  {
    name: 'RESTRICTED',
    genre: 'House',
    genreLabel: 'Tech House · Bass House',
    popularity: 87,
    genreColor: '#d97706',
  },
  {
    name: 'RØZ',
    genre: 'House',
    genreLabel: 'Tech House',
    popularity: 81,
    genreColor: '#f472b6',
  },
  {
    name: 'SABAI',
    genre: 'Future Bass',
    genreLabel: 'Future Bass · Melodic Bass',
    popularity: 85,
    genreColor: '#38bdf8',
  },
  {
    name: 'SHOWTEK HARDSTYLE SET',
    genre: 'Hardstyle',
    genreLabel: 'Hardstyle · Hard Dance',
    popularity: 88,
    genreColor: '#ef4444',
  },
  {
    name: 'SICKMODE',
    genre: 'Dubstep',
    genreLabel: 'Riddim · Dubstep',
    popularity: 86,
    genreColor: '#c2410c',
  },
  {
    name: 'SIHK',
    genre: 'Dubstep',
    genreLabel: 'Dubstep · Bass Music',
    popularity: 82,
    genreColor: '#e879f9',
  },
  {
    name: 'SOFI TUKKER',
    genre: 'House',
    genreLabel: 'Brazilian Bass · Electropop',
    popularity: 93,
    genreColor: '#ec4899',
  },
  {
    name: 'SPACE 92 x POPOF PRESENT: TURBULENCES',
    genre: 'Techno',
    genreLabel: 'Peak Time Techno',
    popularity: 84,
    genreColor: '#6366f1',
  },
  {
    name: 'SUBTRONICS (SUNSET SET)',
    genre: 'Dubstep',
    genreLabel: 'Dubstep · Riddim',
    popularity: 95,
    genreColor: '#7c3aed',
  },
  {
    name: 'SUPERGLOSS',
    genre: 'House',
    genreLabel: 'Tech House',
    popularity: 80,
    genreColor: '#2dd4bf',
  },
  {
    name: 'TAIKI NULIGHT',
    genre: 'Bass House',
    genreLabel: 'Bass House · UK Bass',
    popularity: 83,
    genreColor: '#facc15',
  },
  {
    name: 'TIËSTO',
    genre: 'Big Room',
    genreLabel: 'Big Room · Progressive House',
    popularity: 99,
    genreColor: '#60a5fa',
  },
  {
    name: 'VINTAGE CULTURE',
    genre: 'House',
    genreLabel: 'Deep House · Melodic House',
    popularity: 94,
    genreColor: '#a855f7',
  },
  {
    name: 'VTSS',
    genre: 'Techno',
    genreLabel: 'Hard Techno · Industrial',
    popularity: 87,
    genreColor: '#be123c',
  },
  {
    name: 'WHOMADEWHO (HYBRID DJ SET)',
    genre: 'Techno',
    genreLabel: 'Melodic Techno · Indie Dance',
    popularity: 88,
    genreColor: '#4f46e5',
  },
  {
    name: 'WORSHIP',
    genre: 'Hardstyle',
    genreLabel: 'Rawstyle · Hardstyle',
    popularity: 82,
    genreColor: '#b45309',
  },
  {
    name: 'WUJACKERS',
    genre: 'House',
    genreLabel: 'Tech House',
    popularity: 81,
    genreColor: '#0f766e',
  },
  {
    name: 'YANAMASTE',
    genre: 'Techno',
    genreLabel: 'Melodic Techno',
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

export const EDC_THAILAND_ARTIST_PERFORMANCE_SEED = EDC_THAILAND_ARTISTS.map(
  (artist, index) => {
    const day = EDC_DATE_META[index % EDC_DATE_META.length];
    const slotInDay = Math.floor(index / EDC_DATE_META.length);
    const startMinutes = 14 * 60 + slotInDay * 45;
    const endMinutes = startMinutes + 45;
    const id = artistId(artist.name);
    return perf({
      dateKey: day.dateKey,
      dateLabel: day.label,
      artistId: id,
      artistName: artist.name,
      genre: artist.genre,
      genreLabel: artist.genreLabel,
      stage: MAIN_STAGE,
      stageLabel: MAIN_STAGE_LABEL,
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(endMinutes),
      popularity: artist.popularity,
      avatarSeed: id,
      genreColor: artist.genreColor,
    });
  },
);

export const EDC_THAILAND_ARTIST_NAMES = EDC_THAILAND_ARTISTS.map(
  (a) => a.name,
);
