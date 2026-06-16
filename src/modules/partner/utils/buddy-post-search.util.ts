import type { PostRecord } from '../interfaces/post.repository.interface';
import {
  getContentTypeLabel,
  type PostContentType,
} from './post-content-type.util';

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

function contentTypeSearchLabels(types: string[] | undefined): string[] {
  if (!types?.length) return [];
  const labels = new Set<string>();
  for (const raw of types) {
    const label = getContentTypeLabel(raw as PostContentType);
    if (label) labels.add(label);
    labels.add(raw);
  }
  return [...labels];
}

export function buildBuddyPostSearchText(post: PostRecord): string {
  return [
    post.body,
    post.location,
    post.departureCity,
    post.eventTitle,
    ...(post.tags ?? []),
    ...contentTypeSearchLabels(post.contentTypes),
  ]
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
  '喜欢',
  '需要',
  '希望',
  '想要',
  '同逛',
  '搭子',
  '搭伴',
  '在场',
  '白天',
  '晚上',
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
        .map((part) => part.trim())
        .filter((part) => part.length >= 2 && !SEARCH_STOP_WORDS.has(part)),
    ),
  ];
}

export function resolveBuddyPostSearchTerms(
  parsed: BuddyPostSearchParsed,
  rawQuery: string,
): string[] {
  const fromParsed = buildSearchTermsFromParsed(parsed);
  if (fromParsed.length) return fromParsed;
  return tokenizeRawBuddySearchQuery(rawQuery);
}

/** Keep repository order (createdAt desc); filter only, no re-ranking. */
export function filterBuddyPostsBySearchTerms(
  posts: PostRecord[],
  searchTerms: string[],
): PostRecord[] {
  if (!searchTerms.length) return posts;
  return posts.filter((post) => buddyPostMatchesSearchTerms(post, searchTerms));
}
