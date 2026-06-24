import type { EventsActivitySearchParsed } from '@sync/scene-contracts';
import type { ActivityLookupRecord } from '../ports/activity-lookup.port';

export type { EventsActivitySearchParsed };

const RECRUIT_INTENT_PATTERN =
  /找队|组队|招募|拼房|差\s*\d+\s*人|出发|搭子|同行|buddy|recruit/i;
const TRAVEL_INTENT_PATTERN = /签证|护照|换汇|出入境|海关|入境|出境|visa/i;
const ECOSYSTEM_INTENT_PATTERN =
  /小程序|公众号|购票|买票|票务|平台|edmlink|官方号/i;

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

function parseActivityMonth(
  activity: ActivityLookupRecord,
): number | undefined {
  const match = activity.date?.match(/^(?:\d{4}-)?(\d{2})-/);
  if (!match) return undefined;
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? month : undefined;
}

function parseActivityYear(activity: ActivityLookupRecord): number | undefined {
  const match = activity.date?.match(/^(\d{4})-/);
  if (!match) return undefined;
  return Number(match[1]);
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
  if (ECOSYSTEM_INTENT_PATTERN.test(query)) return 'ecosystem';
  if (TRAVEL_INTENT_PATTERN.test(query)) return 'travel';
  return 'discover';
}

export function parseEventsActivitySearchQuery(
  query: string,
): EventsActivitySearchParsed {
  const trimmed = query.trim();
  if (!trimmed) return {};

  const normalized = normalizeQuery(trimmed);
  const parsed: EventsActivitySearchParsed = {
    intent: resolveIntent(trimmed),
    year: parseYear(trimmed),
  };

  const month = parseMonth(trimmed);
  if (month) parsed.month = month;

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

  const keywords = tokenize(trimmed).filter((term) => {
    const lower = term.toLowerCase();
    if (REGION_ALIASES[lower] || AREA_ALIASES[lower] || GENRE_ALIASES[lower]) {
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
      ['泰国', '日本', '韩国', '印尼'].includes(activity.area ?? '')
    );
  }
  return activity.region === region;
}

function scoreActivityForParsedSearch(
  activity: ActivityLookupRecord,
  parsed: EventsActivitySearchParsed,
  rawQuery: string,
): number {
  let score = 0;
  const haystack = activityHaystack(activity);

  if (parsed.month) {
    const activityMonth = parseActivityMonth(activity);
    if (activityMonth === parsed.month) score += 40;
    else if (activityMonth != null) score -= 10;
  }

  if (parsed.year) {
    const activityYear = parseActivityYear(activity);
    if (activityYear === parsed.year) score += 10;
  }

  if (parsed.region && matchesRegion(activity, parsed.region)) {
    score += 25;
  }

  if (parsed.area) {
    const area = parsed.area.toLowerCase();
    if (haystack.includes(area) || activity.area === parsed.area) score += 30;
  }

  if (parsed.genre && haystack.includes(parsed.genre.toLowerCase())) {
    score += 15;
  }

  for (const keyword of parsed.keywords ?? []) {
    if (haystack.includes(keyword.toLowerCase())) score += 20;
  }

  const normalizedQuery = normalizeQuery(rawQuery);
  if (normalizedQuery && haystack.includes(normalizedQuery)) {
    score += 35;
  }

  for (const alias of activity.alias ?? []) {
    if (normalizedQuery.includes(alias.toLowerCase())) score += 25;
  }

  return score;
}

export function filterActivitiesByParsedSearch(
  activities: ActivityLookupRecord[],
  parsed: EventsActivitySearchParsed,
  rawQuery: string,
  options: { minScore?: number; limit?: number } = {},
): ActivityLookupRecord[] {
  const minScore = options.minScore ?? 15;
  const limit = options.limit ?? 12;
  const trimmed = rawQuery.trim();

  const scored = activities
    .map((activity) => ({
      activity,
      score: scoreActivityForParsedSearch(activity, parsed, trimmed),
    }))
    .filter((item) => item.score >= minScore)
    .sort(
      (a, b) => b.score - a.score || a.activity.legacyId - b.activity.legacyId,
    );

  if (scored.length > 0) {
    return scored.slice(0, limit).map((item) => item.activity);
  }

  if (!trimmed) return activities.slice(0, limit);

  const fallbackTerms = tokenize(trimmed);
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
