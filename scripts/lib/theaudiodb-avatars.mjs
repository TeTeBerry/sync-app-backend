/**
 * Lineup display name → TheAudioDB `search.php?s=` query.
 * Keep in sync with `DISCOGS_LINEUP_SEARCH_ALIASES` in festival-lineup-fallback.mjs.
 */
import { PREFERRED_MB_BY_LINEUP } from './lineup-rejected-discogs.mjs';
import { extractMusicBrainzIdFromUrls } from './musicbrainz-client.mjs';

export const THEAUDIODB_SEARCH_ALIASES = {
  // --- Storm / shared ---
  'AFEM SYKO': 'Afem Syko',
  'ALY & FILA': 'Aly & Fila',
  'ANDY C': 'Andy C',
  'BLONDEX': 'Blondex',
  'COONE': 'Coone',
  'CRUBBIXZ': 'Crubbixz',
  'DIMITRI VEGAS': 'Dimitri Vegas',
  'DIMITRI VEGAS & LIKE MIKE': 'Dimitri Vegas & Like Mike',
  'DJ SNAKE': 'DJ Snake',
  'ERIC PRYDZ': 'Eric Prydz',
  'EXCISION': 'Excision',
  // Fisher (OZ) — search.php?s=fisher returns a US vocal homonym stub; use MB override.
  'FISHER': 'Fisher',
  'GHENGAR': 'Ghastly',
  'GHENGAR (GHASTLY)': 'Ghastly',
  'HOHO ONE': 'Eric Kwok',
  'ILLENIUM': 'Illenium',
  'KANINE': 'Kanine',
  'KREAM': 'Kream',
  'LEVEL UP': 'Level Up',
  'LIKE MIKE': 'Like Mike',
  'LOST FREQUENCIES': 'Lost Frequencies',
  'MARTIN GARRIX': 'Martin Garrix',
  'MARSHMELLO': 'Marshmello',
  'NERVO': 'Nervo',
  'NOISE MAFIA': 'Noise Mafia',
  'ODD MOB': 'Odd Mob',
  'PAUL EUN': 'Paul Eun',
  'SHOWTEK HARDSTYLE SET': 'Showtek',
  'SUBTRONICS': 'Subtronics',
  'SVDDEN DEATH': 'Svdden Death',
  'SWEDISH HOUSE MAFIA': 'Swedish House Mafia',
  'TAIKI NULIGHT': 'Taiki & Nulight',
  'TIËSTO': 'Tiësto',
  TIESTO: 'Tiësto',
  'VIDOJEAN': 'Vidojean',
  'VIDOJEAN (VJ X OL)': 'Vidojean',
  'W&W': 'W&W',
  'WHYBEATZ': 'WhyBeatz',
  'CHARLOTTE DE WITTE': 'Charlotte de Witte',
  'ALLEYCVT': 'ALLEYCVT',

  // --- EDC Thailand / Korea / Tomorrowland (expanded) ---
  '&FRIENDS': '&friends',
  '33 BELOW': '33 Below',
  '4URA': '4ura',
  '999999999': '999999999',
  'ALEX WANN': 'Alex Wann',
  'ALPHA 9': 'Alpha 9',
  'AREA X': 'Area X',
  'ARGY': 'Argy',
  'ASHIKO': 'Ashiko',
  'ASTRO VOIZE': 'Astro Voize',
  'ATLIENS': 'Atliens',
  'AUREDE': 'Aurede',
  'AYYBO': 'Ayybo',
  'BARBARA LAGO': 'Barbara Lago',
  'BASSCON': 'Basscon',
  'BASSKRAP': 'Basskrap',
  'BASSRUSH EXPERIENCE': 'Bassrush',
  'BASSTRIPPER': 'Basstripper',
  'BELLA CLAXTON': 'Bella Claxton',
  'BEN NICKY PRESENTS XTREME': 'Ben Nicky',
  'BLOSSO': 'Blosso',
  'CARTA': 'Carta',
  'CASEPEAT X PURPLE RABBIT': 'Casepeat',
  'CHASEWEST': 'Chasewest',
  'CHARLIE SPARKS': 'Charlie Sparks',
  'CHEEZ & YUKA': 'Cheez',
  'CLARA CUVÉ': 'Clara Cuve',
  'DAXSON': 'Daxson',
  'DAVICO': 'Davico',
  'DEAN TURNLEY': 'Dean Turnley',
  'DEMI': 'Demi',
  'DEMUK': 'Demuk',
  'DENNETT': 'Dennett',
  'DEPARTS': 'Departs',
  'DOM DOLLA': 'Dom Dolla',
  'DØMINA': 'Domina',
  'ELIANA': 'Eliana',
  'FIFI': 'Fifi',
  'FUNK TRIBU': 'Funk Tribu',
  'GUDFELLA': 'Gudfella',
  'HAMDI': 'Hamdi',
  'HANNAH LAING': 'Hannah Laing',
  'I HATE MODELS': 'I Hate Models',
  'JACKIE HOLLANDER': 'Jackie Hollander',
  'JAMIE JONES': 'Jamie Jones',
  'JAMES HYPE': 'James Hype',
  'JULIAN JORDAN': 'Julian Jordan',
  'KAGO PENGCHI': 'Kago Pengchi',
  'KAYZO': 'Kayzo',
  'KYLE STARKEY': 'Kyle Starkey',
  'LEVELTRONICS': 'Subtronics',
  'LIL TEXAS': 'Lil Texas',
  'LILLY PALMER': 'Lilly Palmer',
  'LOCO DICE': 'Loco Dice',
  'MARIE VAUNT': 'Marie Vaunt',
  'MARLO': 'Marlo',
  'MARY DROPPINZ': 'Mary Droppinz',
  'MATTY RALPH': 'Matty Ralph',
  'MAU P': 'Mau P',
  'MAX STYLER': 'Max Styler',
  'MISS MONIQUE': 'Miss Monique',
  'MUZIE': 'Muzie',
  'NICO MORENO': 'Nico Moreno',
  'NIFRA': 'Nifra',
  'NO1': 'No1',
  'NO1 (HONGJOONG)': 'Hongjoong',
  'OGUZ': 'Oguz',
  'OMNOM': 'Omnom',
  'OMAR+': 'Omar+',
  'OMRI': 'Omri',
  'OSMOSIS JONES': 'Osmosis Jones',
  'PETERBLUE': 'Peter Blue',
  'PLUKO': 'Pluko',
  'RESTRICTED': 'Restricted',
  'RIORDAN': 'Riordan',
  'RØZ': 'Roz',
  'SABAI': 'Sabai',
  'SIHK': 'Sihk',
  'SOTA': 'Sota',
  'SORAERE BROCKEN': 'Soraere Brocken',
  'SPACE 92 X POPOF PRESENT: TURBULENCES': 'Space 92',
  'SPECT': 'Spect',
  'SSOMBO': 'Ssombo',
  'SUNGYOO': 'Sungyoo',
  'SUPERGLOSS': 'Supergloss',
  'THE OUTLAW': 'The Outlaw',
  'TIYA': 'Tiya',
  'WAX MOTIF': 'Wax Motif',
  'WUJACKERS': 'Wukong',
  'YANAMASTE': 'Yanamaste',
  'YOHAN': 'Yohan',
  'YOUNA': 'Youna',
  'YUUKI YOSHIYAMA': 'Yuuki Yoshiyama',

  // --- Tomorrowland Thailand ---
  '22 BULLETS': '22Bullets',
  'AGENTS OF TIME': 'Agents Of Time',
  'ALAN WALKER': 'Alan Walker',
  'ALOK': 'Alok',
  'AMBER BROOS B2B SPACE 92': 'Amber Broos',
  'AMÉMÉ B2B HONEYLUV': 'Amémé',
  'AN!KA': 'An!ka',
  'ANDROMEDIK': 'Andromedik',
  'ANGEMI': 'Angemi',
  'APASHE': 'Apashe',
  'ARTBAT': 'Artbat',
  'ARTBAT B2B R3HAB': 'Artbat',
  'BASSJACKERS': 'Bassjackers',
  'BLASTOYZ B2B WHITENO1SE': 'Blastoyz',
  'BRENNAN HEART': 'Brennan Heart',
  'COSMIC GATE': 'Cosmic Gate',
  'DA TWEEKAZ': 'Da Tweekaz',
  'DUBVISION': 'Dubvision',
  'DVBBS': 'DVBBS',
  'ELI & FUR B2B YOTTO': 'Eli & Fur',
  'FERRY CORSTEN': 'Ferry Corsten',
  'FLOSSTRADAMUS B2B YELLOW CLAW': 'Flosstradamus',
  'GHOST RIDER': 'Ghost Rider',
  'GOLDFISH': 'Goldfish',
  HALŌ: 'Halō',
  'INFECTED MUSHROOM': 'Infected Mushroom',
  'JELLE DK': 'Jelle DK',
  JERROOO: 'Jerro',
  'JOHN NEWMAN': 'John Newman',
  'KEVIN DE VRIES': 'Kevin de Vries',
  'KEVIN DE VRIES B2B MORTEN': 'Kevin de Vries',
  KÖLSCH: 'Kölsch',
  'LAIDBACK LUKE': 'Laidback Luke',
  'LUCAS & STEVE': 'Lucas & Steve',
  'LUUK VAN DIJK': 'Luuk van Dijk',
  'MAD MAXX B2B STRYKER': 'Mad Maxx',
  'MARTIN GARRIX': 'Martin Garrix',
  'MATISSE & SADKO': 'Matisse & Sadko',
  'MIND AGAINST': 'Mind Against',
  'NETSKY': 'Netsky',
  'NOME.': 'Nome',
  'OPPIDAN': 'Oppidan',
  'QUINTINO': 'Quintino',
  'R3HAB': 'R3hab',
  'STEVE AOKI': 'Steve Aoki',
  'SUB ZERO PROJECT': 'Sub Zero Project',
  'THIRD PARTY': 'Third Party',
  VEGAS: 'Vegas',
  'VINI VICI': 'Vini Vici',
  'WHISNU SANTIKA': 'Whisnu Santika',
  WUKONG: 'Wukong',
  'XCLUB.': 'X Club',
  'YELLOW CLAW': 'Yellow Claw',
  'YVES V': 'Yves V',

  // --- Defqon.1 2026 (keep in sync with DISCOGS_LINEUP_SEARCH_ALIASES) ---
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
  'ANGERFIST': 'Angerfist',
  'B-FRONT': 'B-Front',
  'BRENNAN HEART': 'Brennan Heart',
  'COONE': 'Coone',
  'D-STURB': 'D-Sturb',
  'DA TWEEKAZ': 'Da Tweekaz',
  'ENDYMION': 'Endymion',
  'E-FORCE': 'E-Force',
  'FRONTLINER': 'Fronliner',
  'GALACTIXX': 'Galactixx',
  'HARD DRIVER': 'Hard Driver',
  'KORSAKOFF': 'Korsakoff',
  'NEOPHYTE': 'Neophyte',
  'NOISECONTROLLERS': 'Noisecontrollers',
  'NOSFERATU': 'Nosferatu',
  'PAUL ELSTAK': 'Paul Elstak',
  'PHUTURE NOIZE': 'Phuture Noize',
  'PRIMESHOCK': 'Primeshock',
  'REJECTA': 'Rejecta',
  'ROOLER': 'Rooler',
  'SHOWTEK': 'Showtek',
  'SOUND RUSH': 'Sound Rush',
  'SUB ZERO PROJECT': 'Sub Zero Project',
  'THE VIPER': 'The Viper',
  'VERTILE': 'Vertile',
  'WARFACE': 'Warface',
  'WASTED PENGUINZ': 'Wasted Penguinz',
  'WILDSTYLEZ': 'Wildstylez',
  'ACTIVATOR': 'Activator',
  'ADJUZT': 'Adjuzt',
  'ADRENALIZE': 'Adrenalize',
  'ART OF FIGHTERS': 'Art of Fighters',
  'BASS MODULATORS': 'Bass Modulators',
  'BILLX': 'Billx',
  'DAVIDE SONAR': 'Davide Sonar',
  'DJ ISAAC': 'DJ Isaac',
  'KELTEK': 'Keltek',
  'PSYKO PUNKZ': 'Psyko Punkz',
  'THA PLAYAH': 'The Playah',
  'ACT OF RAGE': 'Act of Rage',
  'MURDOCK': 'Murdock',
};

/** Collect MB ids to try before TheAudioDB text search (preferred lineup + DJ urls). */
export function collectAvatarMusicBrainzIds(lineupName, catalogUrls) {
  const billingKey = lineupName.trim().toUpperCase();
  const ids = [];
  const preferred = PREFERRED_MB_BY_LINEUP[billingKey]?.mbid?.trim();
  if (preferred) {
    ids.push(preferred);
  }
  const fromUrls = extractMusicBrainzIdFromUrls(catalogUrls);
  if (fromUrls) {
    ids.push(fromUrls);
  }
  return [...new Set(ids.filter(Boolean))];
}

/** TheAudioDB biography lists multiple same-name artists (merged disambiguation stub). */
export function isTheAudioDbHomonymBio(biography) {
  const text = (biography ?? '').trim();
  if (!text) {
    return false;
  }
  return /\bthere are \d+ artists (?:called|named)\b/i.test(text);
}

export function normalizeArtistNameKey(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function getTheAudioDbSearchQueries(lineupName) {
  const trimmed = lineupName.trim();
  const alias = THEAUDIODB_SEARCH_ALIASES[trimmed.toUpperCase()];
  const queries = [];
  if (alias) {
    queries.push(alias);
  }
  queries.push(trimmed);
  if (trimmed !== trimmed.toLowerCase()) {
    queries.push(
      trimmed
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    );
  }
  return [...new Set(queries.map((query) => query.trim()).filter(Boolean))];
}

export function pickTheAudioDbAvatar(artist) {
  return (
    artist?.strArtistThumb?.trim() ||
    artist?.strArtistCutout?.trim() ||
    artist?.strArtistLogo?.trim() ||
    ''
  );
}

export function scoreTheAudioDbMatch(lineupName, candidate) {
  const target = normalizeArtistNameKey(lineupName);
  const names = [
    candidate?.strArtist,
    candidate?.strArtistAlternate,
  ]
    .filter(Boolean)
    .map((name) => normalizeArtistNameKey(name));

  if (!target || !names.length) {
    return 0;
  }
  if (names.some((name) => name === target)) {
    return 100;
  }
  if (names.some((name) => name.includes(target) || target.includes(name))) {
    return 80;
  }
  return 40;
}

/** TheAudioDB genre/style labels for cross-validation against djs.styles. */
export function extractTheAudioDbGenres(candidate) {
  const genres = [
    candidate?.strGenre,
    candidate?.strStyle,
    candidate?.strMood,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(/[,/;|]/))
    .map((part) => part.trim())
    .filter(Boolean);
  return [...new Set(genres)];
}

const ELECTRONIC_GENRE_HINTS = [
  'electronic',
  'techno',
  'house',
  'trance',
  'dubstep',
  'drum',
  'dnb',
  'edm',
  'dance',
  'hardstyle',
  'hardcore',
  'minimal',
  'deep',
  'progressive',
  'psytrance',
  'psy',
  'ambient',
  'breakbeat',
  'garage',
  'detroit',
  'industrial',
  'rave',
];

export function isElectronicGenreCandidate(genres) {
  if (!genres.length) {
    return null; // unknown — neither accept nor reject on genre alone
  }
  const text = genres.join(' ').toLowerCase();
  return ELECTRONIC_GENRE_HINTS.some((hint) => text.includes(hint));
}

/** Penalize low-follower homonym stubs; prefer the popular catalog entry when present. */
export function scoreTheAudioDbSearchCandidate(lineupName, artist) {
  const baseScore = scoreTheAudioDbMatch(lineupName, artist);
  const bio = artist?.strBiography ?? '';
  const genres = extractTheAudioDbGenres(artist);
  if (
    isTheAudioDbHomonymBio(bio) &&
    isElectronicGenreCandidate(genres) !== true
  ) {
    const followers = Number(artist?.intFollowers ?? 0);
    if (followers < 50_000) {
      return baseScore - 60;
    }
    return baseScore + 5;
  }
  return baseScore;
}

/** Shaped search candidate is a low-confidence merged homonym page. */
export function isShapedTheAudioDbHomonymStub(candidate) {
  if (!candidate) {
    return false;
  }
  return isTheAudioDbHomonymBio(candidate.biography) &&
    isElectronicGenreCandidate(candidate.genres ?? []) !== true &&
    Number(candidate.followers ?? 0) < 50_000;
}

export function shapeTheAudioDbCandidate(artist, { query, score, searchVia }) {
  const avatarUrl = pickTheAudioDbAvatar(artist);
  if (!avatarUrl) {
    return null;
  }
  return {
    artistName: artist?.strArtist ?? query,
    avatarUrl,
    score,
    searchQuery: query,
    searchVia,
    genres: extractTheAudioDbGenres(artist),
    theAudioDbArtistId: artist?.idArtist ?? null,
    biography: artist?.strBiography ?? '',
    followers: Number(artist?.intFollowers ?? 0) || null,
    countryCode: artist?.strCountryCode?.trim() || null,
    musicBrainzId: artist?.strMusicBrainzID?.trim() || null,
  };
}

export function createTheAudioDbClient(config) {
  const baseUrl = `https://www.theaudiodb.com/api/v1/json/${config.apiKey}`;

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function lookupByMusicBrainzId(mbid, lineupName) {
    if (!mbid?.trim()) {
      return null;
    }
    await delay(config.requestDelayMs);
    try {
      const url = `${baseUrl}/artist-mb.php?i=${encodeURIComponent(mbid.trim())}`;
      const res = await fetch(url);
      if (!res.ok) {
        return null;
      }
      const data = await res.json();
      const artist = data?.artists?.[0];
      if (!artist) {
        return null;
      }
      const score = scoreTheAudioDbSearchCandidate(lineupName, artist);
      return shapeTheAudioDbCandidate(artist, {
        query: `mb:${mbid.trim()}`,
        score: Math.max(score, 100),
        searchVia: 'musicbrainz',
      });
    } catch (error) {
      console.warn('TheAudioDB MB 查询失败', mbid, error.message ?? error);
      return null;
    }
  }

  async function searchArtist(
    queryName,
    { billingName, catalogUrls } = {},
  ) {
    const lineupName = (billingName ?? queryName).trim();
    const mbIds = collectAvatarMusicBrainzIds(lineupName, catalogUrls);
    for (const mbid of mbIds) {
      const mbMatch = await lookupByMusicBrainzId(mbid, lineupName);
      if (mbMatch?.avatarUrl && !isShapedTheAudioDbHomonymStub(mbMatch)) {
        return mbMatch;
      }
    }

    const queries = getTheAudioDbSearchQueries(queryName);
    let best = null;

    for (const query of queries) {
      await delay(config.requestDelayMs);
      try {
        const url = `${baseUrl}/search.php?s=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        if (!res.ok) {
          continue;
        }
        const data = await res.json();
        const artists = data?.artists ?? [];
        if (!artists.length) {
          continue;
        }

        const ranked = [...artists].sort(
          (a, b) =>
            scoreTheAudioDbSearchCandidate(lineupName, b) -
            scoreTheAudioDbSearchCandidate(lineupName, a),
        );

        for (const artist of ranked) {
          const score = scoreTheAudioDbSearchCandidate(lineupName, artist);
          const shaped = shapeTheAudioDbCandidate(artist, {
            query,
            score,
            searchVia: 'search',
          });
          if (!shaped || isShapedTheAudioDbHomonymStub(shaped)) {
            continue;
          }
          if (!best || shaped.score > best.score) {
            best = shaped;
          }
        }

        if (best?.score >= 100) {
          break;
        }
      } catch (error) {
        console.warn('TheAudioDB 搜索失败', query, error.message ?? error);
      }
    }

    if (best && isShapedTheAudioDbHomonymStub(best)) {
      return null;
    }

    return best;
  }

  return { searchArtist, lookupByMusicBrainzId };
}

export function getTheAudioDbConfig() {
  return {
    apiKey: process.env.THEAUDIODB_API_KEY?.trim() || '123',
    requestDelayMs: Number(process.env.THEAUDIODB_REQUEST_DELAY_MS ?? 350),
  };
}
