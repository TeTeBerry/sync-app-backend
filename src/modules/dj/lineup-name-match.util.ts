/** Keep in sync with `scripts/lib/festival-lineup-fallback.mjs` */

const B2B_PATTERN = /\s+B2B\s+/i;
const AMPERSAND_PATTERN = /\s+&\s+/;
const COLLAB_X_PATTERN = /\s+[X×]\s+/i;

const DUO_LINEUP_ACTS = new Set([
  'ABOVE & BEYOND',
  'ALY & FILA',
  'BLOCK & CROWN',
  'COSMIC GATE',
  'D-BLOCK & S-TE-FAN',
  'DIMITRI VEGAS & LIKE MIKE',
  'ELI & FUR',
  'JKYL & HYDE',
  'LUCAS & STEVE',
  'MATISSE & SADKO',
  'MIKE & ME',
  'TAIKI & NULIGHT',
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
  GHENGAR: 'Ghengar',
  'VIDOJEAN (VJ X OL)': 'Vidojean',
  VIDOJEAN: 'Vidojean',
  WHYBEATZ: 'WhyBeatz',
  '999999999': '999999999',
  BLONDEX: 'Blondex',
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
  HALO: 'Halō',
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
  BADVICE: 'BadVice DJ',
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
  CRYEX: 'Cryex',
  'END OF LINE: CRYEX': 'Cryex',
  'INNER CIRCLE SHOWCASE: XENSE': 'Xense',
  'QLUBTEMPO PARADE: LUNA': 'Luna',
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
  'PURPLE RABBIT': 'Purple Rabbit',
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
  $AVVY: '$Avvy',
  'WES S': 'Wes S',
  'SLIM SHORE PRESENT THIS IS WHO WE ARE!': 'Slim Shore',
  ME: 'Me (3)',
  COONE: 'Coone',
  NAKADIA: 'Nakadia',
  DADOO: 'Dadoo',
  FIRAGA: 'Firaga',
  'SAINT LUDO': 'Saint Ludo',
  BOTCASH: 'Botcash',
  'SOFI TUKKER': 'Sofi Tukker',
  'SVDDEN DEATH': 'Svdden Death',
  BASSCON: 'Basscon',
  TWINSICK: 'Twinsick',
  'THE SPOTLIGHT WITH HYSTA': 'Hysta',
  'ABADDON PURE DOMINATION FT. MC RECKLESS': 'Abaddon',
  'LNY TNZ X JEBROER': 'LNY TNZ',
  'GASDROP X BASS CHASERZ X DR. RUDE X HANS GLOCK': 'Gasdrop',
  'GASDROP X FEEST MODULATORS': 'Gasdrop',
  'THE PITCHER & SLIM SHORE PRESENT THIS IS WHO WE ARE!': 'The Pitcher',
  'LOUD & FOUT': 'Loud (7)',
  'T & SUGAH': 'T & Sugah',
  'WES S & $AVVY': 'Wes S',
  'CRO & STEENVOLK': 'Cro (3)',
  // --- Creamfields ---
  'AMELIE LENS PRESENTS AURA': 'Amelie Lens',
  'ANDY C FT TONN PIPER': 'Andy C',
  LAU: 'LAU.RA',
};

export const LINEUP_COVERAGE_NAME_KEYS: Record<string, string[]> = {
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

function expandAmpersandLineupParts(lineupName: string): string[] {
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

function stripLineupPresentsSuffix(lineupName: string): string {
  const trimmed = lineupName.trim();
  const idx = trimmed.search(/\s+PRESENTS?\b[\s:.\-]/i);
  if (idx < 0) {
    return trimmed;
  }
  return trimmed.slice(0, idx).trim();
}

/** `Amelie Lens Presents AURA` → `Amelie Lens` (not `X Present: Y` showcase titles). */
function stripLineupEventPresentsSuffix(lineupName: string): string {
  const trimmed = lineupName.trim();
  const eventBrand = trimmed.match(/^(.+?)\s+presents\s+[\w.]+\s*$/i);
  if (eventBrand?.[1]) {
    return eventBrand[1].trim();
  }
  return trimmed;
}

function stripFtFeaturedSuffix(lineupName: string): string {
  const trimmed = lineupName.trim();
  const ftPattern = /\s+FT\.?\s+|\s+FEAT(?:\.|URING)?\.?\s+/i;
  if (!ftPattern.test(trimmed)) {
    return trimmed;
  }
  return (trimmed.split(ftPattern)[0] ?? '').trim() || trimmed;
}

function expandCollaboratorXParts(lineupName: string): string[] {
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

export function expandFestivalArtistName(lineupName: string): string[] {
  const trimmed = lineupName.trim();
  if (!trimmed || trimmed === '国内艺人') {
    return [];
  }

  const billingHead = stripLineupEventPresentsSuffix(
    stripFtFeaturedSuffix(trimmed),
  );
  let parts = [billingHead];

  const parenMatch = billingHead.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
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

export function normalizeArtistNameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function getLineupCoverageKeys(lineupName: string): string[] {
  const trimmed = lineupName.trim();
  const upper = trimmed.toUpperCase();
  const explicit = LINEUP_COVERAGE_NAME_KEYS[upper];
  if (explicit?.length) {
    return [
      ...new Set(
        explicit
          .map((key) => normalizeArtistNameKey(key))
          .filter((key) => key.length >= 3),
      ),
    ];
  }

  const expanded = expandFestivalArtistName(trimmed);
  if (expanded.length > 1) {
    return [
      ...new Set(
        expanded
          .map((part) => normalizeArtistNameKey(part))
          .filter((key) => key.length >= 3),
      ),
    ];
  }

  const keys = [normalizeArtistNameKey(trimmed)].filter(
    (key) => key.length >= 3,
  );
  const alias = DISCOGS_LINEUP_SEARCH_ALIASES[upper];
  if (alias) {
    keys.push(normalizeArtistNameKey(alias));
  }
  return [...new Set(keys.filter((key) => key.length >= 3))];
}

export function matchLineupArtistToCatalog<
  T extends { name: string; discogsId?: number },
>(lineupName: string, catalog: T[]): T | null {
  const trimmed = lineupName.trim();

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
    if (!djKey || djKey.length < 3) {
      continue;
    }
    if (targetKeys.some((targetKey) => djKey === targetKey)) {
      return item;
    }
  }

  return null;
}
