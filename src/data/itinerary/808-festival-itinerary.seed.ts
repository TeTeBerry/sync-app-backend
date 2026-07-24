import { LINEUP_SEED_GENRE_PLACEHOLDER } from './lineup-seed-genre.constants';

export const ITINERARY_808_FESTIVAL_ACTIVITY_LEGACY_ID = 17;

/** Matches `LINEUP_ONLY_UNPUBLISHED_MINUTES` — keep local to avoid seed↔catalog cycles. */
const UNPUBLISHED_SET_MINUTES = -1;

type StageDef = {
  id: string;
  label: string;
  color: string;
};

const STAGES = {
  weRaveYou: { id: 'main', label: 'We Rave You', color: '#22c55e' },
  main: { id: 'main', label: 'Main Stage', color: '#ff2d55' },
  drumcode: { id: 'drumcode', label: 'Drumcode', color: '#ef4444' },
  monstercat: { id: 'monstercat', label: 'Monstercat', color: '#3b82f6' },
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

function dj(name: string, popularity: number, genreColor: string): ArtistMeta {
  return {
    name,
    genre: LINEUP_SEED_GENRE_PLACEHOLDER,
    genreLabel: LINEUP_SEED_GENRE_PLACEHOLDER,
    popularity,
    genreColor,
  };
}

const FESTIVAL_808_ARTIST_OVERRIDES = new Map<string, ArtistMeta>([
  ['IZECREAM', dj('IZECREAM', 72, '#f472b6')],
  ['AYRTON L', dj('AYRTON L', 78, '#f97316')],
  ['MR.BLACK', dj('MR.BLACK', 88, '#a855f7')],
  ['JULIET FOX B2B MEGURU', dj('JULIET FOX B2B MEGURU', 90, '#7c3aed')],
  ['MARLO', dj('MARLO', 90, '#38bdf8')],
  ['MADDIX', dj('MADDIX', 92, '#ef4444')],
  ['REINIER ZONNEVELD [LIVE]', dj('REINIER ZONNEVELD [LIVE]', 94, '#dc2626')],
  ['XILLIX', dj('XILLIX', 74, '#10b981')],
  ['KANSHRIYA', dj('KANSHRIYA', 76, '#6366f1')],
  ['WILLIAM KISS', dj('WILLIAM KISS', 82, '#818cf8')],
  ['ODD MOB', dj('ODD MOB', 89, '#3b82f6')],
  ['SAMMY VIRJI', dj('SAMMY VIRJI', 88, '#ec4899')],
  ['DOM DOLLA', dj('DOM DOLLA', 95, '#22c55e')],
  [
    'HEARTBREAKKIDZ B2B PVLMFKC',
    dj('HEARTBREAKKIDZ B2B PVLMFKC', 74, '#f43f5e'),
  ],
  ['DI SUN', dj('DI SUN', 84, '#8b5cf6')],
  ['HNTR', dj('HNTR', 83, '#0ea5e9')],
  ['SPACE 92', dj('SPACE 92', 86, '#6366f1')],
  ['MASSANO', dj('MASSANO', 87, '#a855f7')],
  ['PAN-POT', dj('PAN-POT', 91, '#ef4444')],
  ['J-NANA', dj('J-NANA', 80, '#fb7185')],
  ['ATTA B2B SEESOUNDS', dj('ATTA B2B SEESOUNDS', 72, '#14b8a6')],
  ['NETSKY', dj('NETSKY', 93, '#eab308')],
  ["MALAA'S ALTER EGO", dj("MALAA'S ALTER EGO", 88, '#f59e0b')],
  ['LUCAS & STEVE', dj('LUCAS & STEVE', 90, '#60a5fa')],
  ['TRYM', dj('TRYM', 89, '#be123c')],
  ['CHARLOTTE DE WITTE', dj('CHARLOTTE DE WITTE', 96, '#f43f5e')],
  ['LXYN', dj('LXYN', 75, '#22d3ee')],
  ['KAMIKO', dj('KAMIKO', 77, '#06b6d4')],
  ['OZZY', dj('OZZY', 73, '#84cc16')],
  ['OOTORO', dj('OOTORO', 82, '#f97316')],
  ['INZO', dj('INZO', 86, '#8b5cf6')],
  ['HABSTRAKT', dj('HABSTRAKT', 87, '#ec4899')],
  ['WUKI', dj('WUKI', 85, '#d946ef')],
]);

const DEFAULT_BY_STAGE: Record<
  keyof typeof STAGES,
  [popularity: number, genreColor: string]
> = {
  weRaveYou: [78, '#22c55e'],
  main: [78, '#ff2d55'],
  drumcode: [80, '#ef4444'],
  monstercat: [78, '#3b82f6'],
};

function defaultMeta(name: string, stageKey: keyof typeof STAGES): ArtistMeta {
  const [popularity, genreColor] = DEFAULT_BY_STAGE[stageKey];
  return dj(name, popularity, genreColor);
}

function metaFor(name: string, stageKey: keyof typeof STAGES): ArtistMeta {
  return FESTIVAL_808_ARTIST_OVERRIDES.get(name) ?? defaultMeta(name, stageKey);
}

/**
 * Artist + day + stage known from the official drop.
 * Set times are NOT published yet — never invent HH:mm here.
 */
type DaySlot = {
  artistName: string;
  stageKey: keyof typeof STAGES;
};

function slot(artistName: string, stageKey: keyof typeof STAGES): DaySlot {
  return { artistName, stageKey };
}

const FESTIVAL_808_DEC5_SLOTS: DaySlot[] = [
  slot('IZECREAM', 'weRaveYou'),
  slot('AYRTON L', 'weRaveYou'),
  slot('MR.BLACK', 'weRaveYou'),
  slot('JULIET FOX B2B MEGURU', 'weRaveYou'),
  slot('MARLO', 'weRaveYou'),
  slot('MADDIX', 'weRaveYou'),
  slot('REINIER ZONNEVELD [LIVE]', 'weRaveYou'),
];

const FESTIVAL_808_DEC6_SLOTS: DaySlot[] = [
  slot('XILLIX', 'main'),
  slot('KANSHRIYA', 'main'),
  slot('WILLIAM KISS', 'main'),
  slot('ODD MOB', 'main'),
  slot('SAMMY VIRJI', 'main'),
  slot('DOM DOLLA', 'main'),
  slot('HEARTBREAKKIDZ B2B PVLMFKC', 'drumcode'),
  slot('DI SUN', 'drumcode'),
  slot('HNTR', 'drumcode'),
  slot('SPACE 92', 'drumcode'),
  slot('MASSANO', 'drumcode'),
  slot('PAN-POT', 'drumcode'),
];

const FESTIVAL_808_DEC7_SLOTS: DaySlot[] = [
  slot('J-NANA', 'main'),
  slot('ATTA B2B SEESOUNDS', 'main'),
  slot('NETSKY', 'main'),
  slot("MALAA'S ALTER EGO", 'main'),
  slot('LUCAS & STEVE', 'main'),
  slot('TRYM', 'main'),
  slot('CHARLOTTE DE WITTE', 'main'),
  slot('LXYN', 'monstercat'),
  slot('KAMIKO', 'monstercat'),
  slot('OZZY', 'monstercat'),
  slot('OOTORO', 'monstercat'),
  slot('INZO', 'monstercat'),
  slot('HABSTRAKT', 'monstercat'),
  slot('WUKI', 'monstercat'),
];

function perf(dateKey: string, dateLabel: string, slotEntry: DaySlot) {
  const { artistName, stageKey } = slotEntry;
  const stage = STAGES[stageKey];
  const meta = metaFor(artistName, stageKey);
  const id = artistId(artistName);

  return {
    activityLegacyId: ITINERARY_808_FESTIVAL_ACTIVITY_LEGACY_ID,
    dateKey,
    dateLabel,
    artistId: id,
    artistName,
    genre: LINEUP_SEED_GENRE_PLACEHOLDER,
    genreLabel: LINEUP_SEED_GENRE_PLACEHOLDER,
    stage: stage.id,
    stageLabel: stage.label,
    startTime: '',
    endTime: '',
    startMinutes: UNPUBLISHED_SET_MINUTES,
    endMinutes: UNPUBLISHED_SET_MINUTES,
    popularity: meta.popularity,
    avatarSeed: id,
    genreColor: stage.color,
  };
}

const FESTIVAL_808_DEC5_PERFORMANCES = FESTIVAL_808_DEC5_SLOTS.map((entry) =>
  perf('dec5', '12月5日', entry),
);

const FESTIVAL_808_DEC6_PERFORMANCES = FESTIVAL_808_DEC6_SLOTS.map((entry) =>
  perf('dec6', '12月6日', entry),
);

const FESTIVAL_808_DEC7_PERFORMANCES = FESTIVAL_808_DEC7_SLOTS.map((entry) =>
  perf('dec7', '12月7日', entry),
);

const FESTIVAL_808_DATE_META = [
  {
    dateKey: 'dec5',
    label: '12月5日',
    bannerDateLabel: '12月5日',
    sortOrder: 0,
  },
  {
    dateKey: 'dec6',
    label: '12月6日',
    bannerDateLabel: '12月6日',
    sortOrder: 1,
  },
  {
    dateKey: 'dec7',
    label: '12月7日',
    bannerDateLabel: '12月7日',
    sortOrder: 2,
  },
] as const;

export const FESTIVAL_808_FESTIVAL_SESSION_SEED = FESTIVAL_808_DATE_META.map(
  (day) => ({
    activityLegacyId: ITINERARY_808_FESTIVAL_ACTIVITY_LEGACY_ID,
    ...day,
  }),
);

/**
 * Date + stage known; official clock times not published.
 * `schedulePublished` stays false until real HH:mm land in seed.
 */
export const FESTIVAL_808_ARTIST_PERFORMANCE_SEED = [
  ...FESTIVAL_808_DEC5_PERFORMANCES,
  ...FESTIVAL_808_DEC6_PERFORMANCES,
  ...FESTIVAL_808_DEC7_PERFORMANCES,
];

type LineupArtistSeed = ArtistMeta & { stageKey: keyof typeof STAGES };

const uniqueArtists = new Map<string, LineupArtistSeed>();
for (const slotEntry of [
  ...FESTIVAL_808_DEC5_SLOTS,
  ...FESTIVAL_808_DEC6_SLOTS,
  ...FESTIVAL_808_DEC7_SLOTS,
]) {
  if (uniqueArtists.has(slotEntry.artistName)) {
    continue;
  }
  const meta = metaFor(slotEntry.artistName, slotEntry.stageKey);
  uniqueArtists.set(meta.name, { ...meta, stageKey: slotEntry.stageKey });
}

export const FESTIVAL_808_LINEUP_DJ_SEED = [...uniqueArtists.values()].map(
  (artist) => {
    const stage = STAGES[artist.stageKey];
    const id = artistId(artist.name);
    return {
      id,
      name: artist.name,
      genre: artist.genre,
      genreLabel: artist.genreLabel,
      stage: stage.id,
      popularity: artist.popularity,
      avatarSeed: id,
      genreColor: artist.genreColor,
    };
  },
);

export const FESTIVAL_808_ARTIST_NAMES = [...uniqueArtists.keys()];
