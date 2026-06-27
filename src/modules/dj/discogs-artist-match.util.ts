/**
 * Discogs lineup artist matching (v3):
 *
 * Flow (lineup English name → artist_id):
 * 1. dj_discogs_map hit (mapped) → use artist_id, fetch styles elsewhere
 * 2. Miss → tiered database/search (genre=Electronic on every request):
 *    artist → anv → release-by-artist → release-by-credit → artist q
 * 3. Filter / expand hits → score top 8 → winner ≥120 + name gate → mapped
 * 4. Never upsert djs without verifiable Discogs profile or release-derived styles
 *
 * Five score factors: base 100, profile +30, catalog/release +50, catalog/release −60, profile −100
 * During match phase, artist catalog genres/styles proxy release tags (releases fetched after winner).
 */
import {
  type DiscogsReleaseTags,
  isIrrelevantDiscogsTag,
} from './discogs-dj-styles.util';
import {
  isDiscogsDisambiguationProfile,
  isLineupCatalogProfileTrusted,
} from './lineup-catalog-profile-trust.util';

export type DiscogsReleaseSample = DiscogsReleaseTags & {
  title?: string;
  format?: string;
  formatDescriptions?: string[];
};

export type DiscogsArtistCandidate = {
  id: number;
  name: string;
  profile?: string;
  genres?: string[];
  styles?: string[];
  /** Discogs namevariations / ANV entries from the artist page. */
  aliases?: string[];
  /** @deprecated use releaseSamples — kept for backward compatibility */
  releaseGenres?: string[];
  /** @deprecated use releaseSamples */
  releaseStyles?: string[];
  /** Top N release tag sets used for electronic ratio scoring. */
  releaseSamples?: DiscogsReleaseSample[];
  discoveryMeta?: {
    strategyId: string;
    strategyLabel: string;
  };
};

export type DiscogsArtistMatchScore = {
  discogsId: number;
  name: string;
  total: number;
  breakdown: {
    base: number;
    profileElectronicBonus: number;
    releaseElectronicBonus: number;
    releaseNonElectronicPenalty: number;
    profileNonElectronicPenalty: number;
  };
};

export const DISCOGS_MATCH_BASE_SCORE = 100;
export const DISCOGS_MATCH_MIN_ACCEPT_SCORE = 120;
export const DISCOGS_MATCH_SUSPECT_MIN_SCORE = 60;
export const DISCOGS_MATCH_REJECT_BELOW_SCORE = 60;
export const DISCOGS_MATCH_AMBIGUITY_GAP = 8;
export const DISCOGS_MATCH_RELEASE_SAMPLE_SIZE = 5;
export const DISCOGS_MATCH_RELEASE_ELECTRONIC_RATIO = 0.7;
export const DISCOGS_MATCH_RELEASE_NON_ELECTRONIC_RATIO = 0.4;
export const DISCOGS_SEARCH_CANDIDATE_LIMIT = 8;
/** Every lineup database/search request includes this genre filter. */
export const DISCOGS_LINEUP_SEARCH_GENRE = 'Electronic';
export const DISCOGS_RELEASE_SEARCH_PER_PAGE = 5;
export const DISCOGS_REQUEST_DELAY_MS_DEFAULT = 1200;
export const DISCOGS_REDIS_CACHE_TTL_SEC_DEFAULT = 86_400;

export type DiscogsSearchStrategyKind =
  | 'artist-direct'
  | 'release-graph'
  | 'artist-broad';

export type DiscogsSearchStrategy = {
  id: string;
  kind: DiscogsSearchStrategyKind;
  params: Record<string, string>;
};

export type DiscogsArtistRef = {
  artistId: number;
  displayName: string;
  strategyId: string;
  strategyLabel: string;
  refKind: 'artist-hit' | 'release-graph' | 'anv-hit';
};

const DISCOGS_SEARCH_STRATEGY_PRIORITY: Record<string, number> = {
  'artist-exact': 0,
  'artist-anv': 1,
  'release-by-artist': 2,
  'release-by-credit': 3,
  'artist-q': 4,
};
/** Minimum profile length to accept a Discogs artist page without release styles. */
export const DISCOGS_MIN_VERIFIABLE_PROFILE_LENGTH = 20;

export const DISCOGS_REVIEW_REASON = {
  NO_QUALIFYING_CANDIDATE: '无合格电子音乐人候选：Discogs未检索到对应艺人页面',
  HOMONYM_AMBIGUITY: '通用名称多Discogs艺人歧义，分值接近无法自动区分',
  INSUFFICIENT_SCORE: '企划 / 双人组合名称资料不足，可信度不足',
  BUILD_RECORD_FAILED: '匹配成功但艺人资料单薄/企划联名，数据构建校验不通过',
  nameMismatch: (discogsName: string) => `名称不一致（${discogsName}）`,
} as const;

const PROFILE_ELECTRONIC_BONUS = 30;
const RELEASE_ELECTRONIC_BONUS = 50;
const RELEASE_NON_ELECTRONIC_PENALTY = 60;
const PROFILE_NON_ELECTRONIC_PENALTY = 100;

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

const PURE_NON_ELECTRONIC_PROFILE_HINTS = [
  'band',
  'folk',
  '摇滚乐队',
  '民谣歌手',
  'rock band',
  'folk singer',
  'folk band',
  'indie rock band',
  'country singer',
  'jazz band',
  'orchestra',
  'choir',
  'classical composer',
  'soundtrack composer',
  'film score',
  'author',
  'writer',
  'politician',
  'actor',
  'poet',
  'painter',
];

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

/** Trailing Discogs homonym index, e.g. "Marshmello (2)" → 2. */
export function parseDiscogsDisambiguationSuffix(name: string): number | null {
  const match = name.trim().match(/\((\d+)\)\s*$/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function collectLineupNameNorms(
  lineupName: string,
  nameMatchVariants: string[] = [],
): Set<string> {
  const variants = [
    lineupName,
    ...nameMatchVariants.filter(
      (name) => name.trim() && name.trim() !== lineupName.trim(),
    ),
  ]
    .map((name) => name.trim())
    .filter(Boolean);

  return new Set(variants.map(normalizeDiscogsMatchName).filter(Boolean));
}

/**
 * Strict name gate: Discogs page name (or ANV / alias) must exactly match the
 * lineup display name or an explicit search alias — no partial matching.
 */
export function isLineupDiscogsNamePlausible(
  lineupName: string,
  discogsName: string,
  nameMatchVariants: string[] = [],
  options?: { discogsAliases?: string[] },
): boolean {
  const lineupNorms = collectLineupNameNorms(lineupName, nameMatchVariants);
  if (!lineupNorms.size) {
    return false;
  }

  const discogsNames = [
    discogsName,
    ...(options?.discogsAliases ?? []).filter(Boolean),
  ];

  for (const name of discogsNames) {
    const discogsNorm = normalizeDiscogsMatchName(name);
    if (discogsNorm && lineupNorms.has(discogsNorm)) {
      return true;
    }
  }

  return false;
}

/** How many search hits to request before client-side exact-name filtering. */
export const DISCOGS_ARTIST_SEARCH_RESULT_SCAN_LIMIT = 25;

export type DiscogsArtistSearchHit = {
  type?: string;
  title?: string;
  id?: number;
};

function withLineupSearchGenre(
  params: Record<string, string>,
): Record<string, string> {
  return { ...params, genre: DISCOGS_LINEUP_SEARCH_GENRE };
}

/** v3 tiered database/search plan — every strategy includes genre=Electronic. */
export function buildLineupSearchStrategies(
  artistName: string,
): DiscogsSearchStrategy[] {
  const trimmed = artistName.trim();
  if (!trimmed) {
    return [];
  }

  return [
    {
      id: 'artist-exact',
      kind: 'artist-direct',
      params: withLineupSearchGenre({ type: 'artist', artist: trimmed }),
    },
    {
      id: 'artist-anv',
      kind: 'artist-direct',
      params: withLineupSearchGenre({ type: 'artist', anv: trimmed }),
    },
    {
      id: 'release-by-artist',
      kind: 'release-graph',
      params: withLineupSearchGenre({
        type: 'release',
        artist: trimmed,
        per_page: String(DISCOGS_RELEASE_SEARCH_PER_PAGE),
      }),
    },
    {
      id: 'release-by-credit',
      kind: 'release-graph',
      params: withLineupSearchGenre({
        type: 'release',
        credit: trimmed,
        per_page: String(DISCOGS_RELEASE_SEARCH_PER_PAGE),
      }),
    },
    {
      id: 'artist-q',
      kind: 'artist-broad',
      params: withLineupSearchGenre({ type: 'artist', q: trimmed }),
    },
  ];
}

export function defaultLineupSearchQueryLabel(lineupName: string): string {
  const strategies = buildLineupSearchStrategies(lineupName);
  const primary = strategies[0];
  if (!primary) {
    return 'artist-search';
  }
  return formatDiscogsArtistSearchLabel(primary.params);
}

export function formatDiscogsArtistSearchLabel(
  params: Record<string, string>,
): string {
  const parts = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`);
  return parts.join('&') || 'artist-search';
}

export function compareDiscogsSearchStrategyPriority(
  leftId: string,
  rightId: string,
): number {
  const left = DISCOGS_SEARCH_STRATEGY_PRIORITY[leftId] ?? 99;
  const right = DISCOGS_SEARCH_STRATEGY_PRIORITY[rightId] ?? 99;
  return left - right;
}

export function mergeDiscogsArtistRefs(
  refs: DiscogsArtistRef[],
): DiscogsArtistRef[] {
  const byId = new Map<number, DiscogsArtistRef>();
  for (const ref of refs) {
    const existing = byId.get(ref.artistId);
    if (
      !existing ||
      compareDiscogsSearchStrategyPriority(
        ref.strategyId,
        existing.strategyId,
      ) < 0
    ) {
      byId.set(ref.artistId, ref);
    }
  }
  return [...byId.values()];
}

/** Keep artist hits; ANV strategy trusts Discogs ANV index (verified on artist page). */
export function filterDiscogsArtistSearchHits(
  hits: DiscogsArtistSearchHit[],
  nameMatchVariants: string[],
  strategyId?: string,
): DiscogsArtistSearchHit[] {
  const norms = collectLineupNameNorms(
    nameMatchVariants[0] ?? '',
    nameMatchVariants.slice(1),
  );
  if (!norms.size && strategyId !== 'artist-anv') {
    return [];
  }

  return (hits ?? []).filter((item) => {
    if (item.type !== 'artist' || !item.id) {
      return false;
    }
    if (strategyId === 'artist-anv') {
      return true;
    }
    const titleNorm = normalizeDiscogsMatchName(item.title ?? '');
    return Boolean(titleNorm && norms.has(titleNorm));
  });
}

export function artistRefsFromSearchHits(
  hits: DiscogsArtistSearchHit[],
  strategy: DiscogsSearchStrategy,
  nameMatchVariants: string[],
): DiscogsArtistRef[] {
  const filtered = filterDiscogsArtistSearchHits(
    hits,
    nameMatchVariants,
    strategy.id,
  );
  const strategyLabel = formatDiscogsArtistSearchLabel(strategy.params);
  return filtered.map((hit) => ({
    artistId: hit.id!,
    displayName: hit.title ?? '',
    strategyId: strategy.id,
    strategyLabel,
    refKind: strategy.id === 'artist-anv' ? 'anv-hit' : 'artist-hit',
  }));
}

export function artistRefsFromRelease(
  release: { artists?: Array<{ id?: number; name?: string }> },
  strategy: DiscogsSearchStrategy,
): DiscogsArtistRef[] {
  const strategyLabel = formatDiscogsArtistSearchLabel(strategy.params);
  return (release.artists ?? [])
    .filter((artist) => artist.id)
    .map((artist) => ({
      artistId: artist.id!,
      displayName: artist.name ?? '',
      strategyId: strategy.id,
      strategyLabel,
      refKind: 'release-graph' as const,
    }));
}

export function filterArtistRefsByNameGate(
  refs: DiscogsArtistRef[],
  lineupName: string,
  nameMatchVariants: string[],
): DiscogsArtistRef[] {
  return refs.filter((ref) =>
    isLineupDiscogsNamePlausible(
      lineupName,
      ref.displayName,
      nameMatchVariants,
    ),
  );
}

export function isStaleDiscogsMapEntry(entry: {
  searchQuery?: string;
  discoveryStrategyId?: string;
}): boolean {
  return isLegacyDiscogsV2MapEntry(entry);
}

/** @deprecated use isStaleDiscogsMapEntry */
export function isLegacyDiscogsV2MapEntry(entry: {
  searchQuery?: string;
  discoveryStrategyId?: string;
}): boolean {
  if (entry.discoveryStrategyId?.trim()) {
    return false;
  }
  const query = entry.searchQuery?.trim() ?? '';
  if (!query || query.startsWith('#map:') || query.startsWith('repair:')) {
    return false;
  }
  if (/^q=/.test(query) && !/genre=/i.test(query)) {
    return true;
  }
  return !/genre=Electronic/i.test(query);
}

export function buildLineupSearchRequestParams(
  strategy: DiscogsSearchStrategy,
  scanLimit: number,
): Record<string, string> {
  if (strategy.kind === 'release-graph') {
    return {
      ...strategy.params,
      per_page:
        strategy.params.per_page ?? String(DISCOGS_RELEASE_SEARCH_PER_PAGE),
    };
  }
  return { ...strategy.params, per_page: String(scanLimit) };
}

export function isLineupDiscogsCandidatePlausible(
  lineupName: string,
  candidate: Pick<DiscogsArtistCandidate, 'name' | 'aliases' | 'profile'>,
  nameMatchVariants: string[] = [],
): boolean {
  const profile = candidate.profile?.trim() ?? '';

  if (isDiscogsDisambiguationProfile(profile)) {
    return false;
  }

  if (
    !isLineupDiscogsNamePlausible(
      lineupName,
      candidate.name,
      nameMatchVariants,
      { discogsAliases: candidate.aliases },
    )
  ) {
    return false;
  }

  if (
    profile &&
    !isLineupCatalogProfileTrusted(
      lineupName,
      { name: candidate.name, profile },
      { allowedCatalogNames: nameMatchVariants },
    )
  ) {
    return false;
  }

  return true;
}

export function resolveReleaseSamples(
  candidate: DiscogsArtistCandidate,
): DiscogsReleaseTags[] {
  if (candidate.releaseSamples?.length) {
    return candidate.releaseSamples;
  }
  if (
    (candidate.releaseGenres?.length ?? 0) > 0 ||
    (candidate.releaseStyles?.length ?? 0) > 0
  ) {
    return [
      {
        genres: candidate.releaseGenres ?? [],
        styles: candidate.releaseStyles ?? [],
      },
    ];
  }
  const catalogGenres = candidate.genres ?? [];
  const catalogStyles = candidate.styles ?? [];
  if (catalogGenres.length || catalogStyles.length) {
    return [{ genres: catalogGenres, styles: catalogStyles }];
  }
  return [];
}

function isNonElectronicReleaseTag(tag: string): boolean {
  const normalized = tag.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (isIrrelevantDiscogsTag(tag)) {
    return true;
  }
  return (
    normalized.includes('hip hop') ||
    normalized === 'hip-hop' ||
    normalized === 'hiphop' ||
    normalized === 'r&b' ||
    normalized === 'rnb'
  );
}

function isElectronicReleaseTag(tag: string): boolean {
  const normalized = tag.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized === 'electronic') {
    return true;
  }
  return ELECTRONIC_STYLE_HINTS.some((hint) => normalized.includes(hint));
}

export function scoreReleaseTagRatios(releaseSamples: DiscogsReleaseTags[]): {
  electronicRatio: number;
  nonElectronicRatio: number;
  classifiedTags: number;
} {
  let electronic = 0;
  let nonElectronic = 0;

  for (const release of releaseSamples) {
    const tags = [...(release.genres ?? []), ...(release.styles ?? [])];
    for (const tag of tags) {
      if (isElectronicReleaseTag(tag)) {
        electronic += 1;
        continue;
      }
      if (isNonElectronicReleaseTag(tag)) {
        nonElectronic += 1;
      }
    }
  }

  const classifiedTags = electronic + nonElectronic;
  if (!classifiedTags) {
    return { electronicRatio: 0, nonElectronicRatio: 0, classifiedTags: 0 };
  }

  return {
    electronicRatio: electronic / classifiedTags,
    nonElectronicRatio: nonElectronic / classifiedTags,
    classifiedTags,
  };
}

function scoreProfileElectronicBonus(profile?: string): number {
  const text = profile?.toLowerCase() ?? '';
  if (!text.trim()) {
    return 0;
  }
  for (const keyword of ELECTRONIC_PROFILE_KEYWORDS) {
    if (text.includes(keyword)) {
      return PROFILE_ELECTRONIC_BONUS;
    }
  }
  return 0;
}

function scoreProfileNonElectronicPenalty(profile?: string): number {
  const text = profile?.toLowerCase() ?? '';
  if (!text.trim()) {
    return 0;
  }
  for (const hint of PURE_NON_ELECTRONIC_PROFILE_HINTS) {
    if (text.includes(hint.toLowerCase())) {
      return PROFILE_NON_ELECTRONIC_PENALTY;
    }
  }
  return 0;
}

/** Count electronic genre/style tags across the first N releases (tie-break #1). */
export function countReleaseElectronicTags(
  releaseSamples: DiscogsReleaseTags[],
): number {
  let count = 0;
  for (const release of releaseSamples.slice(
    0,
    DISCOGS_MATCH_RELEASE_SAMPLE_SIZE,
  )) {
    for (const tag of [...(release.genres ?? []), ...(release.styles ?? [])]) {
      if (isElectronicReleaseTag(tag)) {
        count += 1;
      }
    }
  }
  return count;
}

/** Distinct electronic profile keyword hits (tie-break #2). */
export function scoreProfileElectronicKeywordDensity(profile?: string): number {
  const text = profile?.toLowerCase() ?? '';
  if (!text.trim()) {
    return 0;
  }
  let count = 0;
  for (const keyword of ELECTRONIC_PROFILE_KEYWORDS) {
    if (text.includes(keyword)) {
      count += 1;
    }
  }
  return count;
}

/** EP / remix / single preferred over album / compilation (tie-break #3). */
export function scoreReleaseTypePreference(
  releaseSamples: DiscogsReleaseSample[],
): number {
  let score = 0;
  for (const sample of releaseSamples.slice(
    0,
    DISCOGS_MATCH_RELEASE_SAMPLE_SIZE,
  )) {
    const blob = [
      sample.title ?? '',
      sample.format ?? '',
      ...(sample.formatDescriptions ?? []),
      ...(sample.genres ?? []),
      ...(sample.styles ?? []),
    ]
      .join(' ')
      .toLowerCase();

    if (/\bremix\b|rework|\bedit\b|bootleg|\bvip\b/.test(blob)) {
      score += 3;
    } else if (/\bep\b|\bsingle\b|maxi|12"/.test(blob)) {
      score += 2;
    } else if (/\balbum\b|compilation|\bcomp\b|\blp\b/.test(blob)) {
      score -= 1;
    }

    if (/\bpop\b/.test(blob) && !/\belectro\b/.test(blob)) {
      score -= 2;
    }
  }
  return score;
}

export type DiscogsArtistTiebreakBreakdown = {
  disambiguationPreference: number;
  releaseElectronicTags: number;
  profileKeywordDensity: number;
  releaseTypePreference: number;
};

export function scoreDiscogsDisambiguationPreference(name: string): number {
  const suffix = parseDiscogsDisambiguationSuffix(name);
  if (suffix == null) {
    return 100;
  }
  return Math.max(0, 80 - suffix * 15);
}

export function scoreDiscogsArtistTiebreak(
  candidate: DiscogsArtistCandidate,
): DiscogsArtistTiebreakBreakdown {
  const samples = resolveReleaseSamples(candidate) as DiscogsReleaseSample[];
  return {
    disambiguationPreference: scoreDiscogsDisambiguationPreference(
      candidate.name,
    ),
    releaseElectronicTags: countReleaseElectronicTags(samples),
    profileKeywordDensity: scoreProfileElectronicKeywordDensity(
      candidate.profile,
    ),
    releaseTypePreference: scoreReleaseTypePreference(samples),
  };
}

export function compareDiscogsTiebreakBreakdown(
  left: DiscogsArtistTiebreakBreakdown,
  right: DiscogsArtistTiebreakBreakdown,
): number {
  if (left.disambiguationPreference !== right.disambiguationPreference) {
    return left.disambiguationPreference - right.disambiguationPreference;
  }
  if (left.releaseElectronicTags !== right.releaseElectronicTags) {
    return left.releaseElectronicTags - right.releaseElectronicTags;
  }
  if (left.profileKeywordDensity !== right.profileKeywordDensity) {
    return left.profileKeywordDensity - right.profileKeywordDensity;
  }
  return left.releaseTypePreference - right.releaseTypePreference;
}

/**
 * Pick a single winner from all tied candidates using tie-break criteria.
 * Returns null when the top two remain indistinguishable after ranking.
 */
export function pickTiebreakWinner(
  candidates: DiscogsArtistCandidate[],
): DiscogsArtistCandidate | null {
  if (!candidates.length) {
    return null;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      tiebreak: scoreDiscogsArtistTiebreak(candidate),
    }))
    .sort((left, right) =>
      compareDiscogsTiebreakBreakdown(right.tiebreak, left.tiebreak),
    );

  const best = ranked[0];
  const second = ranked[1];
  if (compareDiscogsTiebreakBreakdown(best.tiebreak, second.tiebreak) === 0) {
    return null;
  }

  return best.candidate;
}

/**
 * Break a close high-score tie between two candidates.
 * @deprecated Prefer pickTiebreakWinner for multi-candidate clusters.
 */
export function tryBreakDiscogsArtistTie(
  top: DiscogsArtistCandidate,
  second: DiscogsArtistCandidate,
): DiscogsArtistCandidate | null {
  return pickTiebreakWinner([top, second]);
}

export function getAmbiguousScoreCluster(
  eligible: DiscogsArtistMatchScore[],
  minAccept: number,
  ambiguityGap: number,
): DiscogsArtistMatchScore[] {
  if (!eligible.length) {
    return [];
  }

  const top = eligible[0];
  if (top.total < minAccept) {
    return [];
  }

  return eligible.filter(
    (item) => item.total >= minAccept && top.total - item.total < ambiguityGap,
  );
}

export function isCloseHighScoreAmbiguity(
  eligible: DiscogsArtistMatchScore[],
  minAccept: number,
  ambiguityGap: number,
): boolean {
  return (
    getAmbiguousScoreCluster(eligible, minAccept, ambiguityGap).length >= 2
  );
}

export function getEligibleRankedScores(
  scored: DiscogsArtistMatchScore[],
  suspectMin: number,
): DiscogsArtistMatchScore[] {
  return [...scored]
    .sort((left, right) => right.total - left.total)
    .filter((item) => item.total >= suspectMin);
}

export type DiscogsDjRecordSnapshot = {
  profile?: string;
  genres?: string[];
  styles?: string[];
  representativeWorks?: Array<{ title?: string }>;
};

/**
 * True when the record is backed by real Discogs data — never invent filler copy.
 * Accept: non-trivial profile, or release-derived styles plus at least one work.
 */
export function isVerifiableDiscogsDjRecord(
  record: DiscogsDjRecordSnapshot,
): boolean {
  const profile = record.profile?.trim() ?? '';
  if (isDiscogsDisambiguationProfile(profile)) {
    return false;
  }
  if (profile.length >= DISCOGS_MIN_VERIFIABLE_PROFILE_LENGTH) {
    return true;
  }

  const styles = record.styles ?? [];
  const works = record.representativeWorks ?? [];
  return styles.length > 0 && works.length > 0;
}

function scoreReleaseElectronicBonus(
  releaseSamples: DiscogsReleaseTags[],
): number {
  const { electronicRatio, classifiedTags } =
    scoreReleaseTagRatios(releaseSamples);
  if (!classifiedTags) {
    return 0;
  }
  return electronicRatio > DISCOGS_MATCH_RELEASE_ELECTRONIC_RATIO
    ? RELEASE_ELECTRONIC_BONUS
    : 0;
}

function scoreReleaseNonElectronicPenalty(
  releaseSamples: DiscogsReleaseTags[],
): number {
  const { nonElectronicRatio, classifiedTags } =
    scoreReleaseTagRatios(releaseSamples);
  if (!classifiedTags) {
    return 0;
  }
  return nonElectronicRatio >= DISCOGS_MATCH_RELEASE_NON_ELECTRONIC_RATIO
    ? RELEASE_NON_ELECTRONIC_PENALTY
    : 0;
}

export function scoreDiscogsArtistCandidate(
  _lineupName: string,
  candidate: DiscogsArtistCandidate,
): DiscogsArtistMatchScore {
  const releaseSamples = resolveReleaseSamples(candidate);
  const breakdown = {
    base: DISCOGS_MATCH_BASE_SCORE,
    profileElectronicBonus: scoreProfileElectronicBonus(candidate.profile),
    releaseElectronicBonus: scoreReleaseElectronicBonus(releaseSamples),
    releaseNonElectronicPenalty:
      scoreReleaseNonElectronicPenalty(releaseSamples),
    profileNonElectronicPenalty: scoreProfileNonElectronicPenalty(
      candidate.profile,
    ),
  };

  const total =
    breakdown.base +
    breakdown.profileElectronicBonus +
    breakdown.releaseElectronicBonus -
    breakdown.releaseNonElectronicPenalty -
    breakdown.profileNonElectronicPenalty;

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
      discoveryStrategyId?: string;
    }
  | {
      status: 'pending_review';
      reviewReason: string;
      searchQuery: string;
      candidateScores: DiscogsArtistMatchScore[];
      needsTiebreak?: boolean;
      tiebreakCluster?: DiscogsArtistMatchScore[];
    };

export function decideDiscogsArtistMatch(
  lineupName: string,
  scored: DiscogsArtistMatchScore[],
  options?: {
    minAcceptScore?: number;
    suspectMinScore?: number;
    ambiguityGap?: number;
    searchQuery?: string;
    /** Lineup name + explicit alias only — used for strict name gate. */
    nameMatchVariants?: string[];
    /** When provided, name gate also checks artist page aliases / ANV. */
    candidateById?: Map<
      number,
      Pick<DiscogsArtistCandidate, 'name' | 'aliases' | 'profile'>
    >;
  },
): DiscogsMatchDecision {
  const minAccept = options?.minAcceptScore ?? DISCOGS_MATCH_MIN_ACCEPT_SCORE;
  const suspectMin =
    options?.suspectMinScore ?? DISCOGS_MATCH_SUSPECT_MIN_SCORE;
  const ambiguityGap = options?.ambiguityGap ?? DISCOGS_MATCH_AMBIGUITY_GAP;
  const searchQuery =
    options?.searchQuery ?? defaultLineupSearchQueryLabel(lineupName);
  const nameMatchVariants = options?.nameMatchVariants ?? [];

  function passesNameGate(discogsId: number, discogsName: string): boolean {
    const candidate = options?.candidateById?.get(discogsId);
    if (candidate) {
      return isLineupDiscogsCandidatePlausible(
        lineupName,
        candidate,
        nameMatchVariants,
      );
    }
    return isLineupDiscogsNamePlausible(
      lineupName,
      discogsName,
      nameMatchVariants,
    );
  }

  const ranked = [...scored].sort((a, b) => b.total - a.total);
  const eligible = ranked.filter((item) => item.total >= suspectMin);
  const gatePassed = eligible.filter((item) =>
    passesNameGate(item.discogsId, item.name),
  );

  if (!eligible.length) {
    return {
      status: 'pending_review',
      reviewReason: DISCOGS_REVIEW_REASON.NO_QUALIFYING_CANDIDATE,
      searchQuery,
      candidateScores: [],
    };
  }

  if (!gatePassed.length) {
    return {
      status: 'pending_review',
      reviewReason: DISCOGS_REVIEW_REASON.nameMismatch(eligible[0].name),
      searchQuery,
      candidateScores: eligible,
    };
  }

  const top = gatePassed[0];
  const second = gatePassed[1];

  if (top.total < minAccept) {
    return {
      status: 'pending_review',
      reviewReason: DISCOGS_REVIEW_REASON.INSUFFICIENT_SCORE,
      searchQuery,
      candidateScores: eligible,
    };
  }

  const ambiguousCluster = getAmbiguousScoreCluster(
    gatePassed,
    minAccept,
    ambiguityGap,
  );

  if (isCloseHighScoreAmbiguity(gatePassed, minAccept, ambiguityGap)) {
    return {
      status: 'pending_review',
      reviewReason: DISCOGS_REVIEW_REASON.HOMONYM_AMBIGUITY,
      searchQuery,
      candidateScores: ambiguousCluster,
      needsTiebreak: true,
      tiebreakCluster: ambiguousCluster,
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
