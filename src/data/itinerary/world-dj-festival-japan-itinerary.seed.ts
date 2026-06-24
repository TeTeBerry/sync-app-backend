import { parseTimeToMinutes } from '@src/modules/itinerary/domain/time-minutes.util';

export const ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID = 6;

type StageDef = {
  id: string;
  label: string;
  color: string;
};

const STAGES = {
  world: { id: 'world', label: 'World Stage', color: '#ff2d55' },
  dream: { id: 'dream', label: 'Dream Stage', color: '#ec4899' },
  welcome: {
    id: 'welcome',
    label: 'Welcome Stage',
    color: '#3b82f6',
  },
} as const satisfies Record<string, StageDef>;

type ArtistMeta = {
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
): ArtistMeta {
  return { name, genre, genreLabel, popularity, genreColor };
}

const WORLD_DJ_FESTIVAL_ARTIST_OVERRIDES = new Map<string, ArtistMeta>([
  [
    'PORTER ROBINSON',
    dj(
      'PORTER ROBINSON',
      'Future Bass',
      'Future Bass · Electro Pop',
      96,
      '#a855f7',
    ),
  ],
  [
    'KSHMR',
    dj('KSHMR', 'House', 'Big Room · Progressive House', 93, '#f59e0b'),
  ],
  [
    'CHEAT CODES',
    dj('CHEAT CODES', 'House', 'Pop House · Future Bass', 88, '#22d3ee'),
  ],
  [
    'MIKE PERRY',
    dj(
      'MIKE PERRY',
      'House',
      'Progressive House · Tropical House',
      86,
      '#38bdf8',
    ),
  ],
  [
    'LUCAS & STEVE',
    dj('LUCAS & STEVE', 'House', 'Future House · Big Room', 87, '#ff2d55'),
  ],
  [
    'QUINTINO',
    dj('QUINTINO', 'House', 'Big Room · Electro House', 89, '#facc15'),
  ],
  [
    'LIKE MIKE (MAIN STAGE DJ SET)',
    dj(
      'LIKE MIKE (MAIN STAGE DJ SET)',
      'House',
      'Big Room · Electro House',
      94,
      '#f472b6',
    ),
  ],
  [
    'ANGERFIST',
    dj('ANGERFIST', 'Hardcore', 'Hardcore · Industrial', 94, '#1f2937'),
  ],
  ['VERTILE', dj('VERTILE', 'Hardstyle', 'Hardstyle · Raw', 92, '#ec4899')],
  [
    'SOUND RUSH',
    dj('SOUND RUSH', 'Hardstyle', 'Hardstyle · Euphoric', 90, '#f472b6'),
  ],
  [
    'ATMOZFEARS B2B SOUND RUSH',
    dj(
      'ATMOZFEARS B2B SOUND RUSH',
      'Hardstyle',
      'Hardstyle · Euphoric',
      89,
      '#f472b6',
    ),
  ],
  [
    'TONESHIFTERZ',
    dj('TONESHIFTERZ', 'Hardstyle', 'Hardstyle · Raw', 86, '#db2777'),
  ],
  [
    'DUAL DAMAGE',
    dj('DUAL DAMAGE', 'Hardstyle', 'Hardstyle · Raw', 88, '#7c3aed'),
  ],
  [
    'ATMOZFEARS',
    dj('ATMOZFEARS', 'Hardstyle', 'Hardstyle · Euphoric', 87, '#a855f7'),
  ],
  [
    'MARTIN GARRIX',
    dj('MARTIN GARRIX', 'House', 'Big Room · Progressive House', 98, '#ff2d55'),
  ],
  ['ALOK', dj('ALOK', 'House', 'Brazilian Bass · EDM', 94, '#f472b6')],
  [
    'GALANTIS',
    dj('GALANTIS', 'House', 'Dance Pop · Future Bass', 92, '#38bdf8'),
  ],
  [
    'BLACK TIGER SEX MACHINE',
    dj('BLACK TIGER SEX MACHINE', 'Dubstep', 'Riddim · Dubstep', 91, '#dc2626'),
  ],
  [
    'WUJACKERS',
    dj('WUJACKERS', 'House', 'Big Room · Bass House', 88, '#facc15'),
  ],
  [
    'SICK INDIVIDUALS',
    dj('SICK INDIVIDUALS', 'House', 'Big Room · Electro House', 87, '#f59e0b'),
  ],
  ['MESTO', dj('MESTO', 'House', 'Future House · Big Room', 86, '#22d3ee')],
  [
    '999999999',
    dj('999999999', 'Techno', 'Industrial Techno · Acid', 88, '#818cf8'),
  ],
  [
    'CHARLIE SPARKS',
    dj('CHARLIE SPARKS', 'Techno', 'Hard Techno', 84, '#6366f1'),
  ],
  [
    'STAN CHRIST',
    dj('STAN CHRIST', 'Techno', 'Hard Techno · Industrial', 83, '#7c3aed'),
  ],
  ['FOVOS', dj('FOVOS', 'House', 'Tech House · Bass House', 82, '#ec4899')],
  ['SMACK', dj('SMACK', 'Hardstyle', 'Hardstyle · Raw', 85, '#db2777')],
  ['PAWLOWSKI', dj('PAWLOWSKI', 'Hardstyle', 'Hardstyle · Raw', 84, '#f472b6')],
  [
    'RETROVISION B2B JEONGHYEON',
    dj(
      'RETROVISION B2B JEONGHYEON',
      'House',
      'Future House · Big Room',
      80,
      '#60a5fa',
    ),
  ],
]);

const DEFAULT_BY_STAGE: Record<
  keyof typeof STAGES,
  [genre: string, genreLabel: string, popularity: number, genreColor: string]
> = {
  world: ['House', 'Progressive House · EDM', 78, '#f472b6'],
  dream: ['Hardstyle', 'Hardstyle · Raw', 76, '#ec4899'],
  welcome: ['House', 'J-Pop Dance · Club', 72, '#60a5fa'],
};

function defaultMeta(name: string, stageKey: keyof typeof STAGES): ArtistMeta {
  const [genre, genreLabel, popularity, genreColor] =
    DEFAULT_BY_STAGE[stageKey];
  return dj(name, genre, genreLabel, popularity, genreColor);
}

function metaFor(name: string, stageKey: keyof typeof STAGES): ArtistMeta {
  return (
    WORLD_DJ_FESTIVAL_ARTIST_OVERRIDES.get(name) ?? defaultMeta(name, stageKey)
  );
}

type Slot = {
  artistName: string;
  stage: StageDef;
  stageKey: keyof typeof STAGES;
  startTime: string;
  endTime: string;
};

const WORLD_DJ_FESTIVAL_JUL4_SLOTS: Slot[] = [
  {
    artistName: 'DJ HADOU B2B FØOMIE?',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '11:00',
    endTime: '12:00',
  },
  {
    artistName: 'MIU',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '12:00',
    endTime: '13:00',
  },
  {
    artistName: 'MIKE PERRY',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '13:00',
    endTime: '14:00',
  },
  {
    artistName: 'LUCAS & STEVE',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '14:00',
    endTime: '15:00',
  },
  {
    artistName: 'QUINTINO',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '15:00',
    endTime: '16:00',
  },
  {
    artistName: 'CHEAT CODES',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '16:00',
    endTime: '17:00',
  },
  {
    artistName: 'KSHMR',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '17:00',
    endTime: '18:00',
  },
  {
    artistName: 'PORTER ROBINSON',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '18:00',
    endTime: '19:00',
  },
  {
    artistName: 'LIKE MIKE (MAIN STAGE DJ SET)',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '19:00',
    endTime: '20:00',
  },
  {
    artistName: 'LILY',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '11:00',
    endTime: '11:30',
  },
  {
    artistName: 'FLAVIO',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '11:30',
    endTime: '12:10',
  },
  {
    artistName: 'YUNKORO',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '12:10',
    endTime: '12:55',
  },
  {
    artistName: 'DAIKI',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '12:55',
    endTime: '13:40',
  },
  {
    artistName: 'TATSUNOSHIN',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '13:40',
    endTime: '14:30',
  },
  {
    artistName: 'TONESHIFTERZ',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '14:30',
    endTime: '15:30',
  },
  {
    artistName: 'ATMOZFEARS B2B SOUND RUSH',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '15:30',
    endTime: '16:30',
  },
  {
    artistName: 'VERTILE',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '16:30',
    endTime: '17:30',
  },
  {
    artistName: 'DUAL DAMAGE',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '17:30',
    endTime: '18:30',
  },
  {
    artistName: 'ANGERFIST',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '18:30',
    endTime: '20:00',
  },
  {
    artistName: 'SAULE',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '11:00',
    endTime: '12:00',
  },
  {
    artistName: 'CORE',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '12:00',
    endTime: '13:00',
  },
  {
    artistName: 'JUNI',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '13:00',
    endTime: '14:00',
  },
  {
    artistName: 'RYU',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '14:00',
    endTime: '15:00',
  },
  {
    artistName: '417',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '15:00',
    endTime: '16:00',
  },
  {
    artistName: 'YUNPI',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '16:00',
    endTime: '17:00',
  },
  {
    artistName: 'GAGAKU',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '17:00',
    endTime: '18:00',
  },
  {
    artistName: 'MITOCHY',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '18:00',
    endTime: '19:00',
  },
  {
    artistName: 'SHO-TA',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '19:00',
    endTime: '20:00',
  },
  {
    artistName: 'YUNPI B2B 417',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '20:00',
    endTime: '20:30',
  },
];

const WORLD_DJ_FESTIVAL_JUL5_SLOTS: Slot[] = [
  {
    artistName: 'NICOLE CHEN',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '11:00',
    endTime: '11:45',
  },
  {
    artistName: 'KDH',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '11:45',
    endTime: '12:40',
  },
  {
    artistName: 'RETROVISION B2B JEONGHYEON',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '12:40',
    endTime: '13:40',
  },
  {
    artistName: 'MESTO',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '13:40',
    endTime: '14:40',
  },
  {
    artistName: 'SICK INDIVIDUALS',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '14:40',
    endTime: '15:40',
  },
  {
    artistName: 'WUJACKERS',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '15:40',
    endTime: '16:40',
  },
  {
    artistName: 'BLACK TIGER SEX MACHINE',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '16:40',
    endTime: '17:40',
  },
  {
    artistName: 'GALANTIS',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '17:40',
    endTime: '18:40',
  },
  {
    artistName: 'ALOK',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '18:40',
    endTime: '19:40',
  },
  {
    artistName: 'SIGNATURE SHOW',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '19:40',
    endTime: '20:00',
  },
  {
    artistName: 'MARTIN GARRIX',
    stage: STAGES.world,
    stageKey: 'world',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'MACKEY',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '11:00',
    endTime: '11:40',
  },
  {
    artistName: 'PIXEL',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '11:40',
    endTime: '12:30',
  },
  {
    artistName: 'MAAM & KOKI',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '12:30',
    endTime: '13:20',
  },
  {
    artistName: 'SARA',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '13:20',
    endTime: '14:10',
  },
  {
    artistName: 'CHAWON',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '14:10',
    endTime: '15:00',
  },
  {
    artistName: 'SMACK',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '15:00',
    endTime: '16:00',
  },
  {
    artistName: 'FOVOS',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '16:00',
    endTime: '17:00',
  },
  {
    artistName: 'PAWLOWSKI',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '17:00',
    endTime: '18:00',
  },
  {
    artistName: '999999999',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '18:00',
    endTime: '19:00',
  },
  {
    artistName: 'CHARLIE SPARKS',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '19:00',
    endTime: '20:00',
  },
  {
    artistName: 'STAN CHRIST',
    stage: STAGES.dream,
    stageKey: 'dream',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'KiBØ',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '11:00',
    endTime: '12:00',
  },
  {
    artistName: 'MN4',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '12:00',
    endTime: '13:00',
  },
  {
    artistName: 'ASTERA',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '13:00',
    endTime: '14:00',
  },
  {
    artistName: 'SYZYGY',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '14:00',
    endTime: '14:45',
  },
  {
    artistName: 'I.G.A',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '14:45',
    endTime: '15:30',
  },
  {
    artistName: 'BEAUTY NOISE TOKYO',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '15:30',
    endTime: '16:15',
  },
  {
    artistName: 'LIL NANAA',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '16:15',
    endTime: '17:00',
  },
  {
    artistName: 'NATSUMI',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '17:00',
    endTime: '17:45',
  },
  {
    artistName: 'POKO',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '17:45',
    endTime: '18:30',
  },
  {
    artistName: 'GARKO',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '18:30',
    endTime: '19:15',
  },
  {
    artistName: 'ADI',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '19:15',
    endTime: '20:00',
  },
  {
    artistName: 'YAMAHIRO',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'ROAD TO WELCOME STAGE',
    stage: STAGES.welcome,
    stageKey: 'welcome',
    startTime: '21:00',
    endTime: '21:30',
  },
];

type PerfInput = {
  dateKey: string;
  dateLabel: string;
  artistName: string;
  stage: StageDef;
  stageKey: keyof typeof STAGES;
  startTime: string;
  endTime: string;
};

function perf({
  dateKey,
  dateLabel,
  artistName,
  stage,
  stageKey,
  startTime,
  endTime,
}: PerfInput) {
  const meta = metaFor(artistName, stageKey);
  const id = artistId(artistName);
  const startMinutes = parseTimeToMinutes(startTime);
  let endMinutes = parseTimeToMinutes(endTime);
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }
  return {
    activityLegacyId: ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID,
    dateKey,
    dateLabel,
    artistId: id,
    artistName,
    genre: meta.genre,
    genreLabel: meta.genreLabel,
    stage: stage.id,
    stageLabel: stage.label,
    startTime,
    endTime,
    startMinutes,
    endMinutes,
    popularity: meta.popularity,
    avatarSeed: id,
    genreColor: stage.color,
  };
}

function dayPerformances(dateKey: string, dateLabel: string, slots: Slot[]) {
  return slots.map((slot) => perf({ dateKey, dateLabel, ...slot }));
}

const WORLD_DJ_FESTIVAL_JUL4_PERFORMANCES = dayPerformances(
  'jul4',
  '7月4日',
  WORLD_DJ_FESTIVAL_JUL4_SLOTS,
);

const WORLD_DJ_FESTIVAL_JUL5_PERFORMANCES = dayPerformances(
  'jul5',
  '7月5日',
  WORLD_DJ_FESTIVAL_JUL5_SLOTS,
);

const WORLD_DJ_FESTIVAL_DATE_META = [
  { dateKey: 'jul4', label: '7月4日', bannerDateLabel: '7月4日', sortOrder: 0 },
  { dateKey: 'jul5', label: '7月5日', bannerDateLabel: '7月5日', sortOrder: 1 },
] as const;

export const WORLD_DJ_FESTIVAL_FESTIVAL_SESSION_SEED =
  WORLD_DJ_FESTIVAL_DATE_META.map((day) => ({
    activityLegacyId: ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID,
    ...day,
  }));

const ALL_WORLD_DJ_FESTIVAL_SLOTS = [
  ...WORLD_DJ_FESTIVAL_JUL4_SLOTS,
  ...WORLD_DJ_FESTIVAL_JUL5_SLOTS,
];

const ALL_SLOT_ARTIST_NAMES = [
  ...new Set(ALL_WORLD_DJ_FESTIVAL_SLOTS.map((slot) => slot.artistName)),
];

function primaryStageForArtist(name: string): string {
  return (
    ALL_WORLD_DJ_FESTIVAL_SLOTS.find((slot) => slot.artistName === name)?.stage
      .id ?? STAGES.world.id
  );
}

export const WORLD_DJ_FESTIVAL_LINEUP_DJ_SEED = ALL_SLOT_ARTIST_NAMES.map(
  (name) => {
    const slot = ALL_WORLD_DJ_FESTIVAL_SLOTS.find(
      (s) => s.artistName === name,
    )!;
    const meta = metaFor(name, slot.stageKey);
    const id = artistId(name);
    return {
      id,
      name,
      genre: meta.genre,
      genreLabel: meta.genreLabel,
      stage: primaryStageForArtist(name),
      popularity: meta.popularity,
      avatarSeed: id,
      genreColor: meta.genreColor,
    };
  },
);

export const WORLD_DJ_FESTIVAL_ARTIST_PERFORMANCE_SEED = [
  ...WORLD_DJ_FESTIVAL_JUL4_PERFORMANCES,
  ...WORLD_DJ_FESTIVAL_JUL5_PERFORMANCES,
];

export const WORLD_DJ_FESTIVAL_ARTIST_NAMES = ALL_SLOT_ARTIST_NAMES;
