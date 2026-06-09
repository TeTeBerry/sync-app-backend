import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Sync with `itinerary.seed.ts` storm fallback */
export const STORM_LINEUP_ARTIST_NAMES = [
  'BLONDEX',
  'GHENGAR (GHASTLY)',
  'ANDY C',
  'EXCISION',
  'MARSHMELLO',
  'VIDOJEAN (VJ X OL)',
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
};

/** Skip Discogs crawl — no reliable match; itinerary keeps seed genreLabel. */
export const SEED_ONLY_LINEUP_ARTISTS = new Set(['&FRIENDS', 'PETERBLUE', 'RØZ']);

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
};

/** Lineup display name → normalized keys of acceptable `djs.name` matches. */
export const LINEUP_COVERAGE_NAME_KEYS = {
  'LEVELTRONICS': ['subtronics', 'levelup'],
  'SHOWTEK HARDSTYLE SET': ['showtek'],
  'WUJACKERS': ['wukong', 'bassjackers'],
  'GHENGAR (GHASTLY)': ['ghengar', 'ghastly'],
  'VIDOJEAN (VJ X OL)': ['vidojean'],
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
