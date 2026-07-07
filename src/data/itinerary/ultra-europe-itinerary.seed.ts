import { parseTimeToMinutes } from '@src/modules/itinerary/domain/time-minutes.util';
import { LINEUP_SEED_GENRE_PLACEHOLDER } from './lineup-seed-genre.constants';

export const ITINERARY_ULTRA_EUROPE_ACTIVITY_LEGACY_ID = 15;

type StageDef = {
  id: string;
  label: string;
  color: string;
};

const STAGES = {
  main: { id: 'main', label: 'Ultra Main Stage', color: '#ff2d55' },
  resistance: { id: 'resistance', label: 'Resistance', color: '#7c3aed' },
  umfRadio: { id: 'umf-radio', label: 'UMF Radio', color: '#3b82f6' },
  oasis: { id: 'oasis', label: 'Oasis', color: '#10b981' },
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
  _genre: string,
  _genreLabel: string,
  popularity: number,
  genreColor: string,
): ArtistMeta {
  return {
    name,
    genre: LINEUP_SEED_GENRE_PLACEHOLDER,
    genreLabel: LINEUP_SEED_GENRE_PLACEHOLDER,
    popularity,
    genreColor,
  };
}

const ULTRA_EUROPE_ARTIST_OVERRIDES = new Map<string, ArtistMeta>([
  [
    'ARMIN VAN BUUREN',
    dj(
      'ARMIN VAN BUUREN',
      'Trance',
      'Progressive Trance · Uplifting',
      98,
      '#38bdf8',
    ),
  ],
  [
    'JOHN SUMMIT',
    dj('JOHN SUMMIT', 'House', 'Tech House · Deep House', 95, '#10b981'),
  ],
  ['MADDIX', dj('MADDIX', 'Techno', 'Hard Techno · Big Room', 89, '#ef4444')],
  [
    'HARDWELL',
    dj('HARDWELL', 'House', 'Big Room · Progressive House', 97, '#3b82f6'),
  ],
  [
    'MARTIN GARRIX',
    dj('MARTIN GARRIX', 'House', 'Big Room · Progressive House', 98, '#ff2d55'),
  ],
  [
    'AFROJACK',
    dj('AFROJACK', 'House', 'Big Room · Electro House', 96, '#f472b6'),
  ],
  ['MAU P', dj('MAU P', 'House', 'Tech House · Deep House', 94, '#84cc16')],
  ['ADAM BEYER', dj('ADAM BEYER', 'Techno', 'Peak Time Techno', 95, '#ef4444')],
  ['DJ SNAKE', dj('DJ SNAKE', 'Trap', 'Trap · EDM', 95, '#ff2d55')],
  ['FISHER', dj('FISHER', 'House', 'Tech House', 94, '#84cc16')],
  [
    'CALVIN HARRIS',
    dj('CALVIN HARRIS', 'House', 'Big Room · Dance Pop', 99, '#60a5fa'),
  ],
  ['DOM DOLLA', dj('DOM DOLLA', 'House', 'Tech House', 92, '#22c55e')],
  [
    'OLIVER HELDENS',
    dj('OLIVER HELDENS', 'House', 'Future House · Tech House', 93, '#38bdf8'),
  ],
  [
    'SUBTRONICS',
    dj('SUBTRONICS', 'Dubstep', 'Riddim · Dubstep', 94, '#84cc16'),
  ],
  [
    'CAMELPHAT',
    dj('CAMELPHAT', 'House', 'Melodic House · Tech House', 91, '#6366f1'),
  ],
  [
    'SARA LANDRY',
    dj('SARA LANDRY', 'Techno', 'Hard Techno · Industrial', 92, '#dc2626'),
  ],
  [
    'I HATE MODELS',
    dj('I HATE MODELS', 'Techno', 'Hard Techno · Industrial', 90, '#991b1b'),
  ],
  [
    'DASH BERLIN',
    dj('DASH BERLIN', 'Trance', 'Progressive Trance · EDM', 88, '#38bdf8'),
  ],
  [
    'BLOCK & CROWN',
    dj('BLOCK & CROWN', 'House', 'Tech House · Disco House', 80, '#f472b6'),
  ],
  [
    'NILES VAN ZANDT',
    dj('NILES VAN ZANDT', 'House', 'Future House · Pop EDM', 81, '#60a5fa'),
  ],
  ['KEVU', dj('KEVU', 'House', 'Big Room · Electro House', 84, '#3b82f6')],
  [
    'ALEX PIZZUTI',
    dj('ALEX PIZZUTI', 'House', 'Tech House · Bass House', 80, '#34d399'),
  ],
  ['WREX', dj('WREX', 'House', 'Tech House', 78, '#60a5fa')],
  ['RYAN NOGAR', dj('RYAN NOGAR', 'House', 'EDM · Commercial', 76, '#34d399')],
  ['FRANK JEZ', dj('FRANK JEZ', 'House', 'Open Format · Club', 78, '#22d3ee')],
  ['MANDAS', dj('MANDAS', 'House', 'Tech House', 76, '#34d399')],
  ['WAGS', dj('WAGS', 'House', 'Tech House · Chicago House', 79, '#3b82f6')],
  ['MIKE BOND', dj('MIKE BOND', 'House', 'Tech House', 77, '#60a5fa')],
  ['LORENZO', dj('LORENZO', 'House', 'Tech House', 76, '#60a5fa')],
  ['MIKE & ME', dj('MIKE & ME', 'House', 'Tech House', 75, '#60a5fa')],
  [
    'TOMO IN DER MÜHLEN',
    dj('TOMO IN DER MÜHLEN', 'Techno', 'Melodic Techno', 84, '#818cf8'),
  ],
]);

const DEFAULT_BY_STAGE: Record<
  keyof typeof STAGES,
  [genre: string, genreLabel: string, popularity: number, genreColor: string]
> = {
  main: ['House', 'Progressive House · EDM', 78, '#f472b6'],
  resistance: ['Techno', 'Melodic Techno · Peak Time', 78, '#818cf8'],
  umfRadio: ['House', 'Tech House · Deep House', 74, '#60a5fa'],
  oasis: ['House', 'Tech House · Bass House', 74, '#34d399'],
};

function defaultMeta(name: string, stageKey: keyof typeof STAGES): ArtistMeta {
  const [genre, genreLabel, popularity, genreColor] =
    DEFAULT_BY_STAGE[stageKey];
  return dj(name, genre, genreLabel, popularity, genreColor);
}

function metaFor(name: string, stageKey: keyof typeof STAGES): ArtistMeta {
  return ULTRA_EUROPE_ARTIST_OVERRIDES.get(name) ?? defaultMeta(name, stageKey);
}

type Slot = {
  artistName: string;
  stage: StageDef;
  stageKey: keyof typeof STAGES;
  startTime: string;
  endTime: string;
};

const ULTRA_EUROPE_JUL10_SLOTS: Slot[] = [
  {
    artistName: 'MYKRIS',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '20:00',
    endTime: '21:05',
  },
  {
    artistName: 'HALO',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '21:05',
    endTime: '22:10',
  },
  {
    artistName: 'SUBTRONICS',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '22:10',
    endTime: '23:30',
  },
  {
    artistName: 'OLIVER HELDENS',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '23:30',
    endTime: '00:50',
  },
  {
    artistName: 'AFROJACK',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '00:50',
    endTime: '02:10',
  },
  {
    artistName: 'DJ SNAKE',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '02:10',
    endTime: '03:30',
  },
  {
    artistName: 'JOHN SUMMIT',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '03:30',
    endTime: '05:00',
  },
  {
    artistName: 'DJ JOCK',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '20:00',
    endTime: '21:30',
  },
  {
    artistName: 'DEER JADE',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '21:30',
    endTime: '23:00',
  },
  {
    artistName: 'MISS MONIQUE',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '23:00',
    endTime: '01:00',
  },
  {
    artistName: 'ADAM BEYER',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '01:00',
    endTime: '03:00',
  },
  {
    artistName: 'CAMELPHAT',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '03:00',
    endTime: '05:00',
  },
  {
    artistName: 'TWOFACE',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'BLOCK & CROWN',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'MIKE & ME',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '22:00',
    endTime: '22:40',
  },
  {
    artistName: 'LORENZO',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '22:40',
    endTime: '23:20',
  },
  {
    artistName: 'MERT AYDIN',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '23:20',
    endTime: '00:00',
  },
  {
    artistName: 'P.O.U.',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '00:00',
    endTime: '01:00',
  },
  {
    artistName: 'YAMATOMAYA',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '01:00',
    endTime: '02:00',
  },
  {
    artistName: 'VINJAZ B2B JIM',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '02:00',
    endTime: '03:00',
  },
  {
    artistName: 'LIA LISSE',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '03:00',
    endTime: '04:00',
  },
  {
    artistName: 'TANK',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '04:00',
    endTime: '05:00',
  },
  {
    artistName: 'SEMERENE',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '19:00',
    endTime: '20:00',
  },
  {
    artistName: 'LOOKA',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'RYAN NOGAR',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'MATT',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '22:00',
    endTime: '23:00',
  },
  {
    artistName: 'JAY P',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '23:00',
    endTime: '00:00',
  },
  {
    artistName: 'NAEMS B2B MASKI & BANGA',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '00:00',
    endTime: '01:00',
  },
  {
    artistName: 'SIMO & FRANZ',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '01:00',
    endTime: '05:00',
  },
];

const ULTRA_EUROPE_JUL11_SLOTS: Slot[] = [
  {
    artistName: 'VANILLAZ',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '20:00',
    endTime: '20:50',
  },
  {
    artistName: 'DASH BERLIN',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '20:50',
    endTime: '21:55',
  },
  {
    artistName: 'MADDIX',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '21:55',
    endTime: '23:00',
  },
  {
    artistName: 'WORSHIP',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '23:00',
    endTime: '00:20',
  },
  {
    artistName: 'DOM DOLLA',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '00:20',
    endTime: '01:55',
  },
  {
    artistName: 'CALVIN HARRIS',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '01:55',
    endTime: '03:30',
  },
  {
    artistName: 'HARDWELL',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '03:30',
    endTime: '05:00',
  },
  {
    artistName: 'SHIPE',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '20:00',
    endTime: '21:30',
  },
  {
    artistName: 'MALONE MOREZ',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '21:30',
    endTime: '23:00',
  },
  {
    artistName: 'BEN STERLING',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '23:00',
    endTime: '01:00',
  },
  {
    artistName: 'MAU P',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '01:00',
    endTime: '03:00',
  },
  {
    artistName: 'JAMIE JONES',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '03:00',
    endTime: '05:00',
  },
  {
    artistName: 'SEANXXX',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'WREX',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'RESTER',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '22:00',
    endTime: '22:40',
  },
  {
    artistName: 'MIKE BOND',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '22:40',
    endTime: '23:20',
  },
  {
    artistName: 'DJ TORA',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '23:20',
    endTime: '00:00',
  },
  {
    artistName: 'ALE BASCIANO B2B MARCO NINNI',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '00:00',
    endTime: '01:00',
  },
  {
    artistName: 'YAKSA',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '01:00',
    endTime: '02:00',
  },
  {
    artistName: 'CASPER YU B2B JETEGG',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '02:00',
    endTime: '03:00',
  },
  {
    artistName: 'D.LACRUX',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '03:00',
    endTime: '04:00',
  },
  {
    artistName: 'NILES VAN ZANDT',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '04:00',
    endTime: '05:00',
  },
  {
    artistName: 'SEB C',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'AZOOLAND',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'EVAN PIERINI B2B SEAN PARK',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '22:00',
    endTime: '23:00',
  },
  {
    artistName: 'FRANK JEZ',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '23:00',
    endTime: '00:00',
  },
  {
    artistName: 'SABERZ',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '00:00',
    endTime: '01:00',
  },
  {
    artistName: 'BADVICE',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '01:00',
    endTime: '05:00',
  },
];

const ULTRA_EUROPE_JUL12_SLOTS: Slot[] = [
  {
    artistName: 'KRAUNDLER',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '20:00',
    endTime: '20:50',
  },
  {
    artistName: 'PLASTIK FUNK',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '20:50',
    endTime: '21:55',
  },
  {
    artistName: 'RAY VOLPE B2B SULLIVAN KING',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '21:55',
    endTime: '23:15',
  },
  {
    artistName: 'BUNT.',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '23:15',
    endTime: '00:35',
  },
  {
    artistName: 'ARMIN VAN BUUREN',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '00:35',
    endTime: '01:55',
  },
  {
    artistName: 'MARTIN GARRIX',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '01:55',
    endTime: '03:30',
  },
  {
    artistName: 'FISHER',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '03:30',
    endTime: '05:00',
  },
  {
    artistName: 'TOMO IN DER MÜHLEN',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '20:00',
    endTime: '21:30',
  },
  {
    artistName: 'WILL ATKINSON',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '21:30',
    endTime: '23:00',
  },
  {
    artistName: 'I HATE MODELS',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '23:00',
    endTime: '01:00',
  },
  {
    artistName: 'NICO MORENO',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '01:00',
    endTime: '03:00',
  },
  {
    artistName: 'SARA LANDRY',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '03:00',
    endTime: '05:00',
  },
  {
    artistName: 'CLIFF VAN DELORT',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'JOE2SHINE',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'WAGS',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '22:00',
    endTime: '22:40',
  },
  {
    artistName: 'JOWAVES',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '22:40',
    endTime: '23:20',
  },
  {
    artistName: 'MANUALS',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '23:20',
    endTime: '00:00',
  },
  {
    artistName: 'PETTE',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '00:00',
    endTime: '01:00',
  },
  {
    artistName: 'CARLOM B2B ARINNO',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '01:00',
    endTime: '02:00',
  },
  {
    artistName: 'HRT',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '02:00',
    endTime: '03:00',
  },
  {
    artistName: 'KEVU',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '03:00',
    endTime: '04:00',
  },
  {
    artistName: 'DJ MII',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '04:00',
    endTime: '05:00',
  },
  {
    artistName: 'MANDAS',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'CIRILLO JR.',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'MEAGHAN',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '22:00',
    endTime: '23:00',
  },
  {
    artistName: 'CHARLES B',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '23:00',
    endTime: '00:00',
  },
  {
    artistName: 'MADISM',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '00:00',
    endTime: '01:00',
  },
  {
    artistName: 'ALEX PIZZUTI',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '01:00',
    endTime: '05:00',
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
    activityLegacyId: ITINERARY_ULTRA_EUROPE_ACTIVITY_LEGACY_ID,
    dateKey,
    dateLabel,
    artistId: id,
    artistName,
    genre: LINEUP_SEED_GENRE_PLACEHOLDER,
    genreLabel: LINEUP_SEED_GENRE_PLACEHOLDER,
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

const ULTRA_EUROPE_JUL10_PERFORMANCES = dayPerformances(
  'jul10',
  '7月10日',
  ULTRA_EUROPE_JUL10_SLOTS,
);

const ULTRA_EUROPE_JUL11_PERFORMANCES = dayPerformances(
  'jul11',
  '7月11日',
  ULTRA_EUROPE_JUL11_SLOTS,
);

const ULTRA_EUROPE_JUL12_PERFORMANCES = dayPerformances(
  'jul12',
  '7月12日',
  ULTRA_EUROPE_JUL12_SLOTS,
);

const ULTRA_EUROPE_DATE_META = [
  {
    dateKey: 'jul10',
    label: '7月10日',
    bannerDateLabel: '7月10日',
    sortOrder: 0,
  },
  {
    dateKey: 'jul11',
    label: '7月11日',
    bannerDateLabel: '7月11日',
    sortOrder: 1,
  },
  {
    dateKey: 'jul12',
    label: '7月12日',
    bannerDateLabel: '7月12日',
    sortOrder: 2,
  },
] as const;

export const ULTRA_EUROPE_FESTIVAL_SESSION_SEED = ULTRA_EUROPE_DATE_META.map(
  (day) => ({
    activityLegacyId: ITINERARY_ULTRA_EUROPE_ACTIVITY_LEGACY_ID,
    ...day,
  }),
);

const ALL_ULTRA_EUROPE_SLOTS = [
  ...ULTRA_EUROPE_JUL10_SLOTS,
  ...ULTRA_EUROPE_JUL11_SLOTS,
  ...ULTRA_EUROPE_JUL12_SLOTS,
];

const ALL_SLOT_ARTIST_NAMES = [
  ...new Set(ALL_ULTRA_EUROPE_SLOTS.map((slot) => slot.artistName)),
];

function primaryStageForArtist(name: string): string {
  return (
    ALL_ULTRA_EUROPE_SLOTS.find((slot) => slot.artistName === name)?.stage.id ??
    STAGES.main.id
  );
}

export const ULTRA_EUROPE_LINEUP_DJ_SEED = ALL_SLOT_ARTIST_NAMES.map((name) => {
  const slot = ALL_ULTRA_EUROPE_SLOTS.find((s) => s.artistName === name)!;
  const meta = metaFor(name, slot.stageKey);
  const id = artistId(name);
  return {
    id,
    name,
    genre: LINEUP_SEED_GENRE_PLACEHOLDER,
    genreLabel: LINEUP_SEED_GENRE_PLACEHOLDER,
    stage: primaryStageForArtist(name),
    popularity: meta.popularity,
    avatarSeed: id,
    genreColor: meta.genreColor,
  };
});

export const ULTRA_EUROPE_ARTIST_PERFORMANCE_SEED = [
  ...ULTRA_EUROPE_JUL10_PERFORMANCES,
  ...ULTRA_EUROPE_JUL11_PERFORMANCES,
  ...ULTRA_EUROPE_JUL12_PERFORMANCES,
];

export const ULTRA_EUROPE_ARTIST_NAMES = ALL_SLOT_ARTIST_NAMES;
