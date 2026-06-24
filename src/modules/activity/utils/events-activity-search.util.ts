import type { EventsActivitySearchParsed } from '@sync/scene-contracts';
import {
  extractYearFromText,
  isActivityEnded,
  parseActivityDateRange,
} from '../../../common/utils/activity-date.util';
import { resolveFestivalBrand } from '../../../ai/rag/festival-brand.util';
import type { ActivityLookupRecord } from '../ports/activity-lookup.port';

export type { EventsActivitySearchParsed };

const RECRUIT_INTENT_PATTERN =
  /找队|组队|招募|拼房|差\s*\d+\s*人|出发|搭子|同行|buddy|recruit/i;
const TRAVEL_INTENT_PATTERN = /签证|护照|换汇|出入境|海关|入境|出境|visa/i;
const ECOSYSTEM_INTENT_PATTERN =
  /小程序|公众号|购票|买票|票务|平台|edmlink|官方号/i;
const GENERIC_QUERY_TERMS =
  /电音节|音乐节|音乐节|电子音乐|festival|festivals|edm/gi;
const FESTIVAL_SEARCH_NOISE =
  /阵容|官宣|lineup|timetable|时间表|嘉宾|谁演|几点公布|何时公布|什么时候公布/gi;

function stripFestivalSearchNoise(query: string): string {
  return query.replace(FESTIVAL_SEARCH_NOISE, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeSearchKeyword(keyword: string): string {
  return stripFestivalSearchNoise(keyword).trim();
}

const REGION_ALIASES: Record<string, EventsActivitySearchParsed['region']> = {
  国内: 'domestic',
  中国: 'domestic',
  china: 'domestic',
  domestic: 'domestic',
  港澳台: 'hmt',
  hmt: 'hmt',
  海外: 'overseas',
  国外: 'overseas',
  overseas: 'overseas',
  欧洲: 'europe',
  europe: 'europe',
  亚洲: 'asia',
  asia: 'asia',
};

const AREA_ALIASES: Record<string, string> = {
  泰国: '泰国',
  thailand: '泰国',
  日本: '日本',
  japan: '日本',
  韩国: '韩国',
  korea: '韩国',
  比利时: '比利时',
  belgium: '比利时',
  克罗地亚: '克罗地亚',
  croatia: '克罗地亚',
  印尼: '印尼',
  indonesia: '印尼',
  美国: '美国',
  usa: '美国',
  上海: '上海',
  深圳: '深圳',
  珠海: '珠海',
  苏州: '苏州',
};

const GENRE_ALIASES: Record<string, string> = {
  techno: 'Techno',
  泰克诺: 'Techno',
  house: 'House',
  trance: 'Trance',
  dnb: 'DnB',
  'drum and bass': 'DnB',
  hardstyle: 'Hardstyle',
  hardcore: 'Hardcore',
  psytrance: 'Psytrance',
  bass: 'Bass',
};

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function tokenize(query: string): string[] {
  return query
    .split(/[\s,，、/|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseMonth(query: string): number | undefined {
  const numeric = query.match(/(\d{1,2})\s*月/);
  if (numeric) {
    const month = Number(numeric[1]);
    if (month >= 1 && month <= 12) return month;
  }
  return undefined;
}

function parseYear(
  query: string,
  fallbackYear = new Date().getFullYear(),
): number {
  const full = query.match(/(20\d{2})/);
  if (full) return Number(full[1]);
  const short = query.match(/(\d{2})\s*年/);
  if (short) return 2000 + Number(short[1]);
  return fallbackYear;
}

function hasExplicitYear(query: string): boolean {
  return /(20\d{2}|\d{2}\s*年)/.test(query);
}

function isMonthOnlyQuery(query: string): boolean {
  return /^\d{1,2}\s*月$/.test(query.trim());
}

function resolveActivityYearHint(activity: ActivityLookupRecord): string {
  return (
    extractYearFromText(activity.name) ??
    extractYearFromText(activity.date) ??
    String(new Date().getFullYear())
  );
}

function activityOccursInMonth(
  activity: ActivityLookupRecord,
  month: number,
  year?: number,
): boolean {
  const range = parseActivityDateRange(
    activity.date ?? '',
    resolveActivityYearHint(activity),
  );
  if (!range) return false;

  const startMonth = range.start.getMonth() + 1;
  const endMonth = range.end.getMonth() + 1;
  const startYear = range.start.getFullYear();
  const endYear = range.end.getFullYear();

  if (year != null && (year < startYear || year > endYear)) {
    return false;
  }

  if (startMonth <= endMonth) {
    return month >= startMonth && month <= endMonth;
  }

  return month >= startMonth || month <= endMonth;
}

function activityHaystack(activity: ActivityLookupRecord): string {
  return [
    activity.name,
    activity.code,
    activity.location,
    activity.area,
    activity.region,
    ...(activity.alias ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function resolveIntent(query: string): EventsActivitySearchParsed['intent'] {
  if (RECRUIT_INTENT_PATTERN.test(query)) return 'recruit';
  if (/对比|vs|VS|和.*(比|好)|哪个好|选哪| versus /i.test(query))
    return 'compare';
  if (ECOSYSTEM_INTENT_PATTERN.test(query)) return 'ecosystem';
  if (TRAVEL_INTENT_PATTERN.test(query)) return 'travel';
  return 'discover';
}

function stripParsedTermsFromQuery(
  query: string,
  parsed: EventsActivitySearchParsed,
): string {
  let remainder = query;
  if (parsed.month) {
    remainder = remainder.replace(
      new RegExp(`${parsed.month}\\s*月`, 'gi'),
      ' ',
    );
  }
  if (parsed.region) {
    for (const [alias, region] of Object.entries(REGION_ALIASES)) {
      if (region === parsed.region) {
        remainder = remainder.replace(new RegExp(alias, 'gi'), ' ');
      }
    }
  }
  if (parsed.area) {
    for (const [alias, area] of Object.entries(AREA_ALIASES)) {
      if (area === parsed.area) {
        remainder = remainder.replace(new RegExp(alias, 'gi'), ' ');
      }
    }
  }
  if (parsed.genre) {
    remainder = remainder.replace(new RegExp(parsed.genre, 'gi'), ' ');
  }
  return stripFestivalSearchNoise(
    remainder.replace(GENERIC_QUERY_TERMS, ' ').replace(/\s+/g, ' ').trim(),
  );
}

export function parseEventsActivitySearchQuery(
  query: string,
): EventsActivitySearchParsed {
  const trimmed = query.trim();
  if (!trimmed) return {};

  const normalized = normalizeQuery(trimmed);
  const parsed: EventsActivitySearchParsed = {
    intent: resolveIntent(trimmed),
  };

  const month = parseMonth(trimmed);
  if (month) parsed.month = month;

  if (hasExplicitYear(trimmed)) {
    parsed.year = parseYear(trimmed);
  } else if (!isMonthOnlyQuery(trimmed)) {
    parsed.year = parseYear(trimmed);
  }

  for (const [alias, region] of Object.entries(REGION_ALIASES)) {
    if (normalized.includes(alias.toLowerCase())) {
      parsed.region = region;
      break;
    }
  }

  for (const [alias, area] of Object.entries(AREA_ALIASES)) {
    if (normalized.includes(alias.toLowerCase())) {
      parsed.area = area;
      break;
    }
  }

  for (const [alias, genre] of Object.entries(GENRE_ALIASES)) {
    if (normalized.includes(alias.toLowerCase())) {
      parsed.genre = genre;
      break;
    }
  }

  const keywordSource = stripParsedTermsFromQuery(trimmed, parsed);
  const keywords = tokenize(keywordSource)
    .map(normalizeSearchKeyword)
    .filter((term) => {
      const lower = term.toLowerCase();
      if (
        REGION_ALIASES[lower] ||
        AREA_ALIASES[lower] ||
        GENRE_ALIASES[lower]
      ) {
        return false;
      }
      if (/^\d{1,2}月$/.test(term)) return false;
      if (/^20\d{2}$/.test(term)) return false;
      return term.length >= 2;
    });
  if (keywords.length) parsed.keywords = keywords;

  return parsed;
}

function matchesRegion(
  activity: ActivityLookupRecord,
  region: NonNullable<EventsActivitySearchParsed['region']>,
): boolean {
  if (region === 'europe') {
    const haystack = activityHaystack(activity);
    return (
      activity.region === 'overseas' &&
      /欧洲|比利时|克罗地亚|荷兰|罗马尼亚|英国|美国|奥兰多|斯普利特|阿姆斯特丹/.test(
        haystack,
      )
    );
  }
  if (region === 'asia') {
    return (
      activity.region === 'domestic' ||
      activity.region === 'hmt' ||
      ['泰国', '日本', '韩国', '印尼', '中国'].includes(activity.area ?? '')
    );
  }
  return activity.region === region;
}

function activityMatchesArea(
  activity: ActivityLookupRecord,
  area: string,
): boolean {
  const haystack = activityHaystack(activity);
  const normalized = area.toLowerCase();
  return haystack.includes(normalized) || activity.area === area;
}

function activityMatchesParsedCriteria(
  activity: ActivityLookupRecord,
  parsed: EventsActivitySearchParsed,
): boolean {
  if (
    parsed.month != null &&
    !activityOccursInMonth(activity, parsed.month, parsed.year)
  ) {
    return false;
  }
  if (parsed.region && !matchesRegion(activity, parsed.region)) {
    return false;
  }
  if (parsed.area && !activityMatchesArea(activity, parsed.area)) {
    return false;
  }
  if (
    parsed.genre &&
    !activityHaystack(activity).includes(parsed.genre.toLowerCase())
  ) {
    return false;
  }
  if (parsed.keywords?.length) {
    const haystack = activityHaystack(activity);
    const matched = parsed.keywords.some((keyword) => {
      const normalized = normalizeSearchKeyword(keyword).toLowerCase();
      if (!normalized) return true;
      return haystack.includes(normalized);
    });
    if (!matched) return false;
  }
  return true;
}

function scoreActivityForParsedSearch(
  activity: ActivityLookupRecord,
  parsed: EventsActivitySearchParsed,
  rawQuery: string,
): number {
  let score = 0;
  const haystack = activityHaystack(activity);

  if (
    parsed.month &&
    activityOccursInMonth(activity, parsed.month, parsed.year)
  ) {
    score += 50;
  }
  if (parsed.region && matchesRegion(activity, parsed.region)) {
    score += 25;
  }
  if (parsed.area && activityMatchesArea(activity, parsed.area)) {
    score += 30;
  }
  if (parsed.genre && haystack.includes(parsed.genre.toLowerCase())) {
    score += 15;
  }

  const normalizedQuery = normalizeQuery(rawQuery);
  if (normalizedQuery && haystack.includes(normalizedQuery)) {
    score += 20;
  }

  return score;
}

export function filterActivitiesByParsedSearch(
  activities: ActivityLookupRecord[],
  parsed: EventsActivitySearchParsed,
  rawQuery: string,
  options: { limit?: number } = {},
): ActivityLookupRecord[] {
  const limit = options.limit ?? 12;
  const trimmed = rawQuery.trim();
  const hasStructuredCriteria = Boolean(
    parsed.month ||
    parsed.region ||
    parsed.area ||
    parsed.genre ||
    parsed.keywords?.length,
  );

  if (hasStructuredCriteria) {
    const matched = activities
      .filter((activity) => activityMatchesParsedCriteria(activity, parsed))
      .map((activity) => ({
        activity,
        score: scoreActivityForParsedSearch(activity, parsed, trimmed),
      }))
      .sort(
        (a, b) =>
          b.score - a.score || a.activity.legacyId - b.activity.legacyId,
      )
      .map((item) => item.activity)
      .slice(0, limit);

    if (matched.length > 0 || !trimmed) {
      return matched;
    }
  }

  if (!trimmed) return activities.slice(0, limit);

  const festivalMatch = resolveFestivalBrand(stripFestivalSearchNoise(trimmed));
  if (festivalMatch) {
    const byCode = activities.filter(
      (activity) => activity.code === festivalMatch.brand.code,
    );
    if (byCode.length) return byCode.slice(0, limit);
  }

  const fallbackTerms = tokenize(
    stripFestivalSearchNoise(trimmed.replace(GENERIC_QUERY_TERMS, ' ')),
  );
  return activities
    .filter((activity) => {
      const haystack = activityHaystack(activity);
      return fallbackTerms.some((term) =>
        haystack.includes(term.toLowerCase()),
      );
    })
    .slice(0, limit);
}

export function formatEventsActivitySearchParsedSummary(
  parsed: EventsActivitySearchParsed | null | undefined,
): string | null {
  if (!parsed) return null;
  const parts: string[] = [];

  if (parsed.area) parts.push(parsed.area);
  if (parsed.region === 'europe') parts.push('欧洲');
  else if (parsed.region === 'asia') parts.push('亚洲');
  else if (parsed.region === 'domestic') parts.push('国内');
  else if (parsed.region === 'overseas') parts.push('海外');
  if (parsed.month) parts.push(`${parsed.month}月`);
  if (parsed.genre) parts.push(parsed.genre);
  for (const keyword of parsed.keywords ?? []) {
    if (!parts.includes(keyword)) parts.push(keyword);
  }

  return parts.length ? parts.join(' · ') : null;
}

/** Drop ended festivals; when parsed has month/region/etc., re-validate (blocks chroma drift). */
export function filterActivitiesForKnowledgeSearch(
  activities: ActivityLookupRecord[],
  parsed: EventsActivitySearchParsed,
  now = new Date(),
): ActivityLookupRecord[] {
  return activities.filter((activity) =>
    isActivityEligibleForKnowledgeSearch(activity, parsed, now),
  );
}

function isActivityEligibleForKnowledgeSearch(
  activity: ActivityLookupRecord,
  parsed: EventsActivitySearchParsed,
  now: Date,
): boolean {
  const yearHint = resolveActivityYearHint(activity);
  if (isActivityEnded(activity.date, { yearHint, now })) {
    return false;
  }

  const hasStructuredCriteria = Boolean(
    parsed.month ||
    parsed.region ||
    parsed.area ||
    parsed.genre ||
    parsed.keywords?.length,
  );

  if (hasStructuredCriteria) {
    return activityMatchesParsedCriteria(activity, parsed);
  }

  return true;
}
