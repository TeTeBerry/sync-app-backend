import type { PostRecord } from '../interfaces/post.repository.interface';

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
  return [
    post.body,
    post.location,
    post.departureCity,
    post.eventTitle,
    ...(post.tags ?? []),
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

/** Rule-based keyword parse — no LLM; used for buddy-post pool filter only. */
export function parseBuddyPostSearchQuery(
  query: string,
): BuddyPostSearchParsed {
  const trimmed = query.trim();
  if (!trimmed) return {};

  const peopleMatch = trimmed.match(/(\d+)\s*(个|人|名)/);
  const dateMatch = trimmed.match(/(\d{1,2}[./月]\d{1,2}(?:[./月]\d{2,4})?)/);
  const genreMatch = trimmed.match(/喜欢\s*([^，,。.!！?？；;]+)/);

  const peopleCount = peopleMatch?.[1];
  const date = dateMatch?.[1];
  const genre = genreMatch?.[1]?.trim();

  let remainder = trimmed;
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
    const fromRaw = tokenizeRawBuddySearchQuery(trimmed);
    return fromRaw.length
      ? { extraKeywords: fromRaw }
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
