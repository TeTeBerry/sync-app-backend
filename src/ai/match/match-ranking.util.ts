import type { BuddyMatchCriteria } from './buddy-match.types';
import {
  applyLightTieBreak,
  buildPostFitMatchReason,
  type PostFitSnapshot,
} from './buddy-match-rank.util';

export interface UserMatchProfile {
  city?: string;
  favorGenres?: string[];
  likeMate?: boolean;
  budgetLevel?: string;
}

export interface MatchRankingWeights {
  city: number;
  genreOverlap: number;
  likeMateCompatible: number;
  budgetCompatible: number;
  /** Multiplier strength for Chroma user-profile vector similarity */
  profileVector: number;
  personalization: number;
}

export const DEFAULT_MATCH_RANKING_WEIGHTS: MatchRankingWeights = {
  city: 0.12,
  genreOverlap: 0.1,
  likeMateCompatible: 0.06,
  budgetCompatible: 0.04,
  profileVector: 0.2,
  personalization: 0.04,
};

export interface MatchFilterContext {
  requesterUserId?: string;
  profile?: UserMatchProfile;
  criteria?: BuddyMatchCriteria;
  blockedUserIds: ReadonlySet<string>;
  buddyUserIds: ReadonlySet<string>;
}

export interface PostAuthorSnapshot {
  userId: string;
  city?: string;
  favorGenres?: string[];
  likeMate?: boolean;
  budgetLevel?: string;
}

export interface RankablePostCandidate {
  postId: string;
  document: string;
  distance?: number;
  /** Lower distance = stronger profile-vector fit from Chroma */
  profileDistance?: number;
  authorUserId: string;
  postCity?: string;
  postTags?: string[];
  postBody?: string;
  postDepartureCity?: string;
  author?: PostAuthorSnapshot;
}

export interface RankedMatchResult {
  postId: string;
  snippet: string;
  distance?: number;
  score: number;
  matchReason?: string;
}

function normalizeToken(value?: string): string {
  return value?.trim().toLowerCase() ?? '';
}

function normalizeCity(value?: string): string {
  return normalizeToken(value).replace(/(市|省)$/, '');
}

function citiesMatch(
  requesterCity?: string,
  authorCity?: string,
  postCity?: string,
): boolean {
  const target = normalizeCity(requesterCity);
  if (!target) return false;

  const author = normalizeCity(authorCity);
  if (
    author &&
    (author === target || author.includes(target) || target.includes(author))
  ) {
    return true;
  }

  const location = normalizeCity(postCity);
  return Boolean(
    location &&
    (location === target ||
      location.includes(target) ||
      target.includes(location)),
  );
}

function normalizeGenre(value: string): string {
  return value.trim().toLowerCase().replace(/^#/, '');
}

function genreOverlapRatio(
  requesterGenres: string[] | undefined,
  authorGenres: string[] | undefined,
  postTags: string[] | undefined,
): number {
  const labels = overlappingGenreLabels(
    requesterGenres,
    authorGenres,
    postTags,
  );
  const requesterCount = new Set(
    (requesterGenres ?? []).map(normalizeGenre).filter(Boolean),
  ).size;
  if (!requesterCount) return 0;
  return labels.length / requesterCount;
}

function overlappingGenreLabels(
  requesterGenres: string[] | undefined,
  authorGenres: string[] | undefined,
  postTags: string[] | undefined,
): string[] {
  const requester = new Set(
    (requesterGenres ?? []).map(normalizeGenre).filter(Boolean),
  );
  if (!requester.size) return [];

  const author = new Set(
    (authorGenres ?? []).map(normalizeGenre).filter(Boolean),
  );
  for (const tag of postTags ?? []) {
    const normalized = normalizeGenre(tag);
    if (normalized) author.add(normalized);
  }

  const labels: string[] = [];
  for (const genre of requesterGenres ?? []) {
    const key = normalizeGenre(genre);
    if (key && author.has(key)) {
      labels.push(genre.trim());
    }
  }
  return [...new Set(labels)].slice(0, 3);
}

function displayCityLabel(city?: string): string | undefined {
  const trimmed = city?.trim();
  return trimmed || undefined;
}

function likeMateCompatibility(requester?: boolean, author?: boolean): number {
  if (requester == null || author == null) return 0.5;
  if (requester && author) return 1;
  if (!requester && !author) return 0.75;
  return 0.2;
}

function normalizeBudgetLevel(value?: string): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (trimmed === 'low' || trimmed === 'medium' || trimmed === 'high') {
    return trimmed;
  }
  return undefined;
}

function budgetCompatibility(requester?: string, author?: string): number {
  const left = normalizeBudgetLevel(requester);
  const right = normalizeBudgetLevel(author);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const order = ['low', 'medium', 'high'];
  const li = order.indexOf(left);
  const ri = order.indexOf(right);
  if (li >= 0 && ri >= 0 && Math.abs(li - ri) === 1) return 0.5;
  return 0;
}

function hashPersonalization(userId: string, postId: string): number {
  const key = `${userId}:${postId}`;
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function vectorScore(distance?: number): number {
  if (distance == null || Number.isNaN(distance)) return 0.5;
  return 1 / (1 + Math.max(distance, 0));
}

/** Multiplier applied to vectorScore from stored user-profile embedding similarity */
export function profileVectorWeightBoost(
  profileDistance?: number,
  weight = DEFAULT_MATCH_RANKING_WEIGHTS.profileVector,
): number {
  if (profileDistance == null || Number.isNaN(profileDistance)) return 1;
  const similarity = 1 / (1 + Math.max(profileDistance, 0));
  return 1 + weight * similarity;
}

export function computeProfileBoost(
  profile: UserMatchProfile | undefined,
  candidate: RankablePostCandidate,
  weights: MatchRankingWeights = DEFAULT_MATCH_RANKING_WEIGHTS,
): number {
  if (!profile) return 0;

  let boost = 0;

  if (citiesMatch(profile.city, candidate.author?.city, candidate.postCity)) {
    boost += weights.city;
  }

  const genreRatio = genreOverlapRatio(
    profile.favorGenres,
    candidate.author?.favorGenres,
    candidate.postTags,
  );
  boost += weights.genreOverlap * genreRatio;

  boost +=
    weights.likeMateCompatible *
    likeMateCompatibility(profile.likeMate, candidate.author?.likeMate);

  boost +=
    weights.budgetCompatible *
    budgetCompatibility(profile.budgetLevel, candidate.author?.budgetLevel);

  return boost;
}

export function shouldFilterCandidate(
  candidate: RankablePostCandidate,
  context: MatchFilterContext,
): boolean {
  const requesterId = context.requesterUserId?.trim();
  if (!requesterId) return false;

  const authorId = candidate.authorUserId.trim();
  if (!authorId) return false;

  if (authorId === requesterId) return true;
  if (context.blockedUserIds.has(authorId)) return true;
  if (context.buddyUserIds.has(authorId)) return true;

  return false;
}

function buildSnippet(document: string): string {
  return document.length > 120 ? `${document.slice(0, 120)}…` : document;
}

function candidateToPostFitSnapshot(
  candidate: RankablePostCandidate,
): PostFitSnapshot {
  return {
    tags: candidate.postTags,
    body: candidate.postBody ?? candidate.document,
    departureCity: candidate.postDepartureCity,
    location: candidate.postCity,
  };
}

export function formatMatchReasonParts(parts: string[]): string | undefined {
  const unique = [...new Set(parts.map((p) => p.trim()).filter(Boolean))];
  if (!unique.length) return undefined;
  return unique.slice(0, 2).join(' · ');
}

export function buildMatchReason(
  candidate: RankablePostCandidate,
  profile?: UserMatchProfile,
  criteria?: BuddyMatchCriteria,
): string | undefined {
  const parts: string[] = [];

  const departureCity =
    criteria?.departureCity?.trim() || profile?.city?.trim();
  if (departureCity) {
    const tie = criteria
      ? applyLightTieBreak(criteria, candidateToPostFitSnapshot(candidate))
      : null;
    if (
      tie?.departureCityExact ||
      citiesMatch(departureCity, candidate.author?.city, candidate.postCity)
    ) {
      parts.push(`同「${displayCityLabel(departureCity)}」出发`);
    }
  }

  const genreLabels = overlappingGenreLabels(
    profile?.favorGenres,
    candidate.author?.favorGenres,
    candidate.postTags,
  );
  if (genreLabels.length) {
    parts.push(`曲风接近：${genreLabels.join('、')}`);
  }

  if (profile?.likeMate === true && candidate.author?.likeMate === true) {
    parts.push('都想找搭子');
  }

  if (
    profile?.budgetLevel &&
    candidate.author?.budgetLevel &&
    budgetCompatibility(profile.budgetLevel, candidate.author.budgetLevel) >=
      0.5
  ) {
    parts.push('住宿预算相近');
  }

  if (candidate.profileDistance != null && candidate.profileDistance < 0.5) {
    parts.push('偏好画像接近');
  }

  const formatted = formatMatchReasonParts(parts);
  if (formatted) return formatted;

  if (candidate.distance != null && candidate.distance < 0.35) {
    return '内容高度相关';
  }

  return undefined;
}

export function rerankMatchCandidates(
  candidates: RankablePostCandidate[],
  context: MatchFilterContext,
  limit: number,
  weights: MatchRankingWeights = DEFAULT_MATCH_RANKING_WEIGHTS,
): RankedMatchResult[] {
  const requesterId = context.requesterUserId?.trim();
  const scored: RankedMatchResult[] = [];

  for (const candidate of candidates) {
    if (shouldFilterCandidate(candidate, context)) continue;

    const base = vectorScore(candidate.distance);
    const vectorWeighted =
      base *
      profileVectorWeightBoost(
        candidate.profileDistance,
        weights.profileVector,
      );
    const personalization =
      requesterId && weights.personalization > 0
        ? hashPersonalization(requesterId, candidate.postId) *
          weights.personalization
        : 0;

    let score = vectorWeighted + personalization;
    let matchReason: string | undefined;

    if (context.criteria) {
      const tie = applyLightTieBreak(
        context.criteria,
        candidateToPostFitSnapshot(candidate),
      );
      score = vectorWeighted + personalization + tie.boost * 0.01;
      matchReason =
        tie.matchReason ??
        buildMatchReason(candidate, context.profile, context.criteria);
    } else {
      const profileBoost = computeProfileBoost(
        context.profile,
        candidate,
        weights,
      );
      score += profileBoost;
      matchReason = buildMatchReason(candidate, context.profile);
    }

    scored.push({
      postId: candidate.postId,
      snippet: buildSnippet(candidate.document),
      distance: candidate.distance,
      score,
      matchReason,
    });
  }

  scored.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const leftDistance = left.distance ?? Number.POSITIVE_INFINITY;
    const rightDistance = right.distance ?? Number.POSITIVE_INFINITY;
    return leftDistance - rightDistance;
  });

  return scored.slice(0, Math.max(limit, 0));
}
