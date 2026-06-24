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
  /** Discogs lists as "Kream (4)" */
  KREAM: 2669995,
  /** Italian house trio — Discogs "Meduza (10)" */
  MEDUZA: 7012514,
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
  /** EDC Orlando stage / showcase labels */
  'DISCOVERY PROJECT',
  'FACTORY 93 PRESENTS',
  'BIG FLORIDA',
  /** No reliable Discogs row */
  'AAT',
  'ADRIÁN MILLS',
  'ALVES',
  'AVELLO',
  'FALLON',
  'FURY WITH MC DINO',
  'KINHAU',
  'MADVKTM',
  'MATTHIAS',
  'ME N Ü',
  'M81!',
  'RAJE',
  'ULTRATHEM',
  'DISCIP',
  'SORAERE BROCKEN',
  /** No reliable Discogs row — wrong "Cheez" bassist page on exact search */
  'CHEEZ & YUKA',
  /** No reliable Discogs row — Italian prog band "Nome" on exact search */
  'NOME.',
  /** Ultra Europe — Discogs homonyms / no reliable row */
  'NOME',
  'MATT',
  'BLANK',
  'OAK',
  'TANK',
  'CARLOM',
  'JOWAVES',
  'MYKRIS',
  'JOE2SHINE',
  'JULIAN CROSS',
  'NAESTOR',
  'NOTXERIUS',
  'YAMATOMAYA',
  'GEMINO',
  /** World DJ Festival Japan — local / homonym-prone artists */
  'DJ HADOU',
  'FØOMIE?',
  'MIU',
  'LILY',
  'FLAVIO',
  'YUNKORO',
  'DAIKI',
  'TATSUNOSHIN',
  'SAULE',
  'CORE',
  'JUNI',
  'RYU',
  '417',
  'YUNPI',
  'GAGAKU',
  'MITOCHY',
  'SHO-TA',
  /** World DJ Festival Japan day 2 — stage showcases / local artists */
  'SIGNATURE SHOW',
  'ROAD TO WELCOME STAGE',
  'NICOLE CHEN',
  'KDH',
  'MACKEY',
  'PIXEL',
  'SARA',
  'CHAWON',
  'MAAM & KOKI',
  'KiBØ',
  'MN4',
  'ASTERA',
  'SYZYGY',
  'I.G.A',
  'BEAUTY NOISE TOKYO',
  'LIL NANAA',
  'NATSUMI',
  'POKO',
  'GARKO',
  'ADI',
  'YAMAHIRO',
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
