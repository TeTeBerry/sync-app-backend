import {
  isAiShortcutTag,
  normalizeAiShortcutInput,
} from '../../common/utils/demo-owner.util';
import type { PostRecord } from '../../modules/partner/interfaces/post.repository.interface';
import type { ConversationContext } from '../conversation/conversation-context.parser';
import type { BuddyMatchCriteria, BuddyMatchIntent } from './buddy-match.types';
import { intentsForShortcutTag } from './shortcut-post-match.util';
import { syntheticPostRecordFromShortcut } from './resolve-owner-post-for-match.util';

export { resolveOwnerRecruitingPostForMatch } from './resolve-owner-post-for-match.util';

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

export function inferDepartureCityFromText(
  ...texts: Array<string | undefined>
): string | undefined {
  for (const raw of texts) {
    const text = raw?.trim();
    if (!text) continue;

    const fromBody = text.match(DEPARTURE_FROM_BODY_RE)?.[1]?.trim();
    if (fromBody) {
      const city = normalizeCityName(fromBody);
      if (city) return city;
    }

    for (const city of KNOWN_CITIES) {
      if (text.includes(city) && /出发|同路|同行/.test(text)) {
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

  if (/拼卡|同路|顺风车|包车/.test(haystack)) intents.add('carpool');
  if (/拼住宿|拼房|住宿/.test(haystack)) intents.add('lodging');
  if (/组队|搭子|同行|缺\d/.test(haystack)) intents.add('team');
  if (/票|内场|看台|区/.test(haystack)) intents.add('ticket');
  if (/宵夜|夜宵|吃饭|聚餐|美食|烧烤|火锅|餐厅|吃货/.test(haystack))
    intents.add('food');
  if (/喝酒|蹦迪|派对|afterparty|酒局|酒吧|微醺|\bap\b/.test(haystack))
    intents.add('social');

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

export function mergeBuddySearchIntents(
  shortcutIntents?: BuddyMatchIntent[],
  ownerIntents?: BuddyMatchIntent[],
  freeText?: string,
): BuddyMatchIntent[] {
  const merged: BuddyMatchIntent[] = [];

  if (shortcutIntents?.length) {
    for (const intent of shortcutIntents) {
      if (!merged.includes(intent)) merged.push(intent);
    }
    for (const intent of ownerIntents ?? []) {
      if (!merged.includes(intent)) merged.push(intent);
    }
  } else if (ownerIntents?.length) {
    for (const intent of ownerIntents) {
      if (!merged.includes(intent)) merged.push(intent);
    }
  } else {
    return inferIntentsFromPost([], freeText ?? '');
  }

  if (!merged.length) merged.push('team');
  return merged;
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

function profileBudgetLabel(level?: string): string | undefined {
  const value = level?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === 'low') return '经济';
  if (value === 'high') return '充裕';
  if (value === 'medium') return '舒适';
  return level?.trim();
}

export function buildMatchCriteriaForSearch(params: {
  activityLegacyId: number;
  activityName?: string;
  activityCode?: string;
  activityDate?: string;
  ownerPost?: PostRecord | null;
  conversation?: ConversationContext;
  profileCity?: string;
  profileFavorGenres?: string[];
  profileBudgetLevel?: string;
  profileLikeMate?: boolean;
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

  const trimmedInput = params.userInput?.trim() ?? '';
  const shortcutIntents =
    trimmedInput && isAiShortcutTag(trimmedInput)
      ? intentsForShortcutTag(trimmedInput)
      : undefined;
  const shortcutTag =
    trimmedInput && isAiShortcutTag(trimmedInput)
      ? normalizeAiShortcutInput(trimmedInput)
      : undefined;

  const shortcutOnlyBody = shortcutTag
    ? syntheticPostRecordFromShortcut(shortcutTag).body
    : undefined;

  return {
    activityLegacyId: params.activityLegacyId,
    activityName: params.activityName ?? fromOwner?.activityName,
    activityCode: params.activityCode ?? fromOwner?.activityCode,
    departureCity,
    eventDate:
      params.conversation?.eventDate ??
      params.activityDate ??
      fromOwner?.eventDate,
    zone: params.zone ?? fromOwner?.zone,
    headcount: params.conversation?.peopleCount ?? fromOwner?.headcount,
    genderPref: params.conversation?.genderPreference ?? fromOwner?.genderPref,
    intents: mergeBuddySearchIntents(
      shortcutIntents,
      fromOwner?.intents,
      trimmedInput && !shortcutIntents ? trimmedInput : undefined,
    ),
    searchShortcutTag: shortcutTag,
    requesterTags: collectRequesterTags(
      fromOwner?.requesterTags,
      params.ownerPost?.tags,
      params.ownerPost?.body,
      shortcutTag,
      params.userInput,
      params.zone,
    ),
    requesterBody:
      params.ownerPost?.body?.trim() ??
      fromOwner?.requesterBody ??
      shortcutOnlyBody,
    excludePostIds: params.ownerPost?._id
      ? [String(params.ownerPost._id)]
      : undefined,
    profileFavorGenres: params.profileFavorGenres?.length
      ? params.profileFavorGenres
      : undefined,
    profileBudgetLevel: params.profileBudgetLevel?.trim() || undefined,
    profileLikeMate: params.profileLikeMate,
  };
}

function appendProfileStructuredLines(
  structured: string[],
  criteria: BuddyMatchCriteria,
): void {
  if (criteria.profileFavorGenres?.length) {
    structured.push(`偏好曲风：${criteria.profileFavorGenres.join('、')}`);
  }
  const budgetLabel = profileBudgetLabel(criteria.profileBudgetLevel);
  if (budgetLabel) {
    structured.push(`住宿预算：${budgetLabel}`);
  }
  if (criteria.profileLikeMate === true) {
    structured.push('结伴意愿：想找搭子');
  }
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

const RERANK_USER_NEED_BODY_MAX = 800;

/** Full recruiting need text for LLM rerank (not used for Chroma embedding). */
export function buildRerankUserNeed(criteria: BuddyMatchCriteria): string {
  const parts: string[] = [];

  const body = criteria.requesterBody?.trim();
  if (body) {
    parts.push(
      body.length > RERANK_USER_NEED_BODY_MAX
        ? body.slice(0, RERANK_USER_NEED_BODY_MAX)
        : body,
    );
  }

  const structured: string[] = [];
  if (criteria.searchShortcutTag) {
    structured.push(`当前搜索：${criteria.searchShortcutTag}`);
  }
  if (criteria.activityName) structured.push(`活动：${criteria.activityName}`);
  if (criteria.departureCity)
    structured.push(`出发地：${criteria.departureCity}`);
  if (criteria.requesterTags?.length) {
    structured.push(
      `标签：${criteria.requesterTags.map((tag) => `#${tag}`).join(' ')}`,
    );
  }
  if (criteria.intents?.length) {
    structured.push(`意图：${criteria.intents.join('、')}`);
  }
  if (criteria.zone) structured.push(`区域：${criteria.zone}`);
  if (criteria.eventDate) structured.push(`日期：${criteria.eventDate}`);
  if (criteria.genderPref) structured.push(`性别偏好：${criteria.genderPref}`);
  appendProfileStructuredLines(structured, criteria);

  if (structured.length) {
    parts.push(structured.join('\n'));
  }

  return parts.join('\n\n').trim();
}

function profileEmbeddingSuffix(criteria: BuddyMatchCriteria): string {
  return [
    criteria.departureCity ? `${criteria.departureCity}出发` : undefined,
    criteria.profileFavorGenres?.join(' '),
    profileBudgetLabel(criteria.profileBudgetLevel),
    criteria.profileLikeMate === true ? '找搭子' : undefined,
  ]
    .filter(Boolean)
    .join(' ');
}

export function criteriaToEmbeddingText(criteria: BuddyMatchCriteria): string {
  const body = criteria.requesterBody?.trim();
  const profileSuffix = profileEmbeddingSuffix(criteria);

  // 有用户发帖内容时以帖子正文为主；快捷键补充搜索意图（同路等）
  if (body) {
    const shortcut = criteria.searchShortcutTag?.trim();
    const base = shortcut ? `${shortcut} ${body}`.trim() : body;
    return profileSuffix ? `${base} ${profileSuffix}`.trim() : base;
  }

  // fallback：没有帖子内容时，用结构化需求信息
  const parts = [
    criteria.activityName,
    criteria.departureCity ? `${criteria.departureCity}出发` : '',
    criteria.eventDate,
    criteria.zone,
    criteria.headcount ? `${criteria.headcount}人` : '',
    criteria.genderPref,
    criteria.intents?.join(' '),
    criteria.requesterTags?.map((tag) => `#${tag}`).join(' '),
    profileSuffix || undefined,
  ];
  return parts.filter(Boolean).join(' ');
}
