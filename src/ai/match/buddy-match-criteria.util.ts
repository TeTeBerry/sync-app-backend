import type { PostRecord } from '../../modules/post/interfaces/post.repository.interface';
import type { ConversationContext } from '../conversation/conversation-context.parser';
import type { BuddyMatchCriteria, BuddyMatchIntent } from './buddy-match.types';

const DEPARTURE_FROM_BODY_RE = /从\s*([^\s，,。]+?)\s*出发/;

const KNOWN_CITIES = [
  '上海',
  '北京',
  '广州',
  '深圳',
  '杭州',
  '成都',
  '苏州',
  '珠海',
  '南京',
  '武汉',
  '重庆',
  '西安',
  '东莞',
  '芭提雅',
  '普吉岛',
];

export function normalizeCityName(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(/(市|省)$/, '');
  for (const city of KNOWN_CITIES) {
    if (normalized === city || normalized.includes(city)) {
      return city;
    }
  }
  return normalized.length >= 2 ? normalized : undefined;
}

export function inferDepartureCityFromText(...texts: Array<string | undefined>): string | undefined {
  for (const raw of texts) {
    const text = raw?.trim();
    if (!text) continue;

    const fromBody = text.match(DEPARTURE_FROM_BODY_RE)?.[1]?.trim();
    if (fromBody) {
      const city = normalizeCityName(fromBody);
      if (city) return city;
    }

    for (const city of KNOWN_CITIES) {
      if (text.includes(city) && /出发|拼车|同行/.test(text)) {
        return city;
      }
    }
  }

  return undefined;
}

export function inferIntentsFromPost(
  tags: string[] = [],
  body = '',
): BuddyMatchIntent[] {
  const haystack = [...tags, body].join(' ').toLowerCase();
  const intents = new Set<BuddyMatchIntent>();

  if (/拼车|顺风车|包车/.test(haystack)) intents.add('carpool');
  if (/拼住宿|拼房|住宿/.test(haystack)) intents.add('lodging');
  if (/组队|搭子|同行|缺\d/.test(haystack)) intents.add('team');
  if (/票|内场|看台|区/.test(haystack)) intents.add('ticket');

  if (!intents.size) intents.add('team');
  return [...intents];
}

function normalizeTagToken(value: string): string {
  return value.trim().toLowerCase().replace(/^#/, '');
}

function extractTagsFromText(text?: string): string[] {
  const trimmed = text?.trim();
  if (!trimmed) return [];

  const tags = new Set<string>();
  const re = /#([\w\u4e00-\u9fff_-]+)/g;
  let match: RegExpExecArray | null = null;

  while ((match = re.exec(trimmed)) !== null) {
    const token = normalizeTagToken(match[1] ?? '');
    if (token) tags.add(token);
  }

  return [...tags];
}

export function collectRequesterTags(
  ...sources: Array<string[] | string | undefined>
): string[] {
  const tags = new Set<string>();

  for (const source of sources) {
    if (!source) continue;
    if (Array.isArray(source)) {
      for (const tag of source) {
        const token = normalizeTagToken(tag);
        if (token) tags.add(token);
      }
      continue;
    }

    for (const tag of extractTagsFromText(source)) {
      tags.add(tag);
    }
  }

  return [...tags];
}

export function criteriaFromPostRecord(
  post: PostRecord,
  activity?: { name?: string; code?: string },
): BuddyMatchCriteria {
  const stored = post.matchCriteria as Partial<BuddyMatchCriteria> | undefined;
  const departureCity =
    normalizeCityName(post.departureCity) ??
    normalizeCityName(stored?.departureCity) ??
    inferDepartureCityFromText(post.body) ??
    normalizeCityName(post.location);

  return {
    activityLegacyId: post.activityLegacyId ?? stored?.activityLegacyId ?? 0,
    activityName: activity?.name ?? post.eventTitle,
    activityCode: activity?.code ?? stored?.activityCode,
    departureCity,
    eventDate: stored?.eventDate,
    zone: stored?.zone,
    headcount: stored?.headcount,
    genderPref: stored?.genderPref,
    intents: stored?.intents ?? inferIntentsFromPost(post.tags, post.body),
    requesterTags: collectRequesterTags(post.tags, post.body),
    requesterBody: post.body?.trim() || undefined,
  };
}

export function buildMatchCriteriaForSearch(params: {
  activityLegacyId: number;
  activityName?: string;
  activityCode?: string;
  activityDate?: string;
  ownerPost?: PostRecord | null;
  conversation?: ConversationContext;
  profileCity?: string;
  userInput?: string;
  zone?: string;
}): BuddyMatchCriteria {
  const fromOwner = params.ownerPost
    ? criteriaFromPostRecord(params.ownerPost, {
        name: params.activityName,
        code: params.activityCode,
      })
    : null;

  const departureCity =
    fromOwner?.departureCity ??
    normalizeCityName(params.conversation?.city) ??
    normalizeCityName(params.profileCity) ??
    inferDepartureCityFromText(params.userInput);

  return {
    activityLegacyId: params.activityLegacyId,
    activityName: params.activityName ?? fromOwner?.activityName,
    activityCode: params.activityCode ?? fromOwner?.activityCode,
    departureCity,
    eventDate: params.conversation?.eventDate ?? params.activityDate ?? fromOwner?.eventDate,
    zone: params.zone ?? fromOwner?.zone,
    headcount: params.conversation?.peopleCount ?? fromOwner?.headcount,
    genderPref: params.conversation?.genderPreference ?? fromOwner?.genderPref,
    intents: fromOwner?.intents ?? inferIntentsFromPost([], params.userInput ?? ''),
    requesterTags: collectRequesterTags(
      fromOwner?.requesterTags,
      params.ownerPost?.tags,
      params.ownerPost?.body,
      params.userInput,
      params.zone,
    ),
    requesterBody:
      params.ownerPost?.body?.trim() ??
      fromOwner?.requesterBody ??
      undefined,
  };
}

export function buildMatchCriteriaPatch(params: {
  body: string;
  tags?: string[];
  location?: string;
  departureCity?: string;
  conversation?: ConversationContext;
  activityLegacyId?: number;
}): { departureCity?: string; matchCriteria?: BuddyMatchCriteria } {
  const departureCity =
    normalizeCityName(params.departureCity) ??
    normalizeCityName(params.conversation?.city) ??
    inferDepartureCityFromText(params.body, params.location) ??
    normalizeCityName(params.location);

  const matchCriteria: BuddyMatchCriteria = {
    activityLegacyId: params.activityLegacyId ?? 0,
    departureCity,
    eventDate: params.conversation?.eventDate,
    headcount: params.conversation?.peopleCount,
    genderPref: params.conversation?.genderPreference,
    intents: inferIntentsFromPost(params.tags ?? [], params.body),
    requesterTags: collectRequesterTags(params.tags, params.body),
    requesterBody: params.body?.trim() || undefined,
  };

  return { departureCity, matchCriteria };
}

export function criteriaToEmbeddingText(criteria: BuddyMatchCriteria): string {
  const parts = [
    criteria.activityName,
    criteria.departureCity ? `${criteria.departureCity}出发` : '',
    criteria.eventDate,
    criteria.zone,
    criteria.headcount ? `${criteria.headcount}人` : '',
    criteria.genderPref,
    criteria.intents?.join(' '),
    criteria.requesterTags?.map(tag => `#${tag}`).join(' '),
    criteria.requesterBody,
    '组队 搭子 同行',
  ];
  return parts.filter(Boolean).join(' ');
}
