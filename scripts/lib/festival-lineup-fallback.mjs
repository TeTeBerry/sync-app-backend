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
    'data',
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
    'data',
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

/** Read `EDC_ORLANDO_ARTISTS` names from seed when Mongo has no performances. */
export function loadEdcOrlandoFallbackNames() {
  const seedPath = join(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'itinerary',
    'edc-orlando-itinerary.seed.ts',
  );

  try {
    const content = readFileSync(seedPath, 'utf8');
    const block = content.match(/const EDC_ORLANDO_ARTISTS[\s\S]*?\];/)?.[0] ?? '';
    const names = [
      ...block.matchAll(/dj\('((?:\\'|[^'])*)'/g),
    ].map((match) => match[1].replace(/\\'/g, "'"));

    if (names.length) {
      return names;
    }
  } catch {
    // fall through
  }

  return ['MARTIN GARRIX', 'DAVID GUETTA', 'HARDWELL', 'STEVE AOKI'];
}

/** Read `ULTRA_EUROPE_ARTIST_NAMES` from seed when Mongo has no performances. */
export function loadUltraEuropeFallbackNames() {
  const seedPath = join(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'itinerary',
    'ultra-europe-itinerary.seed.ts',
  );

  try {
    const content = readFileSync(seedPath, 'utf8');
    const block =
      content.match(/export const ULTRA_EUROPE_ARTIST_NAMES = [\s\S]*?];/)?.[0] ??
      '';
    const names = [
      ...block.matchAll(/'((?:\\'|[^'])*)'/g),
    ].map((match) => match[1].replace(/\\'/g, "'"));

    if (names.length) {
      return names;
    }
  } catch {
    // fall through
  }

  return ['MARTIN GARRIX', 'TIËSTO', 'ARMIN VAN BUUREN', 'HARDWELL'];
}

/** Read `WORLD_DJ_FESTIVAL_ARTIST_NAMES` from seed when Mongo has no performances. */
export function loadWorldDjfFallbackNames() {
  const seedPath = join(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'itinerary',
    'world-dj-festival-japan-itinerary.seed.ts',
  );

  try {
    const content = readFileSync(seedPath, 'utf8');
    const block =
      content.match(/export const WORLD_DJ_FESTIVAL_ARTIST_NAMES = [\s\S]*?];/)?.[0] ??
      '';
    const names = [
      ...block.matchAll(/'((?:\\'|[^'])*)'/g),
    ].map((match) => match[1].replace(/\\'/g, "'"));

    if (names.length) {
      return names;
    }
  } catch {
    // fall through
  }

  return ['PORTER ROBINSON', 'KSHMR', 'ANGERFIST', 'VERTILE'];
}

/** Read `TOMORROWLAND_THAILAND_ARTISTS` names from seed when Mongo has no performances. */
export function loadTomorrowlandThailandFallbackNames() {
  const seedPath = join(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'itinerary',
    'tomorrowland-thailand-itinerary.seed.ts',
  );

  try {
    const content = readFileSync(seedPath, 'utf8');
    const block =
      content.match(/const TOMORROWLAND_THAILAND_ARTISTS[\s\S]*?\];/)?.[0] ?? '';
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
  /** Discogs lists as "Kream (4)" */
  KREAM: 2669995,
  MEDUZA: 7012514,

  // --- World DJ Festival Japan (day 1) ---
  /** Discogs #539626 is a US marimba player */
  'MIKE PERRY': 781755,
  'PORTER ROBINSON': 1095210,
  KSHMR: 3763692,
  /** Discogs #2624525 is Brooks (11) */
  QUINTINO: 1437686,
  ANGERFIST: 25958,
  'LUCAS & STEVE': 2500315,
  'CHEAT CODES': 4602891,
  'LIKE MIKE': 806561,
  'LIKE MIKE (MAIN STAGE DJ SET)': 806561,
  'SOUND RUSH': 4440037,
  ATMOZFEARS: 1342829,
  VERTILE: 7233886,
  'DUAL DAMAGE': 12581201,
  TONESHIFTERZ: 1587633,
  TATSUNOSHIN: 9444280,
  /** Discogs "DAIKI (12)" — Electro House DJ, Tokyo */
  DAIKI: 9998461,
  /** Dream Stage hardstyle producer; stage name LILY */
  LILY: 9333424,
};

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

  // --- EDC Orlando ---
  'ME N Ü': 'Me n Ü',
  'ROSSI.': 'Rossi.',
  CØNTRA: 'Contra',
  'M81!': 'M81',
  'JKYL & HYDE': 'Jkyl & Hyde',
  'KI/KI': 'KI/KI',
  'AR/CO': 'AR/CO',
  'A LITTLE SOUND': 'A Little Sound',
  'FURY WITH MC DINO': 'Fury',
  KREAM: 'Kream (4)',
  MEDUZA: 'Meduza',
  DISCIP: 'Discip (2)',
  BENDA: 'Benda (2)',
  BRUNELLO: 'Brunello (2)',
  MPH: 'MPH (3)',

  // --- Ultra Europe ---
  'ARMIN VAN BUUREN': 'Armin van Buuren',
  ALESSO: 'Alesso',
  NGHTMRE: 'NGHTMRE',
  MATRODA: 'Matroda',
  'JOHN SUMMIT': 'John Summit',
  TIËSTO: 'Tiësto',
  'STEVE ANGELLO': 'Steve Angello',
  'JOEL CORRY': 'Joel Corry',
  GRYFFIN: 'Gryffin',
  'WILLY WILLIAM': 'Willy William',
  AFROJACK: 'Afrojack',
  HARDWELL: 'Hardwell',
  'CARL COX': 'Carl Cox',
  SOLOMUN: 'Solomun',
  'JOHANNES BRECHT': 'Johannes Brecht',
  ARTBAT: 'Artbat',
  'TOMO IN DER MÜHLEN': 'Tomo in der Nachten',
  GINCHY: 'Ginchy',
  'BRINA KNAUSS': 'Brina Knauss',
  MRAK: 'Mrak',
  'AMELIE LENS': 'Amelie Lens',
  'ADAM BEYER': 'Adam Beyer',
  'MAU P': 'Mau P',
  INSOLATE: 'Insolate',
  KOROLOVA: 'Korolova',
  'BLOCK & CROWN': 'Block & Crown',
  'MIKE & ME': 'Mike & Me',
  'JIMMY CLASH & TRICKY GULLIVAN': 'Jimmy Clash',
  'NILS VAN ZANDT': 'Nils van Zandt',
  'GIAN VARELA': 'Gian Varela',
  MAIREE: 'Mairee',
  KEVU: 'Kevu',
  'ALEX PIZZUTI': 'Alex Pizzuti',
  MOONSHOT: 'Moonshot',
  WREX: 'Wrex',
  XANI: 'Xani',
  PERCASSI: 'Percassi',
  DOSSCHY: 'Dosschy',
  'RYAN NOGAR': 'Ryan Nogar',
  CIRILLO: 'Cirillo',
  WEKINGZ: 'Wekingz',
  'FRANK JEZ': 'Frank Jez',
  MANDAS: 'Mandas',
  YASHA: 'Yasha',
  VANILLAZ: 'Vanillaz',
  'MALENA NARVAY': 'Malena Narvay',
  'NICK HAVSEN': 'Nick Havsen',
  'VICTOR CARDENAS': 'Victor Cardenas',
  KHARDIAC: 'Khardiac',
  WAGS: 'Wags',
  'MIKE BOND': 'Mike Bond',
  'VEDRAN CAR': 'Vedran Car',
  LORENZO: 'Lorenzo',
  BROZ: 'Broz',
  JAMLES: 'Jamles',
  'JAMES CARTER': 'James Carter',

  // --- World DJ Festival Japan ---
  'PORTER ROBINSON': 'Porter Robinson',
  KSHMR: 'Kshmr',
  'CHEAT CODES': 'Cheat Codes',
  'MIKE PERRY': 'Mike Perry',
  QUINTINO: 'Quintino',
  'LIKE MIKE (MAIN STAGE DJ SET)': 'Like Mike',
  ANGERFIST: 'Angerfist',
  VERTILE: 'Vertile',
  'DUAL DAMAGE': 'Dual Damage',
  TONESHIFTERZ: 'Toneshifterz',
  ATMOZFEARS: 'Atmozfears',
  'SOUND RUSH': 'Sound Rush',
  'FØOMIE?': 'Foomie',
  'DJ HADOU': 'DJ Hadou',
  ALOK: 'Alok',
  GALANTIS: 'Galantis',
  'BLACK TIGER SEX MACHINE': 'Black Tiger Sex Machine',
  MESTO: 'Mesto',
  'SICK INDIVIDUALS': 'Sick Individuals',
  'RETROVISION B2B JEONGHYEON': 'Retrovision',
  'MAAM & KOKI': 'Maam & Koki',
  'CHARLIE SPARKS': 'Charlie Sparks',
  'STAN CHRIST': 'Stan Christ',
  FOVOS: 'Fovos',
  SMACK: 'Smack',
  PAWLOWSKI: 'Pawlowski',
  KiBØ: 'Kibo',

  // --- Defqon.1 2026 (display name → Discogs search) ---
  'ROOLER - 3 HOUR SET': 'Rooler',
  'VERTILE: EVERYTHING CHANGES LIVE': 'Vertile',
  'WILDSTYLEZ - BACK 2 BASICS': 'Wildstylez',
  'ENCORE WITH PHUTURE NOIZE': 'Phuture Noize',
  'GUNZ FOR HIRE - XV THE UNDERGROUND KINGS': 'Gunz For Hire',
  'THE SPOTLIGHT WITH BRENNAN HEART': 'Brennan Heart',
  'FRONTLINER & MAX ENFORCER': 'Fronliner',
  'ZATOX & MAD DOG': 'Zatox',
  'AUDIOTRICZ LIVE': 'Audiotricz',
  'NOISECONTROLLERS TWO DECADES': 'Noisecontrollers',
  'LNY TNZ X JEBROER': 'LNY TNZ',
  'REJECTA & ADARO': 'Rejecta',
  'THE PITCHER & SLIM SHORE PRESENT THIS IS WHO WE ARE!': 'The Pitcher',
  'DEVIN WILD - AMONG THE NOISE': 'Devin Wild',
  'DEEZL: AEON': 'Deezl',
  'CRYEX': 'Cryex',
  'EVIL ACTIVITIES': 'Evil Activities',
  'GEZELLIGE UPTEMPO': 'Gezellige Uptempo',
  'GHOST-LACTIXX': 'Ghostlactixx',
  'HARDE KWARK': 'Harde Kwark',
  'BREAK BY DL': 'Break by DL',
  'FIGHT SWITCH': 'Fight Switch',
  'DIRTY LIL MONKEYZ': 'Dirty Lil Monkeyz',
  'ARABIERQANTUS': 'Arabierqantus',
  'COENFETTI': 'Coenfetti',
  'FEESTNATION': 'Feestnation',
  'MURDOCK': 'Murdock',
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
  'ARTBAT B2B R3HAB': ['artbat', 'r3hab'],
  'KEVIN DE VRIES B2B MORTEN': ['kevinderies', 'morten'],
  'ELI & FUR B2B YOTTO': ['eliandfur', 'yotto'],
  'FLOSSTRADAMUS B2B YELLOW CLAW': ['flosstradamus', 'yellowclaw'],
  'AMBER BROOS B2B SPACE 92': ['amberbroos', 'space92'],
  'AMÉMÉ B2B HONEYLUV': ['ameme', 'honeyluv'],
  'BLASTOYZ B2B WHITENO1SE': ['blastoyz', 'whiteno1se'],
  'MAD MAXX B2B STRYKER': ['madmaxx', 'stryker'],
  VEGAS: ['vegas'],
  'SKULL MACHINE (BLACK TIGER SEX MACHINE X KAI WACHI)': [
    'blacktigersexmachine',
    'kaiwachi',
  ],
  'SKULL MACHINE': ['blacktigersexmachine', 'kaiwachi'],
  'SHIPE B2B DJ JOCK': ['shipe', 'djjock'],
  'ADAM BEYER B2B MAU P': ['adambeyer', 'maup'],
  'ALE BASCIANO B2B MARCO NINNI': ['alebasciano', 'marconinni'],
  'CASPER YU B2B SHANG': ['casperyu', 'shang'],
  'BLACK OPS B2B BRANDON': ['blackops', 'brandon'],
  'SMILE B2B KZ BEATZ': ['smile', 'kzbeatz'],
  'JOHN MASAKI & KIM SANE': ['johnmasaki', 'kimsane'],
  'JIMMY CLASH & TRICKY GULLIVAN': ['jimmyclash', 'trickygullivan'],
  'BLOCK & CROWN': ['block', 'crown'],
  'MIKE & ME': ['mike', 'me'],
  'DJ HADOU B2B FØOMIE?': ['djhadou', 'foomie'],
  'LIKE MIKE (MAIN STAGE DJ SET)': ['likemike'],
  'ATMOZFEARS B2B SOUND RUSH': ['atmozfears', 'soundrush'],
  'YUNPI B2B 417': ['yunpi', '417'],
  'RETROVISION B2B JEONGHYEON': ['retrovision', 'jeonghyeon'],
  'MAAM & KOKI': ['maam', 'koki'],
  'BLACK TIGER SEX MACHINE': ['blacktigersexmachine'],
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
  WORSHIP: {
    discogsId: 990000009,
    name: 'Worship',
    realName: '',
    profile:
      'Drum & bass collective featuring Sub Focus, Dimension, Culture Shock, and 1991. Billed as Worship on festival lineups including EDC Thailand.',
    genres: ['Electronic'],
    styles: ['Drum n Bass', 'Jungle'],
    country: 'United Kingdom',
    urls: [],
    members: ['Sub Focus', 'Dimension', 'Culture Shock', '1991'],
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
