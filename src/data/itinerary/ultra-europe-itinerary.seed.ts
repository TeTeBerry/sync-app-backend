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

/** Official SET TIMES poster only publishes start times (8PM–5AM festival window). */
const FESTIVAL_CLOSE_MINUTES = 29 * 60; // 05:00 next morning

type Slot = {
  artistName: string;
  stage: StageDef;
  stageKey: keyof typeof STAGES;
  /** Official start time from Ultra Europe SET TIMES (HH:mm). */
  startTime: string;
};

function slot(
  artistName: string,
  stageKey: keyof typeof STAGES,
  startTime: string,
): Slot {
  return {
    artistName,
    stage: STAGES[stageKey],
    stageKey,
    startTime,
  };
}

/** Minutes from festival evening open; after-midnight sets roll into the next calendar morning. */
function festivalStartMinutes(startTime: string): number {
  const minutes = parseTimeToMinutes(startTime);
  return minutes < 18 * 60 ? minutes + 24 * 60 : minutes;
}

const ULTRA_EUROPE_JUL10_SLOTS: Slot[] = [
  slot('MYKRIS', 'main', '20:00'),
  slot('HALO', 'main', '21:05'),
  slot('SUBTRONICS', 'main', '22:10'),
  slot('OLIVER HELDENS', 'main', '23:30'),
  slot('AFROJACK', 'main', '00:50'),
  slot('DJ SNAKE', 'main', '02:10'),
  slot('JOHN SUMMIT', 'main', '03:30'),
  slot('DJ JOCK', 'resistance', '20:00'),
  slot('DEER JADE', 'resistance', '21:30'),
  slot('MISS MONIQUE', 'resistance', '23:00'),
  slot('ADAM BEYER', 'resistance', '01:00'),
  slot('CAMELPHAT', 'resistance', '03:00'),
  slot('TWOFACE', 'umfRadio', '20:00'),
  slot('BLOCK & CROWN', 'umfRadio', '21:00'),
  slot('MIKE & ME', 'umfRadio', '22:00'),
  slot('LORENZO', 'umfRadio', '22:40'),
  slot('MERT AYDIN', 'umfRadio', '23:20'),
  slot('P.O.U.', 'umfRadio', '00:00'),
  slot('YAMATOMAYA', 'umfRadio', '01:00'),
  slot('VINJAZ B2B JIM', 'umfRadio', '02:00'),
  slot('LIA LISSE', 'umfRadio', '03:00'),
  slot('TANK', 'umfRadio', '04:00'),
  slot('SEMERENE', 'oasis', '19:00'),
  slot('LOOKA', 'oasis', '20:00'),
  slot('RYAN NOGAR', 'oasis', '21:00'),
  slot('MATT', 'oasis', '22:00'),
  slot('JAY P', 'oasis', '23:00'),
  slot('NAEMS B2B MASKI & BANGA', 'oasis', '00:00'),
  slot('SIMO & FRANZ', 'oasis', '01:00'),
];

const ULTRA_EUROPE_JUL11_SLOTS: Slot[] = [
  slot('VANILLAZ', 'main', '20:00'),
  slot('DASH BERLIN', 'main', '20:50'),
  slot('MADDIX', 'main', '21:55'),
  slot('WORSHIP', 'main', '23:00'),
  slot('DOM DOLLA', 'main', '00:20'),
  slot('CALVIN HARRIS', 'main', '01:55'),
  slot('HARDWELL', 'main', '03:30'),
  slot('SHIPE', 'resistance', '20:00'),
  slot('MALONE MOREZ', 'resistance', '21:30'),
  slot('BEN STERLING', 'resistance', '23:00'),
  slot('MAU P', 'resistance', '01:00'),
  slot('JAMIE JONES', 'resistance', '03:00'),
  slot('SEANXXX', 'umfRadio', '20:00'),
  slot('WREX', 'umfRadio', '21:00'),
  slot('RESTER', 'umfRadio', '22:00'),
  slot('MIKE BOND', 'umfRadio', '22:40'),
  slot('DJ TORA', 'umfRadio', '23:20'),
  slot('ALE BASCIANO B2B MARCO NINNI', 'umfRadio', '00:00'),
  slot('YAKSA', 'umfRadio', '01:00'),
  slot('CASPER YU B2B JETEGG', 'umfRadio', '02:00'),
  slot('D.LACRUX', 'umfRadio', '03:00'),
  slot('NILES VAN ZANDT', 'umfRadio', '04:00'),
  slot('SEB C', 'oasis', '20:00'),
  slot('AZOOLAND', 'oasis', '21:00'),
  slot('EVAN PIERINI B2B SEAN PARK', 'oasis', '22:00'),
  slot('FRANK JEZ', 'oasis', '23:00'),
  slot('SABERZ', 'oasis', '00:00'),
  slot('BADVICE', 'oasis', '01:00'),
];

const ULTRA_EUROPE_JUL12_SLOTS: Slot[] = [
  slot('KRAUNDLER', 'main', '20:00'),
  slot('PLASTIK FUNK', 'main', '20:50'),
  slot('RAY VOLPE B2B SULLIVAN KING', 'main', '21:55'),
  slot('BUNT.', 'main', '23:15'),
  slot('ARMIN VAN BUUREN', 'main', '00:35'),
  slot('MARTIN GARRIX', 'main', '01:55'),
  slot('FISHER', 'main', '03:30'),
  slot('TOMO IN DER MÜHLEN', 'resistance', '20:00'),
  slot('WILL ATKINSON', 'resistance', '21:30'),
  slot('I HATE MODELS', 'resistance', '23:00'),
  slot('NICO MORENO', 'resistance', '01:00'),
  slot('SARA LANDRY', 'resistance', '03:00'),
  slot('CLIFF VAN DELORT', 'umfRadio', '20:00'),
  slot('JOE2SHINE', 'umfRadio', '21:00'),
  slot('WAGS', 'umfRadio', '22:00'),
  slot('JOWAVES', 'umfRadio', '22:40'),
  slot('MANUALS', 'umfRadio', '23:20'),
  slot('PETTE', 'umfRadio', '00:00'),
  slot('CARLOM B2B ARINNO', 'umfRadio', '01:00'),
  slot('HRT', 'umfRadio', '02:00'),
  slot('KEVU', 'umfRadio', '03:00'),
  slot('DJ MII', 'umfRadio', '04:00'),
  slot('MANDAS', 'oasis', '20:00'),
  slot('CIRILLO JR.', 'oasis', '21:00'),
  slot('MEAGHAN', 'oasis', '22:00'),
  slot('CHARLES B', 'oasis', '23:00'),
  slot('MADISM', 'oasis', '00:00'),
  slot('ALEX PIZZUTI', 'oasis', '01:00'),
];

function resolveStageEndMinutes(slots: Slot[]): Map<string, number> {
  const byStage = new Map<string, Slot[]>();
  for (const entry of slots) {
    const list = byStage.get(entry.stage.id) ?? [];
    list.push(entry);
    byStage.set(entry.stage.id, list);
  }

  const endMinutesBySlot = new Map<string, number>();
  for (const stageSlots of byStage.values()) {
    const ordered = [...stageSlots].sort(
      (left, right) =>
        festivalStartMinutes(left.startTime) -
        festivalStartMinutes(right.startTime),
    );
    for (let index = 0; index < ordered.length; index += 1) {
      const current = ordered[index]!;
      const next = ordered[index + 1];
      const endMinutes = next
        ? festivalStartMinutes(next.startTime)
        : FESTIVAL_CLOSE_MINUTES;
      endMinutesBySlot.set(
        `${current.stage.id}|${current.artistName}|${current.startTime}`,
        endMinutes,
      );
    }
  }

  return endMinutesBySlot;
}

function perf(
  dateKey: string,
  dateLabel: string,
  slot: Slot,
  endMinutesBySlot: Map<string, number>,
) {
  const { artistName, stage, stageKey, startTime } = slot;
  const meta = metaFor(artistName, stageKey);
  const id = artistId(artistName);
  const startMinutes = festivalStartMinutes(startTime);
  const endMinutes =
    endMinutesBySlot.get(`${stage.id}|${artistName}|${startTime}`) ??
    FESTIVAL_CLOSE_MINUTES;

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
    endTime: startTime,
    startMinutes,
    endMinutes,
    popularity: meta.popularity,
    avatarSeed: id,
    genreColor: stage.color,
  };
}

function dayPerformances(dateKey: string, dateLabel: string, slots: Slot[]) {
  const endMinutesBySlot = resolveStageEndMinutes(slots);
  return slots.map((entry) =>
    perf(dateKey, dateLabel, entry, endMinutesBySlot),
  );
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
