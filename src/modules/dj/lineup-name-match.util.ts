/** Keep in sync with `scripts/lib/festival-lineup-fallback.mjs` */

const B2B_PATTERN = /\s+B2B\s+/i;

export const DISCOGS_LINEUP_ARTIST_IDS: Record<string, number> = {
  KANINE: 5865864,
  'SVDDEN DEATH': 5375145,
  'HOHO ONE': 1889815,
  'DJ SNAKE': 4046989,
  /** Discogs search homonym — UK radio DJ Marsha Smith shares the stage name */
  MARSHMELLO: 4688591,
  /** Discogs #561124 is a different Alan Walker */
  'ALAN WALKER': 4827622,
  /** Discogs #564801 is a Hong Kong sound artist */
  ALOK: 1588397,
  /** Discogs #911928 is a San Francisco post-rock band */
  CARTA: 5126278,
  /** Discogs #187821 is an R&B singer */
  'JAMIE JONES': 434183,
  /** Discogs #1989806 is a disambiguation stub — Rune Reilly Kölsch is #688469 */
  KÖLSCH: 688469,
  /** Discogs #1310846 is a different Oppidan */
  OPPIDAN: 10423519,
};

/** No reliable Discogs profile — skip crawl; genres always from itinerary seed. */
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
  /** No reliable Discogs row — wrong "Cheez" bassist page on exact search */
  'CHEEZ & YUKA',
  /** No reliable Discogs row — Italian prog band "Nome" on exact search */
  'NOME.',
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
  OPPIDAN: 'Oppidan (2)',
  'ALY & FILA': 'Aly & Fila',
  'DIMITRI VEGAS & LIKE MIKE': 'Dimitri Vegas & Like Mike',
  'SWEDISH HOUSE MAFIA': 'Swedish House Mafia',
  NERVO: 'Nervo',
  // --- Tomorrowland Thailand ---
  '22 BULLETS': '22Bullets',
  'DA TWEEKAZ': 'Da Tweekaz',
  JERROOO: 'Jerro',
  KÖLSCH: 'Kölsch',
  'AN!KA': 'An!ka',
  AMÉMÉ: 'Amémé',
  WHITENO1SE: 'Whiteno1se',
  BLASTOYZ: 'Blastoyz',
  'SUB ZERO PROJECT': 'Sub Zero Project',
  'XCLUB.': 'X Club',
  SM1LE: 'SM1LE',
  'JELLE DK': 'Jelle DK',
  HALŌ: 'Halō',
  VEGAS: 'Vegas (2)',
  'ELI & FUR': 'Eli & Fur',
  YOTTO: 'Yotto',
  MORTEN: 'Morten',
  STRYKER: 'Stryker',
  'SPACE 92': 'Space 92',
  HONEYLUV: 'Honeyluv',
  'AMBER BROOS': 'Amber Broos',
  'MAD MAXX': 'Mad Maxx',
  FLOSSTRADAMUS: 'Flosstradamus',
  'MATISSE & SADKO': 'Matisse & Sadko',
  'LUCAS & STEVE': 'Lucas & Steve',
  'KEVIN DE VRIES': 'Kevin de Vries',
  'MIND AGAINST': 'Mind Against',
  'COSMIC GATE': 'Cosmic Gate',
  'INFECTED MUSHROOM': 'Infected Mushroom',
  'VINI VICI': 'Vini Vici',
  'LAIDBACK LUKE': 'Laidback Luke',
  'LOST FREQUENCIES': 'Lost Frequencies',
  'STEVE AOKI': 'Steve Aoki',
  'MARTIN GARRIX': 'Martin Garrix',
  'ALAN WALKER': 'Alan Walker',
  'FERRY CORSTEN': 'Ferry Corsten',
  'THIRD PARTY': 'Third Party',
  'GHOST RIDER': 'Ghost Rider',
  'JOHN NEWMAN': 'John Newman',
  'RAVE REPUBLIC': 'Rave Republic',
  WHISNU: 'Whisnu Santika',
  'WHISNU SANTIKA': 'Whisnu Santika',
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
  'DIMITRI VEGAS & LIKE MIKE': ['dimitrivegas', 'likemike'],
  'ARTBAT B2B R3HAB': ['artbat', 'r3hab'],
  'KEVIN DE VRIES B2B MORTEN': ['kevinderies', 'morten'],
  'ELI & FUR B2B YOTTO': ['eliandfur', 'yotto'],
  'FLOSSTRADAMUS B2B YELLOW CLAW': ['flosstradamus', 'yellowclaw'],
  'AMBER BROOS B2B SPACE 92': ['amberbroos', 'space92'],
  'AMÉMÉ B2B HONEYLUV': ['ameme', 'honeyluv'],
  'BLASTOYZ B2B WHITENO1SE': ['blastoyz', 'whiteno1se'],
  'MAD MAXX B2B STRYKER': ['madmaxx', 'stryker'],
  VEGAS: ['vegas'],
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

export function matchLineupArtistToCatalog<
  T extends { name: string; discogsId?: number },
>(lineupName: string, catalog: T[]): T | null {
  const trimmed = lineupName.trim();
  if (SEED_ONLY_LINEUP_ARTISTS.has(trimmed.toUpperCase())) {
    return null;
  }

  const forcedId = DISCOGS_LINEUP_ARTIST_IDS[trimmed.toUpperCase()];
  if (forcedId) {
    const forced = catalog.find((item) => item.discogsId === forcedId);
    if (forced) {
      return forced;
    }
  }

  const alias = DISCOGS_LINEUP_SEARCH_ALIASES[trimmed.toUpperCase()];
  if (alias) {
    const aliasKey = normalizeArtistNameKey(alias);
    const aliasHit = catalog.find(
      (item) => normalizeArtistNameKey(item.name) === aliasKey,
    );
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
    if (targetKeys.some((targetKey) => djKey === targetKey)) {
      return item;
    }
  }

  return null;
}
