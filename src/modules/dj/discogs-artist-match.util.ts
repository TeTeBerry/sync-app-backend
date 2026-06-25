/**
 * Discogs lineup artist matching:
 * 1) name alignment
 * 2) profile electronic keywords
 * 3) artist catalog genres/styles
 * 4) latest release electronic tags
 * 5) non-electronic penalty
 */
export type DiscogsArtistCandidate = {
  id: number;
  name: string;
  profile?: string;
  genres?: string[];
  styles?: string[];
  releaseGenres?: string[];
  releaseStyles?: string[];
};

export type DiscogsArtistMatchScore = {
  discogsId: number;
  name: string;
  total: number;
  breakdown: {
    nameMatch: number;
    profileElectronic: number;
    catalogElectronic: number;
    releaseElectronic: number;
    nonElectronicPenalty: number;
  };
};

export const DISCOGS_MATCH_MIN_ACCEPT_SCORE = 55;
export const DISCOGS_MATCH_AMBIGUITY_GAP = 8;
export const DISCOGS_SEARCH_CANDIDATE_LIMIT = 8;
export const DISCOGS_REQUEST_DELAY_MS_DEFAULT = 1200;
export const DISCOGS_REDIS_CACHE_TTL_SEC_DEFAULT = 86_400;

const ELECTRONIC_PROFILE_KEYWORDS = [
  'dj',
  'producer',
  'electronic',
  'edm',
  'techno',
  'house',
  'trance',
  'dubstep',
  'remix',
  'festival',
  'club',
  'rave',
  'disc jockey',
];

const ELECTRONIC_GENRES = new Set(['electronic', 'hip hop', 'hip-hop', 'pop']);

const ELECTRONIC_STYLE_HINTS = [
  'house',
  'techno',
  'trance',
  'dubstep',
  'drum',
  'bass',
  'hardstyle',
  'garage',
  'electro',
  'edm',
  'ambient',
  'breakbeat',
  'jungle',
  'trap',
  'disco',
  'synth',
  'progressive',
  'melodic',
  'minimal',
  'deep',
  'tech',
  'psytrance',
  'psy',
  'rave',
  'club',
  'dance',
  'future',
  'bassline',
  'uk garage',
];

const NON_ELECTRONIC_PROFILE_HINTS = [
  'classical',
  'jazz',
  'folk',
  'author',
  'writer',
  'politician',
  'actor',
  'orchestra',
  'choir',
  'poet',
  'painter',
  'photographer',
  'soundtrack composer',
  'film score',
];

export function normalizeDiscogsMatchName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\(\d+\)\s*$/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildDiscogsElectronicSearchQuery(lineupName: string): string {
  const trimmed = lineupName.trim();
  return `"${trimmed}" dj electronic producer`;
}

function tokenOverlapScore(left: string, right: string): number {
  const leftTokens = new Set(
    normalizeDiscogsMatchName(left).split(/\s+/).filter(Boolean),
  );
  const rightTokens = new Set(
    normalizeDiscogsMatchName(right).split(/\s+/).filter(Boolean),
  );
  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function scoreNameMatch(lineupName: string, artistName: string): number {
  const lineup = normalizeDiscogsMatchName(lineupName);
  const artist = normalizeDiscogsMatchName(artistName);
  if (!lineup || !artist) {
    return 0;
  }
  if (lineup === artist) {
    return 30;
  }
  if (artist.startsWith(lineup) || lineup.startsWith(artist)) {
    return 22;
  }
  const overlap = tokenOverlapScore(lineupName, artistName);
  if (overlap >= 0.85) {
    return 20;
  }
  if (overlap >= 0.6) {
    return 12;
  }
  return 0;
}

function scoreProfileElectronic(profile?: string): number {
  const text = profile?.toLowerCase() ?? '';
  if (!text.trim()) {
    return 0;
  }
  let hits = 0;
  for (const keyword of ELECTRONIC_PROFILE_KEYWORDS) {
    if (text.includes(keyword)) {
      hits += 1;
    }
  }
  return Math.min(20, hits * 5);
}

function hasElectronicGenre(genres: string[] = []): boolean {
  return genres.some((genre) =>
    ELECTRONIC_GENRES.has(genre.trim().toLowerCase()),
  );
}

function countElectronicStyles(styles: string[] = []): number {
  return styles.filter((style) => {
    const lower = style.trim().toLowerCase();
    return ELECTRONIC_STYLE_HINTS.some((hint) => lower.includes(hint));
  }).length;
}

function scoreCatalogElectronic(
  genres: string[] = [],
  styles: string[] = [],
): number {
  let score = 0;
  if (hasElectronicGenre(genres)) {
    score += 15;
  }
  const electronicStyles = countElectronicStyles(styles);
  if (electronicStyles >= 2) {
    score += 10;
  } else if (electronicStyles === 1) {
    score += 6;
  }
  return Math.min(25, score);
}

function scoreReleaseElectronic(
  releaseGenres: string[] = [],
  releaseStyles: string[] = [],
): number {
  let score = 0;
  if (hasElectronicGenre(releaseGenres)) {
    score += 12;
  }
  const electronicStyles = countElectronicStyles(releaseStyles);
  if (electronicStyles >= 2) {
    score += 13;
  } else if (electronicStyles === 1) {
    score += 8;
  }
  return Math.min(25, score);
}

function scoreNonElectronicPenalty(
  profile?: string,
  genres: string[] = [],
  styles: string[] = [],
  releaseStyles: string[] = [],
): number {
  const text = profile?.toLowerCase() ?? '';
  let penalty = 0;

  for (const hint of NON_ELECTRONIC_PROFILE_HINTS) {
    if (text.includes(hint)) {
      penalty += 12;
    }
  }

  const hasElectronic =
    hasElectronicGenre(genres) ||
    countElectronicStyles(styles) > 0 ||
    countElectronicStyles(releaseStyles) > 0;

  if (
    !hasElectronic &&
    genres.length > 0 &&
    genres.every((genre) => {
      const lower = genre.toLowerCase();
      return (
        lower.includes('classical') ||
        lower.includes('jazz') ||
        lower.includes('folk') ||
        lower.includes('stage')
      );
    })
  ) {
    penalty += 25;
  }

  return Math.min(40, penalty);
}

export function scoreDiscogsArtistCandidate(
  lineupName: string,
  candidate: DiscogsArtistCandidate,
): DiscogsArtistMatchScore {
  const breakdown = {
    nameMatch: scoreNameMatch(lineupName, candidate.name),
    profileElectronic: scoreProfileElectronic(candidate.profile),
    catalogElectronic: scoreCatalogElectronic(
      candidate.genres,
      candidate.styles,
    ),
    releaseElectronic: scoreReleaseElectronic(
      candidate.releaseGenres,
      candidate.releaseStyles,
    ),
    nonElectronicPenalty: scoreNonElectronicPenalty(
      candidate.profile,
      candidate.genres,
      candidate.styles,
      candidate.releaseStyles,
    ),
  };

  const total = Math.max(
    0,
    breakdown.nameMatch +
      breakdown.profileElectronic +
      breakdown.catalogElectronic +
      breakdown.releaseElectronic -
      breakdown.nonElectronicPenalty,
  );

  return {
    discogsId: candidate.id,
    name: candidate.name,
    total,
    breakdown,
  };
}

export type DiscogsMatchDecision =
  | {
      status: 'mapped';
      discogsId: number;
      discogsName: string;
      matchScore: number;
      searchQuery: string;
    }
  | {
      status: 'pending_review';
      reviewReason: string;
      searchQuery: string;
      candidateScores: DiscogsArtistMatchScore[];
    };

export function decideDiscogsArtistMatch(
  lineupName: string,
  scored: DiscogsArtistMatchScore[],
  options?: {
    minAcceptScore?: number;
    ambiguityGap?: number;
    searchQuery?: string;
  },
): DiscogsMatchDecision {
  const minAccept = options?.minAcceptScore ?? DISCOGS_MATCH_MIN_ACCEPT_SCORE;
  const ambiguityGap = options?.ambiguityGap ?? DISCOGS_MATCH_AMBIGUITY_GAP;
  const searchQuery =
    options?.searchQuery ?? buildDiscogsElectronicSearchQuery(lineupName);

  const ranked = [...scored]
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  if (!ranked.length) {
    return {
      status: 'pending_review',
      reviewReason: '无合格电子音乐人候选',
      searchQuery,
      candidateScores: scored,
    };
  }

  const top = ranked[0];
  const second = ranked[1];

  if (top.total < minAccept) {
    return {
      status: 'pending_review',
      reviewReason: `最高得分 ${top.total} 低于阈值 ${minAccept}`,
      searchQuery,
      candidateScores: ranked,
    };
  }

  if (
    second &&
    second.total >= minAccept &&
    top.total - second.total < ambiguityGap
  ) {
    return {
      status: 'pending_review',
      reviewReason: `前两名得分接近（${top.total} vs ${second.total}）`,
      searchQuery,
      candidateScores: ranked,
    };
  }

  return {
    status: 'mapped',
    discogsId: top.discogsId,
    discogsName: top.name,
    matchScore: top.total,
    searchQuery,
  };
}
