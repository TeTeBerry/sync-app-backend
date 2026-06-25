import { LINEUP_SEED_GENRE_PLACEHOLDER } from './lineup-seed-genre.constants';

export const ITINERARY_EDC_ORLANDO_ACTIVITY_LEGACY_ID = 13;

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
 * EDC Orlando 2026 官宣阵容（Tinker Field · 11/06–08）。
 * 官方演出时间表未发布前仅提供阵容预选，不写入占位排期。
 */
const EDC_ORLANDO_ARTISTS: EdcArtistSeed[] = [
  dj('A LITTLE SOUND', 'Drum & Bass', 'Liquid D&B · Jump Up', 82, '#22c55e'),
  dj('AARON HIBELL', 'Trance', 'Melodic Trance · Progressive', 86, '#38bdf8'),
  dj('AAT', 'House', 'Tech House', 78, '#34d399'),
  dj('ACRAZE B2B CID', 'House', 'Tech House · Afro House', 90, '#84cc16'),
  dj('ADRIÁN MILLS', 'Techno', 'Melodic Techno', 79, '#818cf8'),
  dj(
    'ADVENTURE CLUB (SUNSET SET)',
    'Dubstep',
    'Melodic Dubstep · Future Bass',
    91,
    '#a855f7',
  ),
  dj('AFROJACK', 'House', 'Big Room · Electro House', 96, '#f472b6'),
  dj(
    'ALAN WALKER (SUNSET SET)',
    'Future Bass',
    'Melodic House · Future Bass',
    95,
    '#60a5fa',
  ),
  dj('ALESSO (SUNSET SET)', 'House', 'Progressive House · EDM', 96, '#38bdf8'),
  dj('ALISON WONDERLAND', 'Dubstep', 'Trap · Bass Music', 92, '#fb7185'),
  dj('ALLEYCVT', 'Dubstep', 'Dubstep · Bass Music', 84, '#fb7185'),
  dj('ALOK', 'House', 'Brazilian Bass · EDM', 94, '#f472b6'),
  dj('ALVES', 'House', 'Tech House · Afro House', 80, '#2dd4bf'),
  dj('AR/CO', 'House', 'Tech House · Bass House', 81, '#14b8a6'),
  dj('ATLIENS', 'Dubstep', 'Bass · Trap', 87, '#f97316'),
  dj('AVELLO', 'House', 'Tech House', 79, '#34d399'),
  dj('AYYBO', 'House', 'Tech House · Bass House', 85, '#e879f9'),
  dj('AZZECCA', 'Techno', 'Hard Techno', 82, '#6366f1'),
  dj('BASSRUSH EXPERIENCE', 'Dubstep', 'Bass Music · Dubstep', 80, '#fb923c'),
  dj('BENDA B2B VASTIVE', 'Dubstep', 'Riddim · Dubstep', 88, '#ef4444'),
  dj('BIG FLORIDA', 'House', 'Tech House · Bass House', 76, '#0d9488'),
  dj('BOOGIE T', 'Dubstep', 'Glitch Hop · Bass', 85, '#f59e0b'),
  dj('BOU B2B KANINE', 'Drum & Bass', 'Jump Up · D&B', 89, '#22c55e'),
  dj(
    'BOYS NOIZE B2B BRUTALISMUS 3000',
    'Techno',
    'Hard Techno · Industrial',
    91,
    '#dc2626',
  ),
  dj(
    'BRUNELLO (SUNSET SET)',
    'House',
    'Afro House · Melodic House',
    84,
    '#a78bfa',
  ),
  dj('BULLET TOOTH B2B SIDNEY CHARLES', 'House', 'Tech House', 83, '#10b981'),
  dj('CHASEWEST', 'House', 'Tech House', 82, '#4ade80'),
  dj('CHEF BOYARBEATZ', 'House', 'Tech House · Bass House', 80, '#facc15'),
  dj('CHRIS LORENZO', 'House', 'Tech House · Bass House', 88, '#84cc16'),
  dj('CØNTRA', 'Techno', 'Hard Techno', 81, '#7c3aed'),
  dj('DAVID GUETTA', 'House', 'Big Room · Electro House', 98, '#ff2d55'),
  dj('DENNIS CRUZ', 'House', 'Tech House · Minimal', 87, '#14b8a6'),
  dj('DEORRO B2B DIESEL', 'House', 'Big Room · Electro House', 90, '#f43f5e'),
  dj(
    'DEVAULT (SUNSET SET)',
    'Future Bass',
    'Melodic Bass · Future Bass',
    84,
    '#c084fc',
  ),
  dj('DISCIP', 'Dubstep', 'Riddim · Dubstep', 83, '#ef4444'),
  dj('DISCO LINES', 'House', 'Tech House · Bass House', 86, '#22d3ee'),
  dj('DISCOVERY PROJECT', 'House', 'Tech House · Bass House', 78, '#f43f5e'),
  dj('ESSE', 'Techno', 'Melodic Techno', 77, '#818cf8'),
  dj('FACTORY 93 PRESENTS', 'Techno', 'Techno · Industrial', 79, '#4b5563'),
  dj('FALLON', 'House', 'Tech House', 78, '#34d399'),
  dj('FRANKY RIZARDO', 'House', 'Tech House · Minimal', 86, '#0ea5e9'),
  dj('FURY WITH MC DINO', 'Hardstyle', 'Hardstyle · Rawstyle', 84, '#ea580c'),
  dj('GABBS', 'House', 'Tech House', 79, '#2dd4bf'),
  dj('GREG 99', 'House', 'Tech House', 76, '#6ee7b7'),
  dj('HARDWELL', 'House', 'Big Room · Progressive House', 97, '#3b82f6'),
  dj('HAYLA', 'House', 'Melodic House · Vocal House', 83, '#f472b6'),
  dj('HOLY PRIEST', 'Techno', 'Hard Techno', 85, '#dc2626'),
  dj('I HATE MODELS', 'Techno', 'Hard Techno · Industrial', 90, '#991b1b'),
  dj('IAN ASHER', 'House', 'Tech House · Afro House', 80, '#fbbf24'),
  dj('IDEMI', 'House', 'Tech House · Bass House', 78, '#ec4899'),
  dj('INBAL', 'Techno', 'Melodic Techno', 77, '#a78bfa'),
  dj(
    'INSOMNIAC RECORDS TAKEOVER',
    'House',
    'Tech House · Bass House',
    79,
    '#f43f5e',
  ),
  dj('INTERPLANETARY CRIMINAL', 'House', 'UK Garage · Bass', 84, '#84cc16'),
  dj('JESSICA AUDIFFRED', 'House', 'Tech House', 76, '#d946ef'),
  dj('JKYL & HYDE', 'Dubstep', 'Riddim · Dubstep', 87, '#ef4444'),
  dj('JOA', 'House', 'Tech House', 78, '#34d399'),
  dj('JOSH BAKER', 'House', 'Tech House · Minimal', 82, '#10b981'),
  dj('JOSHWA', 'House', 'Tech House', 80, '#4ade80'),
  dj('KAIVON', 'Future Bass', 'Melodic Bass · Trap', 83, '#a855f7'),
  dj('KASKADE', 'House', 'Progressive House · Deep House', 95, '#38bdf8'),
  dj('KI/KI', 'Techno', 'Acid Techno · Hard Techno', 88, '#f97316'),
  dj('KINHAU', 'House', 'Tech House', 77, '#2dd4bf'),
  dj('KLANGKUENSTLER', 'Techno', 'Hard Techno', 86, '#dc2626'),
  dj('KNOW GOOD', 'House', 'Tech House', 76, '#14b8a6'),
  dj('KOMPANY', 'Dubstep', 'Riddim · Dubstep', 88, '#ef4444'),
  dj('KREAM', 'House', 'Melodic House · Deep House', 91, '#6366f1'),
  dj('LAYZ', 'Dubstep', 'Riddim · Dubstep', 85, '#fb7185'),
  dj('LEVEL UP', 'Dubstep', 'Riddim · Dubstep', 86, '#f97316'),
  dj('LEVITY', 'Dubstep', 'Melodic Dubstep · Bass', 84, '#c084fc'),
  dj('LUKE DEAN B2B MAX DEAN', 'House', 'Tech House · Minimal', 83, '#22c55e'),
  dj('M81!', 'House', 'Tech House', 77, '#34d399'),
  dj('MADDIX', 'Techno', 'Hard Techno · Big Room', 89, '#ef4444'),
  dj('MADVKTM', 'Techno', 'Hard Techno', 80, '#7c3aed'),
  dj('MAI IACHETTI', 'House', 'Tech House', 76, '#f472b6'),
  dj('MALUGI (SUNSET SET)', 'House', 'Tech House · Bass House', 84, '#84cc16'),
  dj(
    'MARLON HOFFSTADT (SUNSET SET)',
    'Techno',
    'Trance · Euro Dance',
    87,
    '#e879f9',
  ),
  dj('MARTIN GARRIX', 'House', 'Big Room · Progressive House', 98, '#ff2d55'),
  dj('MATTHIAS', 'House', 'Tech House', 78, '#10b981'),
  dj('MAU P', 'House', 'Tech House · Deep House', 94, '#84cc16'),
  dj('ME N Ü', 'House', 'Tech House · Bass House', 82, '#facc15'),
  dj('MEDUZA', 'House', 'Melodic House · Afro House', 95, '#34d399'),
  dj('MIGUELLE & TONS', 'House', 'Tech House · Afro House', 81, '#2dd4bf'),
  dj('MONOKY', 'House', 'Tech House', 77, '#6ee7b7'),
  dj('MPH', 'House', 'Tech House · Bass House', 79, '#f59e0b'),
  dj('NICO MORENO', 'Techno', 'Hard Techno · Peak Time', 85, '#ef4444'),
  dj(
    'OF THE TREES (SUNSET SET)',
    'Dubstep',
    'Melodic Bass · Future Bass',
    86,
    '#a855f7',
  ),
  dj('OMAR+', 'House', 'Tech House · Afro House', 80, '#0ea5e9'),
  dj('PEGASSI', 'House', 'Tech House · Trance', 82, '#818cf8'),
  dj('PHRVA', 'Techno', 'Hard Techno', 78, '#dc2626'),
  dj('PROSPA', 'House', 'Tech House · UK Garage', 84, '#22d3ee'),
  dj('RAJE', 'House', 'Tech House', 77, '#34d399'),
  dj('RAVENSCOON', 'Dubstep', 'Experimental Bass · Dubstep', 83, '#8b5cf6'),
  dj('RAY VOLPE', 'Dubstep', 'Melodic Dubstep · Bass', 92, '#fb7185'),
  dj('RODDY LIMA', 'House', 'Tech House', 76, '#14b8a6'),
  dj('ROSSI. (SUNSET SET)', 'House', 'Tech House · Afro House', 83, '#f472b6'),
  dj(
    'SAN HOLO (WHOLESOME RIDDIM SET)',
    'Future Bass',
    'Future Bass · Melodic Bass',
    90,
    '#60a5fa',
  ),
  dj('SHDW', 'Techno', 'Hard Techno · Industrial', 84, '#4b5563'),
  dj('SIPPY', 'Dubstep', 'Riddim · Dubstep', 82, '#ef4444'),
  dj(
    'SKULL MACHINE (BLACK TIGER SEX MACHINE X KAI WACHI)',
    'Dubstep',
    'Riddim · Dubstep',
    89,
    '#dc2626',
  ),
  dj(
    'SLANDER (SUNSET SET)',
    'Dubstep',
    'Melodic Dubstep · Bass',
    96,
    '#7b61ff',
  ),
  dj('SLOTH', 'Dubstep', 'Riddim · Dubstep', 80, '#f87171'),
  dj('STEVE AOKI', 'House', 'Big Room · Electro House', 95, '#ff2d55'),
  dj('SUBSONIC', 'Drum & Bass', 'Jump Up · D&B', 84, '#22c55e'),
  dj('TAIKI NULIGHT', 'House', 'UK Garage · Bass House', 86, '#0ea5e9'),
  dj('TROYBOI', 'Trap', 'Trap · Future Bass', 88, '#f59e0b'),
  dj('TWINSICK', 'House', 'Tech House · Bass House', 82, '#e879f9'),
  dj('ULTRATHEM', 'Techno', 'Hard Techno', 79, '#991b1b'),
  dj('WHETHAN', 'House', 'Future Bass · Pop EDM', 87, '#f472b6'),
  dj('WOOLI', 'Dubstep', 'Riddim · Dubstep', 90, '#ef4444'),
  dj('ZACK MARTINO', 'House', 'Melodic House · Future Bass', 78, '#60a5fa'),
];

const EDC_ORLANDO_DATE_META = [
  {
    dateKey: 'nov6',
    label: '11月6日',
    bannerDateLabel: '11月6日',
    sortOrder: 0,
  },
  {
    dateKey: 'nov7',
    label: '11月7日',
    bannerDateLabel: '11月7日',
    sortOrder: 1,
  },
  {
    dateKey: 'nov8',
    label: '11月8日',
    bannerDateLabel: '11月8日',
    sortOrder: 2,
  },
] as const;

export const EDC_ORLANDO_FESTIVAL_SESSION_SEED = EDC_ORLANDO_DATE_META.map(
  (day) => ({
    activityLegacyId: ITINERARY_EDC_ORLANDO_ACTIVITY_LEGACY_ID,
    ...day,
  }),
);

export const EDC_ORLANDO_LINEUP_DJ_SEED = EDC_ORLANDO_ARTISTS.map((artist) => {
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
export const EDC_ORLANDO_ARTIST_PERFORMANCE_SEED = [] as const;

export const EDC_ORLANDO_ARTIST_NAMES = EDC_ORLANDO_ARTISTS.map((a) => a.name);
