import { parseTimeToMinutes } from '@src/modules/itinerary/domain/time-minutes.util';
import { LINEUP_SEED_GENRE_PLACEHOLDER } from './lineup-seed-genre.constants';

export const ITINERARY_808_FESTIVAL_ACTIVITY_LEGACY_ID = 17;

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

const FESTIVAL_CLOSE_MINUTES = 24 * 60; // 00:00 next morning

type Slot = {
  artistName: string;
  stage: StageDef;
  stageKey: keyof typeof STAGES;
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

function festivalStartMinutes(startTime: string): number {
  return parseTimeToMinutes(startTime);
}

const FESTIVAL_808_DEC5_SLOTS: Slot[] = [
  slot('IZECREAM', 'weRaveYou', '16:00'),
  slot('AYRTON L', 'weRaveYou', '17:00'),
  slot('MR.BLACK', 'weRaveYou', '18:00'),
  slot('JULIET FOX B2B MEGURU', 'weRaveYou', '19:00'),
  slot('MARLO', 'weRaveYou', '20:15'),
  slot('MADDIX', 'weRaveYou', '21:30'),
  slot('REINIER ZONNEVELD [LIVE]', 'weRaveYou', '22:45'),
];

const FESTIVAL_808_DEC6_SLOTS: Slot[] = [
  slot('XILLIX', 'main', '16:00'),
  slot('KANSHRIYA', 'main', '17:30'),
  slot('WILLIAM KISS', 'main', '18:45'),
  slot('ODD MOB', 'main', '20:00'),
  slot('SAMMY VIRJI', 'main', '21:15'),
  slot('DOM DOLLA', 'main', '22:30'),
  slot('HEARTBREAKKIDZ B2B PVLMFKC', 'drumcode', '16:00'),
  slot('DI SUN', 'drumcode', '17:30'),
  slot('HNTR', 'drumcode', '18:45'),
  slot('SPACE 92', 'drumcode', '20:00'),
  slot('MASSANO', 'drumcode', '21:15'),
  slot('PAN-POT', 'drumcode', '22:45'),
];

const FESTIVAL_808_DEC7_SLOTS: Slot[] = [
  slot('J-NANA', 'main', '16:00'),
  slot('ATTA B2B SEESOUNDS', 'main', '17:00'),
  slot('NETSKY', 'main', '18:25'),
  slot("MALAA'S ALTER EGO", 'main', '19:30'),
  slot('LUCAS & STEVE', 'main', '20:35'),
  slot('TRYM', 'main', '21:40'),
  slot('CHARLOTTE DE WITTE', 'main', '22:45'),
  slot('LXYN', 'monstercat', '16:00'),
  slot('KAMIKO', 'monstercat', '17:00'),
  slot('OZZY', 'monstercat', '18:00'),
  slot('OOTORO', 'monstercat', '19:00'),
  slot('INZO', 'monstercat', '20:15'),
  slot('HABSTRAKT', 'monstercat', '21:30'),
  slot('WUKI', 'monstercat', '22:45'),
];

function resolveStageEndMinutes(slots: Slot[]): Map<string, number> {
  const endMinutesBySlot = new Map<string, number>();
  const byStage = new Map<string, Slot[]>();

  for (const entry of slots) {
    const list = byStage.get(entry.stage.id) ?? [];
    list.push(entry);
    byStage.set(entry.stage.id, list);
  }

  for (const ordered of byStage.values()) {
    ordered.sort(
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
  slotEntry: Slot,
  endMinutesBySlot: Map<string, number>,
) {
  const { artistName, stage, stageKey, startTime } = slotEntry;
  const meta = metaFor(artistName, stageKey);
  const id = artistId(artistName);
  const startMinutes = festivalStartMinutes(startTime);
  const endMinutes =
    endMinutesBySlot.get(`${stage.id}|${artistName}|${startTime}`) ??
    FESTIVAL_CLOSE_MINUTES;

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

const FESTIVAL_808_DEC5_PERFORMANCES = dayPerformances(
  'dec5',
  '12月5日',
  FESTIVAL_808_DEC5_SLOTS,
);

const FESTIVAL_808_DEC6_PERFORMANCES = dayPerformances(
  'dec6',
  '12月6日',
  FESTIVAL_808_DEC6_SLOTS,
);

const FESTIVAL_808_DEC7_PERFORMANCES = dayPerformances(
  'dec7',
  '12月7日',
  FESTIVAL_808_DEC7_SLOTS,
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
