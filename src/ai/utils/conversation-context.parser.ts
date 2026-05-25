import { ChatMessageDto } from '../dto/chat.dto';
import {
  ACTIVITY_PICKER_PROMPT,
  findAssistantBeforeIndex,
  parseActivityPickerIndex,
} from './activity-reply.util';
import { resolveActivityId } from './ticket-draft.parser';

export interface ConversationContext {
  mode?: 'find_buddy';
  activityId?: string;
  activityKeyword?: string;
  activityPickerIndex?: number;
  eventDate?: string;
  peopleCount?: number;
  budget?: number;
  city?: string;
}

const ACTIVITY_KEYWORD_RE =
  /^(edc|edc\s*泰国|edc\s*thailand|s2o|ultra|tomorrowland|tmw|vac|vac\s*珠海|珠海\s*vac|电音节)$/i;

const CITY_NAMES = [
  '上海',
  '北京',
  '广州',
  '深圳',
  '杭州',
  '成都',
  '三亚',
  '苏州',
  '珠海',
  '南京',
  '武汉',
  '重庆',
  '西安',
];

function normalizeDate(raw: string): string | undefined {
  const match = raw.match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (!match) return undefined;
  const [, y, m, d] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function absorbFact(text: string, ctx: ConversationContext): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  const activityId = resolveActivityId(trimmed);
  if (activityId) {
    ctx.activityId = activityId;
    ctx.activityKeyword = trimmed;
  } else if (ACTIVITY_KEYWORD_RE.test(trimmed)) {
    ctx.activityKeyword = trimmed;
    ctx.activityId = resolveActivityId(trimmed);
  }

  const date = normalizeDate(trimmed);
  if (date) {
    ctx.eventDate = date;
  }

  const peopleMatch =
    trimmed.match(/(\d+)\s*人/) ?? trimmed.match(/^(\d+)\s*个$/);
  if (peopleMatch && !/^[1-5]$/.test(trimmed)) {
    ctx.peopleCount = Number(peopleMatch[1]);
  }

  if (/^\d{3,5}$/.test(trimmed)) {
    ctx.budget = Number(trimmed);
  }

  for (const city of CITY_NAMES) {
    if (trimmed === city || trimmed.includes(city)) {
      ctx.city = city;
      break;
    }
  }
}

export function isActivityKeywordInput(input: string): boolean {
  const text = input.trim();
  if (!text || text.length > 24) return false;
  if (resolveActivityId(text)) return true;
  return ACTIVITY_KEYWORD_RE.test(text);
}

export function isFindBuddyThread(messages: ChatMessageDto[]): boolean {
  let active = false;

  for (const message of messages) {
    if (message.role !== 'user') continue;

    if (/我要出票|我有票要出|我要收票|^出票$|^收票$|卖票/.test(message.content)) {
      active = false;
      continue;
    }

    if (
      message.content.trim() === '帮我找搭子' ||
      /找搭子|找同行/.test(message.content)
    ) {
      active = true;
    }
  }

  return active;
}

export function isTicketListingThread(messages: ChatMessageDto[]): boolean {
  return messages.some(
    message =>
      message.role === 'user' &&
      /我有票要出|我要出票|我要收票|^出票$|^收票$|卖票/.test(message.content),
  );
}

export function isShortContextReply(input: string): boolean {
  const text = input.trim();
  if (!text || text.length > 40) return false;
  if (isActivityKeywordInput(text)) return true;
  if (/^\d+\s*个?$/.test(text)) return true;
  if (/^\d{3,5}$/.test(text)) return true;
  if (/(\d{4})[.\-/年]/.test(text)) return true;
  return CITY_NAMES.some(city => text === city || text.includes(city));
}

export function isCreatePindanRequest(input: string): boolean {
  return /创建拼单|发起拼单|发布拼单|创建.*拼单活动/.test(input.trim());
}

export function parseConversationContext(
  messages: ChatMessageDto[],
  latestInput: string,
): ConversationContext {
  const ctx: ConversationContext = {};

  if (isFindBuddyThread(messages)) {
    ctx.mode = 'find_buddy';
  }

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role !== 'user') continue;

    const prevAssistant = findAssistantBeforeIndex(messages, index);
    const pickerIndex = parseActivityPickerIndex(message.content);
    if (
      prevAssistant?.content.includes(ACTIVITY_PICKER_PROMPT) &&
      pickerIndex
    ) {
      ctx.activityPickerIndex = pickerIndex;
      continue;
    }

    absorbFact(message.content, ctx);
  }

  return ctx;
}

export function getMissingBuddyFields(ctx: ConversationContext): string[] {
  const missing: string[] = [];
  if (!ctx.activityId && !ctx.activityKeyword && !ctx.activityPickerIndex) {
    missing.push('活动名称');
  }
  if (!ctx.eventDate) missing.push('出行日期');
  if (!ctx.peopleCount) missing.push('同行人数');
  if (!ctx.city) missing.push('出发城市');
  return missing;
}

export function buildKnownFactsSummary(
  ctx: ConversationContext,
  activityName?: string,
): string {
  const lines = ['已记录你的需求：'];

  if (
    activityName ||
    ctx.activityId ||
    ctx.activityKeyword ||
    ctx.activityPickerIndex
  ) {
    lines.push(`· 活动：${activityName ?? ctx.activityKeyword ?? ctx.activityId}`);
  }
  if (ctx.eventDate) lines.push(`· 日期：${ctx.eventDate}`);
  if (ctx.peopleCount) lines.push(`· 人数：${ctx.peopleCount} 人`);
  if (ctx.budget) lines.push(`· 预算：约 ¥${ctx.budget}/人`);
  if (ctx.city) lines.push(`· 出发：${ctx.city}`);

  if (lines.length === 1) {
    return '收到，我先帮你查平台现有信息。';
  }

  return lines.join('\n');
}
