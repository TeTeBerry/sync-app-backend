import type { PostRecord } from '../interfaces/post.repository.interface';
import {
  extractProfileGenresFromText,
  type UserMatchProfile,
} from '../../user/user-profile-hints.util';
import { normalizeCityName } from './departure-city.util';

export type BuddyPostSearchParsed = {
  eventName?: string;
  date?: string;
  genre?: string;
  peopleCount?: string;
  extraKeywords?: string[];
};

export type BuddyPostSearchResult = {
  parsed: BuddyPostSearchParsed & { searchTerms: string[] };
  items: PostRecord[];
  totalMatched: number;
  totalScanned: number;
};

function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[#＃]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCharacterSubsequence(haystack: string, needle: string): boolean {
  if (!needle) return true;
  let start = 0;
  for (const char of needle) {
    const index = haystack.indexOf(char, start);
    if (index < 0) return false;
    start = index + 1;
  }
  return true;
}

function tokenMatchesHaystack(haystack: string, token: string): boolean {
  if (!token) return true;
  if (haystack.includes(token)) return true;
  if (haystack.split(' ').some((word) => word.startsWith(token))) return true;
  if (token.length >= 2 && isCharacterSubsequence(haystack, token)) return true;
  return false;
}

/** Substring, token prefix, and ordered-character fuzzy match. */
export function fuzzyTextMatches(text: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const haystack = normalizeSearchText(text);
  if (!haystack) return false;

  if (haystack.includes(normalizedQuery)) return true;

  const tokens = normalizedQuery.split(' ').filter(Boolean);
  return tokens.every((token) => tokenMatchesHaystack(haystack, token));
}

export function buildBuddyPostSearchText(post: PostRecord): string {
  return [post.body, post.location, post.departureCity, ...(post.tags ?? [])]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ');
}

export function buddyPostMatchesSearchTerms(
  post: PostRecord,
  searchTerms: string[],
): boolean {
  if (!searchTerms.length) return true;
  const haystack = buildBuddyPostSearchText(post);
  return searchTerms.every((term) => fuzzyTextMatches(haystack, term));
}

const SEARCH_STOP_WORDS = new Set([
  '找',
  '个',
  '人',
  '名',
  '需要',
  '希望',
  '想要',
  '搭子',
  '搭伴',
  '比如',
  '检索',
  '喜欢',
]);

export function buildSearchTermsFromParsed(
  parsed: BuddyPostSearchParsed,
): string[] {
  const terms: string[] = [];
  const push = (value?: string) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    terms.push(trimmed);
  };

  push(parsed.eventName);
  push(parsed.date);
  push(parsed.genre);
  push(parsed.peopleCount);
  for (const keyword of parsed.extraKeywords ?? []) {
    push(keyword);
  }

  return [...new Set(terms)];
}

export function tokenizeRawBuddySearchQuery(query: string): string[] {
  const normalized = query
    .replace(/[，,。.!！?？；;、]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];

  return [
    ...new Set(
      normalized
        .split(' ')
        .map((part) => part.trim().replace(/的搭子$|的搭伴$/, ''))
        .filter((part) => part.length >= 2 && !SEARCH_STOP_WORDS.has(part)),
    ),
  ];
}

export function normalizeBuddyPostSearchInput(query: string): string {
  return query
    .trim()
    .replace(/^找/, '')
    .replace(/的(队|招募帖?|搭子|队友|同行|小伙伴|同逛)(的招募)?$/g, '')
    .replace(/(招募帖?|搭子|队友|同行|小伙伴|同逛)$/g, '')
    .replace(/公开招募/g, ' ')
    .replace(/的$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Rule-based keyword parse — LLM fallback when disabled. */
export function parseBuddyPostSearchQuery(
  query: string,
): BuddyPostSearchParsed {
  const trimmed = query.trim();
  if (!trimmed) return {};

  const normalized = normalizeBuddyPostSearchInput(trimmed);
  const parseTarget = normalized || trimmed;
  const peopleMatch = parseTarget.match(/(\d+)\s*(个|人|名)/);
  const dateMatch = parseTarget.match(
    /(\d{1,2}[./月]\d{1,2}(?:[./月]\d{2,4})?)/,
  );
  const genreMatch = parseTarget.match(/喜欢\s*([^，,。.!！?？；;]+)/);

  const peopleCount = peopleMatch?.[1];
  const date = dateMatch?.[1];
  const genre = genreMatch?.[1]?.trim();

  let remainder = parseTarget;
  if (dateMatch?.[0]) remainder = remainder.replace(dateMatch[0], ' ');
  if (genreMatch?.[0]) remainder = remainder.replace(genreMatch[0], ' ');
  if (peopleMatch?.[0]) remainder = remainder.replace(peopleMatch[0], ' ');

  const extraKeywords = tokenizeRawBuddySearchQuery(remainder);
  const parsed: BuddyPostSearchParsed = {
    date,
    genre,
    peopleCount,
    extraKeywords: extraKeywords.length ? extraKeywords : undefined,
  };

  if (!buildSearchTermsFromParsed(parsed).length) {
    const fromRaw = tokenizeRawBuddySearchQuery(parseTarget || trimmed);
    return fromRaw.length
      ? { extraKeywords: fromRaw }
      : parseTarget
        ? { extraKeywords: [parseTarget] }
        : { extraKeywords: [trimmed] };
  }

  return parsed;
}

export function resolveBuddyPostSearchTerms(
  parsed: BuddyPostSearchParsed,
  rawQuery: string,
): string[] {
  const fromParsed = buildSearchTermsFromParsed(parsed);
  if (fromParsed.length) return fromParsed;

  const normalized = normalizeBuddyPostSearchInput(rawQuery);
  if (normalized) {
    const fromNormalized = tokenizeRawBuddySearchQuery(normalized);
    if (fromNormalized.length) return fromNormalized;
    return [normalized];
  }

  return tokenizeRawBuddySearchQuery(rawQuery);
}

function comparePostsByCreatedAtDesc(
  left: PostRecord,
  right: PostRecord,
): number {
  const leftTime = new Date(String(left.createdAt ?? 0)).getTime();
  const rightTime = new Date(String(right.createdAt ?? 0)).getTime();
  if (rightTime !== leftTime) return rightTime - leftTime;
  return String(right._id).localeCompare(String(left._id));
}

function termMatchStrength(haystack: string, term: string): number {
  const normalizedHaystack = normalizeSearchText(haystack);
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return 0;
  if (normalizedHaystack.includes(normalizedTerm)) return 100;
  if (fuzzyTextMatches(haystack, term)) return 60;
  return 0;
}

/** Higher = stronger keyword relevance (all terms must match to be included). */
export function scoreBuddyPostKeywordMatch(
  post: PostRecord,
  searchTerms: string[],
): number {
  if (!searchTerms.length) return 0;

  const haystack = buildBuddyPostSearchText(post);
  const departureHaystack = normalizeSearchText(
    [post.departureCity, post.location].filter(Boolean).join(' '),
  );

  let total = 0;
  for (const term of searchTerms) {
    const strength = termMatchStrength(haystack, term);
    if (strength === 0) return 0;
    total += strength;

    const normalizedTerm = normalizeSearchText(term);
    if (
      departureHaystack &&
      normalizedTerm &&
      departureHaystack.includes(normalizedTerm)
    ) {
      total += 20;
    }
  }

  return total;
}

/** Secondary ranking signal from the viewer's saved match profile. */
export function scoreBuddyPostPreferenceMatch(
  post: PostRecord,
  profile?: UserMatchProfile | null,
): number {
  if (!profile) return 0;

  let score = 0;
  const userCity = normalizeCityName(profile.city);
  const postCity =
    normalizeCityName(post.departureCity) ?? normalizeCityName(post.location);
  if (userCity && postCity && userCity === postCity) {
    score += 50;
  }

  const postGenres = extractProfileGenresFromText(
    buildBuddyPostSearchText(post),
  );
  const userGenres = new Set(
    (profile.favorGenres ?? []).map((genre) => genre.trim().toLowerCase()),
  );
  let genreHits = 0;
  for (const genre of postGenres) {
    if (userGenres.has(genre.toLowerCase())) {
      genreHits += 1;
    }
  }
  score += Math.min(45, genreHits * 15);

  return score;
}

/** Keyword filter first; rank by keyword score, then user preference, then recency. */
export function rankBuddyPostsBySearch(
  posts: PostRecord[],
  searchTerms: string[],
  profile?: UserMatchProfile | null,
): PostRecord[] {
  const matched = searchTerms.length
    ? posts.filter((post) => buddyPostMatchesSearchTerms(post, searchTerms))
    : [...posts];

  return matched.sort((left, right) => {
    const keywordDelta =
      scoreBuddyPostKeywordMatch(right, searchTerms) -
      scoreBuddyPostKeywordMatch(left, searchTerms);
    if (keywordDelta !== 0) return keywordDelta;

    const preferenceDelta =
      scoreBuddyPostPreferenceMatch(right, profile) -
      scoreBuddyPostPreferenceMatch(left, profile);
    if (preferenceDelta !== 0) return preferenceDelta;

    return comparePostsByCreatedAtDesc(right, left);
  });
}

/** @deprecated Prefer rankBuddyPostsBySearch */
export function filterBuddyPostsBySearchTerms(
  posts: PostRecord[],
  searchTerms: string[],
): PostRecord[] {
  return rankBuddyPostsBySearch(posts, searchTerms);
}
