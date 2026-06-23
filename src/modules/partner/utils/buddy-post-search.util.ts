import type { PostRecord } from '../interfaces/post.repository.interface';
import {
  extractProfileGenresFromText,
  type UserMatchProfile,
} from '../../user/user-profile-hints.util';
import {
  inferDepartureCityFromText,
  normalizeCityName,
  resolveDepartureCity,
} from './departure-city.util';

import type { BuddyPostSearchParsed } from '@sync/partner-contracts';

export type { BuddyPostSearchParsed } from '@sync/partner-contracts';

export type BuddyPostSearchParsedFields = Omit<
  BuddyPostSearchParsed,
  'searchTerms'
>;

export type BuddyPostSearchCriteria = {
  departureCity?: string;
  searchTerms: string[];
  /** Budget / price-band terms — boost ranking but never block results alone. */
  softSearchTerms?: string[];
  preferOpenRecruit?: boolean;
};

export type BuddyPostSearchResult = {
  parsed: BuddyPostSearchParsed;
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

const BUDGET_SEARCH_TERM_PATTERN =
  /^(经济|舒适|豪华|标准|实惠|省钱|高端|奢华)(档|型|预算)?/;

/** Budget / price-band tokens are optional for inclusion (ranking signal only). */
export function isBudgetBuddySearchTerm(term: string): boolean {
  const trimmed = term.trim();
  if (!trimmed) return false;
  if (BUDGET_SEARCH_TERM_PATTERN.test(trimmed)) return true;
  if (/¥\s*\d/.test(trimmed)) return true;
  if (/\(\s*¥?\d+[-–~]¥?\d+/.test(trimmed)) return true;
  if (/\/晚/.test(trimmed) && /\d/.test(trimmed)) return true;
  return false;
}

export function partitionBuddyPostSearchTerms(terms: string[]): {
  required: string[];
  soft: string[];
} {
  const required: string[] = [];
  const soft: string[] = [];
  for (const term of terms) {
    if (isBudgetBuddySearchTerm(term)) {
      soft.push(term);
    } else {
      required.push(term);
    }
  }
  return { required, soft };
}

function countMatchedBuddyPostSearchTerms(
  post: PostRecord,
  terms: string[],
): number {
  if (!terms.length) return 0;
  const haystack = buildBuddyPostSearchText(post);
  return terms.filter((term) => buddyPostSearchTermMatches(haystack, term))
    .length;
}

function budgetLabelFromSearchTerm(term: string): string | undefined {
  const match = term.trim().match(BUDGET_SEARCH_TERM_PATTERN);
  return match?.[1];
}

function buddyPostSearchTermMatches(haystack: string, term: string): boolean {
  if (fuzzyTextMatches(haystack, term)) return true;
  const budgetLabel = budgetLabelFromSearchTerm(term);
  if (budgetLabel && fuzzyTextMatches(haystack, budgetLabel)) return true;
  return false;
}

function resolveCriteriaSearchTermGroups(criteria: BuddyPostSearchCriteria): {
  required: string[];
  soft: string[];
} {
  if (criteria.softSearchTerms !== undefined) {
    return {
      required: criteria.searchTerms,
      soft: criteria.softSearchTerms,
    };
  }
  return partitionBuddyPostSearchTerms(criteria.searchTerms);
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

export function buildBodySearchTermsFromParsed(
  parsed: BuddyPostSearchParsedFields,
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

/** @deprecated Use buildBodySearchTermsFromParsed */
export function buildSearchTermsFromParsed(
  parsed: BuddyPostSearchParsedFields,
): string[] {
  return buildBodySearchTermsFromParsed(parsed);
}

export function buildBuddyPostSearchDisplayTerms(
  parsed: BuddyPostSearchParsedFields,
  criteria: BuddyPostSearchCriteria,
): string[] {
  const terms = [...criteria.searchTerms, ...(criteria.softSearchTerms ?? [])];
  if (parsed.departureCity?.trim()) {
    terms.unshift(parsed.departureCity.trim());
  }
  return [...new Set(terms)];
}

export function postMatchesDepartureCity(
  post: PostRecord,
  departureCity?: string,
): boolean {
  const want = normalizeCityName(departureCity);
  if (!want) return true;
  const got = resolveDepartureCity({
    departureCity: post.departureCity,
    location: post.location,
    body: post.body,
  });
  return got === want;
}

export function buddyPostMatchesSearchCriteria(
  post: PostRecord,
  criteria: BuddyPostSearchCriteria,
): boolean {
  const departureCity = criteria.departureCity?.trim();
  if (departureCity && !postMatchesDepartureCity(post, departureCity)) {
    return false;
  }

  const { required, soft } = resolveCriteriaSearchTermGroups(criteria);
  if (!required.length && !soft.length) {
    return Boolean(departureCity);
  }

  const requiredMatched = countMatchedBuddyPostSearchTerms(post, required);
  const softMatched = countMatchedBuddyPostSearchTerms(post, soft);

  // Core terms (date / headcount / genre, etc.) all match → include even without budget.
  if (required.length > 0 && requiredMatched === required.length) {
    return true;
  }

  const totalDimensions =
    (departureCity ? 1 : 0) + required.length + soft.length;
  const matchedDimensions =
    (departureCity ? 1 : 0) + requiredMatched + softMatched;
  const minMatches = Math.max(1, Math.ceil(totalDimensions * 0.75));

  return matchedDimensions >= minMatches;
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

const COMPLEX_BUDDY_SEARCH_MARKERS =
  /喜欢|同逛|主舞台|拼房|白天|差\s*\d|在场|小伙伴|比如|招募/;

/** True when the query is essentially a departure-city filter (e.g. 杭州出发). */
export function isSimpleCityOnlyBuddySearch(
  query: string,
  ruleParsed: BuddyPostSearchParsedFields,
): boolean {
  if (!ruleParsed.departureCity?.trim()) return false;
  if (ruleParsed.genre || ruleParsed.date || ruleParsed.peopleCount)
    return false;
  if ((ruleParsed.extraKeywords?.length ?? 0) > 0) return false;

  const normalized = normalizeBuddyPostSearchInput(query.trim());
  const withoutCity = normalized
    .replace(ruleParsed.departureCity, '')
    .replace(/出发|离队|走|的队|找|公开招募/g, '')
    .trim();
  return withoutCity.length === 0;
}

/**
 * Rule parse is trustworthy enough to skip the LLM on the first pass.
 * Complex natural language still goes to LLM in BuddyPostSearchParseService.
 */
export function isConfidentRuleBuddySearchParse(
  query: string,
  ruleParsed: BuddyPostSearchParsedFields,
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  // Recruit-slot intent needs LLM (e.g. 差 1 人 = join a team with an open slot).
  if (/差\s*\d+\s*人/.test(trimmed)) return false;

  if (ruleParsed.date || ruleParsed.genre || ruleParsed.peopleCount) {
    return true;
  }

  if (isSimpleCityOnlyBuddySearch(trimmed, ruleParsed)) {
    return true;
  }

  if (ruleParsed.departureCity && (ruleParsed.extraKeywords?.length ?? 0) > 0) {
    const tokens = ruleParsed.extraKeywords ?? [];
    if (tokens.length <= 4 && tokens.every((token) => token.length >= 2)) {
      return true;
    }
  }

  const keywords = ruleParsed.extraKeywords ?? [];
  if (!ruleParsed.departureCity && keywords.length > 0) {
    if (!COMPLEX_BUDDY_SEARCH_MARKERS.test(trimmed) && trimmed.length <= 32) {
      if (keywords.length >= 1 && keywords.length <= 4) {
        if (
          keywords.length === 1 &&
          keywords[0] === trimmed &&
          trimmed.length > 16
        ) {
          return false;
        }
        return true;
      }
    }
  }

  return false;
}

/** Retry LLM when a confident rule parse returned zero matches (not city-only). */
export function shouldRetryBuddySearchWithLlm(
  query: string,
  source: 'rule' | 'llm',
  matchCount: number,
  ruleParsed: BuddyPostSearchParsedFields,
): boolean {
  if (source !== 'rule' || matchCount > 0) return false;
  if (!isConfidentRuleBuddySearchParse(query, ruleParsed)) return false;
  if (isSimpleCityOnlyBuddySearch(query, ruleParsed)) return false;
  return true;
}

/** Rule-based keyword parse — LLM fallback when disabled. */
export function parseBuddyPostSearchQuery(
  query: string,
): BuddyPostSearchParsedFields {
  const trimmed = query.trim();
  if (!trimmed) return {};

  const normalized = normalizeBuddyPostSearchInput(trimmed);
  const parseTarget = normalized || trimmed;
  const departureCity = inferDepartureCityFromText(parseTarget, trimmed);
  const gapPeopleMatch = parseTarget.match(/差\s*(\d+)\s*人/);
  const peopleMatch = parseTarget.match(/(\d+)\s*(个|人|名)/);
  const dateRangeMatch = parseTarget.match(
    /(\d{1,2}[./月]\d{1,2})\s*[-–~至]\s*(\d{1,2}(?:[./月]\d{1,2})?)/,
  );
  const dateMatch = dateRangeMatch
    ? null
    : parseTarget.match(/(\d{1,2}[./月]\d{1,2}(?:[./月]\d{2,4})?)/);
  const genreMatch = parseTarget.match(/喜欢\s*([^，,。.!！?？；;]+)/);

  const peopleCount = gapPeopleMatch?.[1] ?? peopleMatch?.[1];
  const date = dateRangeMatch
    ? `${dateRangeMatch[1]}-${dateRangeMatch[2]}`
    : dateMatch?.[1];
  const genre = genreMatch?.[1]?.trim();

  let remainder = parseTarget;
  if (dateRangeMatch?.[0])
    remainder = remainder.replace(dateRangeMatch[0], ' ');
  else if (dateMatch?.[0]) remainder = remainder.replace(dateMatch[0], ' ');
  if (genreMatch?.[0]) remainder = remainder.replace(genreMatch[0], ' ');
  if (gapPeopleMatch?.[0])
    remainder = remainder.replace(gapPeopleMatch[0], ' ');
  else if (peopleMatch?.[0]) remainder = remainder.replace(peopleMatch[0], ' ');

  const extraKeywords = tokenizeRawBuddySearchQuery(remainder);
  const parsed: BuddyPostSearchParsedFields = {
    departureCity,
    date,
    genre,
    peopleCount,
    preferOpenRecruit: gapPeopleMatch ? true : undefined,
    extraKeywords: extraKeywords.length ? extraKeywords : undefined,
  };

  if (departureCity && parsed.extraKeywords?.length) {
    const filtered = parsed.extraKeywords.filter(
      (keyword) =>
        normalizeCityName(keyword) !== departureCity &&
        keyword !== `${departureCity}出发`,
    );
    parsed.extraKeywords = filtered.length ? filtered : undefined;
  }

  if (!buildBodySearchTermsFromParsed(parsed).length && !parsed.departureCity) {
    const fromRaw = tokenizeRawBuddySearchQuery(parseTarget || trimmed);
    const fallback: BuddyPostSearchParsedFields = fromRaw.length
      ? { extraKeywords: fromRaw }
      : parseTarget
        ? { extraKeywords: [parseTarget] }
        : { extraKeywords: [trimmed] };
    const inferredCity = inferDepartureCityFromText(parseTarget, trimmed);
    if (inferredCity) {
      fallback.departureCity = inferredCity;
      fallback.extraKeywords = (fallback.extraKeywords ?? []).filter(
        (keyword) =>
          normalizeCityName(keyword) !== inferredCity &&
          keyword !== `${inferredCity}出发`,
      );
      if (!fallback.extraKeywords.length) {
        delete fallback.extraKeywords;
      }
    }
    return fallback;
  }

  return parsed;
}

export function resolveBuddyPostSearchCriteria(
  parsed: BuddyPostSearchParsedFields,
  rawQuery: string,
): BuddyPostSearchCriteria {
  const bodyTerms = buildBodySearchTermsFromParsed(parsed);
  const { required, soft } = partitionBuddyPostSearchTerms(bodyTerms);

  if (required.length || soft.length || parsed.departureCity?.trim()) {
    return {
      departureCity: parsed.departureCity?.trim() || undefined,
      searchTerms: required,
      softSearchTerms: soft,
      preferOpenRecruit: parsed.preferOpenRecruit,
    };
  }

  const normalized = normalizeBuddyPostSearchInput(rawQuery);
  const departureCity =
    inferDepartureCityFromText(normalized, rawQuery) ?? undefined;
  if (normalized) {
    const fromNormalized = tokenizeRawBuddySearchQuery(normalized);
    const partitioned = partitionBuddyPostSearchTerms(fromNormalized);
    if (
      partitioned.required.length ||
      partitioned.soft.length ||
      departureCity
    ) {
      return {
        departureCity,
        searchTerms: partitioned.required,
        softSearchTerms: partitioned.soft,
      };
    }
    const fallbackPartition = partitionBuddyPostSearchTerms([normalized]);
    return {
      departureCity,
      searchTerms: fallbackPartition.required,
      softSearchTerms: fallbackPartition.soft,
    };
  }

  const rawPartition = partitionBuddyPostSearchTerms(
    tokenizeRawBuddySearchQuery(rawQuery),
  );
  return {
    departureCity,
    searchTerms: rawPartition.required,
    softSearchTerms: rawPartition.soft,
  };
}

/** Flat term list for API display / legacy callers. */
export function resolveBuddyPostSearchTerms(
  parsed: BuddyPostSearchParsedFields,
  rawQuery: string,
): string[] {
  const criteria = resolveBuddyPostSearchCriteria(parsed, rawQuery);
  return buildBuddyPostSearchDisplayTerms(parsed, criteria);
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
  if (buddyPostSearchTermMatches(haystack, term)) return 60;
  return 0;
}

/** Higher = stronger keyword relevance; partial matches rank below full matches. */
export function scoreBuddyPostSearchCriteria(
  post: PostRecord,
  criteria: BuddyPostSearchCriteria,
): number {
  if (!buddyPostMatchesSearchCriteria(post, criteria)) return 0;

  const departureCity = criteria.departureCity?.trim();
  const { required, soft } = resolveCriteriaSearchTermGroups(criteria);
  const requiredMatched = countMatchedBuddyPostSearchTerms(post, required);
  const softMatched = countMatchedBuddyPostSearchTerms(post, soft);
  const totalDimensions =
    (departureCity ? 1 : 0) + required.length + soft.length;
  const matchedDimensions =
    (departureCity ? 1 : 0) + requiredMatched + softMatched;

  let total = matchedDimensions * 100;

  if (departureCity && postMatchesDepartureCity(post, departureCity)) {
    total += 80;
  }

  if (!required.length && !soft.length) {
    return total;
  }

  const haystack = buildBuddyPostSearchText(post);
  const departureHaystack = normalizeSearchText(
    [post.departureCity, post.location].filter(Boolean).join(' '),
  );

  for (const term of [...required, ...soft]) {
    const strength = termMatchStrength(haystack, term);
    if (strength <= 0) continue;
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

  total += softMatched * 40;

  if (totalDimensions > 0 && matchedDimensions === totalDimensions) {
    total += 50;
  }

  return total;
}

/** @deprecated Use scoreBuddyPostSearchCriteria */
export function scoreBuddyPostKeywordMatch(
  post: PostRecord,
  searchTerms: string[],
): number {
  return scoreBuddyPostSearchCriteria(post, { searchTerms });
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

/** Higher when the post still has recruit slots (used when LLM sets preferOpenRecruit). */
export function scoreBuddyPostOpenRecruitFit(post: PostRecord): number {
  if (post.recruitStatus === 'full') return 0;
  if (post.recruitStatus === 'open') {
    if (
      post.slotsTotal != null &&
      post.slotsFilled != null &&
      post.slotsFilled < post.slotsTotal
    ) {
      return 100;
    }
    return 80;
  }
  return 40;
}

/** Keyword filter first; rank by keyword score, open-recruit intent, preference, recency. */
export function rankBuddyPostsBySearch(
  posts: PostRecord[],
  criteria: BuddyPostSearchCriteria,
  profile?: UserMatchProfile | null,
): PostRecord[] {
  const matched = posts.filter((post) =>
    buddyPostMatchesSearchCriteria(post, criteria),
  );

  return matched.sort((left, right) => {
    const keywordDelta =
      scoreBuddyPostSearchCriteria(right, criteria) -
      scoreBuddyPostSearchCriteria(left, criteria);
    if (keywordDelta !== 0) return keywordDelta;

    if (criteria.preferOpenRecruit) {
      const openDelta =
        scoreBuddyPostOpenRecruitFit(right) -
        scoreBuddyPostOpenRecruitFit(left);
      if (openDelta !== 0) return openDelta;
    }

    const preferenceDelta =
      scoreBuddyPostPreferenceMatch(right, profile) -
      scoreBuddyPostPreferenceMatch(left, profile);
    if (preferenceDelta !== 0) return preferenceDelta;

    return comparePostsByCreatedAtDesc(right, left);
  });
}

/** @deprecated Prefer rankBuddyPostsBySearch with BuddyPostSearchCriteria */
export function filterBuddyPostsBySearchTerms(
  posts: PostRecord[],
  searchTerms: string[],
): PostRecord[] {
  return rankBuddyPostsBySearch(posts, { searchTerms });
}
