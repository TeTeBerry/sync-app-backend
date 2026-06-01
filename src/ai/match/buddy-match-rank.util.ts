import type { PostRecord } from '../../modules/partner/interfaces/post.repository.interface';
import {
  collectRequesterTags,
  normalizeCityName,
} from './buddy-match-criteria.util';
import type { BuddyMatchCriteria } from './buddy-match.types';

export interface PostFitUserProfile {
  city?: string;
  favorGenres?: string[];
}

export interface PostFitSnapshot {
  tags?: string[];
  body?: string;
  departureCity?: string;
  location?: string;
  eventTitle?: string;
  matchCriteria?: Partial<BuddyMatchCriteria>;
}

export interface LightTieBreakResult {
  boost: number;
  matchReason?: string;
  matchedTags: string[];
  departureCityExact: boolean;
}

/** Max nudge after rerank ordering (exact city + shared tags). */
export const LIGHT_TIE_BREAK_MAX = 2;

export interface CriteriaRankedPost {
  postId: string;
  snippet: string;
  score: number;
  matchReason?: string;
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/^#/, '');
}

function countSharedTags(
  requesterTags: string[] | undefined,
  post: PostFitSnapshot,
): string[] {
  const requester = [
    ...new Set((requesterTags ?? []).map(normalizeTag).filter(Boolean)),
  ];
  if (!requester.length) return [];

  const postTagSet = new Set(
    (post.tags ?? []).map(normalizeTag).filter(Boolean),
  );
  const haystack = [
    post.body,
    post.location,
    post.departureCity,
    ...(post.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return requester.filter(
    (tag) =>
      postTagSet.has(tag) ||
      haystack.includes(`#${tag}`) ||
      haystack.includes(tag),
  );
}

export function buildPostFitMatchReason(params: {
  matchedTags: string[];
  departureCity?: string;
  departureCityExact?: boolean;
  topRerank?: boolean;
}): string | undefined {
  if (params.topRerank) {
    return '内容高度相关';
  }

  if (params.matchedTags.length) {
    const labels = params.matchedTags
      .slice(0, 3)
      .map((tag) => `#${tag.startsWith('#') ? tag.slice(1) : tag}`);
    return `标签契合：${labels.join('、')}`;
  }

  if (params.departureCityExact && params.departureCity) {
    return `同样从「${params.departureCity}」出发`;
  }

  return undefined;
}

/**
 * Light tie-break only (+2 max): exact departureCity, shared tags.
 * Does not override rerank ordering except within equal rerank slots.
 */
export function applyLightTieBreak(
  criteria: BuddyMatchCriteria,
  post: PostFitSnapshot,
): LightTieBreakResult {
  let boost = 0;
  const targetCity = normalizeCityName(criteria.departureCity);
  const postCity =
    normalizeCityName(post.departureCity) ??
    normalizeCityName(post.location) ??
    normalizeCityName(post.matchCriteria?.departureCity);

  let departureCityExact = false;

  if (targetCity && postCity === targetCity) {
    boost += 1;
    departureCityExact = true;
  }

  const matchedTags = countSharedTags(criteria.requesterTags, post);
  if (matchedTags.length && boost < LIGHT_TIE_BREAK_MAX) {
    boost += 1;
  }

  const matchReason = buildPostFitMatchReason({
    matchedTags,
    departureCity: targetCity,
    departureCityExact,
  });

  return { boost, matchReason, matchedTags, departureCityExact };
}

/** Lexical overlap for Mongo-only fallback when vectors are unavailable. */
function lexicalFallbackScore(
  criteria: BuddyMatchCriteria,
  post: PostFitSnapshot,
): number {
  const tie = applyLightTieBreak(criteria, post);
  let score = tie.boost;

  const requesterText = [
    criteria.requesterBody,
    criteria.departureCity,
    ...(criteria.requesterTags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const postText = [post.body, post.eventTitle, ...(post.tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!requesterText.trim() || !postText.trim()) return score;

  const tokens = requesterText
    .split(/[\s#，,。、]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  for (const token of tokens) {
    if (postText.includes(token)) score += 0.5;
  }

  return score;
}

function buildSnippet(post: PostFitSnapshot): string {
  const raw = post.body?.trim() || post.eventTitle || '组队帖';
  return raw.length > 120 ? `${raw.slice(0, 120)}…` : raw;
}

export function rankPostsByCriteria(
  posts: PostRecord[],
  criteria: BuddyMatchCriteria,
  limit: number,
  _profile?: PostFitUserProfile,
): CriteriaRankedPost[] {
  const scored = posts
    .map((post) => {
      const snapshot = postRecordToFitSnapshot(post);
      const tie = applyLightTieBreak(criteria, snapshot);
      const score = lexicalFallbackScore(criteria, snapshot);
      return {
        postId: String(post._id),
        snippet: buildSnippet(snapshot),
        score,
        matchReason:
          tie.matchReason ?? (score > tie.boost ? '同活动招募帖' : undefined),
      };
    })
    .sort((left, right) => right.score - left.score);

  return scored.slice(0, limit);
}

export function postRecordToFitSnapshot(post: PostRecord): PostFitSnapshot {
  const stored = post.matchCriteria as Partial<BuddyMatchCriteria> | undefined;

  return {
    tags: post.tags,
    body: post.body,
    departureCity: post.departureCity ?? stored?.departureCity,
    location: post.location,
    eventTitle: post.eventTitle,
    matchCriteria: stored,
  };
}

/** @deprecated Use applyLightTieBreak; kept for match-ranking.util match reasons. */
export function scorePostFit(
  criteria: BuddyMatchCriteria,
  profile: PostFitUserProfile | undefined,
  post: PostFitSnapshot,
): {
  score: number;
  matchReason?: string;
  matchedTags: string[];
  matchedIntents: never[];
  matchedContentTokens: never[];
} {
  const tie = applyLightTieBreak(criteria, post);
  let score = tie.boost;

  if (profile?.city) {
    const target = normalizeCityName(profile.city);
    const postCity =
      normalizeCityName(post.departureCity) ?? normalizeCityName(post.location);
    if (
      target &&
      postCity &&
      (postCity === target || postCity.includes(target))
    ) {
      score += 0.5;
    }
  }

  return {
    score,
    matchReason: tie.matchReason,
    matchedTags: tie.matchedTags,
    matchedIntents: [],
    matchedContentTokens: [],
  };
}
