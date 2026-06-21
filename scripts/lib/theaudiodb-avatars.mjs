/**
 * Lineup display name → TheAudioDB `search.php?s=` query.
 * Keep in sync with `DISCOGS_LINEUP_SEARCH_ALIASES` in festival-lineup-fallback.mjs.
 */
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
};

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

export function createTheAudioDbClient(config) {
  const baseUrl = `https://www.theaudiodb.com/api/v1/json/${config.apiKey}`;

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function searchArtist(lineupName) {
    const queries = getTheAudioDbSearchQueries(lineupName);
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
            scoreTheAudioDbMatch(lineupName, b) -
            scoreTheAudioDbMatch(lineupName, a),
        );
        const top = ranked[0];
        const avatarUrl = pickTheAudioDbAvatar(top);
        if (!avatarUrl) {
          continue;
        }

        const score = scoreTheAudioDbMatch(lineupName, top);
        if (!best || score > best.score) {
          best = {
            artistName: top.strArtist ?? query,
            avatarUrl,
            score,
            searchQuery: query,
          };
        }
        if (score >= 100) {
          break;
        }
      } catch (error) {
        console.warn('TheAudioDB 搜索失败', query, error.message ?? error);
      }
    }

    return best;
  }

  return { searchArtist };
}

export function getTheAudioDbConfig() {
  return {
    apiKey: process.env.THEAUDIODB_API_KEY?.trim() || '123',
    requestDelayMs: Number(process.env.THEAUDIODB_REQUEST_DELAY_MS ?? 350),
  };
}
