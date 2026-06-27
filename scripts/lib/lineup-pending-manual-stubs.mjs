import { allocateSyntheticDiscogsId } from './web-only-dj-profile.mjs';

/** Curated Discogs fixes for high-priority pending lineup names. */
export const PRIORITY_PENDING_DISCOGS = {
  COONE: { discogsId: 79439, discogsName: 'Coone', searchQuery: 'artist=Coone#priority' },
  MORTEN: {
    discogsId: 1305835,
    discogsName: 'Morten Breum',
    searchQuery: 'artist=Morten Breum#priority',
  },
  'COSMIC GATE': {
    discogsId: 11101,
    discogsName: 'Cosmic Gate',
    searchQuery: 'artist=Cosmic Gate#priority',
  },
  'END OF LINE: CRYEX': {
    discogsId: 6998987,
    discogsName: 'Cryex',
    searchQuery: 'artist=Cryex#priority',
  },
  'INNER CIRCLE SHOWCASE: XENSE': {
    discogsId: 4943854,
    discogsName: 'Xense',
    searchQuery: 'artist=Xense#priority',
  },
  'POPOF PRESENT: TURBULENCES': {
    discogsId: 21524,
    discogsName: 'Popof',
    searchQuery: 'artist=Popof#priority',
  },
};

/** Manual stubs when Discogs has no acceptable artist page. */
export const PRIORITY_PENDING_MANUAL = {
  NAKADIA: {
    name: 'Nakadia',
    profile:
      'French techno DJ and producer. Regular on Drumcode and festival lineups including Defqon.1.',
    styles: ['Techno', 'Minimal Techno'],
    country: 'France',
    urls: ['https://soundcloud.com/nakadia'],
  },
  'QLUBTEMPO PARADE: LUNA': {
    name: 'Luna',
    profile:
      'Hard dance / hardstyle artist billed on Defqon.1 Qlubtempo Parade showcases.',
    styles: ['Hardstyle', 'Hard Dance'],
    country: '',
    urls: [],
  },
};

function defaultManualProfile(lineupName) {
  const name = lineupName.trim();
  return {
    discogsId: allocateSyntheticDiscogsId(name),
    name,
    realName: '',
    profile: '',
    genres: [],
    styles: [],
    country: '',
    urls: [],
    members: [],
    representativeWorks: [],
  };
}

export function buildManualStubProfile(lineupName, overrides = {}) {
  const base = defaultManualProfile(lineupName);
  return {
    ...base,
    ...overrides,
    discogsId: overrides.discogsId ?? base.discogsId,
    members: overrides.members ?? base.members,
    representativeWorks: overrides.representativeWorks ?? base.representativeWorks,
    urls: overrides.urls ?? base.urls,
    genres: overrides.genres ?? base.genres,
    styles: overrides.styles ?? base.styles,
  };
}

export function isPriorityPendingLineupName(lineupName) {
  const upper = lineupName.trim().toUpperCase();
  return (
    upper in PRIORITY_PENDING_DISCOGS || upper in PRIORITY_PENDING_MANUAL
  );
}
