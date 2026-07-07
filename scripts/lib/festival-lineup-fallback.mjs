import { extractLineupDiscogsSearchNames } from './lineup-discogs-search.mjs';

const B2B_PATTERN = /\s+B2B\s+/i;
const AMPERSAND_PATTERN = /\s+&\s+/;
const COLLAB_X_PATTERN = /\s+[X×]\s+/i;

/** Festival duo acts that share one Discogs artist page — do not split on `&` / `X`. */
const DUO_LINEUP_ACTS = new Set([
  'ABOVE & BEYOND',
  'ALY & FILA',
  'COSMIC GATE',
  'D-BLOCK & S-TE-FAN',
  'DIMITRI VEGAS & LIKE MIKE',
  'ELI & FUR',
  'JKYL & HYDE',
  'LUCAS & STEVE',
  'MATISSE & SADKO',
  'TAIKI & NULIGHT',
]);

function expandAmpersandLineupParts(lineupName) {
  const trimmed = lineupName.trim();
  if (!trimmed || !AMPERSAND_PATTERN.test(trimmed)) {
    return trimmed ? [trimmed] : [];
  }
  if (DUO_LINEUP_ACTS.has(trimmed.toUpperCase())) {
    return [trimmed];
  }
  return trimmed
    .split(AMPERSAND_PATTERN)
    .map((part) => part.trim())
    .filter(Boolean);
}

function stripLineupPresentsSuffix(lineupName) {
  const trimmed = lineupName.trim();
  const idx = trimmed.search(/\s+PRESENTS?\b[\s:.\-]/i);
  if (idx < 0) {
    return trimmed;
  }
  return trimmed.slice(0, idx).trim();
}

function expandCollaboratorXParts(lineupName) {
  const trimmed = lineupName.trim();
  if (!trimmed || !COLLAB_X_PATTERN.test(trimmed)) {
    return trimmed ? [trimmed] : [];
  }
  if (DUO_LINEUP_ACTS.has(trimmed.toUpperCase())) {
    return [trimmed];
  }
  return trimmed
    .split(COLLAB_X_PATTERN)
    .map((part) => stripLineupPresentsSuffix(part.trim()))
    .filter(Boolean);
}

/**
 * Expand lineup display names into searchable solo artists.
 * - `GREEN VELVET B2B STEVE ANGELLO` → two artists
 * - `JOHN MASAKI & KIM SANE` → two artists (when coverage keys are split)
 * - `ABOVE & BEYOND` → one artist (duo act)
 * - `LEVELTRONICS (SUBTRONICS B2B LEVEL UP)` → LEVELTRONICS + SUBTRONICS + LEVEL UP
 * - `GHENGAR (GHASTLY)` → GHengar only (alias in parens is not crawled separately)
 */
export function expandFestivalArtistName(lineupName) {
  const trimmed = lineupName.trim();
  if (!trimmed || trimmed === '国内艺人') {
    return [];
  }

  let parts = [trimmed];

  const parenMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const main = parenMatch[1].trim();
    const inner = parenMatch[2].trim();
    if (B2B_PATTERN.test(inner)) {
      parts = [
        main,
        ...inner
          .split(B2B_PATTERN)
          .map((part) => part.trim())
          .filter(Boolean),
      ];
    } else {
      parts = main ? [main] : [];
    }
  } else if (B2B_PATTERN.test(trimmed)) {
    parts = trimmed
      .split(B2B_PATTERN)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [
    ...new Set(
      parts
        .flatMap((part) => expandAmpersandLineupParts(part))
        .flatMap((part) => expandCollaboratorXParts(part)),
    ),
  ];
}

export function expandFestivalArtistNames(lineupNames) {
  return [
    ...new Set(lineupNames.flatMap((name) => expandFestivalArtistName(name))),
  ];
}

/** True when the display name is a B2B or split-able `&` combo (not a solo crawl target). */
export function isCompositeLineupDisplayName(lineupName) {
  const trimmed = lineupName.trim();
  if (!trimmed) {
    return false;
  }
  const expanded = expandFestivalArtistName(trimmed);
  return expanded.length > 1;
}

/** Discogs search aliases for hard-to-match EDC lineup display names. */
export const DISCOGS_LINEUP_SEARCH_ALIASES = {
  'AFEM SYKO': 'Afem Syko',
  'LEVEL UP': 'Level Up',
  LEVELTRONICS: 'Subtronics',
  'NOISE MAFIA': 'Noise Mafia',
  'SHOWTEK HARDSTYLE SET': 'Showtek',
  'SPACE 92 X POPOF PRESENT: TURBULENCES': 'Space 92',
  'TAIKI NULIGHT': 'Taiki & Nulight',
  /** WUKONG × Bassjackers — see https://djmag.com/top100djs/2025/83/wukong */
  WUJACKERS: 'Wukong',
  'GHENGAR (GHASTLY)': 'Ghengar',
  GHENGAR: 'Ghengar',
  'VIDOJEAN (VJ X OL)': 'Vidojean',
  VIDOJEAN: 'Vidojean',
  WHYBEATZ: 'WhyBeatz',
  999999999: '999999999',
  BLONDEX: 'Blondex',
  'NO1 (HONGJOONG)': 'Hongjoong',
  'BEN NICKY PRESENTS XTREME': 'Ben Nicky',
  'BEN NICKY': 'Ben Nicky',
  'DEVIN WILD': 'Devin Wild',
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
  PARTYRASER: 'Partyraiser',
  'SCOT PROJECT': 'DJ Scot Project',
  PAVO: 'DJ Pavo',
  'XCLUB.': 'X Club',
  SM1LE: 'SM1LE',
  'JELLE DK': 'Jelle DK',
  HALŌ: 'Halō',
  VEGAS: 'Vegas (2)',
  'ELI & FUR': 'Eli & Fur',
  YOTTO: 'Yotto',
  MORTEN: 'Morten (4)',
  STRYKER: 'Stryker',
  'SPACE 92': 'Space 92',
  HONEYLUV: 'Honeyluv',
  'AMBER BROOS': 'Amber Broos',
  'MAD MAXX': 'Mad Maxx',
  FLOSSTRADAMUS: 'Flosstradamus',
  FLOSSTRADAMUSS: 'Flosstradamus',
  NUTTRIX: 'Nuttrix',
  'DJ SALLY': 'DJ Sally',
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
  'JOHN SUMMIT': 'John Summit',
  AFROJACK: 'Afrojack',
  HARDWELL: 'Hardwell',
  MADDIX: 'Maddix',
  'DJ SNAKE': 'DJ Snake',
  FISHER: 'Fisher',
  'CALVIN HARRIS': 'Calvin Harris',
  'DOM DOLLA': 'Dom Dolla',
  'OLIVER HELDENS': 'Oliver Heldens',
  SUBTRONICS: 'Subtronics',
  CAMELPHAT: 'CamelPhat',
  'ADAM BEYER': 'Adam Beyer',
  'MAU P': 'Mau P',
  'SARA LANDRY': 'Sara Landry',
  'I HATE MODELS': 'I Hate Models',
  'DASH BERLIN': 'Dash Berlin',
  'TOMO IN DER MÜHLEN': 'Tomo in der Nachten',
  'BLOCK & CROWN': 'Block & Crown',
  'MIKE & ME': 'Mike & Me',
  'NILES VAN ZANDT': 'Nils van Zandt',
  KEVU: 'Kevu',
  'ALEX PIZZUTI': 'Alex Pizzuti',
  WREX: 'Wrex',
  'RYAN NOGAR': 'Ryan Nogar',
  'FRANK JEZ': 'Frank Jez',
  MANDAS: 'Mandas',
  VANILLAZ: 'Vanillaz',
  WAGS: 'Wags',
  'MIKE BOND': 'Mike Bond',
  LORENZO: 'Lorenzo',
  'JAMIE JONES': 'Jamie Jones',
  'MISS MONIQUE': 'Miss Monique',
  'WILL ATKINSON': 'Will Atkinson',
  'NICO MORENO': 'Nico Moreno',
  'RAY VOLPE B2B SULLIVAN KING': 'Ray Volpe',
  'BUNT.': 'Bunt',
  'PLASTIK FUNK': 'Plastik Funk',
  'CIRILLO JR.': 'Cirillo',

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
  CRYEX: 'Cryex',
  'END OF LINE: CRYEX': 'Cryex',
  'INNER CIRCLE SHOWCASE: XENSE': 'Xense',
  'QLUBTEMPO PARADE: LUNA': 'Luna',
  'EVIL ACTIVITIES': 'Evil Activities',
  'GEZELLIGE UPTEMPO': 'Gezellige Uptempo',
  'GHOST-LACTIXX': 'Ghostlactixx',
  'HARDE KWARK': 'Harde Kwark',
  'BREAK BY DL': 'Break by DL',
  'FIGHT SWITCH': 'Fight Switch',
  'DIRTY LIL MONKEYZ': 'Dirty Lil Monkeyz',
  ARABIERQANTUS: 'Arabierqantus',
  COENFETTI: 'Coenfetti',
  FEESTNATION: 'Feestnation',
  MURDOCK: 'Murdock',

  // --- Combo parts (split billing → Discogs search) ---
  'PURPLE RABBIT': 'DJ Purple Rabbit',
  SHANG: 'Shang',
  DEPARTS: 'Departs',
  GASDROP: 'Gasdrop',
  'BASS CHASERZ': 'Bass Chaserz',
  'HANS GLOCK': 'Hans Glock',
  'FEEST MODULATORS': 'Feest Modulators',
  'DIKKE BAAP PRESENTS GEZELLIGE BAAP': 'Dikke Baap',
  'DIKKE BAAP - BOUNCE SET': 'Dikke Baap',
  JEBROER: 'JeBroer',
  DEEPACK: 'Deepack',
  'MARK WITH A K': 'Mark With A K',
  'MC CHUCKY': 'MC Chucky',
  'PAT B': 'Pat B',
  'MISS PUSS': 'Miss Puss',
  'KZ BEATZ': 'Kz Beatz',
  'NELLY IS NOT MY NAME': 'Nelly Is Not My Name',
  'POPOF PRESENT: TURBULENCES': 'Popof',
  YUNPI: 'Yunpi',
  LOUD: 'Loud (7)',
  FOUT: 'Fout',
  CRO: 'Cro (3)',
  STEENWOLK: 'Steenwolk',
  SUGAH: 'Sugah',
  '$AVVY': '$Avvy',
  'WES S': 'Wes S',
  'SLIM SHORE PRESENT THIS IS WHO WE ARE!': 'Slim Shore',
  ME: '&Me',

  // --- Pending solos / showcase billings ---
  COONE: 'Coone',
  NAKADIA: 'Nakadia',
  DADOO: 'Dadoo',
  FIRAGA: 'Dj Firaga',
  Firaga: 'Dj Firaga',
  'FREDDY CHASERZ': 'Bass Chaserz',
  'SAINT LUDO': 'Saint Ludo',
  BOTCASH: 'Botcash',
  'SOFI TUKKER': 'Sofi Tukker',
  'SVDDEN DEATH': 'Svdden Death',
  BASSCON: 'Basscon',
  TWINSICK: 'Twinsick',
  'THE SPOTLIGHT WITH HYSTA': 'Hysta',
  'ARTCORE WITH RUFFNECK': 'Artcore',
  'ABADDON PURE DOMINATION FT. MC RECKLESS': 'Abaddon',
  'AMIGO - UPTEMPO FIESTA': 'Amigo',
  'BASS CHASERZ - DE REÜNIE': 'Bass Chaserz',
  'BASS SHAKER - BELGIAN BOYBAND': 'Bass Shaker',
  'DEVIN WILD - AMONG THE NOISE': 'Devin Wild',
  'WILDSTYLEZ - BACK 2 BASICS': 'Wildstylez',
  'ROOLER - 3 HOUR SET': 'Rooler',
  'AUDIOTRICZ LIVE': 'Audiotricz',
  'NOISECONTROLLERS TWO DECADES': 'Noisecontrollers',
  'GUNZ FOR HIRE - XV THE UNDERGROUND KINGS': 'Gunz For Hire',
  'ENCORE WITH PHUTURE NOIZE': 'Phuture Noize',
  'VERTILE: EVERYTHING CHANGES LIVE': 'Vertile',
  'DEEZL: AEON': 'Deezl',
  'GEZELLIGE UPTEMPO B2B DIKKE BAAP PRESENTS GEZELLIGE BAAP': 'Gezellige Uptempo',
  'PIOLINI B2B DIKKE BAAP - BOUNCE SET': 'Piolini',
  'NELLY IS NOT MY NAME B2B KYØN': 'Nelly Is Not My Name',
  'PAT B B2B MISS PUSS': 'Pat B',
  'MARK WITH A K & MC CHUCKY B2B DEEPACK': 'Mark With A K',
  'SMILE B2B KZ BEATZ': 'Smile',
  'CASPER YU B2B SHANG': 'Casper Yu',
  'YUNPI B2B 417': 'Yunpi',
  'LNY TNZ X JEBROER': 'LNY TNZ',
  'SPACE 92 X POPOF PRESENT: TURBULENCES': 'Space 92',
  'GASDROP X BASS CHASERZ X DR. RUDE X HANS GLOCK': 'Gasdrop',
  'GASDROP X FEEST MODULATORS': 'Gasdrop',
  'THE PITCHER & SLIM SHORE PRESENT THIS IS WHO WE ARE!': 'The Pitcher',
  'LOUD & FOUT': 'Loud (7)',
  'T & SUGAH': 'T & Sugah',
  'WES S & $AVVY': 'Wes S',
  'CRO & STEENVOLK': 'Cro (3)',
  RØZ: 'Roz',
  ONEJ: 'Onej',
  MUZIE: 'Muzie',
  KINHAU: 'KinHau',
  'KNOW GOOD': 'Know Good',
  'FACTORY 93 PRESENTS': 'Factory 93',
  'INSOMNIAC RECORDS TAKEOVER': 'Insomniac Records',
  'DREAMSTATE PRESENTS ELECTRIK SEOUL': 'Dreamstate',
  'BASSRUSH EXPERIENCE': 'Bassrush',
  'AREA X': 'Area X',
  TRIPTICAL: 'Triptical',
  'TRIPTICAL NOTE': 'Triptical',
};

/**
 * Secondary Discogs search when primary lineup / alias finds no artist page.
 * e.g. GHENGAR (Ghastly's alias) → fall back to Ghastly.
 */
export const DISCOGS_LINEUP_SEARCH_FALLBACKS = {
  GHENGAR: ['Ghastly'],
  'GHENGAR (GHASTLY)': ['Ghastly'],
  MORTEN: ['Morten Breum', 'Morten (26)'],
  JEBROER: ['JeBroer', 'Jebroer'],
  COONE: ['Coone (2)'],
  DEPARTS: ['Departs (2)'],
  NAKADIA: ['Nakadia (2)'],
  DADOO: ['Dadoo (2)'],
  YUNPI: ['Yunpi'],
  'DIKKE BAAP - BOUNCE SET': ['Dikke Baap'],
  'DIKKE BAAP PRESENTS GEZELLIGE BAAP': ['Dikke Baap'],
  'SLIM SHORE PRESENT THIS IS WHO WE ARE!': ['Slim Shore', 'The Pitcher'],
  'NELLY IS NOT MY NAME': ['Nelly Is Not My Name'],
  GASDROP: ['Gasdrop'],
  'FEEST MODULATORS': ['Feest Modulators'],
  'PURPLE RABBIT': ['Purple Rabbit', 'DJ Purple Rabbit'],
  DEEPACK: ['Deepack'],
  SHANG: ['Shang (2)'],
  'KZ BEATZ': ['Kz Beatz'],
  'PAT B': ['Pat B'],
  'MISS PUSS': ['Miss Puss'],
  ME: ['Me (3)'],
};

/** Lineup display name → normalized keys of acceptable `djs.name` matches. */
export const LINEUP_COVERAGE_NAME_KEYS = {
  LEVELTRONICS: ['subtronics', 'levelup'],
  'SHOWTEK HARDSTYLE SET': ['showtek'],
  WUJACKERS: ['wukong', 'bassjackers'],
  'GHENGAR (GHASTLY)': ['ghengar', 'ghastly'],
  GHENGAR: ['ghengar', 'ghastly'],
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
  'VINJAZ B2B JIM': ['vinjaz', 'jim'],
  'NAEMS B2B MASKI & BANGA': ['naems', 'maski', 'banga'],
  'CASPER YU B2B JETEGG': ['casperyu', 'jetegg'],
  'EVAN PIERINI B2B SEAN PARK': ['evanpierini', 'seanpark'],
  'RAY VOLPE B2B SULLIVAN KING': ['rayvolpe', 'sullivanking'],
  'CARLOM B2B ARINNO': ['carlom', 'arinno'],
  'SIMO & FRANZ': ['simo', 'franz'],
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
  'LEVELTRONICS (SUBTRONICS B2B LEVEL UP)': ['subtronics', 'levelup'],
  'GEZELLIGE UPTEMPO B2B DIKKE BAAP PRESENTS GEZELLIGE BAAP': [
    'gezelligeuptempo',
    'dikkebaap',
  ],
  'PIOLINI B2B DIKKE BAAP - BOUNCE SET': ['piolini', 'dikkebaap'],
  'LNY TNZ X JEBROER': ['lnytnz', 'jebroer'],
  'SPACE 92 X POPOF PRESENT: TURBULENCES': ['space92', 'popof'],
  'GASDROP X BASS CHASERZ X DR. RUDE X HANS GLOCK': [
    'gasdrop',
    'basschaserz',
    'drrude',
    'hansglock',
  ],
  'GASDROP X FEEST MODULATORS': ['gasdrop', 'feestmodulators'],
  'MARK WITH A K & MC CHUCKY B2B DEEPACK': [
    'markwithak',
    'mcchucky',
    'deepack',
  ],
  'NELLY IS NOT MY NAME B2B KYØN': ['nellyisnotmyname', 'kyon'],
  'PAT B B2B MISS PUSS': ['patb', 'misspuss'],
  'LOUD & FOUT': ['loud', 'fout'],
  'T & SUGAH': ['t', 'sugah'],
  'WES S & $AVVY': ['wess', 'avvy'],
  'CRO & STEENVOLK': ['cro', 'steenwolk'],
  'THE PITCHER & SLIM SHORE PRESENT THIS IS WHO WE ARE!': [
    'thepitcher',
    'slimshore',
  ],
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

/** Trusted display names for strict Discogs name gate (lineup + explicit alias only). */
export function expandDjHonorificNameVariants(names) {
  const expanded = new Set(names.filter(Boolean));

  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) {
      continue;
    }

    if (!/^DJ[\s.]/i.test(trimmed)) {
      expanded.add(`DJ ${trimmed}`);
      expanded.add(`Dj ${trimmed}`);
    }

    const stripped = trimmed.replace(/^DJ[\s.]*/i, '').trim();
    if (stripped && stripped !== trimmed) {
      expanded.add(stripped);
    }
  }

  return [...expanded];
}

export function getDiscogsTrustedNameVariants(lineupName) {
  const trimmed = lineupName.trim();
  if (!trimmed) {
    return [];
  }
  const upper = trimmed.toUpperCase();
  const alias = DISCOGS_LINEUP_SEARCH_ALIASES[upper];
  const fallbacks = DISCOGS_LINEUP_SEARCH_FALLBACKS[upper] ?? [];
  const variants = [trimmed];
  if (alias && alias !== trimmed) {
    variants.push(alias);
  }
  for (const name of fallbacks) {
    if (name && !variants.includes(name)) {
      variants.push(name);
    }
  }
  const parenMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch && !/\s+B2B\s+/i.test(parenMatch[2])) {
    const inner = parenMatch[2].trim();
    if (inner && !variants.includes(inner)) {
      variants.push(inner);
    }
  }
  return expandDjHonorificNameVariants(variants);
}

export function getDiscogsSearchQueries(lineupName) {
  const trimmed = lineupName.trim();
  const upper = trimmed.toUpperCase();
  const alias = DISCOGS_LINEUP_SEARCH_ALIASES[upper];
  const fallbacks = DISCOGS_LINEUP_SEARCH_FALLBACKS[upper] ?? [];
  const extracted = extractLineupDiscogsSearchNames(trimmed);
  const queries = [];

  if (trimmed) {
    queries.push(trimmed);
  }
  if (alias && alias !== trimmed && !queries.includes(alias)) {
    queries.push(alias);
  }
  for (const name of extracted) {
    if (name !== trimmed && !queries.includes(name)) {
      queries.push(name);
    }
  }
  for (const name of fallbacks) {
    if (name && !queries.includes(name)) {
      queries.push(name);
    }
  }
  const parenMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch && !/\s+B2B\s+/i.test(parenMatch[2])) {
    const inner = parenMatch[2].trim();
    if (inner && !queries.includes(inner)) {
      queries.push(inner);
    }
  }
  return queries;
}

export function getLineupCoverageKeys(lineupName) {
  const trimmed = lineupName.trim();
  const upper = trimmed.toUpperCase();
  const explicit = LINEUP_COVERAGE_NAME_KEYS[upper];
  if (explicit?.length) {
    return [...new Set(explicit.map((key) => normalizeArtistNameKey(key)))];
  }

  const expanded = expandFestivalArtistName(trimmed);
  if (expanded.length > 1) {
    return [...new Set(expanded.map((part) => normalizeArtistNameKey(part)))];
  }

  const keys = [normalizeArtistNameKey(trimmed)];
  const alias = DISCOGS_LINEUP_SEARCH_ALIASES[upper];
  if (alias) {
    keys.push(normalizeArtistNameKey(alias));
  }
  return [...new Set(keys.filter(Boolean))];
}
