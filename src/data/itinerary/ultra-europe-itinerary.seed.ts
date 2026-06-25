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
  ['ALESSO', dj('ALESSO', 'House', 'Progressive House · EDM', 96, '#38bdf8')],
  [
    'VINI VICI',
    dj('VINI VICI', 'Trance', 'Psytrance · Progressive', 92, '#f59e0b'),
  ],
  [
    'MORTEN',
    dj('MORTEN', 'Techno', 'Melodic Techno · Big Room', 89, '#4f46e5'),
  ],
  ['NGHTMRE', dj('NGHTMRE', 'Trap', 'Trap · Bass Music', 90, '#f97316')],
  ['MATRODA', dj('MATRODA', 'House', 'Bass House · Tech House', 86, '#84cc16')],
  [
    'JOHN SUMMIT',
    dj('JOHN SUMMIT', 'House', 'Tech House · Deep House', 95, '#10b981'),
  ],
  [
    'TIËSTO',
    dj('TIËSTO', 'Big Room', 'Big Room · Progressive House', 99, '#60a5fa'),
  ],
  [
    'STEVE ANGELLO',
    dj('STEVE ANGELLO', 'House', 'Progressive House · Big Room', 93, '#f472b6'),
  ],
  [
    'SOFI TUKKER',
    dj('SOFI TUKKER', 'House', 'Brazilian Bass · Electropop', 93, '#ec4899'),
  ],
  ['MADDIX', dj('MADDIX', 'Techno', 'Hard Techno · Big Room', 89, '#ef4444')],
  ['JOEL CORRY', dj('JOEL CORRY', 'House', 'Dance · Pop House', 88, '#22d3ee')],
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
  [
    'GRYFFIN',
    dj('GRYFFIN', 'Future Bass', 'Melodic Bass · Future Bass', 91, '#a855f7'),
  ],
  [
    'WILLY WILLIAM',
    dj('WILLY WILLIAM', 'House', 'Latin House · Afro House', 84, '#facc15'),
  ],
  ['CARL COX', dj('CARL COX', 'Techno', 'Techno · House', 96, '#f59e0b')],
  [
    'SOLOMUN',
    dj('SOLOMUN', 'House', 'Melodic House · Deep House', 93, '#6366f1'),
  ],
  [
    'JOHANNES BRECHT',
    dj(
      'JOHANNES BRECHT',
      'Techno',
      'Melodic Techno · Progressive',
      84,
      '#818cf8',
    ),
  ],
  [
    'ARTBAT',
    dj('ARTBAT', 'Techno', 'Melodic Techno · Progressive', 90, '#7c3aed'),
  ],
  ['GINCHY', dj('GINCHY', 'House', 'Tech House · Bass House', 85, '#e879f9')],
  [
    'BRINA KNAUSS',
    dj('BRINA KNAUSS', 'Techno', 'Melodic Techno', 83, '#a78bfa'),
  ],
  [
    'AMELIE LENS',
    dj('AMELIE LENS', 'Techno', 'Acid Techno · Peak Time', 95, '#dc2626'),
  ],
  ['MAU P', dj('MAU P', 'House', 'Tech House · Deep House', 94, '#84cc16')],
  [
    'MIND AGAINST',
    dj('MIND AGAINST', 'Techno', 'Melodic Techno · Progressive', 90, '#1e3a8a'),
  ],
  [
    'KOROLOVA',
    dj('KOROLOVA', 'Techno', 'Melodic Techno · Progressive', 85, '#6366f1'),
  ],
  [
    'JAMES CARTER',
    dj('JAMES CARTER', 'House', 'Tech House · Bass House', 82, '#34d399'),
  ],
  [
    'BLOCK & CROWN',
    dj('BLOCK & CROWN', 'House', 'Tech House · Disco House', 80, '#f472b6'),
  ],
  [
    'NILS VAN ZANDT',
    dj('NILS VAN ZANDT', 'House', 'Future House · Pop EDM', 81, '#60a5fa'),
  ],
  [
    'GIAN VARELA',
    dj('GIAN VARELA', 'House', 'Tech House · Latin House', 83, '#14b8a6'),
  ],
  ['MAIREE', dj('MAIREE', 'House', 'Tech House · Bass House', 82, '#22c55e')],
  ['KEVU', dj('KEVU', 'House', 'Big Room · Electro House', 84, '#3b82f6')],
  [
    'ADAM BEYER B2B MAU P',
    dj(
      'ADAM BEYER B2B MAU P',
      'Techno',
      'Peak Time Techno · Tech House',
      95,
      '#ef4444',
    ),
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

const ULTRA_EUROPE_JUL11_SLOTS: Slot[] = [
  {
    artistName: 'MYKRIS',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '20:00',
    endTime: '21:05',
  },
  {
    artistName: 'MATRODA',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '21:05',
    endTime: '22:10',
  },
  {
    artistName: 'NGHTMRE',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '22:10',
    endTime: '23:15',
  },
  {
    artistName: 'MORTEN',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '23:15',
    endTime: '00:35',
  },
  {
    artistName: 'VINI VICI',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '00:35',
    endTime: '01:55',
  },
  {
    artistName: 'ALESSO',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '01:55',
    endTime: '03:30',
  },
  {
    artistName: 'ARMIN VAN BUUREN',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '03:30',
    endTime: '05:00',
  },
  {
    artistName: 'SHIPE B2B DJ JOCK',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '20:00',
    endTime: '21:30',
  },
  {
    artistName: 'JOHANNES BRECHT',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '21:30',
    endTime: '23:00',
  },
  {
    artistName: 'SOLOMUN',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '23:00',
    endTime: '02:00',
  },
  {
    artistName: 'CARL COX',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '02:00',
    endTime: '05:00',
  },
  {
    artistName: 'CARLOM',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '19:00',
    endTime: '20:00',
  },
  {
    artistName: 'JOWAVES',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'LORENZO',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'ALE BASCIANO B2B MARCO NINNI',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '22:00',
    endTime: '23:00',
  },
  {
    artistName: 'BLOCK & CROWN',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '23:00',
    endTime: '00:00',
  },
  {
    artistName: 'JAMES CARTER',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '00:00',
    endTime: '01:00',
  },
  {
    artistName: 'NOME',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '01:00',
    endTime: '02:00',
  },
  {
    artistName: 'BROZ',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '02:00',
    endTime: '03:00',
  },
  {
    artistName: 'MIKE & ME',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '03:00',
    endTime: '04:00',
  },
  {
    artistName: 'JAMLES',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '04:00',
    endTime: '05:00',
  },
  {
    artistName: 'NILS VAN ZANDT',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '19:00',
    endTime: '20:00',
  },
  {
    artistName: 'RYAN NOGAR',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'JOHN MASAKI & KIM SANE',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'SMILE B2B KZ BEATZ',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '22:00',
    endTime: '23:00',
  },
  {
    artistName: 'PERCASSI',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '23:00',
    endTime: '00:00',
  },
  {
    artistName: 'DOSSCHY',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '00:00',
    endTime: '01:00',
  },
  {
    artistName: 'BLACK OPS B2B BRANDON',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '01:00',
    endTime: '05:00',
  },
];

const ULTRA_EUROPE_JUL12_SLOTS: Slot[] = [
  {
    artistName: 'JOE2SHINE',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '20:00',
    endTime: '21:05',
  },
  {
    artistName: 'JOEL CORRY',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '21:05',
    endTime: '22:10',
  },
  {
    artistName: 'MADDIX',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '22:10',
    endTime: '23:15',
  },
  {
    artistName: 'SOFI TUKKER',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '23:15',
    endTime: '00:20',
  },
  {
    artistName: 'STEVE ANGELLO',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '00:20',
    endTime: '01:55',
  },
  {
    artistName: 'TIËSTO',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '01:55',
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
    artistName: 'TOMO IN DER MÜHLEN',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '20:00',
    endTime: '21:30',
  },
  {
    artistName: 'GINCHY',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '21:30',
    endTime: '23:00',
  },
  {
    artistName: 'BRINA KNAUSS',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '23:00',
    endTime: '01:00',
  },
  {
    artistName: 'MRAK',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '01:00',
    endTime: '03:00',
  },
  {
    artistName: 'ARTBAT',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '03:00',
    endTime: '05:00',
  },
  {
    artistName: 'GEMINO',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'VEDRAN CAR',
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
    endTime: '23:00',
  },
  {
    artistName: 'MIKE BOND',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '23:00',
    endTime: '00:00',
  },
  {
    artistName: 'NAESTOR',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '00:00',
    endTime: '01:00',
  },
  {
    artistName: 'CASPER YU B2B SHANG',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '01:00',
    endTime: '02:00',
  },
  {
    artistName: 'TANK',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '02:00',
    endTime: '03:00',
  },
  {
    artistName: 'VICTOR CARDENAS',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '03:00',
    endTime: '04:00',
  },
  {
    artistName: 'KHARDIAC',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '04:00',
    endTime: '05:00',
  },
  {
    artistName: 'CIRILLO',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'WEKINGZ',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'BLANK',
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
    artistName: 'MANDAS',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '00:00',
    endTime: '01:00',
  },
  {
    artistName: 'YASHA',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '01:00',
    endTime: '05:00',
  },
];

const ULTRA_EUROPE_JUL13_SLOTS: Slot[] = [
  {
    artistName: 'JULIAN CROSS',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '20:00',
    endTime: '20:40',
  },
  {
    artistName: 'WILLY WILLIAM',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '20:40',
    endTime: '21:45',
  },
  {
    artistName: 'GRYFFIN',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '21:45',
    endTime: '23:05',
  },
  {
    artistName: 'AFROJACK',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '23:05',
    endTime: '00:50',
  },
  {
    artistName: 'MARTIN GARRIX',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '00:50',
    endTime: '02:30',
  },
  {
    artistName: 'HARDWELL',
    stage: STAGES.main,
    stageKey: 'main',
    startTime: '02:30',
    endTime: '05:00',
  },
  {
    artistName: 'INSOLATE',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'KOROLOVA',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '21:00',
    endTime: '22:30',
  },
  {
    artistName: 'MIND AGAINST',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '22:30',
    endTime: '00:00',
  },
  {
    artistName: 'ADAM BEYER B2B MAU P',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '00:00',
    endTime: '02:00',
  },
  {
    artistName: 'AMELIE LENS',
    stage: STAGES.resistance,
    stageKey: 'resistance',
    startTime: '02:00',
    endTime: '05:00',
  },
  {
    artistName: 'ALEX PIZZUTI',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'MALENA NARVAY',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'VANILLAZ',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '22:00',
    endTime: '23:00',
  },
  {
    artistName: 'OAK',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '23:00',
    endTime: '00:00',
  },
  {
    artistName: 'YAMATOMAYA',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '00:00',
    endTime: '01:00',
  },
  {
    artistName: 'NOTXERIUS',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '01:00',
    endTime: '02:00',
  },
  {
    artistName: 'JIMMY CLASH & TRICKY GULLIVAN',
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
    artistName: 'NICK HAVSEN',
    stage: STAGES.umfRadio,
    stageKey: 'umfRadio',
    startTime: '04:00',
    endTime: '05:00',
  },
  {
    artistName: 'XANI',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'MATT',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'MAIREE',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '22:00',
    endTime: '23:00',
  },
  {
    artistName: 'GIAN VARELA',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '23:00',
    endTime: '00:00',
  },
  {
    artistName: 'WREX',
    stage: STAGES.oasis,
    stageKey: 'oasis',
    startTime: '00:00',
    endTime: '01:00',
  },
  {
    artistName: 'MOONSHOT',
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

const ULTRA_EUROPE_JUL13_PERFORMANCES = dayPerformances(
  'jul13',
  '7月13日',
  ULTRA_EUROPE_JUL13_SLOTS,
);

const ULTRA_EUROPE_DATE_META = [
  {
    dateKey: 'jul11',
    label: '7月11日',
    bannerDateLabel: '7月11日',
    sortOrder: 0,
  },
  {
    dateKey: 'jul12',
    label: '7月12日',
    bannerDateLabel: '7月12日',
    sortOrder: 1,
  },
  {
    dateKey: 'jul13',
    label: '7月13日',
    bannerDateLabel: '7月13日',
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
  ...ULTRA_EUROPE_JUL11_SLOTS,
  ...ULTRA_EUROPE_JUL12_SLOTS,
  ...ULTRA_EUROPE_JUL13_SLOTS,
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
  ...ULTRA_EUROPE_JUL11_PERFORMANCES,
  ...ULTRA_EUROPE_JUL12_PERFORMANCES,
  ...ULTRA_EUROPE_JUL13_PERFORMANCES,
];

export const ULTRA_EUROPE_ARTIST_NAMES = ALL_SLOT_ARTIST_NAMES;
