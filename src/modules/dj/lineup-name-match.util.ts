/** Keep in sync with `scripts/lib/festival-lineup-fallback.mjs` */

const B2B_PATTERN = /\s+B2B\s+/i;

export const DISCOGS_LINEUP_ARTIST_IDS: Record<string, number> = {
  KANINE: 5865864,
  'SVDDEN DEATH': 5375145,
  'HOHO ONE': 1889815,
};

/** No reliable Discogs profile — itinerary uses seed genreLabel instead. */
export const SEED_ONLY_LINEUP_ARTISTS = new Set([
  '&FRIENDS',
  'PETERBLUE',
  'RØZ',
  'CRUSH',
  'TIYA',
  'YOHAN',
  'BASSRUSH EXPERIENCE',
  'DREAMSTATE PRESENTS ELECTRIK SEOUL',
  'INSOMNIAC RECORDS TAKEOVER',
  'SORAERE BROCKEN',
]);

export const DISCOGS_LINEUP_SEARCH_ALIASES: Record<string, string> = {
  'AFEM SYKO': 'Afem Syko',
  'LEVEL UP': 'Level Up',
  LEVELTRONICS: 'Subtronics',
  'NOISE MAFIA': 'Noise Mafia',
  'SHOWTEK HARDSTYLE SET': 'Showtek',
  'SPACE 92 X POPOF PRESENT: TURBULENCES': 'Space 92',
  'TAIKI NULIGHT': 'Taiki & Nulight',
  WUJACKERS: 'Wukong',
  'GHENGAR (GHASTLY)': 'Ghengar',
  'VIDOJEAN (VJ X OL)': 'Vidojean',
  VIDOJEAN: 'Vidojean',
  WHYBEATZ: 'WhyBeatz',
  '999999999': '999999999',
  DØMINA: 'Domina',
  'NO1 (HONGJOONG)': 'Hongjoong',
  'BEN NICKY PRESENTS XTREME': 'Ben Nicky',
  'CASEPEAT X PURPLE RABBIT': 'Casepeat',
  'CHEEZ & YUKA': 'Cheez',
  'ALY & FILA': 'Aly & Fila',
};

export const LINEUP_COVERAGE_NAME_KEYS: Record<string, string[]> = {
  LEVELTRONICS: ['subtronics', 'levelup'],
  'SHOWTEK HARDSTYLE SET': ['showtek'],
  WUJACKERS: ['wukong', 'bassjackers'],
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
};

export function expandFestivalArtistName(lineupName: string): string[] {
  const trimmed = lineupName.trim();
  if (!trimmed || trimmed === '国内艺人') {
    return [];
  }

  const parenMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const main = parenMatch[1].trim();
    const inner = parenMatch[2].trim();
    if (B2B_PATTERN.test(inner)) {
      return [
        main,
        ...inner
          .split(B2B_PATTERN)
          .map((part) => part.trim())
          .filter(Boolean),
      ];
    }
    return main ? [main] : [];
  }

  if (B2B_PATTERN.test(trimmed)) {
    return trimmed
      .split(B2B_PATTERN)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [trimmed];
}

export function normalizeArtistNameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function getLineupCoverageKeys(lineupName: string): string[] {
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

export function matchLineupArtistToCatalog<T extends { name: string }>(
  lineupName: string,
  catalog: T[],
): T | null {
  const trimmed = lineupName.trim();
  if (SEED_ONLY_LINEUP_ARTISTS.has(trimmed.toUpperCase())) {
    return null;
  }

  const alias = DISCOGS_LINEUP_SEARCH_ALIASES[trimmed.toUpperCase()];
  if (alias) {
    const aliasKey = normalizeArtistNameKey(alias);
    const aliasHit = catalog.find((item) => {
      const djKey = normalizeArtistNameKey(item.name);
      return (
        djKey === aliasKey ||
        djKey.includes(aliasKey) ||
        aliasKey.includes(djKey)
      );
    });
    if (aliasHit) {
      return aliasHit;
    }
  }

  const targetKeys = getLineupCoverageKeys(trimmed);
  if (!targetKeys.length) {
    return null;
  }

  for (const item of catalog) {
    const djKey = normalizeArtistNameKey(item.name);
    if (!djKey) {
      continue;
    }
    if (
      targetKeys.some(
        (targetKey) =>
          djKey === targetKey ||
          djKey.includes(targetKey) ||
          targetKey.includes(djKey),
      )
    ) {
      return item;
    }
  }

  return null;
}
