import { LINEUP_SEED_GENRE_PLACEHOLDER } from './lineup-seed-genre.constants';

export const ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID = 8;

const MAIN_STAGE = 'main' as const;

type EdcArtistSeed = {
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
): EdcArtistSeed {
  return {
    name,
    genre: LINEUP_SEED_GENRE_PLACEHOLDER,
    genreLabel: LINEUP_SEED_GENRE_PLACEHOLDER,
    popularity,
    genreColor,
  };
}

/**
 * EDC Korea 2026 官宣阵容（Inspire · 10/03–04）。
 * 官方演出时间表未发布前仅提供阵容预选，不写入占位排期。
 */
const EDC_KOREA_ARTISTS: EdcArtistSeed[] = [
  dj('33 BELOW', 'Bass', 'Dubstep · Bass Music', 84, '#fb7185'),
  dj('4URA', 'Techno', 'Hard Techno', 80, '#c084fc'),
  dj('999999999', 'Techno', 'Industrial Techno · Acid', 88, '#818cf8'),
  dj('ALLEYCVT', 'Dubstep', 'Dubstep · Bass Music', 84, '#fb7185'),
  dj('ALOK', 'House', 'Brazilian Bass · EDM', 93, '#f472b6'),
  dj('ALY & FILA', 'Trance', 'Uplifting Trance', 90, '#38bdf8'),
  dj('ANIME', 'Hardstyle', 'Hardstyle · Hard Dance', 82, '#f97316'),
  dj('AREA X', 'Techno', 'Melodic Techno', 79, '#a78bfa'),
  dj('ARGY', 'Techno', 'Melodic Techno · House', 87, '#22d3ee'),
  dj('ASHIKO', 'House', 'Tech House', 78, '#34d399'),
  dj('ASTRO VOIZE', 'Trance', 'Trance · Progressive', 77, '#60a5fa'),
  dj('AUREDE', 'Techno', 'Melodic Techno', 76, '#818cf8'),
  dj('AYYBO', 'House', 'Tech House · Bass House', 85, '#e879f9'),
  dj('BASSCON', 'Dubstep', 'Riddim · Dubstep', 81, '#ef4444'),
  dj('BASSKRAP', 'Dubstep', 'Bass Music', 78, '#f87171'),
  dj('BASSRUSH EXPERIENCE', 'Dubstep', 'Bass Music · Dubstep', 80, '#fb923c'),
  dj(
    'BEN NICKY PRESENTS XTREME',
    'Hardstyle',
    'Hardstyle · Hardcore',
    83,
    '#ea580c',
  ),
  dj('BLOSSO', 'Future Bass', 'Melodic Bass · Future Bass', 79, '#a855f7'),
  dj('BOU', 'Drum & Bass', 'Jump Up · D&B', 86, '#22c55e'),
  dj('BRENNAN HEART', 'Hardstyle', 'Hardstyle', 89, '#f59e0b'),
  dj('CASEPEAT X PURPLE RABBIT', 'House', 'Tech House', 77, '#14b8a6'),
  dj('CHARLIE SPARKS', 'Techno', 'Hard Techno', 84, '#6366f1'),
  dj('CHEEZ & YUKA', 'House', 'Tech House', 76, '#2dd4bf'),
  dj('COONE', 'Hardstyle', 'Hardstyle · Rawstyle', 87, '#fbbf24'),
  dj('COSMIC GATE', 'Trance', 'Progressive Trance', 91, '#38bdf8'),
  dj('DAVICO B2B DEMUK B2B DEPARTS', 'Techno', 'Melodic Techno', 78, '#7c3aed'),
  dj('DIMENSION', 'Drum & Bass', 'D&B · Liquid', 88, '#10b981'),
  dj('DJ SNAKE', 'Trap', 'Trap · EDM', 95, '#ff2d55'),
  dj('DØMINA', 'Techno', 'Melodic Techno', 80, '#8b5cf6'),
  dj(
    'DREAMSTATE PRESENTS ELECTRIK SEOUL',
    'Trance',
    'Trance · Progressive',
    82,
    '#0ea5e9',
  ),
  dj('ELIANA', 'House', 'Afro House · Melodic House', 78, '#f472b6'),
  dj('FISHER', 'House', 'Tech House', 94, '#84cc16'),
  dj('HOHO ONE', 'House', 'Cantopop · EDM · Tech House', 75, '#06b6d4'),
  dj('DEMI', 'House', 'Tech House · Bass House', 77, '#ec4899'),
  dj(
    'ILLENIUM B2B DABIN',
    'Dubstep',
    'Melodic Dubstep · Future Bass',
    96,
    '#7b61ff',
  ),
  dj(
    'INSOMNIAC RECORDS TAKEOVER',
    'House',
    'Tech House · Bass House',
    79,
    '#f43f5e',
  ),
  dj('JESSICA AUDIFFRED', 'House', 'Tech House', 76, '#d946ef'),
  dj('KAGO PENGCHI', 'House', 'Tech House', 74, '#0d9488'),
  dj('KAYZO', 'Dubstep', 'Hybrid Trap · Dubstep', 90, '#ef4444'),
  dj('KREAM', 'House', 'Future House · Bass House', 88, '#3b82f6'),
  dj('LEVEL UP', 'Dubstep', 'Riddim · Dubstep', 85, '#a3e635'),
  dj('LILLY PALMER', 'Techno', 'Hard Techno', 86, '#e11d48'),
  dj('MARIE VAUNT', 'Techno', 'Hard Techno · Acid', 84, '#be123c'),
  dj('MARY DROPPINZ', 'Dubstep', 'Bass Music', 77, '#f97316'),
  dj('MATTY RALPH', 'House', 'Tech House', 75, '#22d3ee'),
  dj('MUZIE', 'House', 'Tech House', 74, '#64748b'),
  dj('NICO MORENO', 'Techno', 'Hard Techno', 85, '#7f1d1d'),
  dj('NIFRA', 'Hardstyle', 'Hardstyle · Uplifting', 84, '#ca8a04'),
  dj('NO1 (HONGJOONG)', 'House', 'Open Format · EDM', 80, '#6366f1'),
  dj('OGUZ', 'Techno', 'Hard Techno', 83, '#4f46e5'),
  dj('ONEJ', 'House', 'Tech House', 74, '#059669'),
  dj(
    'PAUL EUN',
    'Trance',
    'Progressive Trance · Uplifting Trance',
    78,
    '#0ea5e9',
  ),
  dj('PLUKO', 'Future Bass', 'Melodic Bass', 76, '#c026d3'),
  dj('R3HAB', 'House', 'Big Room · Electro House', 91, '#facc15'),
  dj('RIORDAN', 'Techno', 'Melodic Techno', 82, '#5b21b6'),
  dj('SARA LANDRY', 'Techno', 'Hard Techno · Industrial', 92, '#dc2626'),
  dj('SORAERE BROCKEN', 'Techno', 'Melodic Techno', 75, '#9333ea'),
  dj('SPECT', 'Dubstep', 'Dubstep · Bass', 78, '#b91c1c'),
  dj('SSOMBO', 'House', 'Tech House', 74, '#16a34a'),
  dj('SUBTRONICS', 'Dubstep', 'Riddim · Dubstep', 94, '#84cc16'),
  dj('SUNGYOO', 'House', 'Tech House', 73, '#0284c7'),
  dj('SVDDEN DEATH', 'Dubstep', 'Brostep · Riddim', 93, '#7c3aed'),
  dj('THE OUTLAW', 'House', 'Tech House · Bass House', 76, '#ea580c'),
  dj('TIËSTO', 'House', 'Big Room · Progressive House', 98, '#ff2d55'),
  dj('TOKIMONSTA', 'Electronic', 'Future Beats · Hip Hop', 83, '#f472b6'),
  dj('TROYBOI', 'Trap', 'Trap · Future Bass', 87, '#14b8a6'),
  dj('VINI VICI', 'Trance', 'Psytrance · Progressive', 92, '#f59e0b'),
  dj('W&W', 'Big Room', 'Big Room · Electro House', 90, '#3b82f6'),
  dj('WAX MOTIF', 'House', 'G-House · Tech House', 86, '#eab308'),
  dj(
    'WILLIAM BLACK',
    'Future Bass',
    'Melodic Dubstep · Future Bass',
    84,
    '#8b5cf6',
  ),
  dj('WOOLI', 'Dubstep', 'Riddim · Dubstep', 88, '#65a30d'),
  dj('YOUNA', 'Trance', 'Uplifting Trance', 81, '#2563eb'),
  dj('YUUKI YOSHIYAMA', 'Hardstyle', 'Hardstyle', 80, '#d97706'),
];

const EDC_KOREA_DATE_META = [
  {
    dateKey: 'oct03',
    label: '10月3日',
    bannerDateLabel: '10月3日',
    sortOrder: 0,
  },
  {
    dateKey: 'oct04',
    label: '10月4日',
    bannerDateLabel: '10月4日',
    sortOrder: 1,
  },
] as const;

export const EDC_KOREA_FESTIVAL_SESSION_SEED = EDC_KOREA_DATE_META.map(
  (day) => ({
    activityLegacyId: ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID,
    ...day,
  }),
);

export const EDC_KOREA_LINEUP_DJ_SEED = EDC_KOREA_ARTISTS.map((artist) => {
  const id = artistId(artist.name);
  return {
    id,
    name: artist.name,
    genre: artist.genre,
    genreLabel: artist.genreLabel,
    stage: MAIN_STAGE,
    popularity: artist.popularity,
    avatarSeed: id,
    genreColor: artist.genreColor,
  };
});

/** Lineup-only: official timetable not published yet. */
export const EDC_KOREA_ARTIST_PERFORMANCE_SEED = [] as const;

export const EDC_KOREA_ARTIST_NAMES = EDC_KOREA_ARTISTS.map((a) => a.name);
