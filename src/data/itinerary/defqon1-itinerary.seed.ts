import { parseTimeToMinutes } from '@src/modules/itinerary/domain/time-minutes.util';
import { LINEUP_SEED_GENRE_PLACEHOLDER } from './lineup-seed-genre.constants';
import { DEFQON1_JUN27_ROWS } from './defqon1-jun27-itinerary.seed';
import { DEFQON1_JUN28_ROWS } from './defqon1-jun28-itinerary.seed';

export const ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID = 2;

type StageDef = {
  id: string;
  label: string;
  color: string;
};

const STAGES = {
  blue: { id: 'blue', label: 'Blue', color: '#38bdf8' },
  black: { id: 'black', label: 'Black', color: '#6b7280' },
  indigo: { id: 'indigo', label: 'Indigo', color: '#a78bfa' },
  brownSilent: {
    id: 'brown-silent',
    label: 'Brown - Silent',
    color: '#d97706',
  },
  magentaSilent: {
    id: 'magenta-silent',
    label: 'Magenta - Silent',
    color: '#ec4899',
  },
  stampkroeg: { id: 'stampkroeg', label: 'Stampkroeg', color: '#fcd34d' },
  red: { id: 'red', label: 'Red', color: '#ef4444' },
  uv: { id: 'uv', label: 'UV', color: '#a855f7' },
  magenta: { id: 'magenta', label: 'Magenta', color: '#f472b6' },
  green: { id: 'green', label: 'Green', color: '#22c55e' },
  yellow: { id: 'yellow', label: 'Yellow', color: '#eab308' },
  gold: { id: 'gold', label: 'Gold', color: '#f59e0b' },
  orange: { id: 'orange', label: 'Orange', color: '#f97316' },
  purple: { id: 'purple', label: 'Purple', color: '#8b5cf6' },
  stampkroegLarstig: {
    id: 'stampkroeg-larstig',
    label: 'Stampkroeg - Larstig & Gasdrop',
    color: '#d97706',
  },
  silver: { id: 'silver', label: 'Silver', color: '#94a3b8' },
  stampkroegDikkeBaap: {
    id: 'stampkroeg-dikke-baap',
    label: 'Stampkroeg - Dikke Baap',
    color: '#fdba74',
  },
  blueNight: { id: 'blue-night', label: 'Blue Night', color: '#1d4ed8' },
  magentaNightSilent: {
    id: 'magenta-night-silent',
    label: 'Magenta Night [Silent]',
    color: '#be185d',
  },
  stampkroegNight: {
    id: 'stampkroeg-night',
    label: 'Stampkroeg Night',
    color: '#ca8a04',
  },
  pink: { id: 'pink', label: 'Pink', color: '#f9a8d4' },
  stampkroegBassbrain: {
    id: 'stampkroeg-bassbrain',
    label: 'Stampkroeg - Bassbrain',
    color: '#fb923c',
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

function defaultMeta(name: string): ArtistMeta {
  return dj(name, '', '', 78, '#94a3b8');
}

/** Explicit metadata for headliners / multi-day returning acts. */
const DEFQON1_ARTIST_OVERRIDES = new Map<string, ArtistMeta>([
  ['COONE', dj('COONE', 'Hardstyle', 'Hardstyle · Rawstyle', 91, '#fbbf24')],
  [
    'DJ ISAAC',
    dj('DJ ISAAC', 'Hardstyle', 'Hardstyle · Rawstyle', 90, '#0ea5e9'),
  ],
  ['REJECTA', dj('REJECTA', 'Hardcore', 'Rawstyle · Hardcore', 88, '#7c3aed')],
  ['ANIME', dj('ANIME', 'Hardstyle', 'Hardstyle · Hard Dance', 84, '#f97316')],
  ['CRYEX', dj('CRYEX', 'Hardcore', 'Rawstyle · Hardcore', 84, '#a78bfa')],
  ['RANSOM', dj('RANSOM', 'House', 'Tech House · Melodic', 78, '#d97706')],
  [
    "PLUG 'N PLAY",
    dj("PLUG 'N PLAY", 'Hardstyle', 'Hardstyle · Classics', 80, '#ea580c'),
  ],
  [
    'LARSTIG & GASDROP',
    dj('LARSTIG & GASDROP', 'Hardstyle', 'Hardstyle · Raw', 82, '#db2777'),
  ],
  [
    'ANGERFIST',
    dj('ANGERFIST', 'Hardcore', 'Hardcore · Industrial', 94, '#1f2937'),
  ],
  [
    'DR. PEACOCK',
    dj('DR. PEACOCK', 'Hardcore', 'Frenchcore · Hardcore', 90, '#4b5563'),
  ],
  [
    'DA TWEEKAZ',
    dj('DA TWEEKAZ', 'Hardstyle', 'Hardstyle · Euphoric', 89, '#ef4444'),
  ],
  [
    'SUB ZERO PROJECT',
    dj('SUB ZERO PROJECT', 'Hardstyle', 'Hardstyle · Raw', 92, '#dc2626'),
  ],
  [
    'SOUND RUSH',
    dj('SOUND RUSH', 'Hardstyle', 'Hardstyle · Euphoric', 90, '#f472b6'),
  ],
  [
    'BRENNAN HEART',
    dj('BRENNAN HEART', 'Hardstyle', 'Hardstyle', 91, '#f59e0b'),
  ],
  [
    'NOISECONTROLLERS',
    dj('NOISECONTROLLERS', 'Hardstyle', 'Hardstyle · Classics', 90, '#8b5cf6'),
  ],
  ['ARGY', dj('ARGY', 'Techno', 'Melodic Techno', 87, '#22d3ee')],
  ['THE VIPER', dj('THE VIPER', 'Hardcore', 'Hardcore · Early', 88, '#f59e0b')],
  [
    'WILL ATKINSON',
    dj('WILL ATKINSON', 'Trance', 'Uplifting Trance', 89, '#38bdf8'),
  ],
  ['MARCEL WOODS', dj('MARCEL WOODS', 'Trance', 'Tech Trance', 86, '#60a5fa')],
  [
    'ALPHA TWINS',
    dj('ALPHA TWINS', 'Hardstyle', 'Hardstyle · Classics', 85, '#ec4899'),
  ],
  [
    'CHARLIE SPARKS',
    dj('CHARLIE SPARKS', 'Techno', 'Hard Techno', 84, '#22c55e'),
  ],
  ['E-FORCE', dj('E-FORCE', 'Hardstyle', 'Hardstyle · Raw', 87, '#3b82f6')],
  [
    'PHUTURE NOIZE',
    dj('PHUTURE NOIZE', 'Hardstyle', 'Hardstyle · Raw', 90, '#1d4ed8'),
  ],
  [
    'SHOWTEK',
    dj('SHOWTEK', 'Hardstyle', 'Hardstyle · Big Room', 93, '#f472b6'),
  ],
  ['VERTILE', dj('VERTILE', 'Hardstyle', 'Hardstyle · Raw', 92, '#ec4899')],
  [
    'WILDSTYLEZ',
    dj('WILDSTYLEZ', 'Hardstyle', 'Hardstyle · Euphoric', 91, '#a855f7'),
  ],
  [
    'FRONTLINER',
    dj('FRONTLINER', 'Hardstyle', 'Hardstyle · Euphoric', 90, '#ef4444'),
  ],
  [
    'HARD DRIVER',
    dj('HARD DRIVER', 'Hardstyle', 'Hardstyle · Raw', 88, '#38bdf8'),
  ],
  ['ROOLER', dj('ROOLER', 'Hardstyle', 'Hardstyle · Raw', 91, '#2563eb')],
  ['WARFACE', dj('WARFACE', 'Hardstyle', 'Hardstyle · Raw', 90, '#1e40af')],
  ['B-FRONT', dj('B-FRONT', 'Hardstyle', 'Hardstyle · Raw', 89, '#3b82f6')],
  ['ENDYMION', dj('ENDYMION', 'Hardcore', 'Hardcore · Early', 88, '#4b5563')],
  ['KORSAKOFF', dj('KORSAKOFF', 'Hardcore', 'Hardcore · Early', 87, '#6b7280')],
  [
    'GUNZ FOR HIRE - XV THE UNDERGROUND KINGS',
    dj('GUNZ FOR HIRE', 'Hardstyle', 'Hardstyle · Raw', 93, '#db2777'),
  ],
  ['KRUELTY', dj('KRUELTY', 'Hardcore', 'Uptempo · Hardcore', 86, '#7c3aed')],
  [
    'PAUL ELSTAK',
    dj('PAUL ELSTAK', 'Hardcore', 'Hardcore · Early', 85, '#a855f7'),
  ],
]);

function metaFor(name: string): ArtistMeta {
  return DEFQON1_ARTIST_OVERRIDES.get(name) ?? defaultMeta(name);
}

type PerfInput = {
  dateKey: string;
  dateLabel: string;
  artistName: string;
  stage: StageDef;
  startTime: string;
  endTime: string;
};

function perf({
  dateKey,
  dateLabel,
  artistName,
  stage,
  startTime,
  endTime,
}: PerfInput) {
  const meta = metaFor(artistName);
  const id = artistId(artistName);
  const startMinutes = parseTimeToMinutes(startTime);
  let endMinutes = parseTimeToMinutes(endTime);
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }
  return {
    activityLegacyId: ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID,
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

type Slot = {
  artistName: string;
  stage: StageDef;
  startTime: string;
  endTime: string;
};

function dayPerformances(dateKey: string, dateLabel: string, slots: Slot[]) {
  return slots.map((slot) => perf({ dateKey, dateLabel, ...slot }));
}

const DEFQON1_DAY1_SLOTS: Slot[] = [
  {
    artistName: 'D-STURB',
    stage: STAGES.blue,
    startTime: '18:00',
    endTime: '19:00',
  },
  {
    artistName: 'DJ ISAAC',
    stage: STAGES.blue,
    startTime: '19:00',
    endTime: '20:00',
  },
  {
    artistName: 'COONE',
    stage: STAGES.blue,
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'RAN-D & ADARO',
    stage: STAGES.blue,
    startTime: '21:00',
    endTime: '21:50',
  },
  {
    artistName: 'D-BLOCK & S-TE-FAN',
    stage: STAGES.blue,
    startTime: '21:50',
    endTime: '22:55',
  },
  {
    artistName: 'MISS K8',
    stage: STAGES.black,
    startTime: '18:00',
    endTime: '19:00',
  },
  {
    artistName: 'EVIL ACTIVITIES',
    stage: STAGES.black,
    startTime: '19:00',
    endTime: '20:00',
  },
  {
    artistName: 'ANIME',
    stage: STAGES.black,
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'GEZELLIGE UPTEMPO',
    stage: STAGES.black,
    startTime: '21:00',
    endTime: '21:45',
  },
  {
    artistName: 'NOXIOUZ',
    stage: STAGES.black,
    startTime: '21:45',
    endTime: '22:30',
  },
  {
    artistName: 'THE SPOTLIGHT WITH HYSTA',
    stage: STAGES.black,
    startTime: '22:30',
    endTime: '23:00',
  },
  {
    artistName: 'CRYEX',
    stage: STAGES.indigo,
    startTime: '18:00',
    endTime: '18:45',
  },
  {
    artistName: 'DELUZION',
    stage: STAGES.indigo,
    startTime: '18:45',
    endTime: '19:30',
  },
  {
    artistName: 'REJECTA',
    stage: STAGES.indigo,
    startTime: '19:30',
    endTime: '20:15',
  },
  {
    artistName: 'MUTILATOR & ADJUZT',
    stage: STAGES.indigo,
    startTime: '20:15',
    endTime: '21:15',
  },
  {
    artistName: 'FACELESS, SANCTUARY & DARK ENTITIES',
    stage: STAGES.indigo,
    startTime: '21:15',
    endTime: '22:00',
  },
  {
    artistName: 'SPITNOISE & UNLOCKED',
    stage: STAGES.indigo,
    startTime: '22:00',
    endTime: '23:00',
  },
  {
    artistName: 'RANSOM',
    stage: STAGES.brownSilent,
    startTime: '18:00',
    endTime: '19:30',
  },
  {
    artistName: 'RICARDO MORENO',
    stage: STAGES.brownSilent,
    startTime: '19:30',
    endTime: '21:00',
  },
  {
    artistName: "PLUG 'N PLAY",
    stage: STAGES.brownSilent,
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'THE RAVER',
    stage: STAGES.brownSilent,
    startTime: '22:00',
    endTime: '23:00',
  },
  {
    artistName: 'ANDY SVGE',
    stage: STAGES.magentaSilent,
    startTime: '18:00',
    endTime: '19:30',
  },
  {
    artistName: 'LARSTIG & GASDROP',
    stage: STAGES.magentaSilent,
    startTime: '19:30',
    endTime: '21:00',
  },
  {
    artistName: 'DR. RUDE "JUMP CLASSICS"',
    stage: STAGES.magentaSilent,
    startTime: '21:00',
    endTime: '22:15',
  },
  {
    artistName: 'ACT OF RAGE & ADRENALIZE',
    stage: STAGES.magentaSilent,
    startTime: '22:15',
    endTime: '23:15',
  },
  {
    artistName: 'DEEPACK',
    stage: STAGES.magentaSilent,
    startTime: '23:15',
    endTime: '00:30',
  },
  {
    artistName: 'GOLDSCHOOL WITH FRIENDS',
    stage: STAGES.magentaSilent,
    startTime: '00:30',
    endTime: '02:00',
  },
  {
    artistName: 'CRO & Steenwolk',
    stage: STAGES.stampkroeg,
    startTime: '18:00',
    endTime: '19:30',
  },
  {
    artistName: 'RuneScape Rave',
    stage: STAGES.stampkroeg,
    startTime: '19:30',
    endTime: '21:00',
  },
  {
    artistName: 'Peygan',
    stage: STAGES.stampkroeg,
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'Wheel of madness: Lost Shepherds',
    stage: STAGES.stampkroeg,
    startTime: '23:00',
    endTime: '23:45',
  },
  {
    artistName: 'No feest, no glory: Alaafrobros',
    stage: STAGES.stampkroeg,
    startTime: '23:45',
    endTime: '00:30',
  },
  {
    artistName: 'Freddy Chaserz',
    stage: STAGES.stampkroeg,
    startTime: '00:30',
    endTime: '01:15',
  },
  {
    artistName: 'Wasted Melodies: Special Krew',
    stage: STAGES.stampkroeg,
    startTime: '01:15',
    endTime: '02:00',
  },
];

/** Defqon.1 2026 Day 2 (Friday 6/26) — Red / Blue / Black / UV / Magenta / Green / Yellow / Gold / Orange / Purple / Stampkroeg. */
const DEFQON1_DAY2_SLOTS: Slot[] = [
  {
    artistName: 'THE OPENING CEREMONY WITH OUTSIDERS',
    stage: STAGES.red,
    startTime: '13:00',
    endTime: '14:00',
  },
  {
    artistName: 'JAY REEVE & ECSTATIC FT SYNERGY',
    stage: STAGES.red,
    startTime: '14:00',
    endTime: '15:00',
  },
  {
    artistName: 'THE PURGE & MANDY',
    stage: STAGES.red,
    startTime: '15:00',
    endTime: '16:00',
  },
  {
    artistName: 'THE STRAIKERZ "ALL ON RED"',
    stage: STAGES.red,
    startTime: '16:00',
    endTime: '16:30',
  },
  {
    artistName: 'DA TWEEKAZ',
    stage: STAGES.red,
    startTime: '16:30',
    endTime: '17:15',
  },
  {
    artistName: 'REJECTA & ADARO',
    stage: STAGES.red,
    startTime: '17:15',
    endTime: '18:00',
  },
  {
    artistName: 'TESTAROSSA',
    stage: STAGES.red,
    startTime: '18:00',
    endTime: '18:30',
  },
  {
    artistName: 'WARFACE X RESTRICTED',
    stage: STAGES.red,
    startTime: '18:30',
    endTime: '19:15',
  },
  {
    artistName: "CHAIN REACTION & LUNA 'THE CLASSIC JOURNEY'",
    stage: STAGES.blue,
    startTime: '11:00',
    endTime: '12:15',
  },
  {
    artistName: 'KRONOS: CHOOSE YOUR ERA',
    stage: STAGES.blue,
    startTime: '12:15',
    endTime: '13:15',
  },
  {
    artistName: 'DIGITAL PUNK',
    stage: STAGES.blue,
    startTime: '13:15',
    endTime: '14:00',
  },
  {
    artistName: 'B-FRONTLINER',
    stage: STAGES.blue,
    startTime: '14:00',
    endTime: '14:30',
  },
  {
    artistName: 'E-FORCE & WOLV',
    stage: STAGES.blue,
    startTime: '14:30',
    endTime: '15:30',
  },
  {
    artistName: 'DEVIN WILD - AMONG THE NOISE',
    stage: STAGES.blue,
    startTime: '15:30',
    endTime: '16:00',
  },
  {
    artistName: 'HOLY PRIEST',
    stage: STAGES.blue,
    startTime: '16:00',
    endTime: '16:45',
  },
  {
    artistName: 'END OF LINE: CRYEX, BLOODLUST & OMNYA',
    stage: STAGES.blue,
    startTime: '16:45',
    endTime: '17:45',
  },
  {
    artistName: 'THE SAINTS',
    stage: STAGES.blue,
    startTime: '17:45',
    endTime: '18:45',
  },
  {
    artistName: 'AVERSION',
    stage: STAGES.blue,
    startTime: '18:45',
    endTime: '19:30',
  },
  {
    artistName: 'MUTILATOR',
    stage: STAGES.blue,
    startTime: '19:30',
    endTime: '20:15',
  },
  {
    artistName: 'RADICAL REDEMPTION "THE RETURN TO THE TRIBE"',
    stage: STAGES.blue,
    startTime: '20:15',
    endTime: '21:15',
  },
  {
    artistName: 'UNRESOLVED',
    stage: STAGES.blue,
    startTime: '21:15',
    endTime: '22:00',
  },
  {
    artistName: 'NOISEFLOW & CYBER GUNZ & SCHLOT PRESENTS THE GREAT KRACH SHOW',
    stage: STAGES.black,
    startTime: '11:00',
    endTime: '12:30',
  },
  {
    artistName: 'RESTRAINED',
    stage: STAGES.black,
    startTime: '12:30',
    endTime: '13:30',
  },
  {
    artistName: 'NAMARA',
    stage: STAGES.black,
    startTime: '13:30',
    endTime: '14:45',
  },
  {
    artistName: 'THA PLAYAH & NEVER SURRENDER',
    stage: STAGES.black,
    startTime: '14:45',
    endTime: '16:00',
  },
  {
    artistName: 'EZG - MAXIMAAL!',
    stage: STAGES.black,
    startTime: '16:00',
    endTime: '16:30',
  },
  {
    artistName: 'BULLETPROOF',
    stage: STAGES.black,
    startTime: '16:30',
    endTime: '17:30',
  },
  {
    artistName: 'ANGERFIST',
    stage: STAGES.black,
    startTime: '17:30',
    endTime: '18:30',
  },
  {
    artistName: 'DR. PEACOCK',
    stage: STAGES.black,
    startTime: '18:30',
    endTime: '19:30',
  },
  {
    artistName: 'PARTYRASER',
    stage: STAGES.black,
    startTime: '19:30',
    endTime: '20:30',
  },
  {
    artistName: 'SLAUGHTERHOUSE',
    stage: STAGES.black,
    startTime: '20:30',
    endTime: '21:15',
  },
  {
    artistName: 'NOISEFLOW',
    stage: STAGES.black,
    startTime: '21:15',
    endTime: '22:15',
  },
  {
    artistName: 'ROSBEEK & MANIFEST DESTINY',
    stage: STAGES.black,
    startTime: '22:15',
    endTime: '23:00',
  },
  {
    artistName: 'THIS IS SEFA',
    stage: STAGES.uv,
    startTime: '11:30',
    endTime: '12:30',
  },
  {
    artistName: 'ANAMORPHIC',
    stage: STAGES.uv,
    startTime: '12:30',
    endTime: '13:30',
  },
  {
    artistName: 'MAXTREME',
    stage: STAGES.uv,
    startTime: '13:30',
    endTime: '14:30',
  },
  {
    artistName: 'USED CROSSOVER SET',
    stage: STAGES.uv,
    startTime: '14:30',
    endTime: '15:30',
  },
  {
    artistName: 'SOLSTICE',
    stage: STAGES.uv,
    startTime: '15:30',
    endTime: '16:15',
  },
  {
    artistName: 'AUDIOFREQ',
    stage: STAGES.uv,
    startTime: '16:15',
    endTime: '17:00',
  },
  {
    artistName: 'MORE KORDS PRESENTS ZAAGPHORIC',
    stage: STAGES.uv,
    startTime: '17:00',
    endTime: '17:45',
  },
  {
    artistName: 'KUTSKI & GAMMER',
    stage: STAGES.uv,
    startTime: '17:45',
    endTime: '18:45',
  },
  {
    artistName: 'ATMOZFEARS',
    stage: STAGES.uv,
    startTime: '18:45',
    endTime: '19:45',
  },
  {
    artistName: 'TONESHIFTERZ',
    stage: STAGES.uv,
    startTime: '19:45',
    endTime: '20:30',
  },
  {
    artistName: 'NOISECONTROLLERS TWO DECADES',
    stage: STAGES.uv,
    startTime: '20:30',
    endTime: '21:30',
  },
  {
    artistName: 'BASS SHOCK (BASS MODULATORS & AFTERSHOCK)',
    stage: STAGES.uv,
    startTime: '21:30',
    endTime: '22:15',
  },
  {
    artistName: 'ARTIC',
    stage: STAGES.magenta,
    startTime: '11:00',
    endTime: '12:00',
  },
  {
    artistName: 'ALPHA TWINS',
    stage: STAGES.magenta,
    startTime: '12:00',
    endTime: '13:00',
  },
  {
    artistName: 'OUTBREAK',
    stage: STAGES.magenta,
    startTime: '13:00',
    endTime: '14:00',
  },
  {
    artistName: "SUB SONIK 'MY TRUE DNA'",
    stage: STAGES.magenta,
    startTime: '14:00',
    endTime: '15:00',
  },
  {
    artistName: 'BASS CHASERZ - DE REÜNIE',
    stage: STAGES.magenta,
    startTime: '15:00',
    endTime: '16:00',
  },
  {
    artistName: 'JASON PAYNE PRESENTS GOLDSCHOOL',
    stage: STAGES.magenta,
    startTime: '16:00',
    endTime: '17:00',
  },
  {
    artistName: 'CRYPSIS',
    stage: STAGES.magenta,
    startTime: '17:00',
    endTime: '18:00',
  },
  {
    artistName: 'E-FORCE',
    stage: STAGES.magenta,
    startTime: '18:00',
    endTime: '19:00',
  },
  {
    artistName: 'REGAIN',
    stage: STAGES.magenta,
    startTime: '19:00',
    endTime: '19:45',
  },
  {
    artistName: 'DARREN STYLES',
    stage: STAGES.magenta,
    startTime: '19:15',
    endTime: '20:00',
  },
  {
    artistName: 'SOUND RUSH',
    stage: STAGES.magenta,
    startTime: '20:00',
    endTime: '20:45',
  },
  {
    artistName: 'SUB ZERO PROJECT',
    stage: STAGES.magenta,
    startTime: '20:45',
    endTime: '21:45',
  },
  {
    artistName: 'SICKMODE',
    stage: STAGES.magenta,
    startTime: '21:45',
    endTime: '22:20',
  },
  {
    artistName: 'THE SPOTLIGHT WITH BRENNAN HEART',
    stage: STAGES.magenta,
    startTime: '22:20',
    endTime: '23:00',
  },
  {
    artistName: 'STANNE',
    stage: STAGES.green,
    startTime: '11:00',
    endTime: '12:00',
  },
  {
    artistName: 'ACTIVATOR (A.K.A T78) & A*S*Y*S',
    stage: STAGES.green,
    startTime: '12:00',
    endTime: '13:00',
  },
  {
    artistName: 'AREA ØNE',
    stage: STAGES.green,
    startTime: '13:00',
    endTime: '14:00',
  },
  {
    artistName: 'MANJI',
    stage: STAGES.green,
    startTime: '14:00',
    endTime: '15:00',
  },
  {
    artistName: 'XRTN',
    stage: STAGES.green,
    startTime: '15:00',
    endTime: '16:00',
  },
  {
    artistName: 'CHARLIE SPARKS',
    stage: STAGES.green,
    startTime: '16:00',
    endTime: '17:00',
  },
  {
    artistName: 'ANIME & JAZZY',
    stage: STAGES.green,
    startTime: '17:00',
    endTime: '18:00',
  },
  {
    artistName: 'ONLYNUMBERS',
    stage: STAGES.green,
    startTime: '18:00',
    endTime: '19:00',
  },
  {
    artistName: 'VIEZE ASBAK',
    stage: STAGES.green,
    startTime: '19:00',
    endTime: '20:00',
  },
  {
    artistName: 'IMHAPPY',
    stage: STAGES.green,
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'BLNK',
    stage: STAGES.green,
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'JO3Y3T',
    stage: STAGES.green,
    startTime: '22:00',
    endTime: '23:00',
  },
  {
    artistName: 'VANDAL',
    stage: STAGES.yellow,
    startTime: '11:00',
    endTime: '12:00',
  },
  {
    artistName: 'CRYOGENIC & SPIADY',
    stage: STAGES.yellow,
    startTime: '12:00',
    endTime: '13:00',
  },
  {
    artistName: 'ARADIA',
    stage: STAGES.yellow,
    startTime: '13:00',
    endTime: '13:45',
  },
  {
    artistName: 'DOUBLE TROUBLE',
    stage: STAGES.yellow,
    startTime: '13:45',
    endTime: '14:30',
  },
  {
    artistName: 'DORIS',
    stage: STAGES.yellow,
    startTime: '14:30',
    endTime: '15:15',
  },
  {
    artistName: 'T.M.O.',
    stage: STAGES.yellow,
    startTime: '15:15',
    endTime: '16:00',
  },
  {
    artistName: "THE SICKEST SQUAD & D'ORT",
    stage: STAGES.yellow,
    startTime: '16:00',
    endTime: '17:00',
  },
  {
    artistName: 'COMPLEX',
    stage: STAGES.yellow,
    startTime: '17:00',
    endTime: '18:00',
  },
  {
    artistName: 'THAROZA - LIVE OR DIE',
    stage: STAGES.yellow,
    startTime: '18:00',
    endTime: '18:30',
  },
  {
    artistName: 'REMZCORE',
    stage: STAGES.yellow,
    startTime: '18:30',
    endTime: '19:30',
  },
  {
    artistName: 'SAMYNATOR & UDOW',
    stage: STAGES.yellow,
    startTime: '19:30',
    endTime: '20:30',
  },
  {
    artistName: 'THARKEN',
    stage: STAGES.yellow,
    startTime: '20:30',
    endTime: '21:15',
  },
  {
    artistName: '99PRBLMZ',
    stage: STAGES.yellow,
    startTime: '21:15',
    endTime: '22:00',
  },
  {
    artistName: 'MISS MONICA',
    stage: STAGES.gold,
    startTime: '12:00',
    endTime: '13:00',
  },
  {
    artistName: 'PARTY ANIMALS VS FLAMMAN & ABRAXAS',
    stage: STAGES.gold,
    startTime: '13:00',
    endTime: '14:00',
  },
  {
    artistName: 'DJ ROB & MC JOE',
    stage: STAGES.gold,
    startTime: '14:00',
    endTime: '15:00',
  },
  {
    artistName: 'VINCE & DJ RUFFIAN',
    stage: STAGES.gold,
    startTime: '15:00',
    endTime: '16:00',
  },
  {
    artistName: 'DUNE',
    stage: STAGES.gold,
    startTime: '16:00',
    endTime: '17:00',
  },
  {
    artistName: 'MARC ACARDIPANE',
    stage: STAGES.gold,
    startTime: '17:00',
    endTime: '18:00',
  },
  {
    artistName: 'AMNESYS X NICO & TETTA',
    stage: STAGES.gold,
    startTime: '18:00',
    endTime: '19:00',
  },
  {
    artistName: 'THE VIPER',
    stage: STAGES.gold,
    startTime: '19:00',
    endTime: '20:00',
  },
  {
    artistName: 'NOIZE SUPPRESSOR',
    stage: STAGES.gold,
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'DESTRUCTIVE TENDENCIES',
    stage: STAGES.gold,
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'DJ THERA PRES. TRANCEPARENCY',
    stage: STAGES.orange,
    startTime: '11:00',
    endTime: '12:00',
  },
  {
    artistName: 'MARCEL WOODS',
    stage: STAGES.orange,
    startTime: '12:00',
    endTime: '13:00',
  },
  {
    artistName: 'OLIVE ANGUZ',
    stage: STAGES.orange,
    startTime: '13:00',
    endTime: '13:45',
  },
  {
    artistName: 'PANTEROS666',
    stage: STAGES.orange,
    startTime: '13:45',
    endTime: '14:45',
  },
  {
    artistName: 'DAVID FORBES',
    stage: STAGES.orange,
    startTime: '14:45',
    endTime: '15:45',
  },
  {
    artistName: 'WILL ATKINSON',
    stage: STAGES.orange,
    startTime: '15:45',
    endTime: '17:00',
  },
  {
    artistName: 'GECK-O "THE SOUL SHAKER"',
    stage: STAGES.orange,
    startTime: '17:00',
    endTime: '18:30',
  },
  {
    artistName: 'UBERJAKD',
    stage: STAGES.orange,
    startTime: '18:30',
    endTime: '20:00',
  },
  {
    artistName: 'ARGY',
    stage: STAGES.orange,
    startTime: '20:00',
    endTime: '21:00',
  },
  {
    artistName: 'STEVE HILL & FRANCESCO ZETA',
    stage: STAGES.orange,
    startTime: '21:00',
    endTime: '22:00',
  },
  {
    artistName: 'PLUS+',
    stage: STAGES.purple,
    startTime: '12:00',
    endTime: '13:00',
  },
  {
    artistName: 'RED RACE #4',
    stage: STAGES.purple,
    startTime: '13:00',
    endTime: '13:45',
  },
  {
    artistName: 'ARK8',
    stage: STAGES.purple,
    startTime: '13:45',
    endTime: '14:30',
  },
  {
    artistName: 'RED RACE #2',
    stage: STAGES.purple,
    startTime: '14:30',
    endTime: '15:15',
  },
  {
    artistName: 'SIMOX',
    stage: STAGES.purple,
    startTime: '15:15',
    endTime: '16:00',
  },
  {
    artistName: 'DISTRESS',
    stage: STAGES.purple,
    startTime: '16:00',
    endTime: '16:45',
  },
  {
    artistName: 'NOCTURNAL',
    stage: STAGES.purple,
    startTime: '16:45',
    endTime: '17:30',
  },
  {
    artistName: 'NEXOR',
    stage: STAGES.purple,
    startTime: '17:30',
    endTime: '18:15',
  },
  {
    artistName: 'RESILIENCE & REFOLD',
    stage: STAGES.purple,
    startTime: '18:15',
    endTime: '19:00',
  },
  {
    artistName: 'MODESTO',
    stage: STAGES.purple,
    startTime: '19:00',
    endTime: '19:45',
  },
  {
    artistName: 'HARDERCLASS HARDCORE CONTEST',
    stage: STAGES.purple,
    startTime: '19:45',
    endTime: '20:30',
  },
  {
    artistName: 'RAYZEN',
    stage: STAGES.purple,
    startTime: '20:30',
    endTime: '21:15',
  },
  {
    artistName: 'HETZKINEN',
    stage: STAGES.purple,
    startTime: '21:15',
    endTime: '22:00',
  },
  {
    artistName: 'ONESIE BRIGADE',
    stage: STAGES.stampkroegLarstig,
    startTime: '12:00',
    endTime: '12:30',
  },
  {
    artistName: 'LOUD & FOUT',
    stage: STAGES.stampkroegLarstig,
    startTime: '12:30',
    endTime: '13:00',
  },
  {
    artistName: 'COENFETTI',
    stage: STAGES.stampkroegLarstig,
    startTime: '13:00',
    endTime: '13:30',
  },
  {
    artistName: 'FEESTNATION',
    stage: STAGES.stampkroegLarstig,
    startTime: '13:30',
    endTime: '14:15',
  },
  {
    artistName: 'OTTO WUNDERBAR',
    stage: STAGES.stampkroegLarstig,
    startTime: '14:15',
    endTime: '14:45',
  },
  {
    artistName: 'SEBASTIAN BRONK',
    stage: STAGES.stampkroegLarstig,
    startTime: '14:45',
    endTime: '15:30',
  },
  {
    artistName: "RANSOM X PLUG 'N PLAY",
    stage: STAGES.stampkroegLarstig,
    startTime: '15:30',
    endTime: '16:30',
  },
  {
    artistName: "GLADJAKKERS - ONMEUING BREKK'N",
    stage: STAGES.stampkroegLarstig,
    startTime: '16:30',
    endTime: '17:00',
  },
  {
    artistName: 'TONY STAR',
    stage: STAGES.stampkroegLarstig,
    startTime: '17:00',
    endTime: '17:45',
  },
  {
    artistName: 'ESSOCIAAL',
    stage: STAGES.stampkroegLarstig,
    startTime: '17:45',
    endTime: '18:30',
  },
  {
    artistName: 'A-MOTION VS JASON PAYNE - GOLDSCHOOL MIEN LEEM',
    stage: STAGES.stampkroegLarstig,
    startTime: '18:30',
    endTime: '19:30',
  },
  {
    artistName: 'LARSTIG & GASDROP X FEEST MODULATORS',
    stage: STAGES.stampkroegLarstig,
    startTime: '19:30',
    endTime: '20:15',
  },
  {
    artistName: 'RENÉ LE BLANC PRES. DEFQON.1 LE BLANC',
    stage: STAGES.stampkroegLarstig,
    startTime: '20:15',
    endTime: '20:30',
  },
  {
    artistName:
      'PURE CHAOS MET LARSTIG & GASDROP X BASS CHASERZ X DR. RUDE X HANS GLOCK',
    stage: STAGES.stampkroegLarstig,
    startTime: '20:30',
    endTime: '22:00',
  },
];

const DEFQON1_DAY1_PERFORMANCES = dayPerformances(
  'jun25',
  '6月25日',
  DEFQON1_DAY1_SLOTS,
);
const DEFQON1_DAY2_PERFORMANCES = dayPerformances(
  'jun26',
  '6月26日',
  DEFQON1_DAY2_SLOTS,
);

const DEFQON1_DAY3_SLOTS: Slot[] = DEFQON1_JUN27_ROWS.map(
  ([artistName, stageKey, startTime, endTime]) => ({
    artistName,
    stage: STAGES[stageKey as keyof typeof STAGES],
    startTime,
    endTime,
  }),
);
const DEFQON1_DAY3_PERFORMANCES = dayPerformances(
  'jun27',
  '6月27日',
  DEFQON1_DAY3_SLOTS,
);

const DEFQON1_DAY4_SLOTS: Slot[] = DEFQON1_JUN28_ROWS.map(
  ([artistName, stageKey, startTime, endTime]) => ({
    artistName,
    stage: STAGES[stageKey as keyof typeof STAGES],
    startTime,
    endTime,
  }),
);
const DEFQON1_DAY4_PERFORMANCES = dayPerformances(
  'jun28',
  '6月28日',
  DEFQON1_DAY4_SLOTS,
);

const DEFQON1_DATE_META = [
  {
    dateKey: 'jun25',
    label: '6月25日',
    bannerDateLabel: '6月25日',
    sortOrder: 0,
  },
  {
    dateKey: 'jun26',
    label: '6月26日',
    bannerDateLabel: '6月26日',
    sortOrder: 1,
  },
  {
    dateKey: 'jun27',
    label: '6月27日',
    bannerDateLabel: '6月27日',
    sortOrder: 2,
  },
  {
    dateKey: 'jun28',
    label: '6月28日',
    bannerDateLabel: '6月28日',
    sortOrder: 3,
  },
] as const;

export const DEFQON1_FESTIVAL_SESSION_SEED = DEFQON1_DATE_META.map((day) => ({
  activityLegacyId: ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID,
  ...day,
}));

const ALL_SLOT_ARTIST_NAMES = [
  ...new Set([
    ...DEFQON1_DAY1_SLOTS.map((slot) => slot.artistName),
    ...DEFQON1_DAY2_SLOTS.map((slot) => slot.artistName),
    ...DEFQON1_DAY3_SLOTS.map((slot) => slot.artistName),
    ...DEFQON1_DAY4_SLOTS.map((slot) => slot.artistName),
  ]),
];

const ALL_DEFQON1_SLOTS = [
  ...DEFQON1_DAY1_SLOTS,
  ...DEFQON1_DAY2_SLOTS,
  ...DEFQON1_DAY3_SLOTS,
  ...DEFQON1_DAY4_SLOTS,
];

function primaryStageForArtist(name: string): string {
  return (
    ALL_DEFQON1_SLOTS.find((slot) => slot.artistName === name)?.stage.id ??
    STAGES.blue.id
  );
}

export const DEFQON1_LINEUP_DJ_SEED = ALL_SLOT_ARTIST_NAMES.map((name) => {
  const meta = metaFor(name);
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

export const DEFQON1_ARTIST_PERFORMANCE_SEED = [
  ...DEFQON1_DAY1_PERFORMANCES,
  ...DEFQON1_DAY2_PERFORMANCES,
  ...DEFQON1_DAY3_PERFORMANCES,
  ...DEFQON1_DAY4_PERFORMANCES,
];

export const DEFQON1_ARTIST_NAMES = ALL_SLOT_ARTIST_NAMES;
