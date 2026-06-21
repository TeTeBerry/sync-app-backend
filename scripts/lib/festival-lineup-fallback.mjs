import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Sync with `itinerary.seed.ts` storm fallback */
export const STORM_LINEUP_ARTIST_NAMES = [
  'CRUSH',
  'CRUBBIXZ',
  'TIYA',
  'GHENGAR (GHASTLY)',
  'BLONDEX',
  'ANDY C',
  'EXCISION',
  'MARSHMELLO',
  'WHYBEATZ',
  'YOHAN',
  'VIDOJEAN',
  'JULIAN JORDAN',
  'ODD MOB',
  'ERIC PRYDZ',
  'ILLENIUM',
];

/** Read `EDC_THAILAND_ARTISTS` names from seed when Mongo has no performances. */
export function loadEdcThailandFallbackNames() {
  const seedPath = join(
    __dirname,
    '..',
    '..',
    'src',
    'modules',
    'itinerary',
    'edc-thailand-itinerary.seed.ts',
  );

  try {
    const content = readFileSync(seedPath, 'utf8');
    const block =
      content.match(/const EDC_THAILAND_ARTISTS[\s\S]*?\];/)?.[0] ?? '';
    const names = [
      ...block.matchAll(/name:\s*'((?:\\'|[^'])*)'/g),
    ].map((match) => match[1].replace(/\\'/g, "'"));

    if (names.length) {
      return names;
    }
  } catch {
    // fall through
  }

  return [
    'MARTIN GARRIX',
    'TIËSTO',
    'CHARLOTTE DE WITTE',
    'DOM DOLLA',
    'JAMES HYPE',
    'DJ SNAKE',
  ];
}

/** Read `EDC_KOREA_ARTISTS` names from seed when Mongo has no performances. */
export function loadEdcKoreaFallbackNames() {
  const seedPath = join(
    __dirname,
    '..',
    '..',
    'src',
    'modules',
    'itinerary',
    'edc-korea-itinerary.seed.ts',
  );

  try {
    const content = readFileSync(seedPath, 'utf8');
    const block = content.match(/const EDC_KOREA_ARTISTS[\s\S]*?\];/)?.[0] ?? '';
    const names = [
      ...block.matchAll(/dj\('((?:\\'|[^'])*)'/g),
    ].map((match) => match[1].replace(/\\'/g, "'"));

    if (names.length) {
      return names;
    }
  } catch {
    // fall through
  }

  return ['TIËSTO', 'SUBTRONICS', 'FISHER', 'DJ SNAKE'];
}

/** Read `TOMORROWLAND_THAILAND_ARTISTS` names from seed when Mongo has no performances. */
export function loadTomorrowlandThailandFallbackNames() {
  const seedPath = join(
    __dirname,
    '..',
    '..',
    'src',
    'modules',
    'itinerary',
    'tomorrowland-thailand-itinerary.seed.ts',
  );

  try {
    const content = readFileSync(seedPath, 'utf8');
    const block =
      content.match(/const TOMORROWLAND_THAILAND_ARTISTS[\s\S]*?\];/)?.[0] ?? '';
    const names = [
      ...block.matchAll(/dj\(\s*'((?:\\'|[^'])*)'/g),
    ].map((match) => match[1].replace(/\\'/g, "'"));

    if (names.length) {
      return names;
    }
  } catch {
    // fall through
  }

  return [
    'SWEDISH HOUSE MAFIA',
    'MARTIN GARRIX',
    'DIMITRI VEGAS & LIKE MIKE',
    'AFROJACK',
    'NERVO',
    'LOST FREQUENCIES',
  ];
}

const B2B_PATTERN = /\s+B2B\s+/i;

/**
 * Expand lineup display names into searchable solo artists.
 * - `GREEN VELVET B2B STEVE ANGELLO` → two artists
 * - `LEVELTRONICS (SUBTRONICS B2B LEVEL UP)` → LEVELTRONICS + SUBTRONICS + LEVEL UP
 * - `GHENGAR (GHASTLY)` → GHengar only (alias in parens is not crawled separately)
 */
export function expandFestivalArtistName(lineupName) {
  const trimmed = lineupName.trim();
  if (!trimmed || trimmed === '国内艺人') {
    return [];
  }

  const parenMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const main = parenMatch[1].trim();
    const inner = parenMatch[2].trim();
    if (B2B_PATTERN.test(inner)) {
      return [main, ...inner.split(B2B_PATTERN).map((part) => part.trim()).filter(Boolean)];
    }
    return main ? [main] : [];
  }

  if (B2B_PATTERN.test(trimmed)) {
    return trimmed.split(B2B_PATTERN).map((part) => part.trim()).filter(Boolean);
  }

  return [trimmed];
}

export function expandFestivalArtistNames(lineupNames) {
  return [
    ...new Set(lineupNames.flatMap((name) => expandFestivalArtistName(name))),
  ];
}

/** Force Discogs artist id when search returns the wrong homonym. */
export const DISCOGS_LINEUP_ARTIST_IDS = {
  KANINE: 5865864,
  /** Discogs lists as "Sudden Death (16)" — dubstep producer Svdden Death */
  'SVDDEN DEATH': 5375145,
  /**
   * HO HO ONE = Eric Kwok (郭偉亮) × Dan James Cantopop/EDM duo.
   * No standalone Discogs page; producer half is #1889815.
   */
  'HOHO ONE': 1889815,
  'DJ SNAKE': 4046989,
};

/** Skip Discogs crawl — no reliable match; itinerary keeps seed genreLabel. */
export const SEED_ONLY_LINEUP_ARTISTS = new Set([
  '&FRIENDS',
  'PETERBLUE',
  'RØZ',
  /** Discogs homonyms — keep itinerary seed genreLabel */
  'CRUSH',
  'TIYA',
  'YOHAN',
  /** EDC Korea stage / showcase labels */
  'BASSRUSH EXPERIENCE',
  'DREAMSTATE PRESENTS ELECTRIK SEOUL',
  'INSOMNIAC RECORDS TAKEOVER',
  'SORAERE BROCKEN',
]);

/** Discogs search aliases for hard-to-match EDC lineup display names. */
export const DISCOGS_LINEUP_SEARCH_ALIASES = {
  'AFEM SYKO': 'Afem Syko',
  'LEVEL UP': 'Level Up',
  'LEVELTRONICS': 'Subtronics',
  'NOISE MAFIA': 'Noise Mafia',
  'SHOWTEK HARDSTYLE SET': 'Showtek',
  'SPACE 92 X POPOF PRESENT: TURBULENCES': 'Space 92',
  'TAIKI NULIGHT': 'Taiki & Nulight',
  /** WUKONG × Bassjackers — see https://djmag.com/top100djs/2025/83/wukong */
  'WUJACKERS': 'Wukong',
  'GHENGAR (GHASTLY)': 'Ghengar',
  'VIDOJEAN (VJ X OL)': 'Vidojean',
  VIDOJEAN: 'Vidojean',
  WHYBEATZ: 'WhyBeatz',
  '999999999': '999999999',
  'DØMINA': 'Domina',
  'NO1 (HONGJOONG)': 'Hongjoong',
  'BEN NICKY PRESENTS XTREME': 'Ben Nicky',
  'CASEPEAT X PURPLE RABBIT': 'Casepeat',
  'CHEEZ & YUKA': 'Cheez',
  'ALY & FILA': 'Aly & Fila',
  'DIMITRI VEGAS & LIKE MIKE': 'Dimitri Vegas & Like Mike',
  'SWEDISH HOUSE MAFIA': 'Swedish House Mafia',
  NERVO: 'Nervo',
};

/** Lineup display name → normalized keys of acceptable `djs.name` matches. */
export const LINEUP_COVERAGE_NAME_KEYS = {
  'LEVELTRONICS': ['subtronics', 'levelup'],
  'SHOWTEK HARDSTYLE SET': ['showtek'],
  'WUJACKERS': ['wukong', 'bassjackers'],
  'GHENGAR (GHASTLY)': ['ghengar', 'ghastly'],
  'VIDOJEAN (VJ X OL)': ['vidojean'],
  VIDOJEAN: ['vidojean'],
  WHYBEATZ: ['whybeatz'],
  CRUBBIXZ: ['crubbixz'],
  'DAVICO B2B DEMUK B2B DEPARTS': ['davico', 'demuk', 'departs'],
  'ILLENIUM B2B DABIN': ['illenium', 'dabin'],
  'CASEPEAT X PURPLE RABBIT': ['casepeat', 'purplerabbit'],
  'SVDDEN DEATH': ['suddendeath', 'svddendeath'],
  'HOHO ONE': ['erickwok', 'hohoone'],
  'PAUL EUN': ['pauleun'],
  'DIMITRI VEGAS & LIKE MIKE': ['dimitrivegas', 'likemike'],
};

/**
 * Curated DJ rows when Discogs has no artist page.
 * Uses reserved positive ids (99xxxxxxx) to avoid collision with real Discogs ids.
 */
export const LINEUP_MANUAL_DJ_PROFILES = {
  'PAUL EUN': {
    discogsId: 990000008,
    name: 'Paul Eun',
    realName: '',
    profile:
      'Seoul-based trance DJ and Trancempire organizer. Hosts In Trance We United sets at Club Temple, Seoul.',
    genres: ['Electronic'],
    styles: ['Trance', 'Progressive Trance', 'Uplifting Trance'],
    country: 'South Korea',
    urls: ['https://soundcloud.com/paul-eun'],
    members: [],
    representativeWorks: [],
  },
};

export function normalizeArtistNameKey(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function getDiscogsSearchQueries(lineupName) {
  const trimmed = lineupName.trim();
  const alias = DISCOGS_LINEUP_SEARCH_ALIASES[trimmed.toUpperCase()];
  const queries = [];
  if (alias) {
    queries.push(alias);
  }
  if (!queries.includes(trimmed)) {
    queries.push(trimmed);
  }
  return queries;
}

export function getLineupCoverageKeys(lineupName) {
  const trimmed = lineupName.trim();
  const keys = [normalizeArtistNameKey(trimmed)];
  const extras = LINEUP_COVERAGE_NAME_KEYS[trimmed.toUpperCase()];
  if (extras) {
    keys.push(...extras.map((key) => normalizeArtistNameKey(key)));
  }
  const alias = DISCOGS_LINEUP_SEARCH_ALIASES[trimmed.toUpperCase()];
  if (alias) {
    keys.push(normalizeArtistNameKey(alias));
  }
  return [...new Set(keys.filter(Boolean))];
}
